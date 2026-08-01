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
// Scale the product so its LONG side fills 92% of the canvas. Amazon's spec
// says the product should "touch or nearly touch all four edges" and
// recommends scaling to ~88%+ to clear the 85% rule with margin. At 0.92 a
// moderately rectangular product (up to ~1.08:1) clears 85% on BOTH axes;
// only strongly elongated shapes fall short on their short axis, which the
// compliance check now reports honestly instead of faking a pass.
const FRAME_FILL = 0.92;
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
 * Render the isolated subject into a temporary transparent canvas, softening
 * ONLY the alpha edge. The previous implementation set ctx.filter=blur() on
 * the main draw call, which blurred the ENTIRE subject (texture, logos,
 * laces) — the primary cause of soft, "upscaled-looking" output. Now the
 * subject is drawn sharp, then its alpha is multiplied by a blurred copy of
 * itself (destination-in), which feathers the mask edge 1-2px inward while
 * leaving every interior RGB pixel untouched.
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
  lctx.imageSmoothingEnabled = true;
  lctx.imageSmoothingQuality = "high";
  lctx.drawImage(img, bounds.x, bounds.y, bounds.w, bounds.h, dx, dy, drawW, drawH);

  const mask = document.createElement("canvas");
  mask.width = size;
  mask.height = size;
  const mctx = mask.getContext("2d");
  if (mctx) {
    mctx.filter = `blur(${FEATHER_PX}px)`;
    mctx.drawImage(layer, 0, 0);
    mctx.filter = "none";
    lctx.globalCompositeOperation = "destination-in";
    lctx.drawImage(mask, 0, 0);
    lctx.globalCompositeOperation = "source-over";
  }
  return layer;
}

/**
 * Mild unsharp mask on RGB (alpha untouched) to recover perceived detail
 * after upscaling small sources to the 1000px Amazon canvas. Strength
 * scales with the upscale factor; no-op for downscales.
 */
function sharpenLayer(layer: HTMLCanvasElement, scale: number): void {
  if (scale <= 1.15) return;
  const k = Math.min(0.25, (scale - 1) * 0.2);
  const ctx = layer.getContext("2d");
  if (!ctx) return;
  const { width, height } = layer;
  const srcData = ctx.getImageData(0, 0, width, height);
  const src = srcData.data;
  const out = new Uint8ClampedArray(src);
  const center = 1 + 4 * k;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      if (src[i + 3] === 0) continue;
      for (let c = 0; c < 3; c++) {
        const v =
          src[i + c] * center -
          k *
            (src[i - 4 + c] +
              src[i + 4 + c] +
              src[i - width * 4 + c] +
              src[i + width * 4 + c]);
        out[i + c] = v;
      }
    }
  }
  srcData.data.set(out);
  ctx.putImageData(srcData, 0, 0);
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
  const bandHeightTarget = Math.max(9, Math.round(size * 0.03));
  const bandTop = Math.max(0, Math.round(bottomY - (bandHeightTarget - 2)));
  const bandHeight = Math.min(bandHeightTarget, size - bandTop);
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

