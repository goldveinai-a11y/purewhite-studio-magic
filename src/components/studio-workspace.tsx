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
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { removeBackground } from "@/lib/process-image.functions";
import { fileToDataUrl, postProcess, type ComplianceResult } from "@/lib/canvas-processing";

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

const MAX_CONCURRENT = 5;
const FREE_BATCH_LIMIT = 3;
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB — matches the promise in the UI

export function StudioWorkspace({
  amazonPreset,
  softShadow,
  credits,
  setCredits,
  onPaywall,
}: {
  amazonPreset: boolean;
  softShadow: boolean;
  credits: number;
  setCredits: (updater: (prev: number) => number) => void;
  onPaywall: () => void;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const removeBg = useServerFn(removeBackground);

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

  const updateJob = useCallback((id: string, patch: Partial<Job>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  // One silent retry before giving up — transient fal.ai hiccups shouldn't
  // cost the user a job.
  const removeWithRetry = useCallback(
    async (imageUrl: string): Promise<{ url: string }> => {
      try {
        return await removeBg({ data: { imageUrl } });
      } catch {
        return await removeBg({ data: { imageUrl } });
      }
    },
    [removeBg],
  );

  const runJob = useCallback(
    async (job: Job) => {
      try {
        updateJob(job.id, { status: "uploading", progress: 15 });
        const dataUrl = await fileToDataUrl(
          await (await fetch(job.originalUrl)).blob().then(
            (b) => new File([b], job.name, { type: b.type || "image/png" }),
          ),
        );
        updateJob(job.id, { status: "removing", progress: 40 });
        const { url } = await removeWithRetry(dataUrl);
        updateJob(job.id, { status: "compositing", progress: 75 });
        const { blob, compliance } = await postProcess(url, {
          amazonPreset: amazonRef.current,
          softShadow: shadowRef.current,
        });
        const resultUrl = URL.createObjectURL(blob);
        updateJob(job.id, {
          status: "done",
          progress: 100,
          resultBlob: blob,
          resultUrl,
          compliance,
        });
        // Credit already reserved up-front in handleFiles — nothing to do here.
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Processing failed";
        updateJob(job.id, { status: "error", progress: 100, error: msg });
        // Refund the reserved credit — failures are on us, not the user.
        setCredits((c) => c + 1);
        toast.error(`${job.name}: ${msg}`);
      }
    },
    [removeWithRetry, updateJob, setCredits],
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
        onPaywall();
        toast.info(`Free tier supports up to ${FREE_BATCH_LIMIT} photos per batch.`);
        return;
      }
      if (credits <= 0) {
        onPaywall();
        return;
      }
      if (files.length > credits) {
        onPaywall();
        toast.info(`You have ${credits} credit(s). Upgrade to process more.`);
        return;
      }

      // Reserve credits for the WHOLE batch atomically, before jobs start.
      // Failed jobs refund inside runJob.
      setCredits((c) => Math.max(0, c - files.length));

      const newJobs: Job[] = files.map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        originalUrl: URL.createObjectURL(f),
        status: "queued",
        progress: 5,
      }));
      setJobs((prev) => [...newJobs, ...prev]);
      setActiveIdx(0);

      // Concurrency-limited processing (max 5 in flight)
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
    [credits, onPaywall, runJob, setCredits],
  );

  const doneJobs = jobs.filter((j) => j.status === "done" && j.resultBlob);
  const active = jobs[activeIdx] ?? jobs[0];

  const downloadOne = () => {
    const target = active?.status === "done" ? active : doneJobs[0];
    if (!target?.resultBlob) {
      toast.info("Upload a photo to generate a download.");
      return;
    }
    triggerDownload(target.resultBlob, renameToPng(target.name));
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
  };

  const remove = (id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  return (
    <>
      <div
        className="group relative rounded-xl border-2 border-dashed border-primary/30 bg-accent/40 p-8 text-center transition-colors hover:border-primary/60 hover:bg-accent/70"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handleFiles(e.dataTransfer.files);
        }}
      >
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
          Batch supported (5 concurrent). Max 20MB per file. {credits} credit
          {credits === 1 ? "" : "s"} remaining.
        </p>
        <div className="mt-5 flex flex-col items-center gap-2">
          <Button
            size="lg"
            onClick={() => inputRef.current?.click()}
            className="w-full whitespace-normal rounded-full bg-primary px-6 font-semibold text-primary-foreground shadow-[var(--shadow-elegant)] hover:opacity-95"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Product Photos (Batch Supported)
          </Button>
        </div>
      </div>

      {jobs.length > 0 && (
        <div className="mt-6 grid gap-6 md:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            <ResultPreview job={active} />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Batch Queue ({jobs.length})
            </p>
            <div className="max-h-80 space-y-2 overflow-auto pr-1">
              {jobs.map((j, idx) => (
                <QueueRow
                  key={j.id}
                  job={j}
                  active={idx === activeIdx}
                  onSelect={() => setActiveIdx(idx)}
                  onRemove={() => remove(j.id)}
                />
              ))}
            </div>
            <div className="grid gap-2 pt-2">
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
        <span
          className={`absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-semibold text-white ${
            job.compliance.passed ? "bg-emerald-600" : "bg-amber-500"
          }`}
          title={`${job.compliance.frameFill.detail} · ${job.compliance.backgroundPure.detail}`}
        >
          {job.compliance.passed ? "✓ Passes Amazon spec" : "⚠ Needs review"}
        </span>
      )}
      <span className="absolute right-2 top-2 rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
        {showResult ? "AFTER · #FFFFFF" : "PROCESSING"}
      </span>
    </div>
  );
}

function QueueRow({
  job,
  active,
  onSelect,
  onRemove,
}: {
  job: Job;
  active: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors ${
        active
          ? "border-primary/60 bg-accent/60"
          : "border-border/60 bg-background hover:bg-accent/40"
      }`}
    >
      <img
        src={job.resultUrl ?? job.originalUrl}
        alt=""
        className="h-10 w-10 flex-shrink-0 rounded object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{job.name}</p>
        <div className="mt-1 flex items-center gap-2">
          <Progress value={job.progress} className="h-1" />
          <span className="text-[10px] uppercase text-muted-foreground">
            {job.status}
          </span>
        </div>
      </div>
      {job.status === "done" ? (
        <Check className="h-4 w-4 flex-shrink-0 text-primary" />
      ) : job.status === "error" ? (
        <AlertCircle className="h-4 w-4 flex-shrink-0 text-destructive" />
      ) : (
        <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-muted-foreground" />
      )}
      <span
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="rounded p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="h-3 w-3" />
      </span>
    </button>
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
