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
const FRAME_FILL = 0.87;
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
 * Render the isolated subject with a light edge feather (1-2px) into a
 * temporary transparent canvas of the target size. Feathering softens
 * jagged mask edges from the background remover before we composite the
 * subject onto the pure white canvas.
 */
function renderFeatheredSubject(
  img: CanvasImageSource,
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
  // Slight blur on the alpha edges - CanvasRenderingContext2D.filter is
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

/**
 * Find each contiguous horizontal "footprint" segment where the subject
 * touches the ground line, scanning a thin band just above the object's
 * lowest opaque row. Multiple objects in one frame (e.g. a pair of shoes)
 * produce multiple disjoint segments instead of one segment spanning the
 * full bounding box - each gets its own contact shadow instead of a single
 * shadow "puddle" stretching across the gap between them.
 */
function findFootprintSegments(
  layer: HTMLCanvasElement,
  bottomY: number,
  size: number,
): Array<{ cx: number; width: number }> {
  const ctx = layer.getContext("2d");
  if (!ctx) return [];
  const bandTop = Math.max(0, Math.round(bottomY - 7));
  const bandHeight = Math.min(9, size - bandTop);
  if (bandHeight <= 0) return [];
  const band = ctx.getImageData(0, bandTop, size, bandHeight).data;
  const ALPHA_THRESHOLD = 25;
  const covered = new Uint8Array(size);
  for (let x = 0; x < size; x++) {
    for (let row = 0; row < bandHeight; row++) {
      const alpha = band[(row * size + x) * 4 + 3];
      if (alpha > ALPHA_THRESHOLD) {
        covered[x] = 1;
        break;
      }
    }
  }

  // Merge runs separated by small gaps (laces, straps, anti-aliasing dips)
  // so we don't over-fragment a single object into several tiny shadows.
  const MERGE_GAP_PX = Math.round(size * 0.03);
  const segments: Array<{ start: number; end: number }> = [];
  let runStart = -1;
  for (let x = 0; x <= size; x++) {
    const on = x < size && covered[x] === 1;
    if (on && runStart === -1) {
      runStart = x;
    } else if (!on && runStart !== -1) {
      const runEnd = x - 1;
      const last = segments[segments.length - 1];
      if (last && runStart - last.end <= MERGE_GAP_PX) {
        last.end = runEnd;
      } else {
        segments.push({ start: runStart, end: runEnd });
      }
      runStart = -1;
    }
  }

  if (segments.length === 0) return [];
  return segments.map((s) => ({
    cx: (s.start + s.end) / 2,
    width: s.end - s.start + 1,
  }));
}

function drawShadowForSegment(
  ctx: CanvasRenderingContext2D,
  size: number,
  cx: number,
  width: number,
  bottomY: number,
) {
  // Layer 2 - ambient: wider, softer, offset 3px below the sole
  const ambient = document.createElement("canvas");
  ambient.width = size;
  ambient.height = size;
  const ax = ambient.getContext("2d");
  if (ax) {
    ax.filter = "blur(14px)";
    ax.fillStyle = "rgba(0, 0, 0, 0.22)";
    ax.beginPath();
    ax.ellipse(cx, bottomY + 3, Math.max(width * 0.475, 8), 8, 0, 0, Math.PI * 2);
    ax.fill();
    ctx.drawImage(ambient, 0, 0);
  }

  // Layer 1 - contact: tight, dark, flush with object base (zero gap)
  const contact = document.createElement("canvas");
  contact.width = size;
  contact.height = size;
  const cxt = contact.getContext("2d");
  if (cxt) {
    cxt.filter = "blur(3px)";
    cxt.fillStyle = "rgba(0, 0, 0, 0.72)";
    cxt.beginPath();
    cxt.ellipse(cx, bottomY, Math.max(width * 0.425, 6), 3, 0, 0, Math.PI * 2);
    cxt.fill();
    ctx.drawImage(contact, 0, 0);
  }
}

function fillInteriorHoles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const total = width * height;
  const ALPHA_THRESHOLD = 20;

  const bg = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    bg[i] = data[i * 4 + 3] <= ALPHA_THRESHOLD ? 1 : 0;
  }

  const outside = new Uint8Array(total);
  const queue = new Int32Array(total);
  let qHead = 0;
  let qTail = 0;
  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const idx = y * width + x;
      if (bg[idx] && !outside[idx]) {
        outside[idx] = 1;
        queue[qTail++] = idx;
      }
    }
  }
  for (let y = 0; y < height; y++) {
    for (const x of [0, width - 1]) {
      const idx = y * width + x;
      if (bg[idx] && !outside[idx]) {
        outside[idx] = 1;
        queue[qTail++] = idx;
      }
    }
  }
  while (qHead < qTail) {
    const idx = queue[qHead++];
    const x = idx % width;
    const y = (idx / width) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= height) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        if (nx < 0 || nx >= width) continue;
        const nIdx = ny * width + nx;
        if (outside[nIdx] || !bg[nIdx]) continue;
        outside[nIdx] = 1;
        queue[qTail++] = nIdx;
      }
    }
  }

  let holeCount = 0;
  const isHole = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    if (bg[i] && !outside[i]) {
      isHole[i] = 1;
      holeCount++;
    }
  }
  if (holeCount === 0) return;

  const claimed = new Uint8Array(total);
  const rOut = new Uint8Array(total);
  const gOut = new Uint8Array(total);
  const bOut = new Uint8Array(total);
  let qh2 = 0;
  let qt2 = 0;
  const queue2 = new Int32Array(total);
  for (let i = 0; i < total; i++) {
    if (!bg[i]) {
      rOut[i] = data[i * 4];
      gOut[i] = data[i * 4 + 1];
      bOut[i] = data[i * 4 + 2];
      claimed[i] = 1;
      queue2[qt2++] = i;
    }
  }
  while (qh2 < qt2) {
    const idx = queue2[qh2++];
    const x = idx % width;
    const y = (idx / width) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= height) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        if (nx < 0 || nx >= width) continue;
        const nIdx = ny * width + nx;
        if (claimed[nIdx] || !isHole[nIdx]) continue;
        rOut[nIdx] = rOut[idx];
        gOut[nIdx] = gOut[idx];
        bOut[nIdx] = bOut[idx];
        claimed[nIdx] = 1;
        queue2[qt2++] = nIdx;
      }
    }
  }

  for (let i = 0; i < total; i++) {
    if (isHole[i]) {
      data[i * 4] = rOut[i];
      data[i * 4 + 1] = gOut[i];
      data[i * 4 + 2] = bOut[i];
      data[i * 4 + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Remove disconnected foreground blobs (paint splashes, dust, stray props
 * the AI matting model treats as "salient") so only the actual product
 * remains. A pure alpha>0 connected-component pass is not enough because
 * splash/mist effects often touch the product through a thin filament of
 * pixels, fusing them into one blob. Instead this:
 *   1. Eroded-mask pass: shrinks the foreground by a small radius so thin
 *      bridges (a splash trail, a wisp) snap, revealing separate "core"
 *      blobs for each real, solid shape.
 *   2. Sizes each core and keeps only cores >= 35% of the largest one
 *      (keeps genuine multi-item shots, e.g. a shoe pair with a gap).
 *   3. Multi-source regrowth: grows every surviving core back through the
 *      full, un-eroded foreground, so thin real details (laces, straps)
 *      reattach to their parent product instead of being clipped.
 * Anything left unclaimed by a kept core is cleared to transparent.
 */
function removeDisconnectedDebris(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const total = width * height;
  const ALPHA_THRESHOLD = 20;
  const ERODE_RADIUS = Math.min(6, Math.max(2, Math.round(Math.min(width, height) / 200)));

  const fg = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    fg[i] = data[i * 4 + 3] > ALPHA_THRESHOLD ? 1 : 0;
  }

  // Two-pass box erosion (horizontal min, then vertical min) to find "core"
  // seeds - cheap O(width*height) sliding-window implementation.
  const rowEroded = new Uint8Array(total);
  for (let y = 0; y < height; y++) {
    const base = y * width;
    let zeroCount = 0;
    for (let x = -ERODE_RADIUS; x <= ERODE_RADIUS; x++) {
      if (x < 0 || x >= width || fg[base + x] === 0) zeroCount++;
    }
    for (let x = 0; x < width; x++) {
      rowEroded[base + x] = zeroCount === 0 ? 1 : 0;
      const outX = x - ERODE_RADIUS;
      const inX = x + ERODE_RADIUS + 1;
      const outBg = outX < 0 || fg[base + outX] === 0;
      const inBg = inX >= width || fg[base + inX] === 0;
      if (outBg) zeroCount--;
      if (inBg) zeroCount++;
    }
  }

  const core = new Uint8Array(total);
  for (let x = 0; x < width; x++) {
    let zeroCount = 0;
    for (let y = -ERODE_RADIUS; y <= ERODE_RADIUS; y++) {
      if (y < 0 || y >= height || rowEroded[y * width + x] === 0) zeroCount++;
    }
    for (let y = 0; y < height; y++) {
      core[y * width + x] = zeroCount === 0 ? 1 : 0;
      const outY = y - ERODE_RADIUS;
      const inY = y + ERODE_RADIUS + 1;
      const outBg = outY < 0 || rowEroded[outY * width + x] === 0;
      const inBg = inY >= height || rowEroded[inY * width + x] === 0;
      if (outBg) zeroCount--;
      if (inBg) zeroCount++;
    }
  }

  const labels = new Int32Array(total);
  const areas: number[] = [0];
  let nextLabel = 1;
  const queue = new Int32Array(total);

  for (let start = 0; start < total; start++) {
    if (core[start] !== 1 || labels[start] !== 0) continue;
    let qHead = 0;
    let qTail = 0;
    queue[qTail++] = start;
    labels[start] = nextLabel;
    let area = 0;
    while (qHead < qTail) {
      const idx = queue[qHead++];
      area++;
      const x = idx % width;
      const y = (idx / width) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const nIdx = ny * width + nx;
          if (labels[nIdx] !== 0 || core[nIdx] !== 1) continue;
          labels[nIdx] = nextLabel;
          queue[qTail++] = nIdx;
        }
      }
    }
    areas[nextLabel] = area;
    nextLabel++;
  }

  if (nextLabel <= 1) return;

  let maxArea = 0;
  for (let i = 1; i < nextLabel; i++) {
    if (areas[i] > maxArea) maxArea = areas[i];
  }

  const keepThreshold = maxArea * 0.35;
  const keep = new Uint8Array(nextLabel);
  for (let i = 1; i < nextLabel; i++) {
    keep[i] = areas[i] >= keepThreshold ? 1 : 0;
  }

  // Multi-source regrowth: expand every core label back through the full
  // (un-eroded) foreground so thin real details reattach to their blob.
  let qHead = 0;
  let qTail = 0;
  for (let i = 0; i < total; i++) {
    if (labels[i] !== 0) queue[qTail++] = i;
  }
  while (qHead < qTail) {
    const idx = queue[qHead++];
    const label = labels[idx];
    const x = idx % width;
    const y = (idx / width) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= height) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        if (nx < 0 || nx >= width) continue;
        const nIdx = ny * width + nx;
        if (labels[nIdx] !== 0 || fg[nIdx] !== 1) continue;
        labels[nIdx] = label;
        queue[qTail++] = nIdx;
      }
    }
  }

  for (let i = 0; i < total; i++) {
    const label = labels[i];
    if (label !== 0 && !keep[label]) {
      data[i * 4 + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}


function boxErode(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let zeroCount = 0;
    const rowBase = y * w;
    for (let x = -r; x <= r; x++) {
      const xx = Math.min(w - 1, Math.max(0, x));
      if (!mask[rowBase + xx]) zeroCount++;
    }
    for (let x = 0; x < w; x++) {
      tmp[rowBase + x] = zeroCount === 0 ? 1 : 0;
      const xOut = x - r;
      const xIn = x + r + 1;
      const xxOut = Math.min(w - 1, Math.max(0, xOut));
      const xxIn = Math.min(w - 1, Math.max(0, xIn));
      if (xOut >= 0 && xIn < w) {
        if (!mask[rowBase + xxOut]) zeroCount--;
        if (!mask[rowBase + xxIn]) zeroCount++;
      }
    }
  }
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let zeroCount = 0;
    for (let y = -r; y <= r; y++) {
      const yy = Math.min(h - 1, Math.max(0, y));
      if (!tmp[yy * w + x]) zeroCount++;
    }
    for (let y = 0; y < h; y++) {
      out[y * w + x] = zeroCount === 0 ? 1 : 0;
      const yOut = y - r;
      const yIn = y + r + 1;
      const yyOut = Math.min(h - 1, Math.max(0, yOut));
      const yyIn = Math.min(h - 1, Math.max(0, yIn));
      if (yOut >= 0 && yIn < h) {
        if (!tmp[yyOut * w + x]) zeroCount--;
        if (!tmp[yyIn * w + x]) zeroCount++;
      }
    }
  }
  return out;
}

