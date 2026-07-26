# Fix: halos on straps/hangers + revert preUpscale regression

Two small, isolated changes to background removal — no model swap, no UI changes.

## 1. Revert preUpscale threshold: 1200 → 900

**File:** `src/components/studio-workspace.tsx` (~line 133)

Change:
```ts
const preUpscale = Math.max(dims.w, dims.h) < 1200;
```
back to:
```ts
const preUpscale = Math.max(dims.w, dims.h) < 900;
```

Also update the comment above (~lines 131–132) to reflect the 900px threshold.

**Why:** raising to 1200 pushed ~1000px photos (like the sneakers case) through Recraft AI upscaling, which hallucinates detail that confuses `rembg` and leaves background gaps. 900 is the previously-known-good value where straight-through path is used for typical phone/DSLR shots and AI upscale only kicks in for genuinely tiny sources.

## 2. Enable alpha matting in rembg

**File:** `src/lib/process-image.server.ts` (~line 42)

Change the rembg request body from:
```ts
body: JSON.stringify({ image_url: sourceUrl }),
```
to:
```ts
body: JSON.stringify({
  image_url: sourceUrl,
  alpha_matting: true,
  alpha_matting_foreground_threshold: 240,
  alpha_matting_background_threshold: 10,
  alpha_matting_erode_size: 10,
}),
```

**Why:** the greyish halo around dress straps and hangers is `rembg`'s U²-Net leaving semi-transparent alpha pixels (values 20–60%) at fuzzy edges. On white canvas that reads as dirty haze — a common Amazon rejection reason in fashion. Alpha matting is a refinement pass that resolves each edge pixel as clearly foreground or clearly background, eliminating the halo.

**Tradeoffs:**
- +1–2s per photo
- Slightly higher fal.ai cost per call
- Cleaner edges on straps, hair, mesh, thin hangers — much safer for Amazon auto-moderation

## Out of scope

- No model change (staying on `rembg`).
- No UI/layout changes.
- No changes to silent retry, concurrency, or dropzone text.
