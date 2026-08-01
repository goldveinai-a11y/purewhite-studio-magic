import { useCallback, useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import {
  Upload,
  Download,
  Package,
  Loader2,
  X,
  Check,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { removeBackground } from "@/lib/process-image.functions";
import { reservePhotos } from "@/lib/payments.functions";
import { fileToDataUrl, postProcess, type ComplianceResult } from "@/lib/canvas-processing";
import { useTierLimits } from "@/hooks/use-tier-limits";
import { track } from "@/lib/ga4-client";

// Downscale big source photos client-side before sending to the matting
// backend. Bria/Birefnet operate at ~1024–2048px internally, so a 4000px
// phone photo only inflates upload + fal.ai decode time without improving
// the mask. Longest edge 1600px + JPEG q0.9 cuts ~50% of end-to-end
// latency on typical DSLR/phone shots while preserving edge quality.
const MAX_UPLOAD_EDGE = 1600;
async function downscaleForUpload(file: File): Promise<string> {
  // Small sources go through untouched — the server pre-upscale path
  // (< 900px) needs the original pixels.
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return fileToDataUrl(file);
  const longest = Math.max(bmp.width, bmp.height);
  if (longest <= MAX_UPLOAD_EDGE) {
    bmp.close();
    return fileToDataUrl(file);
  }
  const scale = MAX_UPLOAD_EDGE / longest;
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bmp.close();
    return fileToDataUrl(file);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9),
  );
  if (!blob) return fileToDataUrl(file);
  return fileToDataUrl(new File([blob], file.name, { type: "image/jpeg" }));
}

type JobStatus = "queued" | "uploading" | "removing" | "compositing" | "done" | "error";

type Job = {
  id: string;
  name: string;
  originalUrl: string;
  status: JobStatus;
  progress: number;
  resultUrl?: string;
  resultBlob?: Blob;
  compliance?: ComplianceResult;
  error?: string;
};

const MAX_CONCURRENT = 8;
const FREE_BATCH_LIMIT = 3;
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB — matches the promise in the UI

