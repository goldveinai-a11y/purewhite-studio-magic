## Problem

In the Studio section, the left column stacks `StudioWorkspace` (uploader) **plus** the large `Sample Preview` sneaker slider, while the right column only holds the Control Panel toggles and the short "Why Sellers Choose" list. That makes the left column roughly twice as tall as the right, leaving the big empty white gap under the right column that you circled.

The right column also has a small structural issue: the "Why Sellers" card lives inside the toggles block but is missing one level of indentation, so it butts awkwardly against the toggle group.

## Fix

Restructure only the studio card layout in `src/routes/index.tsx` (lines ~315–398). No new components, no design-token changes.

1. **Left column** → keep only `<StudioWorkspace />` (uploader + dropzone + credits meter). Remove the Sample Preview from here.
2. **Right column** → keep Control Panel heading + both `ToggleRow`s + the "Free tier / batches" hint + the "Why Sellers Choose" card. Fix the indentation so the Why-Sellers card is a proper sibling of the toggles, not a nested orphan.
3. **Sample Preview** → move out of the grid and render as a **full-width block below** the two-column grid, still inside the same white card. Keep the same `BeforeAfter` component, label, and dashed border styling.

Result: left and right columns end at roughly the same height (both anchored by the Control Panel / uploader), and the sneaker Before/After slider becomes a wide showcase strip underneath — no more dead space next to the "Why Sellers" list.

## Technical notes

- Single edit to `src/routes/index.tsx` inside the `Hero` component's studio card.
- Grid stays `md:grid-cols-[1.4fr_1fr]`; only its children change. Sample Preview moves to a sibling `<div>` after the grid, inside the same `<Card>`.
- No changes to `StudioWorkspace`, `BeforeAfter`, tokens, or other sections.
