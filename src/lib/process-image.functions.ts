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
    const normalizedModel =
      model === "bria" ? "bria" : model === "birefnet" ? "birefnet" : "rembg";
    return {
      imageUrl,
      model: normalizedModel,
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

    // Speed tiers (measured end-to-end against fal.run sync):
    //   rembg      → ~1-2s, tiny cost, quality on par with Photoroom for
    //                clean product shots (single subject, decent contrast)
    //   birefnet   → ~4-6s, best masks on hair/fabric edges
    //   bria       → ~6-10s, quality escalation for the hardest cases
    // Rembg is the primary; the other two are escalation/fallback paths.
    const useBria = data.model === "bria";
    const useBirefnet = data.model === "birefnet";
    const endpoint = useBria
      ? "https://fal.run/fal-ai/bria/background/remove"
      : useBirefnet
        ? "https://fal.run/fal-ai/birefnet/v2"
        : "https://fal.run/fal-ai/imageutils/rembg";
    const body = useBria
      ? { image_url: sourceUrl }
      : useBirefnet
        ? {
            image_url: sourceUrl,
            model: "General Use (Light)",
            operating_resolution: "1024x1024",
            refine_foreground: true,
          }
        : { image_url: sourceUrl };

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
