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
