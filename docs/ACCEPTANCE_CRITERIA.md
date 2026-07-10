# Acceptance Criteria — Rhinestone Template Tool

## How to Use This Document

These criteria define what "done" means for each phase. A phase is not complete until **all criteria in that phase pass**, including any physical cut tests where specified.

---

## Phase 0 — Foundation

- [x] Project scaffold exists (Next.js, TypeScript, Tailwind)
- [x] Folder structure matches the spec in `docs/TECHNICAL_SPEC.md`
- [x] All documentation files exist in `/docs/`
- [ ] `src/lib/rhinestone-engine/` folder exists with sub-folders
- [ ] AGENTS.md contains project-specific rules

---

## Phase 6 — Physical Size Controls v1 (Implemented)

- [x] `calculatePolylineBounds` returns correct bounds for one and multiple polylines
- [x] `scalePolylinesToWidth` scales to exact target width (aspect preserved)
- [x] `scalePolylinesToHeight` scales to exact target height (aspect preserved)
- [x] `scalePolylinesToFit` with both dimensions + `preserveAspectRatio:true` fits inside box
- [x] `scalePolylinesToFit` with `preserveAspectRatio:false` stretches independently
- [x] Scaling moves minX/minY to `originXmm`/`originYmm`
- [x] Scaling does not mutate input polylines
- [x] Throws on empty polylines, invalid target dimensions
- [x] `getTemplateStoneBounds` includes full hole radius
- [x] `getTemplatePhysicalSize` returns `widthMm`/`heightMm`
- [x] `createPolylineRhinestoneTemplate` accepts `targetWidthMm`, `targetHeightMm`, `preserveAspectRatio`
- [x] Scaled template passes `validateRhinestoneTemplate`
- [x] Exported SVG width/height are in mm (not px)
- [x] `SvgUploadGenerator` and `PolylineLogoGenerator` show estimated physical output size
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass

---

## Phase 5 — SVG Upload v2: Curves + Transforms (Implemented)

- [x] C/c cubic Bezier flattened to `curveSegments` polyline points
- [x] S/s smooth cubic Bezier (reflected control point)
- [x] Q/q quadratic Bezier flattened
- [x] T/t smooth quadratic Bezier (reflected control point)
- [x] A/a arc throws with message `"arc commands are not supported"`
- [x] `curveSegments` option controls smoothness (default 24)
- [x] translate, scale, rotate, matrix transforms applied to element points
- [x] Transform chain (multiple transforms) applied in SVG left-to-right order
- [x] Unsupported transforms (skewX/skewY) throw with clear error
- [x] Malformed matrix throws with clear error
- [x] `parseSvgViewBox` returns `{minX,minY,width,height}` or null
- [x] `getSvgRootAttributes` returns viewBox, width, height from root `<svg>`
- [x] `<style`, `data:`, `@import` added to safety block list
- [x] `SvgUploadGenerator` banner updated for v2
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass

---

## Phase 4 — SVG Upload v1: Safe Primitive Parsing (Implemented)

- [x] `validateSafeSvgInput` returns safe for simple primitive SVG
- [x] `validateSafeSvgInput` flags script, foreignObject, image, javascript:, onload=, href=, xlink:href=
- [x] `extractSvgElements` extracts line, polyline, polygon, rect, circle, ellipse, path elements
- [x] `svgStringToPolylines` converts all supported primitives to Polylines
- [x] Circle/ellipse approximated with configurable segment count (default 64)
- [x] Path M/L/H/V/Z commands supported
- [x] Bezier curve commands (C/Q/A/…) throw with clear error mentioning “flatten”
- [x] `transform` attribute throws with clear error
- [x] Unsafe SVG throws
- [x] SVG with no supported shapes throws
- [x] Generated polylines pass through `createPolylineRhinestoneTemplate`
- [x] Generated template passes `validateRhinestoneTemplate`
- [x] Exported SVG contains real `<circle>` elements, no `<image>`, no raw uploaded SVG data
- [x] `SvgUploadGenerator` component never passes uploaded SVG to `dangerouslySetInnerHTML`
- [x] Preview shows only engine-generated rhinestone SVG
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass

---

## Phase 3 — SVG/Logo Foundation v1: Polyline Sampling (Implemented)

- [x] `getPolylineLength` returns correct length for single segments, multi-segment, and closed polylines
- [x] `normalizePolylineInput` clones input, throws on < 2 points, throws on non-finite values
- [x] `samplePolylineBySpacing` always includes the first point
- [x] `samplePolylineBySpacing` returns deterministic results
- [x] `samplePolylineBySpacing` throws if spacingMm <= 0
- [x] `samplePolylineBySpacing` supports closed polylines (more points than open)
- [x] `createPolylineRhinestoneTemplate` returns `RhinestoneTemplate` with `unit: 'mm'`
- [x] Template passes `validateRhinestoneTemplate` with zero issues
- [x] Template exports via `createBasicSvgExport` — each stone is a `<circle>`
- [x] Exported SVG has no `<image>` elements
- [x] `PolylineLogoGenerator` component uses `createPolylineRhinestoneTemplate` from the engine
- [x] Demo shapes (diamond, triangle, rectangle, zigzag) work correctly
- [x] No raw SVG input accepted by the component
- [x] `npm run build`, `typecheck`, `lint`, and `test` all pass

