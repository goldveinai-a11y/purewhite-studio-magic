import { createServerFn } from "@tanstack/react-start";

type FalResult = {
  image?: { url?: string; content_type?: string };
  images?: Array<{ url?: string; content_type?: string }>;
};

/**
 * Calls fal.ai birefnet to remove the background from an image.
 * Accepts a data URL or public https URL and returns a transparent PNG URL
 * hosted on fal's CDN. Post-processing (canvas resize, shadow) happens on
 * the client.
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
    const { imageUrl } = input as { imageUrl: string };
    if (imageUrl.length > 15_000_000) {
      throw new Error("Image payload too large (max ~11MB base64)");
    }
    return { imageUrl };
  })
  .handler(async ({ data }) => {
    const key = process.env.FALAI_KEY;
    if (!key) throw new Error("FALAI_KEY is not configured");

    // Primary model: Bria RMBG 2.0 — trained on licensed e-commerce data,
    // commercial use permitted via fal's partner endpoint ($0.018/image).
    // Produces harder, cleaner alpha on complex product textures (suede,
    // gloss) than birefnet, which tends to leave semi-transparent "ghost"
    // background patches. Set FALAI_MODEL=birefnet to roll back instantly.
    const useBirefnet = process.env.FALAI_MODEL === "birefnet";
    const endpoint = useBirefnet
      ? "https://fal.run/fal-ai/birefnet/v2"
      : "https://fal.run/fal-ai/bria/background/remove";
    const body = useBirefnet
      ? {
          image_url: data.imageUrl,
          model: "General Use (Heavy)",
          operating_resolution: "2048x2048",
          refine_foreground: true,
        }
      : { image_url: data.imageUrl };

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
    return { url: outUrl };
  });
