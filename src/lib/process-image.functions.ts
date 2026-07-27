import { createServerFn } from "@tanstack/react-start";
import { removeBackground as removeBackgroundImpl, type RemoveBackgroundInput } from "./process-image.server";

export const removeBackground = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): RemoveBackgroundInput => {
    if (
      !input ||
      typeof input !== "object" ||
      typeof (input as { imageUrl?: unknown }).imageUrl !== "string"
    ) {
      throw new Error("imageUrl (string) is required");
    }
    const { imageUrl, preUpscale, modelTier } = input as {
      imageUrl: string;
      preUpscale?: boolean;
      modelTier?: string;
    };
    if (imageUrl.length > 15_000_000) {
      throw new Error("Image payload too large (max ~11MB base64)");
    }
    return {
      imageUrl,
      preUpscale: preUpscale === true,
      // Default to economy if the client sends something unexpected - never
      // let a malformed/spoofed value silently grant premium for free.
      modelTier: modelTier === "premium" ? "premium" : "economy",
    };
  })
  .handler(async ({ data }) => {
    const key = process.env.FALAI_KEY;
    if (!key) throw new Error("FALAI_KEY is not configured");
    return removeBackgroundImpl({ apiKey: key, ...data });
  });
