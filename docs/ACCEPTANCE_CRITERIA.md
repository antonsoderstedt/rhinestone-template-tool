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
