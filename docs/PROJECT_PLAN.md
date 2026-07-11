# Project Plan — Rhinestone Template Tool

## Phases

### Phase 0 — Foundation (Current)
- [x] Scaffold Next.js project
- [x] Create documentation and folder structure
- [ ] Define TypeScript types for the engine
- [ ] Write unit tests for geometry utilities

### Phase 0.5 — Template Creation and Validation
- [x] `createRhinestoneTemplate` — validated manual template creation
- [x] `createStoneGridTemplate` — deterministic rectangular grid helper
- [x] `validateRhinestoneTemplate` — pre-export safety check (unit, ids, hole diameters, collisions)

### Phase 1 — Engine Core
- [ ] Implement hex grid placement algorithm (path-fill variant)
- [x] Implement collision detection
- [x] Implement stone size profiles (SS6–SS12)
- [ ] Implement path-fill algorithm (place stones inside an arbitrary SVG path)
- [x] Export engine as pure functions with no UI dependency

### Phase 2 — Text Input
- [ ] Render text to SVG path using a web font
- [ ] Pass path to engine fill algorithm
- [ ] Preview in-browser
- [ ] Download Cricut-ready SVG

### Phase 1.5 — First UI: Manual Grid Generator (Implemented)
- [x] `ManualGridGenerator` React component (`app/components/ManualGridGenerator.tsx`)
- [x] Uses `createStoneGridTemplate` from the engine — no duplicated logic in the component
- [x] Runs `validateRhinestoneTemplate` before export — shows validation status in UI
- [x] Exports via `createBasicSvgExport` — Cricut-safe SVG, mm dimensions, no rasterization
- [x] Download button (Blob + `URL.createObjectURL`)
- [x] Copy SVG button (Clipboard API)
- [x] Deterministic filename: `rhinestone-grid-{size}-{cols}x{rows}.svg`
- [x] Template stats: stone size, count, columns, rows
- [x] SVG preview inline

### Phase 9 — Cricut Test Pack + Sprint Polish (Implemented)
- [x] `createCricutTestPack(options?)` — four-template starter pack (grid, SMOOCH, calibration, diamond)
- [x] `CricutTestPack` React component with stone size selector and per-item download/copy
- [x] Home page restructured: Test Pack first, then generators
- [x] Hero explains the recommended first-use workflow
- [x] All test pack templates pass `checkExportReadiness` without blocking errors
- [x] Test pack is deterministic and fully tested

### Recommended first physical test sequence
1. Download the Test Pack (SS10 or your target size)
2. Cut the **Calibration Sheet** on a scrap of Magic Flock — find the right hole diameter
3. Cut the **SS10 Grid** — verify stone seating and spacing
4. Cut **SMOOCH** — check dot-matrix text density
5. Cut the **Diamond** — verify outline path accuracy at sharp corners
6. After all four pass physical validation, proceed to production designs

### Phase 8 — Export Readiness / Cricut QA v1 (Implemented)
- [x] `checkExportReadiness(template, options?)` — single engine function for all export readiness checks
- [x] Errors: invalid unit, no stones, stone count below minimum, duplicate IDs, collisions
- [x] Warnings: calibration required, physical size out of range, unsupported stone size
- [x] Info: physical size summary (always present)
- [x] `ExportReadinessPanel` React component — renders result, never recomputes logic
- [x] All four generators (text, polyline, SVG upload, manual grid) use `ExportReadinessPanel`
- [x] `CalibrationSheetGenerator` shows readiness (calibration warning expected and does not block download)
- [x] `SvgExportActions` disabled when `readiness.ready === false`
- [x] Readiness logic lives entirely in the engine
- [ ] Per-stone QA (deferred)
- [ ] Advanced Cricut mat size limits as default options (deferred)

