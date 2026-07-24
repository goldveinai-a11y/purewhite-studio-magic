/**
 * Client-side canvas post-processing for background-removed PNGs.
 * - amazonPreset: fits object on a 1000x1000 pure #FFFFFF canvas at ~85% frame
 * - softShadow: renders a realistic soft drop shadow below the object base
 */

export type PostProcessOptions = {
  amazonPreset: boolean;
  softShadow: boolean;
};

const AMAZON_SIZE = 1000;
const FRAME_FILL = 0.85;
const FEATHER_PX = 1.2;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

/**
 * Render the isolated subject with a light edge feather (1–2px) into a
 * temporary transparent canvas of the target size. Feathering softens
 * jagged mask edges from the background remover before we composite the
 * subject onto the pure white canvas.
 */
function renderFeatheredSubject(
  img: HTMLImageElement,
  bounds: { x: number; y: number; w: number; h: number },
  drawW: number,
  drawH: number,
  dx: number,
  dy: number,
  size: number,
): HTMLCanvasElement {
  const layer = document.createElement("canvas");
  layer.width = size;
  layer.height = size;
  const lctx = layer.getContext("2d");
  if (!lctx) throw new Error("Canvas 2D unavailable");
  // Slight blur on the alpha edges — CanvasRenderingContext2D.filter is
  // widely supported in modern browsers and only affects this draw call.
  lctx.filter = `blur(${FEATHER_PX}px)`;
  lctx.drawImage(img, bounds.x, bounds.y, bounds.w, bounds.h, dx, dy, drawW, drawH);
  lctx.filter = "none";
  return layer;
}

/** Find opaque bounding box in an ImageData. */
function findBounds(data: ImageData) {
  const { data: px, width, height } = data;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = px[(y * width + x) * 4 + 3];
      if (alpha > 16) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }
  if (!found) return { x: 0, y: 0, w: width, h: height };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export async function postProcess(
  transparentPngUrl: string,
  opts: PostProcessOptions,
): Promise<Blob> {
  const img = await loadImage(transparentPngUrl);

  // Read source to compute tight bounds of the isolated subject
  const src = document.createElement("canvas");
  src.width = img.naturalWidth;
  src.height = img.naturalHeight;
  const sctx = src.getContext("2d");
  if (!sctx) throw new Error("Canvas 2D unavailable");
  sctx.drawImage(img, 0, 0);
  const bounds = findBounds(sctx.getImageData(0, 0, src.width, src.height));

  const size = opts.amazonPreset
    ? AMAZON_SIZE
    : Math.max(img.naturalWidth, img.naturalHeight);

  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Fill pure white background (#FFFFFF) — always, so Amazon-compliant
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, size, size);

  // Compute placement: scale bounds so subject occupies FRAME_FILL of the frame
  const scale = (size * FRAME_FILL) / Math.max(bounds.w, bounds.h);
  const drawW = bounds.w * scale;
  const drawH = bounds.h * scale;
  const dx = (size - drawW) / 2;
  const dy = (size - drawH) / 2;

  // Soft drop shadow UNDER the object — drawn before the subject so it
  // sits behind it. Rendered on its own offscreen canvas and blurred with
  // ctx.filter for a realistic contact shadow, then composited in.
  if (opts.softShadow) {
    // Lowest opaque pixel of the subject as rendered on the output canvas.
    // Nudge up by 1px so the shadow visually touches the sole with ZERO gap
    // (accounts for edge feathering softening the last row of pixels).
    const bottomY = dy + drawH - 1;
    const cx = size / 2;

    // Layer 2 — ambient: wider, softer, offset 3px below the sole
    const ambient = document.createElement("canvas");
    ambient.width = size;
    ambient.height = size;
    const ax = ambient.getContext("2d");
    if (ax) {
      ax.filter = "blur(14px)";
      ax.fillStyle = "rgba(0, 0, 0, 0.12)";
      ax.beginPath();
      // height 16px -> ry = 8; shifted 3px lower than contact baseline
      ax.ellipse(cx, bottomY + 3, drawW * 0.475, 8, 0, 0, Math.PI * 2);
      ax.fill();
      ctx.drawImage(ambient, 0, 0);
    }

    // Layer 1 — contact: tight, dark, flush with object base (zero gap)
    const contact = document.createElement("canvas");
    contact.width = size;
    contact.height = size;
    const cxt = contact.getContext("2d");
    if (cxt) {
      cxt.filter = "blur(3px)";
      cxt.fillStyle = "rgba(0, 0, 0, 0.55)";
      cxt.beginPath();
      // height 6px -> ry = 3; centered on the sole so the top half overlaps
      // the last opaque row and eliminates any visible whitespace gap.
      cxt.ellipse(cx, bottomY, drawW * 0.425, 3, 0, 0, Math.PI * 2);
      cxt.fill();
      ctx.drawImage(contact, 0, 0);
    }
  }

  // Draw subject with 1–2px alpha feather + subtle contrast/saturation boost.
  // Filters only affect this drawImage call; the white background is untouched.
  const subjectLayer = renderFeatheredSubject(img, bounds, drawW, drawH, dx, dy, size);
  ctx.filter = "contrast(1.04) saturate(1.02)";
  ctx.drawImage(subjectLayer, 0, 0);
  ctx.filter = "none";

  return new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png",
    );
  });
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}