---

## Phase 2 — Text-to-Rhinestones v1: Dot Matrix (Implemented)

- [x] `DOT_MATRIX_5X7_FONT` has entries for all uppercase A–Z, 0–9, space, and . , ! ? - _
- [x] Every glyph is exactly 7 rows of 5 characters each
- [x] All glyph cells are only `"0"` or `"1"`
- [x] `getDotMatrixGlyph(char)` returns the `?` glyph for unsupported characters
- [x] `createDotMatrixTextTemplate` returns a `RhinestoneTemplate` with `unit: 'mm'`
- [x] `createDotMatrixTextTemplate` generates 18 stones for text `"A"` (SS10)
- [x] Stone IDs are deterministic and unique
- [x] Lowercase input is uppercased by default
- [x] Multiline text (split on `\n`) produces stones on separate rows
- [x] Generated template passes `validateRhinestoneTemplate` with zero issues
- [x] Generated template exports via `createBasicSvgExport` — each stone is a `<circle>`
- [x] Exported SVG has no `<image>` elements
- [x] `TextMatrixGenerator` component uses `createDotMatrixTextTemplate` from the engine
- [x] `TextMatrixGenerator` uses shared `SvgPreview`, `SvgExportActions`, `TemplateStatsCard`, `ValidationIssuesList`
- [x] Filename is deterministic: `rhinestone-text-dot-matrix-{size}.svg`
- [x] `npm run build`, `typecheck`, `lint`, and `test` all pass

---

## Phase 1.7 — Shared SVG UI Components (Implemented)

- [x] `SvgPreview` renders engine-generated SVG safely; shows empty state when svg is empty
- [x] `SvgPreview` has a code comment explaining the `dangerouslySetInnerHTML` security contract
- [x] `SvgExportActions` handles Download and Copy with disabled state when svg is empty
- [x] `SvgExportActions` shows copy success/error state
- [x] `TemplateStatsCard` renders any combination of stone count, size, columns, rows, material, cutter, and extra stats
- [x] `ValidationIssuesList` shows valid/invalid status, issue list with codes, and stone IDs
- [x] `ManualGridGenerator` uses all four shared components
- [x] `CalibrationSheetGenerator` uses `SvgPreview`, `SvgExportActions`, `TemplateStatsCard`
- [x] `npm run build`, `typecheck`, and `lint` all pass
- [x] Duplicate download/copy/preview logic removed from individual components

---

## Phase 1.6 — Calibration Sheet UI (Implemented)

- [x] `CalibrationSheetGenerator` component exists at `app/components/CalibrationSheetGenerator.tsx`
- [x] Uses `createDefaultMagicFlockCalibrationSheet()` — no engine logic duplicated in React
- [x] Exports via `createBasicSvgExport()` — same pipeline as production templates
- [x] Exported SVG has `width`/`height` in `mm` units, no `<image>`, all holes are `<circle>`
- [x] Shows material, cutter, stone sizes, and total hole count
- [x] Shows description of diameter variant columns and how to use them
- [x] Prominent provisional warning banner
- [x] Download button creates a Blob (`magic-flock-calibration-sheet.svg`)
- [x] Copy SVG button
- [x] Component appears on home page below the grid generator
- [x] No raw user SVG input accepted
- [x] `npm run build`, `typecheck`, and `lint` all pass

---

## Phase 1.5 — First UI: Manual Grid Generator (Implemented)

- [x] `ManualGridGenerator` component exists at `app/components/ManualGridGenerator.tsx`
- [x] Component uses `createStoneGridTemplate` from the engine — no engine logic duplicated in React
- [x] Component calls `validateRhinestoneTemplate` before export
- [x] Validation status (valid/invalid + issue list) is shown in the UI
- [x] Export uses `createBasicSvgExport` — all holes are `<circle>` elements
- [x] Exported SVG has `width`/`height` in `mm` units
- [x] Exported SVG does not contain `<image>` or raster data
- [x] Download button creates a Blob and uses `URL.createObjectURL`
- [x] Filename is deterministic: `rhinestone-grid-{size}-{cols}x{rows}.svg`
- [x] Copy SVG button copies the SVG string to clipboard
- [x] Template stats (stone size, count, columns, rows) are displayed
- [x] SVG preview renders inline using `dangerouslySetInnerHTML` on engine-only output
- [x] No raw SVG input from the user is accepted
- [x] `npm run build`, `typecheck`, and `lint` all pass

---

## Phase 0.5 — Template Creation and Validation (Implemented)