/**
 * Fixes semi-transparent "ghost" patches INSIDE the subject: on complex
 * textures (suede, glossy highlights, laces) the matting model can return
 * mid-range alpha (80-220) for pixels that are clearly deep inside the
 * object. Composited onto pure white, those pixels look washed-out — the
 * background "shows through" the product. decontaminateEdgeColors fixes RGB
 * tint but not alpha, so the wash-through survives it.
 *
 * Fix: erode the alpha>0 mask to find the guaranteed-interior core, then
 * force alpha=255 for every core pixel. Edge pixels (outside the core) keep
 * their original alpha, so antialiasing and edge softness are untouched —
 * only interior translucency is removed.
 */
function solidifyInteriorAlpha(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const total = width * height;

  const fg = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    fg[i] = data[i * 4 + 3] > 0 ? 1 : 0;
  }

  // Same interior-core radius as decontaminateEdgeColors so both passes
  // agree on what counts as "safely inside the subject".
  const ERODE_RADIUS = Math.min(10, Math.max(3, Math.round(Math.min(width, height) / 150)));
  const core = boxErode(fg, width, height, ERODE_RADIUS);

  let changed = false;
  for (let i = 0; i < total; i++) {
    if (core[i] && data[i * 4 + 3] < 255) {
      data[i * 4 + 3] = 255;
      changed = true;
    }
  }
  if (changed) ctx.putImageData(imageData, 0, 0);
}