### Phase 7 — Stone Spacing / Density Controls v1 (Implemented)
- [x] `getDensitySpacing` — safe/standard/dense/loose/custom presets with clamping
- [x] `getDensityPresetOptions` — returns labelled preset list for UI rendering
- [x] `createDotMatrixTextTemplate` supports `densityPreset` + `customSpacingMm`
- [x] `createPolylineRhinestoneTemplate` supports `densityPreset` + `customSpacingMm`
- [x] `createStoneGridTemplate` supports `densityPreset` + `customSpacingMm`
- [x] All four UI components (text, polyline, SVG upload, manual grid) have density controls
- [x] Density math lives in the engine; React only passes preset name and value
- [x] Templates with dense spacing still pass `validateRhinestoneTemplate` (never below min)
- [x] resolvedSpacingMm and densityPreset recorded in template metadata
- [ ] Per-region density controls (deferred)
- [ ] Manual stone editing (deferred)

### Phase 6 — Physical Size Controls v1 (Implemented)
- [x] `calculatePolylineBounds` — bounding box of all points across all polylines
- [x] `scalePolylinesToWidth` / `scalePolylinesToHeight` — uniform scaling helpers
- [x] `scalePolylinesToFit` — general fit-to-box with optional aspect ratio control
- [x] `getTemplateStoneBounds`, `getTemplatePhysicalSize`, `estimateTemplatePhysicalSizeFromStones`
- [x] `createPolylineRhinestoneTemplate` supports `targetWidthMm`, `targetHeightMm`, `preserveAspectRatio`
- [x] `SvgUploadGenerator`: target width/height inputs + preserve aspect ratio
- [x] `PolylineLogoGenerator`: target width/height inputs (default 80mm) + preserve aspect ratio
- [x] Both UIs show estimated physical output size in stats
- [ ] Physical size normalization from SVG viewBox/width/height (deferred)
- [ ] Cricut calibration scale compensation (deferred)

### Phase 5 — SVG Upload v2: Curves + Transforms (Implemented)
- [x] Cubic Bezier C/c, smooth cubic S/s, quadratic Q/q, smooth quadratic T/t curve flattening
- [x] `curveSegments` option (default 24) for configurable curve smoothness
- [x] Transform support: translate, scale, rotate(angle), rotate(angle,cx,cy), matrix
- [x] Arc A/a still throws with clear message (expand arcs before upload)
- [x] `svgUnits.ts`: `parseSvgViewBox`, `getSvgRootAttributes` groundwork
- [x] Additional safety patterns: `<style`, `data:`, `@import`
- [x] `SvgUploadGenerator` messaging updated for v2 capabilities
- [ ] Arc support (deferred — requires parametric arc-to-Bezier conversion)
- [ ] viewBox-based physical scale normalization (deferred)
- [ ] Nested group flattening (deferred)

### Phase 4 — SVG Upload v1: Safe Primitive Parsing (Implemented)
- [x] `validateSafeSvgInput` — blocks script, foreignObject, image, href, javascript: patterns
- [x] `extractSvgElements` — extracts line/polyline/polygon/rect/circle/ellipse/path elements
- [x] `svgStringToPolylines` — converts safe SVG primitives to Polylines
- [x] Path support: M/m/L/l/H/h/V/v/Z/z (Bezier/arc commands throw with clear error)
- [x] Transform attributes throw with clear message
- [x] `SvgUploadGenerator` React component — raw uploaded SVG is never rendered
- [ ] Full path flattening (Bezier curves) — deferred
- [ ] SVG transform resolution — deferred
- [ ] Complex SVG parsing (nested groups, use, symbols) — deferred

