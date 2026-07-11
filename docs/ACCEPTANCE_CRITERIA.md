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

## Phase 15 — Fill Mode v1 (Implemented)

- [x] `pointInPolygon` returns true for inside points, false for outside
- [x] `calculatePolygonBounds` returns correct AABB
- [x] `generateFillPointsForClosedPolyline` places points inside a closed rectangle
- [x] Open polylines produce no fill points (no error)
- [x] Grid and offset-grid patterns are deterministic
- [x] `spacingMm <= 0` throws an error
- [x] Polygon with fewer than 3 points throws an error
- [x] Fill generation does not mutate input
- [x] `createPolylineFilledRhinestoneTemplate` outline mode equals `createPolylineRhinestoneTemplate`
- [x] Fill mode creates stones inside closed shapes
- [x] Outline-fill creates more or equal stones than outline alone
- [x] All modes support densityPreset and targetWidthMm
- [x] Fill mode passes `validateRhinestoneTemplate` (no collision errors)
- [x] Fill mode passes `checkExportReadiness`
- [x] Exported SVG from fill mode contains `<circle>` elements
- [x] Exported SVG does not contain `<image>` tags
- [x] Fill output is deterministic (same input → same positions)
- [x] `createOutlineTextTemplate` supports `fillMode` and `fillPattern`
- [x] Filled outline text passes validation and exports correctly
- [x] SVG Upload, Polyline Demo, Outline Text UI all expose fill mode controls
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass
- [x] Raw uploaded SVG is never rendered

---

## Phase 14 — Font Outline Text Foundation v1 (Implemented)

- [x] `BUILT_IN_VECTOR_FONT` covers A–Z, 0–9, space, `. , ! ? - _`
- [x] `getVectorGlyph` maps lowercase to uppercase glyph
- [x] `getVectorGlyph` returns `?` fallback for any unsupported character
- [x] Space glyph has advance width but zero polylines
- [x] All supported glyphs have at least 2 points per polyline
- [x] All glyph coordinates are finite numbers
- [x] `createOutlineTextTemplate` creates stones for single-character text
- [x] `createOutlineTextTemplate` creates stones for multi-character text (SMOOCH)
- [x] Lowercase input maps to uppercase glyphs (stone count equal)
- [x] Multiline text lays glyphs on separate rows
- [x] Center / right alignment shifts stone positions
- [x] `fontSizeMm` scales stone positions
- [x] `targetWidthMm` / `targetHeightMm` scale the final layout
- [x] `densityPreset` and `customSpacingMm` pass through to stone spacing
- [x] Template metadata includes `generatedBy`, `text`, `fontMode`, `fontSizeMm`, `align`, spacing fields
- [x] Throws on empty id / name / text
- [x] Throws on invalid `fontSizeMm` (zero, negative, non-finite)
- [x] Generated template passes `validateRhinestoneTemplate` (no collision errors)
- [x] Generated template passes `checkExportReadiness`
- [x] Exports through `createBasicSvgExport` without error
- [x] Exported SVG contains `<circle>` elements
- [x] Exported SVG does not contain `<image>` tags
- [x] Output is deterministic (identical input → identical stone positions)
- [x] `OutlineTextGenerator` component renders and generates valid SVG
- [x] All engine outline logic in `src/lib/rhinestone-engine/textOutline/`
- [x] No TTF/OTF parsing, no font file upload, no system font access
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass

---

## Phase 13 — Manual Stone Editor v1 (Implemented)

- [x] `addStoneToTemplate` adds stone, rejects duplicate ids, rejects invalid holes
- [x] `removeStoneFromTemplate` removes stone, throws for missing id
- [x] `generateManualStoneId` returns deterministic `manual-N` ids
- [x] `createStoneAtPoint` uses recommended hole diameter
- [x] `undoEdit`/`redoEdit` restore previous/next states immutably
- [x] `commitEditedTemplate` pushes present to past, clears future
- [x] Edited templates carry `edited: true` and `editMode` metadata
- [x] Edited templates pass `validateRhinestoneTemplate` (when no collisions)
- [x] Edited templates pass `checkExportReadiness` (when valid)
- [x] Exported SVGs contain real `<circle>` elements, no `<image>`
- [x] `ManualStoneEditor` component uses all engine editor functions
- [x] All editor math in engine; React only manages state
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass

---

## Phase 12 — Text Layout v2 (Implemented)

- [x] `calculateDotMatrixTextLayoutBounds` returns correct bounds for single and multiline text
- [x] `alignDotMatrixLine` returns 0 for left, correct offsets for center/right
- [x] `computeTextScaleFactors` preserves aspect ratio and stretches independently
- [x] `createDotMatrixTextTemplate` supports `targetWidthMm`, `targetHeightMm`, `align`, `letterSpacingColumns`, `lineSpacingRows`
- [x] Invalid target dimensions throw with clear errors
- [x] Scaled templates pass `validateRhinestoneTemplate` and `checkExportReadiness`
- [x] Template metadata includes layout fields
- [x] `TextMatrixGenerator` exposes layout controls (alignment, spacing, sizing)
- [x] Physical text size shown in stats
- [x] Text layout logic lives in the engine
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass

