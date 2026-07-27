type FalResult = {
  image?: { url?: string; content_type?: string };
  images?: Array<{ url?: string; content_type?: string }>;
};

export type ModelTier = "premium" | "economy";

export type RemoveBackgroundInput = {
  imageUrl: string;
  preUpscale: boolean;
  modelTier: ModelTier;
};

// Free tier always gets `premium` (Bria) - it's the first impression that
// has to sell the product, and volume is capped at 3 credits so the cost
// difference is a few cents total. Pro/Lifetime default to `economy`
// (rembg) since most real-world catalog photos are already simple.
// Exactly ONE model call per photo, always - no quality-based re-run/escalation.
// An earlier version auto-re-ran flagged photos through a second premium-model
// pass; that doubled processing time to 30-40s for a 3-photo batch and was
// removed for good. See the NOTE in studio-workspace.tsx (runJob) for detail.
export async function removeBackground({
  apiKey,
  imageUrl,
  preUpscale,
  modelTier,
}: RemoveBackgroundInput & { apiKey: string }) {
  let sourceUrl = imageUrl;

  // Pre-upscale is an AI (generative) upscaler, not a plain pixel resize -
  // on very low-quality sources it can subtly re-imagine texture/shape
  // instead of just sharpening. That's an unacceptable risk for an
  // e-commerce tool (the customer receives a different product than shown).
  // Restricting it to `economy` tier only, on genuinely tiny sources,
  // shrinks that risk surface. Premium (Bria) requests skip it entirely -
  // Bria handles small sources better on its own and this is exactly the
  // path free-tier demo photos take, where a hallucinated result is most
  // damaging to trust.
  if (preUpscale && modelTier === "economy") {
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

  const endpoint =
    modelTier === "premium"
      ? "https://fal.run/fal-ai/bria/background/remove"
      : "https://fal.run/fal-ai/imageutils/rembg";

  const body: Record<string, unknown> = { image_url: sourceUrl };
  if (modelTier === "premium") {
    // Bria's own doc'd param for output resolution - keeps quality high
    // without needing the recraft pre-upscale step at all.
    body.operating_resolution = "2048x2048";
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fal.ai ${modelTier} matting failed: ${res.status} ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as FalResult;
  const outUrl = json.image?.url ?? json.images?.[0]?.url;
  if (!outUrl) throw new Error("fal.ai matting returned no image URL");

  return { url: outUrl, sourceUrl };
}

// Backward-compatible alias - some callers may still import the old name.
export const removeBackgroundWithRembg = removeBackground;
