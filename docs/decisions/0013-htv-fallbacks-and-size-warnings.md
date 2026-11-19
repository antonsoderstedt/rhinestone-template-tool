# 0013 — HTV: graceful 3D fallback, converter states, size warnings

Status: accepted (Phase 9 of `docs/COPILOT_FIX_PLAN.md`)

## Context

Three HTV Studio screens could leave the user with nothing and no explanation:

- **3D tab.** When WebGL was missing or the graphics context was lost, the pane went blank (or froze on its last frame). A
  garment model that failed to load threw out of the scene.
- **Image → silhouette dialog.** Tracing ran synchronously on every slider tick, so a photo froze the page, and any failure
  was swallowed: the preview just went empty and *Apply* stayed disabled without a reason.
- **Sizes.** Nothing told the user their artwork was bigger than the garment placement. The export dialog knew about Cricut mats
  but showed millimetres only.

## Decisions

1. **3D never shows a blank pane.** `HtvGarment3D` probes WebGL up front (`webglSupport.isWebglAvailable`, which releases its
   probe context), wraps the scene in an error boundary, and listens for `webglcontextlost`. In any of these cases it shows the
   flat garment view (passed in as `fallback`) with a plain-language reason and a **Retry 3D** button. Retry clears drei's
   cache of failed models, re-probes WebGL and remounts the canvas. If the browser restores the context itself, 3D comes back
   without a click. A *Loading 3D model…* badge covers the model download.
2. **The converter shows its state.** Tracing is deferred one tick (so *Tracing…* paints first) and debounced 150 ms while a
   slider moves; *Apply* is disabled while tracing. Large images are shrunk to ≤ 1.5 MP with a box filter before tracing
   (`silhouetteTrace.prepareTraceImage`), and the dialog says so. Outcomes are data (`ok` / `empty` / `error`) so each gets its own
   message instead of an empty preview.
3. **Sizes are checked and shown in mm and inches.** `htvSizeCheck.ts` compares the artwork with the placement's real print size
   (`htvPlacementZones.getPlacementZoneSizeMm`, now the single source for the placement labels) and the cut file with the Cricut
   12×12 / 12×24 mat areas that already existed in `exportDialogHelpers`. Exceeding the placement or the largest mat is a
   *warning* (status turns to Warning); needing the 12×24 mat is information. The export dialog adds inches and the placement note,
   using the exact size from the export.
4. **No warnings from guesses.** Text outlines load asynchronously, and the old width estimate (0.6 × font size × characters) can be
   far off. `useMeasuredTextSizes` measures the real outlines; until every visible text layer is measured the summary reports
   `measuring: true` and raises no issues.

## Consequences

- The artwork can still be larger than the placement; this warns, it does not block export (people cut test pieces and
  oversize prints on purpose).
- Mat fit assumes the standard Cricut usable areas (≈ 292 × 292 mm and 292 × 597 mm) and a weed margin from Settings. Other machines
  or roll-fed materials may differ.
- Tracing still runs on the main thread (now shorter and debounced). A Web Worker would remove the remaining pause on very
  detailed images but was not needed for the cases tested.
- The 3D preview is still not tested in a browser *without* a GPU; the fallback paths were exercised by simulating each failure
  (lost context, `getContext` returning null, blocked model request).
