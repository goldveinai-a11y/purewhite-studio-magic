type FalResult = {
  image?: { url?: string; content_type?: string };
  images?: Array<{ url?: string; content_type?: string }>;
};

export type RemoveBackgroundInput = {
  imageUrl: string;
  preUpscale: boolean;
};

export async function removeBackgroundWithRembg({
  apiKey,
  imageUrl,
  preUpscale,
}: RemoveBackgroundInput & { apiKey: string }) {
  let sourceUrl = imageUrl;

  // Small sources get a pre-upscale before matting so thumbnail-grade inputs
  // keep sharper product edges. If it fails, continue with the original.
  if (preUpscale) {
    const upRes = await fetch("https://fal.run/fal-ai/recraft/upscale/crisp", {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image_url: sourceUrl }),
    });
    if (upRes.ok) {
      const upJson = (await upRes.json()) as FalResult;
      const upUrl = upJson.image?.url ?? upJson.images?.[0]?.url;
      if (upUrl) sourceUrl = upUrl;
    }
  }

  const res = await fetch("https://fal.run/fal-ai/imageutils/rembg", {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: sourceUrl,
      alpha_matting: true,
      alpha_matting_foreground_threshold: 240,
      alpha_matting_background_threshold: 10,
      alpha_matting_erode_size: 10,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fal.ai rembg failed: ${res.status} ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as FalResult;
  const outUrl = json.image?.url ?? json.images?.[0]?.url;
  if (!outUrl) throw new Error("fal.ai rembg returned no image URL");

  return { url: outUrl, sourceUrl };
}