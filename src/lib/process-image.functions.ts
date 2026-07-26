import { createServerFn } from "@tanstack/react-start";

type FalResult = {
  image?: { url?: string; content_type?: string };
  images?: Array<{ url?: string; content_type?: string }>;
};

/**
 * Background removal with a cost cascade:
 *  - model "birefnet" (~$0.003/img) is the cheap first pass
 *  - model "bria"     (~$0.018/img) is the quality escalation (Bria RMBG 2.0)
 * The client decides escalation based on the AI QC judge verdict, so the
 * average blended cost stays low while bad first-pass results get re-done
 * on the stronger model automatically.
 */
export const removeBackground = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    if (
      !input ||
      typeof input !== "object" ||
      typeof (input as { imageUrl?: unknown }).imageUrl !== "string"
    ) {
      throw new Error("imageUrl (string) is required");
    }
    const { imageUrl, model, preUpscale } = input as {
      imageUrl: string;
      model?: string;
      preUpscale?: boolean;
    };
    if (imageUrl.length > 15_000_000) {
      throw new Error("Image payload too large (max ~11MB base64)");
    }
    return {
      imageUrl,
      model: model === "bria" ? "bria" : "birefnet",
      preUpscale: preUpscale === true,
    };
  })
  .handler(async ({ data }) => {
    const key = process.env.FALAI_KEY;
    if (!key) throw new Error("FALAI_KEY is not configured");

    // Small sources (phone thumbnails, marketplace grabs) get an AI
    // upscale (Recraft Crisp, $0.004 flat — tuned for product shots)
    // BEFORE matting. Upscaling the source instead of the cutout gives the
    // matting model more edge detail to work with AND removes the softness
    // our canvas upscale to the 1000px Amazon frame used to introduce.
    let sourceUrl = data.imageUrl;
    if (data.preUpscale) {
      const upRes = await fetch("https://fal.run/fal-ai/recraft/upscale/crisp", {
        method: "POST",
        headers: {
          Authorization: `Key ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image_url: sourceUrl }),
      });
      if (upRes.ok) {
        const upJson = (await upRes.json()) as FalResult;
        const upUrl = upJson.image?.url ?? upJson.images?.[0]?.url;
        if (upUrl) sourceUrl = upUrl;
      }
      // Upscale failure is non-fatal: continue with the original source.
    }

    const useBria = data.model === "bria";
    const endpoint = useBria
      ? "https://fal.run/fal-ai/bria/background/remove"
      : "https://fal.run/fal-ai/birefnet/v2";
    // Birefnet: use the "Light" variant at 1024px — ~2× faster than
    // "General Use (Heavy)" with visually indistinguishable masks on
    // product photography (single subject, controlled background).
    // refine_foreground stays on: it's the alpha-decontamination pass
    // that keeps edges clean and costs very little time.
    const body = useBria
      ? { image_url: sourceUrl }
      : {
          image_url: sourceUrl,
          model: "General Use (Light)",
          operating_resolution: "1024x1024",
          refine_foreground: true,
        };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`fal.ai background removal failed: ${res.status} ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as FalResult;
    const outUrl = json.image?.url ?? json.images?.[0]?.url;
    if (!outUrl) throw new Error("fal.ai returned no image URL");
    // sourceUrl differs from input when pre-upscale ran — the client caches
    // it so an escalation pass reuses the already-upscaled source (saves
    // one Recraft call: ~4s and \$0.004 per escalated photo).
    return { url: outUrl, model: data.model, sourceUrl };
  });

export type QcVerdict = {
  available: boolean;
  pass: boolean;
  issues: string[];
  reason: string;
};

function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Expected base64 data URL");
  return { mediaType: match[1], base64: match[2] };
}

/**
 * AI QC judge: Claude vision compares the original photo with the processed
 * result and returns a strict pass/fail verdict with issue flags. This is
 * the semantic layer geometry heuristics can't provide — it knows a hanger
 * hook is part of the product and a paint splash is not.
 * Cost control: the client downscales both images to <=512px JPEG.
 */
export const qcJudge = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const { original, result } = (input ?? {}) as { original?: string; result?: string };
    if (typeof original !== "string" || typeof result !== "string") {
      throw new Error("original and result data URLs are required");
    }
    if (original.length > 2_000_000 || result.length > 2_000_000) {
      throw new Error("QC images too large — downscale before sending");
    }
    return { original, result };
  })
  .handler(async ({ data }): Promise<QcVerdict> => {
    const key = process.env.ANTHROPIC_KEY;
    if (!key) {
      return { available: false, pass: true, issues: [], reason: "qc disabled" };
    }

    const orig = parseDataUrl(data.original);
    const res = parseDataUrl(data.result);

    const prompt = [
      "You are a strict QC inspector for e-commerce product photos.",
      "Image 1 is the original photo. Image 2 is the processed result on a white background.",
      "The result must contain ONLY the product itself on white. Decorative scene elements from the original — splashes, drips, spills, smoke, dust clouds, confetti, water, scattered props — are NOT part of the product and must be ABSENT from the result, even though they appear in the original photo.",
      "Fail the result if ANY of these are true:",
      "- part of the product or its structural accessories (hanger, hook, strap, box, handle, second item of a pair) is cut off or missing compared to the original",
      "- ANY splash, drip, spill, smoke, or scattered fragment remains in the result (issue: debris) — presence in the original does NOT make it acceptable",
      "- the result is significantly blurrier than the original",
      "- leftover background patches or non-white contamination around the subject",
      "Hands, arms, legs, or a person holding/wearing the product are ACCEPTABLE and must not cause a fail.",
      "A soft shadow under the product is expected and acceptable.",
      'Respond with ONLY minified JSON, no code fences: {"pass":boolean,"issues":["cut_object"|"debris"|"blur"|"background_dirty"],"reason":"<10 words"}',
    ].join("\n");

    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: orig.mediaType, data: orig.base64 } },
              { type: "image", source: { type: "base64", media_type: res.mediaType, data: res.base64 } },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!apiRes.ok) {
      // Judge outage must never block the user's photo — pass through.
      return { available: false, pass: true, issues: [], reason: `qc error ${apiRes.status}` };
    }

    const json = (await apiRes.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (json.content ?? [])
      .filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("")
      .replace(/```json|```/g, "")
      .trim();

    try {
      const parsed = JSON.parse(text) as { pass?: boolean; issues?: string[]; reason?: string };
      return {
        available: true,
        pass: parsed.pass !== false,
        issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 4) : [],
        reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 120) : "",
      };
    } catch {
      return { available: true, pass: true, issues: [], reason: "unparseable verdict" };
    }
  });
