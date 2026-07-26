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

    const res = await fetch("https://fal.run/fal-ai/birefnet/v2", {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: data.imageUrl,
        model: "General Use (Heavy)",
        operating_resolution: "2048x2048",
        refine_foreground: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`fal.ai birefnet failed: ${res.status} ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as FalResult;
    const outUrl = json.image?.url ?? json.images?.[0]?.url;
    if (!outUrl) throw new Error("fal.ai returned no image URL");
    return { url: outUrl };
  });
