type FalResult = {
  image?: { url?: string; content_type?: string };
  images?: Array<{ url?: string; content_type?: string }>;
};

export type RemoveBackgroundInput = {
  imageUrl: string;
};

export async function removeBackgroundWithRembg({
  apiKey,
  imageUrl,
}: RemoveBackgroundInput & { apiKey: string }) {
  // BRIA RMBG 2.0 — e-commerce-grade matting: closes inter-object gaps,
  // clean edges on shoes/apparel/glass, handles small sources natively.
  const res = await fetch("https://fal.run/fal-ai/bria/background/remove", {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image_url: imageUrl, content_moderation: false }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fal.ai BRIA failed: ${res.status} ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as FalResult;
  const outUrl = json.image?.url ?? json.images?.[0]?.url;
  if (!outUrl) throw new Error("fal.ai BRIA returned no image URL");

  return { url: outUrl };
}