export function StudioWorkspace({
  amazonPreset,
  softShadow,
  credits,
  setCredits,
  onPaywall,
  onTopUp,
}: {
  amazonPreset: boolean;
  softShadow: boolean;
  credits: number;
  setCredits: (updater: (prev: number) => number) => void;
  onPaywall: () => void;
  onTopUp?: () => void;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const { reserve, tier } = useTierLimits();
  // Track the selected job by STABLE id, never by array index: new batches
  // are prepended to `jobs` and rows can be removed, both of which shift
  // indices. Index-based selection made the preview (and its compliance
  // badges) show a DIFFERENT photo's result than the one the user clicked —
  // the "result doesn't match the source photo" bug.
  const [activeId, setActiveId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const removeBg = useServerFn(removeBackground);
  const reserveServerPhotos = useServerFn(reservePhotos);

  // Refs so in-flight batch jobs always read the CURRENT toggle values,
  // even if the user flips them mid-batch.
  const amazonRef = useRef(amazonPreset);
  const shadowRef = useRef(softShadow);
  useEffect(() => {
    amazonRef.current = amazonPreset;
  }, [amazonPreset]);
  useEffect(() => {
    shadowRef.current = softShadow;
  }, [softShadow]);

  // Every job holds 1-2 object URLs (original preview + processed result).
  // React state alone never frees these — the browser keeps the underlying
  // blob in memory until URL.revokeObjectURL() is called explicitly. On a
  // long session with several 50-photo batches this silently accumulates
  // hundreds of live blobs. This ref tracks every URL we hand out so it can
  // always be found and released, regardless of where in the job lifecycle
  // it currently lives (queue, done, replaced by a retry).
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const trackUrl = useCallback((url: string) => {
    objectUrlsRef.current.add(url);
    return url;
  }, []);
  const releaseUrl = useCallback((url: string | undefined) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    objectUrlsRef.current.delete(url);
  }, []);
  // Catch-all for navigation away from the studio mid-session: whatever
  // wasn't individually released above still gets freed on unmount.
  useEffect(() => {
    return () => {
      for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
      objectUrlsRef.current.clear();
    };
  }, []);

  const updateJob = useCallback((id: string, patch: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const runJob = useCallback(
    async (job: Job) => {
      try {
        updateJob(job.id, { status: "uploading", progress: 10 });
        const srcFile = await (await fetch(job.originalUrl))
          .blob()
          .then((b) => new File([b], job.name, { type: b.type || "image/png" }));
        const dataUrl = await downscaleForUpload(srcFile);

        updateJob(job.id, { status: "removing", progress: 30 });
        const matted = await removeBg({ data: { imageUrl: dataUrl } });
        updateJob(job.id, { status: "compositing", progress: 60 });
        let { blob, compliance } = await postProcess(matted.url, {
          amazonPreset: amazonRef.current,
          softShadow: shadowRef.current,
        });

        // On a manual retry, `job.resultUrl` still holds the PREVIOUS
        // attempt's blob URL (retry() spreads the old job object) — free
        // it before minting a new one so retries don't leak.
        releaseUrl(job.resultUrl);
        const resultUrl = trackUrl(URL.createObjectURL(blob));
        updateJob(job.id, {
          status: "done",
          progress: 100,
          resultBlob: blob,
          resultUrl,
          compliance,
        });
        // Credit already reserved up-front in handleFiles — nothing to do here.
        track("photo_processed", {
          tier,
          amazon_preset: amazonRef.current,
          soft_shadow: shadowRef.current,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Processing failed";
        updateJob(job.id, { status: "error", progress: 100, error: msg });
        // Refund the reserved credit — failures are on us, not the user.
        setCredits((c) => c + 1);
        toast.error(`${job.name}: ${msg}`);
        track("photo_processing_failed", { tier, error_reason: msg.slice(0, 100) });
      }
    },
    [releaseUrl, removeBg, tier, trackUrl, updateJob, setCredits],
  );

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      let files = Array.from(fileList).slice(0, 50);

      // Enforce the 20MB per-file promise
      const oversize = files.filter((f) => f.size > MAX_FILE_BYTES);
      if (oversize.length > 0) {
        toast.error(
          `${oversize.length} file(s) over 20MB were skipped: ${oversize
            .map((f) => f.name)
            .slice(0, 3)
            .join(", ")}${oversize.length > 3 ? "…" : ""}`,
        );
        files = files.filter((f) => f.size <= MAX_FILE_BYTES);
        if (files.length === 0) return;
      }

      // Paywall gates — checked BEFORE any processing starts
      if (files.length > FREE_BATCH_LIMIT && credits < 999) {
        track("paywall_viewed", { trigger_reason: "batch_limit", tier });
        onPaywall();
        toast.info(`Free tier supports up to ${FREE_BATCH_LIMIT} photos per batch.`);
        return;
      }
      if (credits <= 0) {
        track("paywall_viewed", { trigger_reason: "credits_exhausted", tier });
        onPaywall();
        return;
      }
      if (files.length > credits) {
        track("paywall_viewed", { trigger_reason: "insufficient_credits", tier });
        onPaywall();
        toast.info(`You have ${credits} credit(s). Upgrade to process more.`);
        return;
      }

      // Paid tiers: real server-side quota check (Supabase RPC, atomic,
      // row-locked) — this is what actually stops a paying customer from
      // resetting their own usage counter via clearing localStorage. Free
      // tier keeps its existing local-only gate unchanged (reserve() is a
      // documented no-op passthrough for it) so the no-signup trial flow
      // is completely unaffected by this change.
      if (tier !== "free") {
        try {
          const result = await reserveServerPhotos({ data: { count: files.length } });
          const ok = "ok" in result && result.ok === true;
          if (!ok) {
            track("paywall_viewed", { trigger_reason: "quota_exceeded", tier });
            onTopUp?.();
            return;
          }
        } catch {
          // Transient network/session issue talking to the quota check -
          // never silently hang a paying customer's upload. Let them retry
          // rather than eat the click with no feedback.
          toast.error("Couldn't verify your account right now — please try again.");
          return;
        }
      } else if (!reserve(files.length)) {
        track("paywall_viewed", { trigger_reason: "free_limit", tier });
        onTopUp?.();
        return;
      }

      // Reserve credits for the WHOLE batch atomically, before jobs start.
      // Failed jobs refund inside runJob.
      setCredits((c) => Math.max(0, c - files.length));
      track("photos_uploaded", { file_count: files.length, tier });

      const newJobs: Job[] = files.map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        originalUrl: trackUrl(URL.createObjectURL(f)),
        status: "queued",
        progress: 5,
      }));
      setJobs((prev) => [...newJobs, ...prev]);
      setActiveId(newJobs[0]?.id ?? null);

      // Concurrency-limited processing
      let cursor = 0;
      const workers: Promise<void>[] = [];
      const next = async (): Promise<void> => {
        while (cursor < newJobs.length) {
          const job = newJobs[cursor++];
          await runJob(job);
        }
      };
      for (let i = 0; i < Math.min(MAX_CONCURRENT, newJobs.length); i++) {
        workers.push(next());
      }
      await Promise.all(workers);
    },
    [credits, onPaywall, onTopUp, reserve, reserveServerPhotos, runJob, setCredits, tier, trackUrl],
  );

  const doneJobs = jobs.filter((j) => j.status === "done" && j.resultBlob);
  const active = jobs.find((j) => j.id === activeId) ?? jobs[0];

  const downloadOne = () => {
    const target = active?.status === "done" ? active : doneJobs[0];
    if (!target?.resultBlob) {
      toast.info("Upload a photo to generate a download.");
      return;
    }
    triggerDownload(target.resultBlob, renameToPng(target.name));
    track("photo_downloaded", { tier });
  };

  const downloadZip = async () => {
    if (doneJobs.length === 0) {
      toast.info("Process at least one photo to export a ZIP.");
      return;
    }
    const zip = new JSZip();
    for (const j of doneJobs) {
      if (j.resultBlob) zip.file(renameToPng(j.name), j.resultBlob);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    triggerDownload(blob, "purewhite-batch.zip");
    track("batch_downloaded", { tier, photo_count: doneJobs.length });
  };

  const remove = (id: string) => {
    setJobs((prev) => {
      const job = prev.find((j) => j.id === id);
      if (job) {
        releaseUrl(job.originalUrl);
        releaseUrl(job.resultUrl);
      }
      return prev.filter((j) => j.id !== id);
    });
  };

  const retry = useCallback(
    (id: string) => {
      const job = jobs.find((j) => j.id === id);
      if (!job) return;
      // Reserve credit again for the manual retry
      if (credits <= 0) {
        onPaywall();
        return;
      }
      setCredits((c) => Math.max(0, c - 1));
      updateJob(id, { status: "queued", progress: 5, error: undefined });
      void runJob({ ...job, status: "queued", progress: 5, error: undefined });
    },
    [jobs, credits, onPaywall, setCredits, updateJob, runJob],
  );

  return (
    <>
      <input
        id="pwbg-file-input"
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {jobs.length === 0 ? (
        <div
          className="group relative rounded-xl border-2 border-dashed border-primary/30 bg-accent/40 p-5 text-center transition-colors hover:border-primary/60 hover:bg-accent/70 sm:p-8"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void handleFiles(e.dataTransfer.files);
          }}
        >
          <div
            className="mx-auto mb-4 grid h-14 w-14 cursor-pointer place-items-center rounded-2xl text-white"
            style={{ background: "var(--gradient-primary)" }}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-6 w-6" />
          </div>
          <p className="text-base font-semibold text-foreground">
            Drop up to 50 photos — JPEG, PNG, WEBP
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Up to 50 photos at once. Max 20MB per file.
            {tier === "free" && (
              <>
                {" "}
                {credits <= 0
                  ? "Free photos used — upgrade to continue."
                  : credits === 1
                    ? "⚠ Last free photo — upgrade to keep going."
                    : `${credits} free photos left.`}
              </>
            )}
          </p>
          <div className="mt-5 flex flex-col items-center gap-2">
            <Button
              size="lg"
              onClick={() => inputRef.current?.click()}
              className="!h-auto w-full whitespace-normal rounded-xl bg-primary px-6 py-3 text-sm font-semibold leading-snug text-primary-foreground shadow-[var(--shadow-elegant)] hover:opacity-95 sm:text-base"
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Product Photos (Batch Supported)
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-primary/30 bg-accent/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {jobs.length} photo{jobs.length === 1 ? "" : "s"} added
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            className="rounded-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            Add more
          </Button>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="mt-6 space-y-5">
          {/* Large full-width preview */}
          <ResultPreview job={active} />

          {/* Horizontal thumbnail queue */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Batch Queue ({jobs.length})
              </p>
              <p className="text-[11px] text-muted-foreground">
                Click a thumbnail to preview
              </p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {jobs.map((j) => (
                <QueueThumb
                  key={j.id}
                  job={j}
                  active={j.id === (active?.id ?? null)}
                  onSelect={() => setActiveId(j.id)}
                  onRemove={() => remove(j.id)}
                  onRetry={() => retry(j.id)}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              className="w-full justify-center rounded-lg border-border/70 font-medium"
              onClick={downloadOne}
            >
              <Download className="mr-2 h-4 w-4" />
              Download Single PNG (High-Res)
            </Button>
            <Button
              className="w-full justify-center rounded-lg bg-primary font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] hover:opacity-95"
              onClick={downloadZip}
            >
              <Package className="mr-2 h-4 w-4" />
              Download All as .ZIP ({doneJobs.length})
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function ResultPreview({ job }: { job: Job | undefined }) {
  if (!job) return null;
  const showResult = job.status === "done" && job.resultUrl;
  return (
    <div
      className="relative aspect-square w-full overflow-hidden rounded-xl border border-border/70 bg-white"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <img
        src={showResult ? job.resultUrl : job.originalUrl}
        alt={job.name}
        className="h-full w-full object-contain"
      />
      {!showResult && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/70 backdrop-blur-sm">
          {job.status === "error" ? (
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertCircle className="h-4 w-4" /> {job.error ?? "Failed"}
            </div>
          ) : (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground capitalize">
                {job.status}…
              </p>
              <div className="w-40">
                <Progress value={job.progress} />
              </div>
            </>
          )}
        </div>
      )}
      {showResult && job.compliance && (
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold text-white ${
              job.compliance.backgroundPure.pass ? "bg-emerald-600" : "bg-amber-500"
            }`}
            title={job.compliance.backgroundPure.detail}
          >
            {job.compliance.backgroundPure.pass ? "✓ White BG" : "⚠ BG issue"}
          </span>
          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold text-white ${
              job.compliance.frameFill.status === "pass"
                ? "bg-emerald-600"
                : job.compliance.frameFill.status === "warn"
                  ? "bg-amber-500"
                  : "bg-red-500"
            }`}
            title={job.compliance.frameFill.detail}
          >
            {job.compliance.frameFill.status === "pass"
              ? `✓ ${job.compliance.frameFill.value}% fill`
              : job.compliance.frameFill.status === "warn"
                ? `⚠ ${job.compliance.frameFill.value}% (elongated)`
                : "✕ Fill too low"}
          </span>
        </div>
      )}
      <span className="absolute right-2 top-2 rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
        {showResult ? "AFTER · #FFFFFF" : "PROCESSING"}
      </span>
    </div>
  );
}

function QueueThumb({
  job,
  active,
  onSelect,
  onRemove,
  onRetry,
}: {
  job: Job;
  active: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const statusColor =
    job.status === "done"
      ? "bg-emerald-500"
      : job.status === "error"
        ? "bg-red-500"
        : "bg-amber-500";
  const isBusy =
    job.status !== "done" && job.status !== "error";
  return (
    <div
      className={`group relative flex-shrink-0 rounded-lg border-2 bg-white transition-all ${
        active ? "border-primary shadow-[var(--shadow-elegant)]" : "border-border/60 hover:border-primary/40"
      }`}
      title={`${job.name} — ${job.status}${job.error ? `: ${job.error}` : ""}`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="block h-20 w-20 overflow-hidden rounded-md"
      >
        <img
          src={job.resultUrl ?? job.originalUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      </button>
      {/* Status dot */}
      <span
        className={`absolute left-1 top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${statusColor}`}
      />
      {/* Busy spinner overlay */}
      {isBusy && (
        <span className="absolute inset-0 flex items-center justify-center rounded-md bg-white/40 backdrop-blur-[1px]">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </span>
      )}
      {/* Retry on error */}
      {job.status === "error" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRetry();
          }}
          className="absolute inset-0 flex items-center justify-center rounded-md bg-red-500/15 text-red-700 hover:bg-red-500/25"
          aria-label="Retry"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      )}
      {/* Remove */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label="Remove"
        className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-foreground text-background opacity-0 shadow transition-opacity group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
      {/* Done check */}
      {job.status === "done" && (
        <span className="absolute bottom-1 right-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
          <Check className="h-2.5 w-2.5" />
        </span>
      )}
    </div>
  );
}

function renameToPng(name: string) {
  return name.replace(/\.[^.]+$/, "") + ".png";
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