---

## Phase 11 — SVG Cleanup + Logo Quality v1 (Implemented)

- [x] `removeDuplicatePolylinePoints` removes exact and near-duplicate consecutive points
- [x] `removeShortPolylineSegments` removes intermediate points creating short segments
- [x] `simplifyPolyline` (RDP) reduces collinear point count; preserves endpoints
- [x] `removeTinyPolylines` removes polylines below minimum arc length
- [x] `cleanupPolylines` throws if all polylines removed
- [x] Cleanup does not mutate input
- [x] `svgStringToPolylines` runs cleanup by default
- [x] Cleanup can be disabled with `cleanup: false`
- [x] Cleaned templates pass `validateRhinestoneTemplate` and `checkExportReadiness`
- [x] Exported SVGs contain real `<circle>` elements, no `<image>`, no raw SVG content
- [x] `SvgUploadGenerator` exposes cleanup controls
- [x] All cleanup logic in the engine
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass

---

## Phase 10 — Calibration Workflow v1 (Implemented)

- [x] `createCalibrationOverrideSet` validates holeDiameterMm > 0 and throws on invalid values
- [x] `getCalibratedHoleDiameter` returns override when present, falls back when not
- [x] `applyCalibrationOverridesToTemplate` updates matching stone sizes, leaves others unchanged
- [x] Original template is never mutated
- [x] Calibrated stones have `calibrated: true`, `calibratedHoleDiameterMm`, `originalHoleDiameterMm` in metadata
- [x] Exported SVG uses calibrated hole radius (not default)
- [x] Output is deterministic
- [x] `CalibrationWorkflow` component shows per-size inputs, comparison table, calibrated preview
- [x] All calibration math lives in the engine
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass

---

## Phase 9 — Cricut Test Pack (Implemented)

- [x] `createCricutTestPack()` returns 4 templates: grid, SMOOCH text, calibration, diamond
- [x] Every template has `unit: 'mm'` and at least one stone
- [x] Every template passes `validateRhinestoneTemplate` and `checkExportReadiness` (no errors)
- [x] Every `recommendedFilename` ends in `.svg`
- [x] Exported SVGs contain `<circle>` elements, no `<image>`
- [x] Pack is deterministic
- [x] `CricutTestPack` component shows stone count, physical size, readiness status per item
- [x] Download button gated by readiness
- [x] Stone size selector changes grid, text, and diamond templates
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass

---

## Phase 8 — Export Readiness / Cricut QA v1 (Implemented)

- [x] `checkExportReadiness` returns `ready: false` for empty, non-mm, or colliding templates
- [x] `checkExportReadiness` returns errors for duplicate IDs, invalid holes, collisions
- [x] `checkExportReadiness` returns calibration warning (not error) — template stays ready
- [x] `checkExportReadiness` returns physical size warnings for out-of-range dimensions
- [x] `checkExportReadiness` returns `PHYSICAL_SIZE` info issue always
- [x] `minStoneCount` option produces error when count is too low
- [x] Summary includes `stoneCount`, `widthMm`, `heightMm`, `materialProfileId`, `cutter`, `stoneSizes`, `hasCollisions`
- [x] Result is deterministic
- [x] Grid, text, and polyline templates pass readiness with no errors
- [x] `ExportReadinessPanel` shows ready/not ready status with errors, warnings, info
- [x] All four generators and `CalibrationSheetGenerator` render `ExportReadinessPanel`
- [x] `SvgExportActions` is disabled when `readiness.ready === false`
- [x] Calibration sheet download is never blocked by calibration warning alone
- [x] Readiness math lives in engine, not duplicated in React
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass

---

## Phase 7 — Stone Spacing / Density Controls v1 (Implemented)

- [x] `standard` preset equals recommended center distance
- [x] `safe` preset is recommended + 0.25 mm
- [x] `dense` preset is recommended − 0.15 mm, clamped to `minCenterDistanceMm`
- [x] `loose` preset is recommended + 0.5 mm
- [x] `custom` preset uses caller-supplied value, validated against `minCenterDistanceMm`
- [x] `custom` with missing value throws; `custom` below min throws
- [x] Dense never produces spacing below `minAllowedSpacingMm` (safe to cut)
- [x] `createDotMatrixTextTemplate`, `createPolylineRhinestoneTemplate`, `createStoneGridTemplate` all support `densityPreset`
- [x] Templates with any preset pass `validateRhinestoneTemplate`
- [x] `densityPreset` and `resolvedSpacingMm` recorded in template metadata
- [x] All four UI components have density preset dropdown and custom spacing input
- [x] Density math is in the engine — React only passes the preset name and optional value
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass

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
