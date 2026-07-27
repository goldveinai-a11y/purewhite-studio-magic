import { createServerFn } from "@tanstack/react-start";
import { removeBackgroundWithRembg, type RemoveBackgroundInput } from "./process-image.server";

export const removeBackground = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): RemoveBackgroundInput => {
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
    return removeBackgroundWithRembg({ apiKey: key, ...data });
  });