### Phase 3 — SVG/Logo-to-Rhinestones Foundation v1: Polyline Sampling (Implemented)
- [x] `getPolylineLength`, `samplePolylineBySpacing`, `normalizePolylineInput` in `path/polyline.ts`
- [x] `createPolylineRhinestoneTemplate` — polylines → RhinestoneTemplate via engine pipeline
- [x] Open and closed polylines supported
- [x] Deterministic stone IDs and positions
- [x] `PolylineLogoGenerator` React component using shared preview/export components
- [x] Demo shapes: diamond, triangle, rectangle, zigzag
- [ ] Raw SVG upload (deferred — requires SVG parsing and path extraction)
- [ ] SVG path-fill (deferred — requires point-in-path algorithm)
- [ ] Outline vs fill mode (deferred)

### Phase 2 — Text-to-Rhinestones v1: Dot Matrix (Implemented)
- [x] Built-in 5×7 dot-matrix font (`dotMatrixFont.ts`) — A–Z, 0–9, space, . , ! ? - _
- [x] `createDotMatrixTextTemplate(options)` — text → RhinestoneTemplate via engine pipeline
- [x] Multiline text support (split on `\n`)
- [x] Deterministic stone IDs and positions
- [x] `TextMatrixGenerator` React component using shared preview/export components
- [x] Home page: Dot Matrix Text section added above the grid generator
- [ ] Font-outline vector text (deferred — requires path-fill algorithm)
- [ ] Custom font upload (deferred)

### Phase 1.7 — Shared SVG UI Components (Implemented)
- [x] `SvgPreview` — safe inline SVG preview (`dangerouslySetInnerHTML` on engine-only output)
- [x] `SvgExportActions` — Download + Copy buttons with disabled/error states
- [x] `TemplateStatsCard` — compact stats display (stone count, size, material, etc.)
- [x] `ValidationIssuesList` — validation status + per-issue list with stone IDs
- [x] `ManualGridGenerator` refactored to use all four shared components
- [x] `CalibrationSheetGenerator` refactored to use `SvgPreview`, `SvgExportActions`, `TemplateStatsCard`
- [x] Future text/SVG/image generators should reuse these same components

### Phase 1.6 — Calibration Sheet UI (Implemented)
- [x] `CalibrationSheetGenerator` React component (`app/components/CalibrationSheetGenerator.tsx`)
- [x] Uses `createDefaultMagicFlockCalibrationSheet()` from the engine
- [x] Exports via `createBasicSvgExport()` — same Cricut-safe pipeline as production templates
- [x] Shows stats: material, cutter, stone sizes, total hole count
- [x] Shows explanation of the four diameter variants and how to use them
- [x] Download button (`magic-flock-calibration-sheet.svg`)
- [x] Copy SVG button
- [x] Prominent warning that values are provisional until physically tested
- [x] Calibration UI is on the home page alongside the grid generator

### Phase 3 — SVG/Logo Input
- [ ] Accept user-uploaded SVG
- [ ] Parse and normalize input SVG paths
- [ ] Pass paths to engine fill algorithm
- [ ] Preview and download

### Phase 4 — Calibration
- [ ] Build calibration workflow
- [ ] Generate calibration cut sheet
- [ ] Allow per-material offset adjustment
- [ ] Save calibration profiles

### Phase 5 — Raster Image Input (Post-MVP)
- [ ] PNG/JPG upload
- [ ] Auto-trace to vector paths
- [ ] Pass to engine fill algorithm

---

## Development Rules

1. **Engine first.** No UI work until the engine is tested.
2. **Tests before integration.** Every engine function must have passing unit tests before it is wired to the UI.
3. **Deterministic output.** Same input always produces the same SVG output.
4. **No rasterization.** The SVG export pipeline must never involve canvas or bitmap rendering.
5. **Physical accuracy.** All internal calculations use millimeters.

---

## Milestones

| Milestone | Description | Status |
|-----------|-------------|--------|
| M0 | Project scaffold + docs + folder structure | In Progress |
| M1 | Engine core (types, geometry, collision) | Pending |
| M2 | Text input → SVG output | Pending |
| M3 | SVG/Logo input → SVG output | Pending |
| M4 | Calibration workflow | Pending |
| M5 | Raster image input | Pending |