- [x] `createRhinestoneTemplate(input)` returns a `RhinestoneTemplate` with `unit: 'mm'`
- [x] `createRhinestoneTemplate` throws on empty id, empty name, duplicate stone ids, invalid hole diameters
- [x] `createStoneGridTemplate(options)` generates a correct rectangular grid with deterministic ids
- [x] `createStoneGridTemplate` uses recommended hole diameter and spacing from material profile
- [x] `createStoneGridTemplate` throws on rows/columns < 1 or insufficient spacing
- [x] `validateRhinestoneTemplate` returns `valid: true` for a clean template
- [x] `validateRhinestoneTemplate` returns `valid: false` and error codes for unit mismatch, empty fields, bad hole diameter, duplicate ids, collisions
- [x] Collision issues include the `stoneIds` of both offending stones
- [x] `requireNoCollisions: false` option suppresses collision errors
- [x] `requireUniqueStoneIds: false` option suppresses duplicate-id errors
- [x] Grid templates pass `validateRhinestoneTemplate` with zero issues

---

## Phase 1 — Engine Core

### Geometry
- [ ] `generateHexGrid(bounds, stoneProfile, materialProfile)` returns a sorted array of `Point` objects
- [ ] Grid covers the full bounding box
- [ ] Grid spacing matches the stone size + safety margin formula from `RHINESTONE_ENGINE_SPEC.md`

### Collision Detection
- [ ] `filterCollisions(candidates, accepted, minDistance)` correctly removes overlapping points
- [ ] A pair of stones at exactly `minDistance` apart is **accepted**
- [ ] A pair of stones at `minDistance - 0.001` apart is **rejected**
- [ ] Performance: 10,000 candidates resolved in < 100 ms

### Path Fill Filter
- [ ] `filterInsidePaths(candidates, paths)` retains only points inside the path
- [ ] Points on the path boundary are included
- [ ] Compound paths (holes) are handled correctly: points inside a hole are excluded

### Determinism
- [ ] Running the engine twice with identical inputs produces byte-identical `StonePosition[]` arrays
- [ ] Output is sorted by `(y ASC, x ASC)`

---

## Phase 2 — Text Input

### Functional
- [ ] User can type text and select a font
- [ ] Text is converted to SVG path (vector outline)
- [ ] Engine fills the path with stones using the selected size
- [ ] Preview renders in-browser without canvas

### Output Quality
- [ ] Stones are distributed evenly inside all characters
- [ ] No stones overlap
- [ ] Characters with holes (O, B, D, etc.) correctly exclude the interior hole
- [ ] Design is legible at 50 mm height for SS10 stones

### Export
- [ ] Downloaded SVG opens in Cricut Design Space at correct physical size
- [ ] SVG passes the export checklist in `docs/EXPORT_REQUIREMENTS.md`

---

## Phase 3 — SVG/Logo Input

### Functional
- [ ] User can upload an SVG file
- [ ] Upload is parsed and normalized to mm-coordinate paths
- [ ] Engine fills the paths with stones
- [ ] Preview renders correctly

### Edge Cases
- [ ] SVG with nested groups is flattened correctly
- [ ] SVG with `transform` attributes is resolved before path extraction
- [ ] Very small paths (< 3 stones fit) produce 0–2 stones without error

### Export
- [ ] Output SVG is Cricut-safe (passes export checklist)

---

## Phase 4 — Calibration

### Engine (Implemented)
- [x] `createCalibrationSheet(profile, options?)` returns a `RhinestoneTemplate` with `unit: 'mm'`
- [x] Sheet contains one row per supported stone size
- [x] Default variant mode produces 4 holes per size (−0.1, 0, +0.1, +0.2 mm)
- [x] Variant-off mode produces 1 hole per size
- [x] All stones carry `calibration: true`, `materialProfileId`, `testedHoleDiameterMm`, `variantLabel` in metadata
- [x] Generated IDs and positions are deterministic
- [x] Calibration sheet exports via `createBasicSvgExport()` without error
- [x] Exported SVG contains `<circle>`, `data-stone-size`, `data-hole-diameter-mm`
- [x] Exported SVG does not contain `<image>`

### UI (Pending)
- [ ] User can trigger calibration sheet download from the UI
- [ ] User can enter measured offsets in the UI
- [ ] Offsets are applied to engine output
- [ ] Calibrated profile is saved to `/calibration/`

### Physical Test (Required)
- [ ] Calibration sheet is cut on Magic Flock with a Cricut Maker
- [ ] Holes at all four diameter variants are tested with real stones
- [ ] Correct diameter variant identified; `kerfCompensationMm` updated
- [ ] All stone sizes seat correctly with no tearing after calibration

---

## General Non-Regression Rules

These must hold across all phases:

1. The engine never imports from `/app/`.
2. No `<canvas>` element is used in the export pipeline.
3. All SVG output has `width` and `height` in `mm`.
4. Collision detection is never disabled.
5. All engine functions have corresponding unit tests.
6. A new stone size can be added by adding one profile entry — no algorithm changes needed.