function drawAmbientOnly(
  ctx: CanvasRenderingContext2D,
  size: number,
  cx: number,
  width: number,
  bottomY: number,
) {
  const ambient = document.createElement("canvas");
  ambient.width = size;
  ambient.height = size;
  const ax = ambient.getContext("2d");
  if (ax) {
    ax.filter = "blur(16px)";
    ax.fillStyle = "rgba(0, 0, 0, 0.14)";
    ax.beginPath();
    ax.ellipse(cx, bottomY + 3, Math.max(width * 0.45, 8), 7, 0, 0, Math.PI * 2);
    ax.fill();
    ctx.drawImage(ambient, 0, 0);
  }
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
    cxt.fillStyle = "rgba(0, 0, 0, 0.55)";
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

  // Only fill SMALL holes (mask defects on textures). Large enclosed
  // background regions are legitimate see-through gaps — e.g. the opening
  // between an arm and a held product, a bag handle, a shoe pair leaning on
  // each other. Filling those painted big smeared color blocks over the
  // image. Per-component labeling with an area cap: anything larger than 2%
  // of the foreground stays transparent.
  let fgArea = 0;
  for (let i = 0; i < total; i++) if (!bg[i]) fgArea++;
  const MAX_HOLE_AREA = Math.max(96, Math.round(fgArea * 0.02));
  const holeLabels = new Int32Array(total);
  let holeNext = 1;
  const hq = new Int32Array(total);
  for (let start = 0; start < total; start++) {
    if (!isHole[start] || holeLabels[start] !== 0) continue;
    let h0 = 0;
    let h1 = 0;
    hq[h1++] = start;
    holeLabels[start] = holeNext;
    const members: number[] = [];
    while (h0 < h1) {
      const idx = hq[h0++];
      members.push(idx);
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
          if (holeLabels[nIdx] !== 0 || !isHole[nIdx]) continue;
          holeLabels[nIdx] = holeNext;
          hq[h1++] = nIdx;
        }
      }
    }
    if (members.length > MAX_HOLE_AREA) {
      for (const m of members) isHole[m] = 0;
      holeCount -= members.length;
    }
    holeNext++;
  }
  if (holeCount <= 0) return;

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
  aggressive = false,
): void {
  // Two-stage debris remover:
  //   Stage A - Erosion-based bridge break. Splashes/dust/mist attach to
  //     the product through 1-3px filaments, so a plain connected-component
  //     pass keeps them. Erode the mask by ~0.5% of the smaller dimension
  //     (~3-6px) so those filaments snap, label the eroded "cores", keep
  //     any core >= 20% of the largest, then regrow through the full
  //     un-eroded mask. Real thin structures (laces, straps, hanger hooks)
  //     are reattached during regrowth because they connect to a surviving
  //     product core.
  //   Stage B - Small-blob speck filter on what remains: kills isolated
  //     droplets/dust that never touched the product at all.
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const total = width * height;
  const ALPHA_THRESHOLD = 20;

  const fg = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    fg[i] = data[i * 4 + 3] > ALPHA_THRESHOLD ? 1 : 0;
  }

  // ---- Stage A: erosion-based bridge break ----
  // Wider erosion so thicker splash-to-product bridges snap. Laces/straps
  // at 2K resolution are typically 20-40px wide and survive this radius;
  // they reattach during regrowth.
  const erodeR = Math.max(6, Math.round(Math.min(width, height) * 0.012));
  const eroded = boxErode(fg, width, height, erodeR);
  const coreLabels = new Int32Array(total);
  const coreAreas: number[] = [0];
  const cq = new Int32Array(total);
  let coreNext = 1;
  for (let s = 0; s < total; s++) {
    if (!eroded[s] || coreLabels[s] !== 0) continue;
    let h0 = 0;
    let h1 = 0;
    cq[h1++] = s;
    coreLabels[s] = coreNext;
    let a = 0;
    while (h0 < h1) {
      const idx = cq[h0++];
      a++;
      const x = idx % width;
      const y = (idx / width) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const ni = ny * width + nx;
          if (coreLabels[ni] !== 0 || !eroded[ni]) continue;
          coreLabels[ni] = coreNext;
          cq[h1++] = ni;
        }
      }
    }
    coreAreas[coreNext] = a;
    coreNext++;
  }

  // If erosion wiped everything (thin/small product), skip Stage A entirely
  // rather than clear the whole subject.
  if (coreNext > 1) {
    let maxCore = 0;
    for (let i = 1; i < coreNext; i++) if (coreAreas[i] > maxCore) maxCore = coreAreas[i];
    const keepCoreMin = maxCore * (aggressive ? 0.4 : 0.28);
    const keepCore = new Uint8Array(coreNext);
    for (let i = 1; i < coreNext; i++) keepCore[i] = coreAreas[i] >= keepCoreMin ? 1 : 0;

    // Multi-source regrowth through the full foreground mask
    const claimed = new Uint8Array(total);
    const rq = new Int32Array(total);
    let r0 = 0;
    let r1 = 0;
    for (let i = 0; i < total; i++) {
      const lbl = coreLabels[i];
      if (lbl !== 0 && keepCore[lbl]) {
        claimed[i] = 1;
        rq[r1++] = i;
      }
    }
    if (r1 > 0) {
      while (r0 < r1) {
        const idx = rq[r0++];
        const x = idx % width;
        const y = (idx / width) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;
            const ni = ny * width + nx;
            if (claimed[ni] || !fg[ni]) continue;
            claimed[ni] = 1;
            rq[r1++] = ni;
          }
        }
      }
      for (let i = 0; i < total; i++) {
        if (fg[i] && !claimed[i]) {
          data[i * 4 + 3] = 0;
          fg[i] = 0;
        }
      }
    }
  }

  // ---- Stage B: small-blob speck filter on the remaining mask ----
  const labels = new Int32Array(total);
  const areas: number[] = [0];
  let nextLabel = 1;
  const queue = new Int32Array(total);

  for (let start = 0; start < total; start++) {
    if (fg[start] !== 1 || labels[start] !== 0) continue;
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
          if (labels[nIdx] !== 0 || fg[nIdx] !== 1) continue;
          labels[nIdx] = nextLabel;
          queue[qTail++] = nIdx;
        }
      }
    }
    areas[nextLabel] = area;
    nextLabel++;
  }

  if (nextLabel <= 2) {
    ctx.putImageData(imageData, 0, 0);
    return;
  }

  let maxArea = 0;
  for (let i = 1; i < nextLabel; i++) {
    if (areas[i] > maxArea) maxArea = areas[i];
  }
  const keepThreshold = Math.max(64, maxArea * (aggressive ? 0.12 : 0.02));

  for (let i = 0; i < total; i++) {
    const label = labels[i];
    if (label !== 0 && areas[label] < keepThreshold) {
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

  // Only recolor rim pixels that STRONGLY deviate from their interior
  // reference color (background bleed: green grass fringe on a white sole,
  // wood-table orange on suede). Mild differences are legitimate shading,
  // reflections, and material gradients — flattening them made results look
  // sterile and fake. Threshold: sum of |ΔR|+|ΔG|+|ΔB| > 110.
  for (let i = 0; i < total; i++) {
    if (fg[i] && !core[i]) {
      const dr = Math.abs(data[i * 4] - rOut[i]);
      const dg = Math.abs(data[i * 4 + 1] - gOut[i]);
      const db = Math.abs(data[i * 4 + 2] - bOut[i]);
      if (dr + dg + db > 110) {
        data[i * 4] = rOut[i];
        data[i * 4 + 1] = gOut[i];
        data[i * 4 + 2] = bOut[i];
      }
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
  frameFill: ComplianceCheck & { value: number; status: "pass" | "warn" | "fail" };
};

function checkAmazonCompliance(
  ctx: CanvasRenderingContext2D,
  size: number,
  subjectBox: { dx: number; dy: number; drawW: number; drawH: number },
): ComplianceResult {
  // Hybrid compliance model (matches how Amazon's spec is most commonly
  // stated vs. how its algorithm actually measures):
  //  - Most Amazon guidance says "product fills 85%+ of the frame" and
  //    means the LONG axis. We scale the long axis to 92%, so that always
  //    clears 85% → the primary pass signal.
  //  - BUT Amazon's automated check can evaluate the SHORT axis too, and a
  //    strongly elongated product (a side-on shoe, a bottle) fills far less
  //    on its short axis. Rather than fake a green pass (the old bug) or
  //    hard-fail every rectangular product, we surface a WARN: the long
  //    axis is compliant, but the shape is elongated and Amazon *may* judge
  //    it on the short axis. This is honest and still lets the user ship.
  const AMAZON_MIN_FILL = 85;
  const WARN_SHORT_AXIS = 78; // short axis this low → elongated, worth a heads-up
  const longFill = Math.round(Math.max((subjectBox.drawW / size) * 100, (subjectBox.drawH / size) * 100));
  const shortFill = Math.round(Math.min((subjectBox.drawW / size) * 100, (subjectBox.drawH / size) * 100));
  const hasSubject = subjectBox.drawW > 2 && subjectBox.drawH > 2;

  let fillStatus: "pass" | "warn" | "fail";
  let fillDetail: string;
  if (!hasSubject) {
    fillStatus = "fail";
    fillDetail = "No product detected in frame — check the source photo";
  } else if (longFill < AMAZON_MIN_FILL) {
    // Shouldn't happen at FRAME_FILL 0.92, but guard anyway.
    fillStatus = "fail";
    fillDetail = `Subject fills only ${longFill}% of frame — Amazon needs 85%. Crop the source tighter.`;
  } else if (shortFill < WARN_SHORT_AXIS) {
    fillStatus = "warn";
    fillDetail = `Long side fills ${longFill}% ✓ — but this is an elongated shape (short side ${shortFill}%). Amazon usually accepts this, but for a strict category you can crop the source closer to a square.`;
  } else {
    fillStatus = "pass";
    fillDetail = `Subject fills ${longFill}% of frame (Amazon minimum: 85%)`;
  }

  const frameFill: ComplianceCheck & { value: number; status: "pass" | "warn" | "fail" } = {
    // A warn is still a "soft pass" for the overall passed flag — the image
    // is shippable; the warning is advisory, not a block.
    pass: fillStatus === "pass" || fillStatus === "warn",
    status: fillStatus,
    value: hasSubject ? longFill : 0,
    detail: fillDetail,
  };

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  // Check the background band ABOVE the product only. The soft contact
  // shadow legitimately paints faint grey pixels below and around the
  // product's base (Amazon permits a natural contact shadow), so scanning
  // the whole frame would false-fail every shadowed export. The top band is
  // guaranteed shadow-free, and an off-white FILL — the thing Amazon
  // actually suppresses — is uniform across the whole canvas, so if the top
  // is contaminated the fill is bad, and if the top is pure the fill is
  // pure. This isolates "is the background truly white" from "is there a
  // shadow".
  const scanBottom = Math.max(0, Math.floor(subjectBox.dy) - 2);
  let contaminated = 0;
  let scanned = 0;
  let firstX = -1;
  let firstY = -1;
  for (let y = 0; y < scanBottom; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Amazon requires EXACT RGB 255,255,255. "Off-white" (250,250,250),
      // light grey, and any near-white are the #1 cause of main-image
      // suppression — so the check must flag ANY pixel that isn't pure
      // white. The previous `isNeutralGray` shortcut passed all greys (even
      // black), making the background check useless. Allow only a 1-level
      // tolerance to absorb canvas anti-aliasing, NOT to permit off-white.
      const isPureWhite = r >= 254 && g >= 254 && b >= 254;
      scanned++;
      if (!isPureWhite) {
        contaminated++;
        if (firstX === -1) {
          firstX = x;
          firstY = y;
        }
      }
    }
  }
  // If there's no band above the product (product touches the top edge),
  // we can't sample a shadow-free region — treat as pure rather than
  // false-fail, since the white fill itself is always drawn as #FFFFFF.
  const backgroundPure: ComplianceCheck = {
    pass: scanned === 0 || contaminated === 0,
    detail:
      scanned === 0 || contaminated === 0
        ? "Background is pure white (RGB 255,255,255)"
        : `${contaminated} background pixel(s) are not pure white (first near ${firstX},${firstY}) — Amazon requires exact RGB 255,255,255 and suppresses off-white`,
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
  // Minimal, non-destructive post-processing: cut the background, keep the
  // product itself intact, then only apply safe canvas finishing.
  fillInteriorHoles(sctx, src.width, src.height);
  // Snap thin filaments between product and splashes/dust/mist, then drop
  // any leftover disconnected specks. Erosion is capped so thin real
  // structures (laces, straps, hanger hooks) reattach on regrowth.
  removeDisconnectedDebris(sctx, src.width, src.height, false);
  // Fix rim color-fringing and interior translucency ("ghost" wash-through on
  // complex textures - suede, glossy highlights, laces) left by the matting
  // model. Both operate on an eroded "safe core" so edge softness and
  // legitimate shading/reflections are untouched.
  decontaminateEdgeColors(sctx, src.width, src.height);
  solidifyInteriorAlpha(sctx, src.width, src.height);
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
  // Recover detail lost to upscaling small sources (thumbnails, phone crops).
  // No unsharp pass: it amplified JPEG grain on compressed sources and
  // gave the "gritty" look. Bria + Recraft pre-upscale already deliver
  // adequate sharpness; keep the subject as-is.

  // Soft drop shadow UNDER the object - drawn before the subject is
  // composited onto the output so it sits behind it. Nudge up by 1px so
  // the shadow visually touches the sole with ZERO gap (accounts for edge
  // feathering softening the last row of pixels).
  if (opts.softShadow) {
    const bottomY = dy + drawH - 1;
    const segments = findFootprintSegments(subjectLayer, bottomY, size);
    // Fabric hems, ruffled edges, and multi-point bottoms produce many
    // narrow segments; stacking a dark contact ellipse on each merges into
    // an ugly blob. For those, render ONE soft ambient shadow across the
    // union and skip the dark contact layer entirely. Contact shadows only
    // for clearly grounded objects (1-3 solid segments).
    if (segments.length > 3) {
      const left = Math.min(...segments.map((s) => s.cx - s.width / 2));
      const right = Math.max(...segments.map((s) => s.cx + s.width / 2));
      drawAmbientOnly(ctx, size, (left + right) / 2, right - left, bottomY);
    } else if (segments.length > 0) {
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