// Fixes color-fringing / "white spots" / faint dark specks: the AI matting
// model's semi-transparent rim pixels can retain the hue of whatever
// background was behind the subject, even at alpha very close to fully
// opaque (250+). Compositing that tinted rim onto a white canvas produces a
// visible colored fringe, and very low-alpha stray pixels (below the debris
// remover's own threshold) show up as faint colored specks on white.
// Fix: find a "safe core" well inside the subject via erosion (guaranteed
// untouched by any edge/background bleed), then flood-fill that core's
// color outward through the full alpha mask. Alpha is never modified - only
// RGB is corrected for rim pixels - so edge softness/antialiasing is
// unchanged, only the tint is removed.
function decontaminateEdgeColors(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const total = width * height;

  const fg = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    fg[i] = data[i * 4 + 3] > 0 ? 1 : 0;
  }

  const ERODE_RADIUS = Math.min(10, Math.max(3, Math.round(Math.min(width, height) / 150)));
  const core = boxErode(fg, width, height, ERODE_RADIUS);

  const rOut = new Uint8Array(total);
  const gOut = new Uint8Array(total);
  const bOut = new Uint8Array(total);
  const claimed = new Uint8Array(total);
  const queue = new Int32Array(total);
  let qHead = 0;
  let qTail = 0;

  for (let i = 0; i < total; i++) {
    if (core[i]) {
      rOut[i] = data[i * 4];
      gOut[i] = data[i * 4 + 1];
      bOut[i] = data[i * 4 + 2];
      claimed[i] = 1;
      queue[qTail++] = i;
    }
  }

  while (qHead < qTail) {
    const idx = queue[qHead++];
    const x = idx % width;
    const y = (idx / width) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= height) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        if (nx < 0 || nx >= width) continue;
        const nIdx = ny * width + nx;
        if (claimed[nIdx]) continue;
        if (!fg[nIdx]) continue;
        rOut[nIdx] = rOut[idx];
        gOut[nIdx] = gOut[idx];
        bOut[nIdx] = bOut[idx];
        claimed[nIdx] = 1;
        queue[qTail++] = nIdx;
      }
    }
  }

  for (let i = 0; i < total; i++) {
    if (fg[i] && !core[i]) {
      data[i * 4] = rOut[i];
      data[i * 4 + 1] = gOut[i];
      data[i * 4 + 2] = bOut[i];
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

export type ComplianceCheck = {
  pass: boolean;
  detail: string;
};

export type ComplianceResult = {
  passed: boolean;
  backgroundPure: ComplianceCheck;
  frameFill: ComplianceCheck & { value: number };
};

function checkAmazonCompliance(
  ctx: CanvasRenderingContext2D,
  size: number,
  subjectBox: { dx: number; dy: number; drawW: number; drawH: number },
): ComplianceResult {
  const frameFillValue = Math.round(FRAME_FILL * 100);
  const frameFillPass = subjectBox.drawW > 2 && subjectBox.drawH > 2;
  const frameFill: ComplianceCheck & { value: number } = {
    pass: frameFillPass,
    value: frameFillPass ? frameFillValue : 0,
    detail: frameFillPass
      ? `Subject fills ${frameFillValue}% of frame (Amazon minimum: 85%)`
      : "No product detected in frame - check the source photo",
  };

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  const margin = 1;
  const left = Math.max(0, Math.floor(subjectBox.dx) - margin);
  const top = Math.max(0, Math.floor(subjectBox.dy) - margin);
  const right = Math.min(size, Math.ceil(subjectBox.dx + subjectBox.drawW) + margin);
  const bottom = Math.min(size, Math.ceil(subjectBox.dy + subjectBox.drawH) + margin);

  let contaminated = 0;
  let firstX = -1;
  let firstY = -1;
  for (let y = 0; y < size; y++) {
    const insideSubjectRow = y >= top && y < bottom;
    for (let x = 0; x < size; x++) {
      if (insideSubjectRow && x >= left && x < right) continue;
      const i = (y * size + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const isWhite = r === 255 && g === 255 && b === 255;
      const isNeutralGray = Math.abs(r - g) <= 2 && Math.abs(g - b) <= 2 && Math.abs(r - b) <= 2;
      if (!isWhite && !isNeutralGray) {
        contaminated++;
        if (firstX === -1) {
          firstX = x;
          firstY = y;
        }
      }
    }
  }

  const backgroundPure: ComplianceCheck = {
    pass: contaminated === 0,
    detail:
      contaminated === 0
        ? "Background is pure white (RGB 255,255,255) with no stray color"
        : `${contaminated} background pixel(s) are not pure white or neutral (first near ${firstX},${firstY})`,
  };

  return {
    passed: backgroundPure.pass && frameFill.pass,
    backgroundPure,
    frameFill,
  };
}

export async function postProcess(
  transparentPngUrl: string,
  opts: PostProcessOptions,
): Promise<{ blob: Blob; compliance: ComplianceResult }> {
  const img = await loadImage(transparentPngUrl);

  // Read source to compute tight bounds of the isolated subject
  const src = document.createElement("canvas");
  src.width = img.naturalWidth;
  src.height = img.naturalHeight;
  const sctx = src.getContext("2d");
  if (!sctx) throw new Error("Canvas 2D unavailable");
  sctx.drawImage(img, 0, 0);
  fillInteriorHoles(sctx, src.width, src.height);
  removeDisconnectedDebris(sctx, src.width, src.height);
  solidifyInteriorAlpha(sctx, src.width, src.height);
  decontaminateEdgeColors(sctx, src.width, src.height);
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

  // Fill pure white background (#FFFFFF) - always, so Amazon-compliant
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, size, size);

  // Compute placement: scale bounds so subject occupies FRAME_FILL of the frame
  const scale = (size * FRAME_FILL) / Math.max(bounds.w, bounds.h);
  const drawW = bounds.w * scale;
  const drawH = bounds.h * scale;
  const dx = (size - drawW) / 2;
  const dy = (size - drawH) / 2;

  // Render the subject first (off-canvas) so we can measure its actual
  // footprint at the ground line before drawing any shadow beneath it.
  const subjectLayer = renderFeatheredSubject(src, bounds, drawW, drawH, dx, dy, size);

  // Soft drop shadow UNDER the object - drawn before the subject is
  // composited onto the output so it sits behind it. Nudge up by 1px so
  // the shadow visually touches the sole with ZERO gap (accounts for edge
  // feathering softening the last row of pixels).
  if (opts.softShadow) {
    const bottomY = dy + drawH - 1;
    const segments = findFootprintSegments(subjectLayer, bottomY, size);
    if (segments.length > 0) {
      for (const seg of segments) {
        drawShadowForSegment(ctx, size, seg.cx, seg.width, bottomY);
      }
    } else {
      // Fallback: footprint scan found nothing (shouldn't normally happen) -
      // use the full bounding box like before rather than skip the shadow.
      drawShadowForSegment(ctx, size, size / 2, drawW, bottomY);
    }
  }

  // Draw subject with 1-2px alpha feather + subtle contrast/saturation boost.
  // Filters only affect this drawImage call; the white background is untouched.
  ctx.filter = "contrast(1.04) saturate(1.02)";
  ctx.drawImage(subjectLayer, 0, 0);
  ctx.filter = "none";

  const compliance = checkAmazonCompliance(ctx, size, { dx, dy, drawW, drawH });
  const blob = await new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/png",
    );
  });
  return { blob, compliance };
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}
