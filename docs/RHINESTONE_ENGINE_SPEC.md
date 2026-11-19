# Rhinestone Engine Specification

## Purpose

The rhinestone engine is the core algorithmic component of the tool. It takes a set of SVG paths (in millimeter coordinates) and a stone size, and returns the exact positions of every rhinestone that fits inside those paths without overlapping.

The engine is a **pure TypeScript library** with no UI, no DOM, and no external runtime dependencies. It must be independently testable.

---

## Stone Sizes

Stone sizes are `SS6`, `SS8`, `SS10`, `SS12`, `SS16`, `SS20`. Physical stone
diameter is generic per size (`profiles/stoneSizes.ts`); the **hole diameter**
actually cut is material-specific and lives on the material profile's
`holePresets` (see `MAGIC_FLOCK_HOLE_PRESETS` in
`profiles/materialProfiles.ts` and ADR 0004) — do not hand-maintain a second
copy of these numbers here. Call `getRecommendedHoleDiameter(stoneSize, materialProfileId)`
for the current authoritative value; do not hardcode hole diameters elsewhere.

SS12 has no verified vendor source and is marked `status: 'provisional'` —
treat it as a starting point requiring physical calibration, never an
official default.

> **Hole diameter** is smaller than physical stone diameter to ensure the stone snaps in.
> **Minimum center-to-center gap** is derived dynamically — see Collision Detection below — not a fixed per-size constant.

---

## Grid Generation

Stones are placed on a **hexagonal close-pack grid** (offset rows), which maximizes fill density.

Given a stone size `s` and row height factor `h = s * sqrt(3) / 2`:

- Row spacing: `h + gap`
- Column spacing (even rows): `s + gap`
- Column spacing (odd rows): offset by `(s + gap) / 2`

The grid covers the entire bounding box of the input paths. Positions outside the paths are discarded in the filter step.

---

## Collision Detection

After grid generation, every candidate position is checked against every already-accepted position. A position is accepted only if:

```
distance(candidateCenter, acceptedCenter) >= holeRadiusA + holeRadiusB + minimumEdgeSpacingMm
```

This is `getMinimumCenterDistance(holeRadiusAMm, holeRadiusBMm, materialProfileId)` in
`profiles/materialProfiles.ts` — the hard physical safety floor, used by collision
detection, automatic placement, and export validation. It is symmetric and handles
mixed stone sizes correctly (e.g. an SS6 hole next to an SS20 hole). `minimumEdgeSpacingMm`
(0.508 mm for Magic Flock) is defined per material profile (see `docs/MATERIAL_PROFILES.md`
and ADR 0004). `getRecommendedCenterDistance` adds the profile's `spacingSafetyMarginMm`
on top of this floor for a comfortable default — always ≥ the physical minimum.

Collision detection must run even after path filtering, because grid positions near path boundaries may be closer than the grid spacing suggests when both paths and offset grids are involved.

### Gap semantics

The engine distinguishes between true overlap and a tight but non-overlapping gap:

- `STONE_OVERLAP`: edge gap < 0 mm. Always a blocking error.
- `STONE_TIGHT_GAP`: 0 <= edge gap < `minimumEdgeSpacingMm`. A blocking error for user-generated templates, a warning for vendor-authored templates (`template.source = 'vendor'` or metadata source `vendor`).

The measured gap is computed in millimeters from the center distance of the two holes:

```
measuredGapMm = centerDistanceMm - (radiusA + radiusB)
```

This value is carried on validation issues and surfaced in user copy as `"Stones 12 and 13 are 0.35 mm apart (minimum 0.51 mm)"`.

---

## Path Fill Filter

A candidate position (center point) is included in the output if and only if:

1. The center point is **inside** at least one of the input paths.
2. The full circle (center ± stoneRadius) does not extend outside any containing path by more than the allowed bleed margin.
3. No collision with an already-accepted position.

### Point-in-Path Algorithm

Use the **even-odd ray casting algorithm** applied to the path's SVG path data converted to a sequence of line segments and Bézier curves. The test must handle:
- Closed subpaths
- Compound paths (multiple subpaths = holes)

---

## Calibration Offsets

The material profile includes a `calibrationOffset` object:

```typescript
interface CalibrationOffset {
  holeDiameterAdjustment: number;  // mm, positive = larger hole
  spacingAdjustment: number;        // mm, positive = more gap
}
```

These offsets are applied before grid generation and collision detection. They are derived from a physical calibration print (see `docs/CALIBRATION_PLAN.md`).

---

## Determinism Guarantee

The engine must produce **byte-identical output** for identical inputs. This means:
- No `Date.now()`, `Math.random()`, or non-deterministic iteration.
- Positions in the output array are always sorted by `(y, x)` in ascending order.
- Floating point operations use a fixed precision (4 decimal places in mm).

---

## Module Boundaries

```
/src/lib/rhinestone-engine/
  index.ts              — Public API (re-exports only)
  types/                — Interfaces, enums, constants
  profiles/             — Stone size data, material profiles
  geometry/             — Grid gen, collision, path fill, point-in-path
  export/               — SVG construction (circles → SVG string)
  calibration/          — Calibration sheet generator
```

No module in `/src/lib/rhinestone-engine/` may import from `/app/`.

## Export QA Module

### Why export readiness is required before production cutting

A template that fails readiness checks will produce a cut file that:
- Has overlapping holes (tears the flock)
- Has zero stones (cuts nothing)
- Uses the wrong coordinate unit (wrong physical scale)
- Has collisions that split the material bridge between holes

`checkExportReadiness` catches all of these problems before the SVG is exported.

### `checkExportReadiness(template, options?)`

Checks a `RhinestoneTemplate` against the material profile and physical constraints.

**Errors** (block export — `ready = false`):
- `INVALID_UNIT`: unit is not `"mm"`
- `NO_STONES`: template is empty
- `INSUFFICIENT_STONES`: fewer than `minStoneCount`
- Validation errors from `validateRhinestoneTemplate` (duplicate IDs, invalid hole sizes, `STONE_OVERLAP`, `STONE_TIGHT_GAP` for user-generated templates, legacy `STONE_COLLISION` alias)

**Warnings** (do not block export):
- `REQUIRES_CALIBRATION`: material profile needs physical calibration
- `EXCEEDS_MAX_WIDTH`/`BELOW_MIN_WIDTH`: physical size out of range
- `EXCEEDS_MAX_HEIGHT`/`BELOW_MIN_HEIGHT`: same for height
- `UNSUPPORTED_STONE_SIZE`: stone size not in material profile's supported list
- `HIGH_STONE_COUNT`: more than `HIGH_STONE_COUNT_THRESHOLD` (1500) stones — slow to cut, weed and set
- `EXCEEDS_MAT_SIZE`: the physical size does not fit the largest Cricut mat (12 × 24 in, usable 292.1 × 596.9 mm) in either orientation. A design that fits a 12 × 24 mat but not a 12 × 12 one gets no readiness issue; the export dialog and the Quick fixes panel say which mat it needs
- `STONE_TIGHT_GAP` on vendor-authored templates

**Info** (always present):
- `PHYSICAL_SIZE`: estimated output dimensions including hole radii

The summary object includes `widthMm`, `heightMm`, `stoneCount`, `materialProfileId`, `cutter`, `stoneSizes`, `hasCollisions`, `hasCalibrationWarning`.

### Mat fit, stone estimate and spacing auto-fix (Phase 12, ADR 0016)

All pure, deterministic and in millimetres.

- `sizing/matFit.ts`: `getMatFit(widthMm, heightMm)` → `fits-12x12 | fits-12x24 | too-large | unknown` (both orientations tried, rotation reported);
  `getFitToMatScale(widthMm, heightMm, mat, marginFraction?)` → the largest uniform scale ≤ 1 at which the size fits `'12x12'` or `'12x24'`.
  Stones are **not** squeezed closer to fit a mat: the UI regenerates the design smaller by changing the producing tool's target size.
- `estimate/stoneEstimate.ts`: `estimateStoneUsage(stones, { wastePercent = 10, packSizeStones = 144, pricePerPackBySize })` →
  per stone size: count, count plus spare (rounded up), gross (2 decimals), whole packs and cost. A size with no price has no cost and
  the engine never supplies a price; `totalCost` is `null` without any price and `costComplete` is false while some sizes are unpriced.
- `spacing/autoFix.ts`: `autoFixSpacing(template, { minGapMm })` runs `resolveStoneSpacing` (strategy `nudge`) on an existing
  template and reports `issuesBefore`, `movedStoneCount`, `removedStoneCount`, `maxDisplacementMm` and `remainingIssues` from a fresh
  `validateRhinestoneTemplate`. A clean template is returned as is. Collision detection is not bypassed.

### Calibration gate and the uncalibrated override (UI contract, decision D2)

`REQUIRES_APPROVED_CALIBRATION_PROFILE` is an engine-level error, but the UI treats it as a *separate export step*, not
a design error (`summarizeExportStatus` → `needsCalibration`, `designErrors`). The Export action (`getExportGate`) behaves as follows:

- Real design errors (overlap, invalid holes, ...) always block and can never be overridden.
- When calibration is the only blocker, the user may choose **"Export anyway (uncalibrated) — I understand"**.
  This calls `createBasicSvgExport(template, { uncalibratedOverride: true })`, which adds
  `data-calibration="uncalibrated-override"` to the root `<svg>` and a note to `<desc>`. Geometry is unchanged, and the file stays
  Cricut-safe (mm size, circles only, no `<use>`, no nested `<svg>`, no opacity). The download is named `<name>-uncalibrated.svg`.
- Confidence labels are honest: the software verifies geometry only, so it reports "Design checks passed",
  "Uncalibrated defaults", "Needs review" or "Blocked" (`getExportConfidence`) — never "high confidence" for the physical cut.
- Approving a calibration profile is self-attested ("not verified by software"); the UI requires the user to confirm the
  stone fit before the Approve button is enabled.

### Calibration sheet special case

Calibration sheets intentionally trigger the `REQUIRES_CALIBRATION` warning (since calibrating IS their purpose). Because warnings do not block export (`ready = true` when only warnings exist), calibration sheet downloads are never blocked.

---

## Spacing / Density Module

### Why density controls matter

Stone spacing directly affects both material safety and visual quality:
- Too close (below `minCenterDistanceMm`): holes merge, material tears.
- Too loose: wasted material, gaps visible in the design.
- `dense` mode intentionally approaches the minimum but is **always clamped** so the output is safe to cut.
- `custom` is validated against the physical minimum before the template is created.

### `getDensitySpacing(options)`

| Preset | Spacing | Notes |
|--------|---------|-------|
| `safe` | recommended + 0.25 mm | Conservative extra gap |
| `standard` | recommended center distance | Default |
| `dense` | recommended − 0.15 mm, clamped to `minCenterDistanceMm` | If clamped, `warning` is set |
| `loose` | recommended + 0.5 mm | Open/decorative designs |
| `custom` | caller-supplied | Validated against `minCenterDistanceMm`; throws if too small |

The `recommendedCenterDistanceMm` is `minCenterDistanceMm + spacingSafetyMarginMm` (from the material profile). The `minAllowedSpacingMm` is just `minCenterDistanceMm` (the bare physical minimum).

### Template metadata

When a density preset is used, the template metadata includes:
- `densityPreset`: the preset name
- `resolvedSpacingMm`: the actual spacing used
- `densityWarning`: present only if dense was clamped

For spacing auto-fixes, `resolveStoneSpacing(template, { minGapMm, strategy: 'nudge' })` returns a new template with deterministic metadata:

- `resolvedSpacingMm`
- `spacingStrategy`
- `movedStoneCount`
- `removedStoneCount`
- `maxDisplacementMm`
- `resolutionPasses`
- `tooDenseForStoneSize`

### Rhinestone font scale (`rhinestoneFont/glyphExtraction.ts`, ADR 0018)

`layoutRhinestoneFontText` converts font units to millimetres with `scale = targetStoneSizeMm / nativeDiameter`, where
`nativeDiameter = measureNativeStoneDiameterFontUnits(font, text)`: the median diameter of the circular contours of the glyphs of
the typed text. The stones the font draws therefore get exactly the target diameter, and the spacing between stones, advance
widths and line height scale with them, so a font designed with separate stones stays separate. TRW Clean Stone's 72 font units
is used only when the text has no measurable stone.

### `enlargeToCuttableSpacing(template, { minGapMm })` (stone fonts, ADR 0018)

Vendor rhinestone fonts are often artwork made of dots that overlap on purpose, so the holes of a template made from them
would merge and cannot be cut. `hasOverlappingStones(stones)` detects this. `enlargeToCuttableSpacing` then enlarges the
whole layout, about its top-left corner, by `scale = max(1, (maxHoleDiameter + minGapMm) / p5NearestNeighbour * 1.002)`
(the 5th percentile of each stone's nearest-neighbour distance, so one odd pair does not blow the design up), keeps every stone
and every hole size, and finally runs `thinStonesToSpacing` to drop the few stones still closer than `minGapMm` (walking the
stones in their original order, keeping a stone only if it is far enough from all kept ones). A layout with no overlaps is
returned unchanged (same object, `scale` 1). The result records `metadata.enlargedByFactor`. Pure and deterministic.
It is **never applied automatically**: stone fonts are shown as drawn. The editor offers it as a user-chosen, undoable quick fix
("Enlarge ×N to make cuttable") when a dry run gives a factor of at least 1.3. `createRhinestoneFontTemplate` is unchanged.
TRW Clean Stone, whose stones do not overlap, is unaffected.

### `resolveStoneSpacing` final algorithm

1. Sort stones in stable order (`id`, then `y`, then `x`).
2. Build a spatial hash grid and find violating pairs (`edgeGapMm < minGapMm`) in O(n)-style neighborhood scans.
3. Run iterative relaxation (max 500 passes):
   - For each violating pair, compute the separation direction.
   - Accumulate displacement vectors for both stones.
   - Apply all displacement vectors simultaneously.
   - Identical centers use a deterministic direction derived from stone IDs.
4. If violations remain after the pass cap, remove the lesser stone for each remaining pair as a last resort (`remove-lesser` fallback).

The resolver is pure, deterministic, and idempotent. A valid input returns unchanged coordinates.

### Editor application scope

Automatic spacing resolution is applied only to generated templates:

- text (outline + dot-matrix)
- artwork fill (`svg`)
- SVG alphabet text (`svg-alphabet`)
- letter stencil (`letter-stencil`)

Automatic spacing resolution is intentionally **not** applied to:

- `grid` tool output
- `template-import` output
- vendor-authored templates (`source: 'vendor'`)

---

## Sizing Module

### Why physical size matters

An uploaded SVG or polyline may have arbitrary coordinate values — user units with no defined physical scale. Without scaling, a 10-unit-wide SVG would place stones at 10mm spacing, a 1000-unit-wide SVG at 1000mm. Physical size controls allow the user to say “make this design 80mm wide” before stones are sampled.

### `calculatePolylineBounds(polylines)`

Returns the axis-aligned bounding box of all points across all polylines in mm.

### `scalePolylinesToFit(polylines, options)`

Scales all polylines to fit a target physical size:

- Only `targetWidthMm`: scale both X and Y uniformly to hit the target width.
- Only `targetHeightMm`: scale both X and Y uniformly to hit the target height.
- Both + `preserveAspectRatio: true` (default): scale by the smaller factor (no distortion).
- Both + `preserveAspectRatio: false`: scale X and Y independently (stretches to fill).
- After scaling, the top-left is moved to (`originXmm`, `originYmm`) (default 10, 10).

Input polylines are never mutated. Output is a new array with rounded (4dp) coordinates.

### `getTemplatePhysicalSize(template)`

Returns `{ widthMm, heightMm }` measured from stone hole circles (includes radius). This is an estimate — actual cut dimensions depend on calibration.

### Split module: `planSplitForMat(template, mat, options?)` and `buildPartTemplate(template, plan, part)`

A design that does not fit one cutting mat is cut in parts. Cricut usable areas: 12 × 12 in = 292.1 × 292.1 mm, 12 × 24 in =
292.1 × 596.9 mm (the caller subtracts the export padding on each side, so the exported file, not just the stones, fits).

- **A stone is never cut.** Each stone goes whole to exactly one part, the side its centre is on. The union of all parts is
  exactly the input stones, each once; no stone is added, moved or resized.
- **Seams run between stones.** Along an axis the seam is searched in the window `[lo + (max − rMax) / 2, lo + max − rMax]`
  (`lo` = start of the remaining stones, `max` = mat length on that axis, `rMax` = the largest stone radius) in steps of
  0.25 mm; the position crossed by the fewest circles wins, and the farthest position that no circle touches ends the search,
  so there are as few parts as possible. Seam crossings (circles a seam passes through, kept whole on one side) are reported.
- **Order:** columns by X first, then rows by Y within each column. Both orientations of the mat are tried; the one with fewer
  parts, then fewer crossings, wins. A part that only fits turned 90° reports `needsTurn`.
- **Every part fits the mat**, radii included. If the stones are larger than the mat can hold (`maxLen <= 2 × rMax`), the plan
  reports `splittable: false`. A design that already fits returns one part and `fitsWhole: true`. An empty template returns no
  parts.
- Pure and deterministic: millimetres, no randomness, no clock. Cut shapes belong to the whole design and are dropped from the
  parts (the UI says so).
- Each part keeps the original coordinates, so its offset from the design's top-left is `part.minX/minY − design minX/minY`;
  the app writes these offsets, the part sizes and a "turn 90°" hint into `<name>-layout.txt` inside the zip.

---

## Fill Mode Module (v1)

### Overview

Fill Mode places stones inside closed polygon shapes using a deterministic grid.
Three modes are available:
- `'outline'` (default): stones along polyline paths (existing behaviour)
- `'fill'`: stones inside closed shapes only
- `'outline-fill'`: both outline and fill, deduplicated with a global collision filter

Fill only works well on **closed** polylines (`closed: true`). Open polylines are silently
skipped for fill generation.

### Why fill output needs export readiness validation

Fill stones are generated from a regular grid — not from physical measurements. The grid
spacing uses the same density presets as outline mode, but the collision filter is a
greedy Euclidean pass, not a physical cut simulation. Export readiness validation catches
any residual overlaps and flags templates with too few or too many stones.

### `pointInPolygon(point, polygonPoints)`

Ray-casting (Jordan curve theorem) implementation. Deterministic, no randomness.
Returns `true` for strictly-inside points. Boundary behaviour is unspecified.

### `generateFillPointsForClosedPolyline(polyline, options)`

Candidates are placed on a regular grid starting at (bounds.minX + spacing/2, bounds.minY + spacing/2).
Each candidate is tested with `pointInPolygon`. Optional `insetMm` applies an additional edge-distance filter.

Patterns:
- `'grid'`: uniform rows and columns
- `'offset-grid'`: every odd row is shifted right by spacing/2 for denser, more natural coverage

### `createPolylineFilledRhinestoneTemplate(options)` pipeline

```
For 'outline':      → createPolylineRhinestoneTemplate (unchanged)
For 'fill':         → generateFillPointsForClosedPolylines
                    → stone id: {size}-fill-f{N}
                    → global greedy collision filter
                    → createRhinestoneTemplate
For 'outline-fill': → createPolylineRhinestoneTemplate (outline stones)
                    → generateFillPointsForClosedPolylines (fill stones)
                    → combine (outline first)
                    → global greedy collision filter
                    → createRhinestoneTemplate
```

### Cross-mode collision filter

Same algorithm used in `createOutlineTextTemplate`: O(n²) greedy pass,
keeps each stone only when its centre is ≥ holeDiameterMm from all kept stones.
Outline stones have priority (they come first in the combined array).

### Future phases

- Better edge inset (insetMm ≈ holeDiameterMm/2)
- Hole-aware fill (avoid placing fill stones over existing holes)
- Manual fill cleanup tool
- Advanced packing: hex grid, circular offset
- Fill for non-convex polygons via winding-number rule

---

## Font Outline Text Module (v1 — Font Outline Foundation)

### Font coverage (`textOutline/fontLoader.ts`, ADR 0017)

`loadOutlineFont(fontId, options?)` parses a font once (cached) and checks coverage on every call:

- Always required: `A–Z a–z 0–9`. A font without them is broken and is rejected.
- Extended set `Å Ä Ö å ä ö` and ` .,!?-_`: required by default (HTV keeps this rule), but with
  `allowMissingExtendedCharacters: true` (used by `createOutlineTextTemplateAsync`) a font that lacks them still loads.
- `findUnsupportedCharacters(font, text)` lists the characters of `text` with no glyph (whitespace ignored).
  `createOutlineTextTemplateAsync` throws `Font X has no glyph for: … Remove … from the text or choose another font.` when the typed
  text needs a glyph the font lacks; text the font can draw is generated normally.

### Why TTF/OTF is deferred

Real font parsing requires either shipping a large WebAssembly binary (HarfBuzz ~2MB)
or a JavaScript font parser. Both increase bundle size and introduce file-upload
attack surface. The built-in vector font proves the complete end-to-end pipeline
(outline → polyline → stones → validated SVG) without any dependency risk.

Future phases: real font parsing, font upload, fill mode, centerline mode, better
kerning, text warping.

### Font file integrity (`textOutline/fontInspection.ts`)

`inspectFontBytes(bytes)` is a pure check run before a font is used or added (import script, upload, `npm run audit:fonts`).
It reports: `woff-length-trailing-bytes` (header declares fewer bytes than the file has; browsers refuse it; repairable with
`repairFontBytes`, which trims to the declared length), `woff-truncated` (not repairable), `unparseable`, and `no-outlines`
(none of `A a O o 1 S` has an outline, e.g. an empty glyph table). It does not change how outlines are converted to stones;
it only decides whether a font file may enter that pipeline.

### Built-in Vector Outline Font

```
id:         built-in-vector-outline-v1
unitsPerEm: 100
glyphs:     A–Z, 0–9, space, . , ! ? - _
fallback:   ?
```

Each glyph is stored as one or more stroke `Polyline` objects in font units (0–100 per em).
Coordinate convention: x ∈ [5, 75], y ∈ [5, 90], advanceWidth ≈ 42–80 units.

Lowercase input is mapped to uppercase glyphs. Unknown characters use the `?` fallback.

### `getVectorGlyph(character)`

Lookup order: as-is → uppercased → fallback `?`.

### `createOutlineTextTemplate(options)` pipeline

```
text.split('\n')             → lines
lines[i].split('')           → characters
getVectorGlyph(char)         → VectorGlyph (font units)
glyph.polylines.map(scale)   → Polyline[] in mm  (scale = fontSizeMm / unitsPerEm)
offset by (currentX, lineY) → positioned polylines
align offset per line        → center / right shift
scalePolylinesToFit          → optional physical size scaling
createPolylineRhinestoneTemplate  → samples stones along outlines
global cross-stroke filter   → removes stones overlapping ANY previous stone
createRhinestoneTemplate     → final RhinestoneTemplate with metadata
```

### Cross-stroke collision filter

The per-polyline greedy filter in `pathTemplate.ts` prevents within-stroke collisions
but cannot prevent collisions between strokes sharing endpoints (e.g. H's spine/crossbar
junction) or between non-adjacent stones on a zigzag path (e.g. M's valley peaks).

`createOutlineTextTemplate` applies a global O(n²) greedy pass after all stones are
collected: a stone is kept only if its center is ≥ `holeDiameterMm` from every
already-kept stone.

### Metadata attached to every outline text template

```typescript
{
  generatedBy:        'createOutlineTextTemplate',
  text,
  fontMode:           'built-in-vector-outline-v1',
  fontSizeMm,
  preserveAspectRatio,
  align,
  letterSpacingMm,
  lineSpacingMm,
  // optional:
  targetWidthMm, targetHeightMm, densityPreset, customSpacingMm
}
```

### Future phases

- Real TTF/OTF font parsing (opentype.js or HarfBuzz WASM)
- Font file upload (drag-and-drop .ttf / .otf)
- Fill mode (stones fill glyph interior)
- Centerline mode (stroke centreline only)
- Better kerning / pair-adjustment tables
- Text warping / path text

---

## Manual Stone Editor Module (v1)

### Architecture

All editing logic is pure and deterministic. React state holds a `TemplateEditHistory`; each edit creates a new template via engine functions.

### Undo/Redo

```
commitEditedTemplate(history, nextTemplate)  → new history (past + present, future cleared)
undoEdit(history)                            → restores previous present; pushes current to future
redoEdit(history)                            → re-applies most-recently-undone state
```

All operations return new history objects — nothing is mutated in place.

### Stone operations

| Function | Description |
|---|---|
| `addStoneToTemplate(t, stone)` | Appends stone; throws on duplicate id, invalid dimensions |
| `removeStoneFromTemplate(t, id)` | Removes stone; throws if id not found |
| `generateManualStoneId(t, prefix?)` | Returns next `manual-N` id deterministically |
| `createStoneAtPoint(options)` | Creates a Stone at given mm coordinates (does not add it) |
| `applyTemplateEditOperation(t, op)` | Dispatches to add/remove |

### Edited template metadata

```typescript
metadata: { edited: true, editMode: 'manual-stone-editor-v1', ... }
```

### Limitations (v1)
- No drag/move
- No multi-select
- No saved editor sessions

---

## Text Layout Module (Layout v2)

### Why dot matrix text remains deterministic

Dot-matrix text uses a fixed 5×7 bitmap glyph per character. Every stone position is deterministic given the same input parameters. This makes it safe to test, reproducible, and calibration-friendly. Real font-outline text (converting vector letterforms to stone fills) requires the path-fill algorithm and is deferred.

### New layout options in v2

| Option | Description | Default |
|--------|-------------|-------|
| `align` | `left` / `center` / `right` for multiline text | `left` |
| `letterSpacingColumns` | Empty dot columns between characters | `1` |
| `lineSpacingRows` | Empty dot rows between lines | `2` |
| `targetWidthMm` | Scale text layout to this width | unset |
| `targetHeightMm` | Scale text layout to this height | unset |
| `preserveAspectRatio` | Fit inside box without distortion | `true` |

### `textLayout.ts` functions

- `calculateDotMatrixTextLayoutBounds` — returns natural bounding box (mm) of the text block
- `alignDotMatrixLine` — returns x offset (column units) for a given line alignment
- `computeTextScaleFactors` — returns `{scaleX, scaleY}` to fit text into a target box
- `scaleDotMatrixTextPoints` — applies scale factors to 2D point arrays

### Template metadata

Templates now include: `align`, `letterSpacingColumns`, `lineSpacingRows`, `resolvedTextWidthMm`, `resolvedTextHeightMm`.

---

## Polyline Cleanup Module

### Why cleanup improves rhinestone placement

SVG logos and paths converted to polylines often contain:
- Duplicate or near-duplicate consecutive points (from rasterized paths or imprecise editors)
- Very short segments (< 0.25 mm) from over-sampled curves
- Tiny polylines (< 1 mm total length) from stray marks

Without cleanup, these artifacts cause:
- Multiple stones placed at the same position (collision errors)
- Dense stone clusters at segment boundaries
- Stray single-stone polylines that look like noise in the output

### Functions

| Function | Purpose |
|---|---|
| `removeDuplicatePolylinePoints(poly, tol)` | Removes consecutive points within `tol` mm |
| `removeShortPolylineSegments(poly, min)` | Removes intermediate points creating segments < `min` mm |
| `simplifyPolyline(poly, tol)` | Ramer-Douglas-Peucker simplification |
| `removeTinyPolylines(polys, min)` | Removes polylines with arc length < `min` mm |
| `cleanupPolylines(polys, options)` | Runs full pipeline; throws if all removed |

### Defaults (when `cleanup: true` in `svgStringToPolylines`)
- `removeDuplicatePoints: true`, tolerance 0.05 mm
- `removeShortSegments: true`, min 0.25 mm
- `simplify: false`
- `removeTinyPolylines: true`, min 1 mm

**Warning:** Cleanup does not replace manual design review. Complex logos should be simplified in a vector editor before upload. Cleanup is conservative by default.

---

## SVG Parser Module (Upload v2)

### Security model

Same as v1. The uploaded SVG is NEVER rendered. It is safety-validated, parsed into internal polylines, then discarded. Three new unsafe patterns added: `<style`, `data:`, `@import`.

### Supported primitives (unchanged from v1)

line, polyline, polygon, rect, circle, ellipse — see v1 section.

### Path commands (v2 expansion)

| Command | Description |
|---------|-------------|
| M/m/L/l/H/h/V/v/Z/z | Straight lines (v1) |
| C/c | Cubic Bezier (flattened to `curveSegments` points) |
| S/s | Smooth cubic Bezier (reflected control point) |
| Q/q | Quadratic Bezier (flattened) |
| T/t | Smooth quadratic Bezier (reflected control point) |
| A/a | **Not supported** — throws with clear message asking to expand arcs |

Curve smoothness is controlled by `curveSegments` (default 24). Higher = smoother.

### Transform support (v2)

Element-level `transform` attributes are now parsed and applied:
- `translate(tx [ty])` — shifts all points
- `scale(s)` or `scale(sx, sy)` — scales from origin
- `rotate(angle)` or `rotate(angle, cx, cy)` — rotation in degrees
- `matrix(a,b,c,d,e,f)` — raw SVG matrix

Compose order: left-to-right in attribute string (same as SVG spec). Throws on `skewX`/`skewY` and malformed matrices.

### svgUnits.ts (groundwork)

Provides `parseSvgViewBox` and `getSvgRootAttributes` for reading the root SVG's `viewBox`, `width`, and `height`. These are not yet used for coordinate rescaling but provide the foundation for future physical-size normalization.

---

## SVG Import Module (v3, `svg/svgImport.ts`)

`importSvgArtwork(svgText)` reads an SVG as a viewer would, as far as artwork for stones needs, and returns `shapes` (document
order = paint order), the `viewBox`, `naturalSizeMm`, `userUnitMm` and plain-language `warnings`. `svgStringToPolylines` is a
thin wrapper that flattens the shapes to polylines (user units, one unit = one mm until the caller scales) and runs the
polyline cleanup.

- **Tree and transforms:** a tolerant tokenizer builds the element tree; the transform of every enclosing group is applied
  (`translate`, `scale`, `rotate`, `skewX`, `skewY`, `matrix`, lists). An unknown transform function is skipped with a warning.
- **`<use>` / `<defs>` / `<symbol>`:** local references (`#id`) are instanced with the use's `x`, `y` and transform; things
  only inside `defs` are not drawn; depth is limited to 8 and instances to 5,000.
- **Styles:** presentation attributes < `<style>` rules (tag, `.class`, `#id`, `tag.class`, by specificity then order) < inline
  `style`. Inherited: `fill`, `stroke`, `stroke-width`, `fill-rule`, `visibility`; `opacity` multiplies down the tree.
  Colours are normalised to `#rrggbb` (hex, rgb(), names). Gradients and patterns become one flat grey with a warning.
- **Visibility:** `display:none`, `visibility:hidden`, zero opacity, and shapes with neither a visible fill nor a stroke are
  skipped. Text is skipped with a message on how to convert it to outlines.
- **Paths:** M L H V C S Q T and elliptical arcs `A` (spec F.6, flags may be written without separators); extra pairs after
  `M` are line-tos; a subpath after `Z` starts at the previous start; a closed path that repeats its first point drops the copy.
- **Size:** `width` / `height` with units give `naturalSizeMm`; otherwise the viewBox at 96 dpi; `userUnitMm` is mm per user unit.
- **Refused (`findUnsafeSvgContent`):** `<script>`, `<foreignObject>`, `<image>`, entity declarations, event handlers,
  `javascript:`, `data:`, `@import`, any `href` or `url()` that does not start with `#`.
- Fill rule, stroke width (scaled by the transform) and opacity are kept on each shape for the colour-layer step.

### Artwork quality (`quality/artworkQuality.ts`)

`measureArtworkQuality({ polylines, stones, pitchMm })` scores a layout against its source: `areaCoverage` (share of the
even-odd silhouette within 0.75 pitch of a stone), `outlineCoverage` (share of the outline within one pitch of a stone),
`outsideStones`, `strayStones` (no neighbour within two pitches) and `minGapMm`. Pure and deterministic. The regression test
`tests/quality/` holds every generator to `tests/quality/baseline.json`; `npm run quality` writes `docs/QUALITY_REPORT.md`.

---

## SVG Parser Module (Upload v1)

### Security model

The uploaded SVG is NEVER rendered, embedded in output, or passed to `dangerouslySetInnerHTML`. It is treated as untrusted text that is validated and converted to internal polylines, then discarded.

**Blocked patterns (any match aborts processing):**
`<script`, `<foreignObject`, `onload=`, `onclick=`, `javascript:`, `href=`, `xlink:href=`, `<image`

### Supported primitives

| Element | Conversion |
|---------|------------|
| `<line>` | Open 2-point polyline |
| `<polyline>` | Open polyline |
| `<polygon>` | Closed polyline |
| `<rect>` | Closed 4-point polyline |
| `<circle>` | Closed N-point polygon approximation (default 64 segments) |
| `<ellipse>` | Closed N-point polygon approximation (default 64 segments) |
| `<path>` | Simple subpaths from M/m/L/l/H/h/V/v/Z/z only |

**Not supported in v1 (throw with clear error):**
- `transform` attribute on any element
- Bezier/arc path commands: C/c/S/s/Q/q/T/t/A/a
- Nested groups, `<use>`, `<symbol>`, `<defs>`

**Future:** full path flattening, transform resolution, compound paths.

---

## Path Module (SVG/Logo Foundation v1)

### Overview

The path module places rhinestone holes along polylines (sequences of connected straight line segments). It is the foundation for future SVG/logo-to-rhinestones features.

**Why raw SVG upload is deferred:**  
Parsing an arbitrary SVG file requires handling `<path>` d-attribute commands (M, L, C, Q, A, Z), resolving transforms, flattening groups, and handling fill vs. outline modes. This infrastructure is significant and is deferred to a future phase. Polyline input provides a clean, testable foundation without the SVG parsing complexity.

### `normalizePolylineInput(points)`

Validates and deep-clones a `PolylinePoint[]`. Throws if fewer than 2 points or if any coordinate is non-finite.

### `getPolylineLength(polyline)`

Returns the total arc length in mm. Includes the closing segment for `closed: true` polylines.

### `samplePolylineBySpacing(polyline, spacingMm)`

Walks along the polyline segments and places a sample point every `spacingMm` mm. The first point of the polyline is always included. Uses linear interpolation within segments. Output coordinates are rounded to 4 decimal places for determinism. Automatically removes a duplicate endpoint for exactly-divisible closed polylines.

### `createPolylineRhinestoneTemplate(options)`

Convert an array of `Polyline` objects to a `RhinestoneTemplate`:

1. For each polyline, validate and clone points with `normalizePolylineInput`.
2. Sample positions using `samplePolylineBySpacing`.
3. Assign each position a stone with `holeDiameterMm = getRecommendedHoleDiameter(stoneSize)`.
4. ID format: `{stoneSize.toLowerCase()}-path{N}-p{M}` (1-based).
5. Wrap in `createRhinestoneTemplate`.

**Future path modes:**
- SVG upload + path extraction from `<path>` d-attribute commands
- Path-fill: place stones inside a closed path (requires point-in-path algorithm)
- Outline vs fill selection

---

## Text Module (Text v1)

### Overview

Text-to-Rhinestones v1 uses a built-in 5×7 dot-matrix bitmap font. Each “1” pixel in a glyph row becomes a stone hole in the output `RhinestoneTemplate`. The output is then exported via `createBasicSvgExport` like any other template.

**Why font-outline conversion is deferred:**  
Path-fill (placing stones inside a closed SVG path) requires a ray-casting point-in-path algorithm that has not yet been implemented. Font-outline text would generate a path outline per character and fill it with stones. Dot-matrix text bypasses this by using a pre-defined bitmap per character.

### `getDotMatrixGlyph(character: string): DotMatrixGlyph`

Returns the 5×7 glyph for the given character. The lookup is case-sensitive; the font only contains uppercase entries. Falls back to the “?” glyph for unsupported characters.

### `createDotMatrixTextTemplate(options)`

Converts a text string to a `RhinestoneTemplate`:

1. Uppercase the text (if `uppercase: true`, the default).
2. Split on `\n` to get lines.
3. For each character in each line, look up the glyph.
4. For each `1` cell in the glyph, place a stone at the corresponding mm position.
5. Stone x = `startXmm + (charIndex * (5 + characterSpacingColumns) + col) * spacingMm`
6. Stone y = `startYmm + (lineIndex * (7 + lineSpacingRows) + row) * spacingMm`
7. Wrap in `createRhinestoneTemplate` (which validates all stones).

**Future text modes:**
- Font-outline fill: render font glyphs as SVG paths, then fill with stones using a path-fill algorithm.
- Custom font upload: allow users to upload a TTF/OTF and generate path outlines.

---

## Template Module

### `createRhinestoneTemplate(input)`

Creates a validated `RhinestoneTemplate` from explicit input. Validates all fields and throws descriptive errors for: empty id/name, duplicate stone ids, invalid hole diameters, and non-finite coordinates. The returned template always has `unit: 'mm'`.

### `createStoneGridTemplate(options)`

Generates a rectangular hex-row grid of rhinestones. Stone ids are deterministic: `${stoneSize.toLowerCase()}-r{row}-c{col}` (1-based). Hole diameter and spacing are sourced from the material profile via `getRecommendedHoleDiameter` and `getRecommendedCenterDistance`. Throws if a custom `spacingMm` would cause collisions.

---

## Validation Module

### `validateRhinestoneTemplate(template, options?)`

Runs a structured validation pass on any `RhinestoneTemplate`. Returns `{ valid: boolean, issues: TemplateValidationIssue[] }`. A template is `valid` when there are no `'error'`-severity issues.

**Why validation is mandatory before export:**  
A template with overlapping holes will tear the flock material. A template with a wrong unit will be exported at the wrong physical scale. Running `validateRhinestoneTemplate` before `createBasicSvgExport` catches these problems in software before any physical cut.

**Default checks:**
- `template.unit === 'mm'`
- Non-empty `id` and `name`
- All `holeDiameterMm > 0`
- No duplicate stone ids
- No overlapping stone circles (uses `hasCircleCollisions` from the geometry module)

Collision issues include the `stoneIds` of both offending stones for easy debugging.

---

## Calibration Module

### `createCalibrationSheet(profile, options?)`

Generates a `RhinestoneTemplate` containing rows of holes at varying diameters for each stone size supported by the material profile.

**Purpose:** Allow a crafter to cut a test sheet on their actual machine and material, place stones in each hole, and find the diameter that seats the stone correctly. The correct diameter is then set as `kerfCompensationMm` in the material profile.

**Why physical testing is required:** Recommended hole diameters in stone size profiles are provisional estimates. Actual cut size depends on blade depth, blade wear, cut pressure, mat tackiness, flock batch, and ambient humidity. No software can substitute for a physical cut test.

**Diameter variants (default):**

| Column | Offset | Label |
|--------|--------|-------|
| 0 | −0.1 mm | `recommended-0.1mm` |
| 1 | 0 | `recommended` |
| 2 | +0.1 mm | `recommended+0.1mm` |
| 3 | +0.2 mm | `recommended+0.2mm` |

**Output:** A `RhinestoneTemplate` with `unit: 'mm'`. Every stone has a `metadata` object containing `calibration: true`, `materialProfileId`, `variantLabel`, `recommendedHoleDiameterMm`, and `testedHoleDiameterMm`.

**Export:** Use `createBasicSvgExport()` — the same function used for production templates. The calibration sheet and production templates share a single, audited export path.

---

## SVG Alphabet Baseline Metrics

Curated SVG alphabets store each character in its own file, so no cross-file
baseline survives import (every glyph is re-zeroed to its own bounding box).
Generators that compose letters (`createSvgAlphabetTemplate`,
`createLetterStencilTemplate`) therefore need to know how far each glyph
should hang below a shared text baseline.

An alphabet definition may carry `baselineBelowFractionByChar`: a map from
character to the fraction of that glyph's own height that sits below the
baseline (`0` = bottom on the baseline, negative = bottom floats above it).
Characters not listed sit on the baseline. When present, both generators align
glyphs using these exact fractions and skip the layout heuristics (lowercase
descender list, cap-height outlier detection) that remain the fallback for
alphabets without metrics.

Fractions are derived from the alphabet's source material — measured from a
combined all-letters strip that shares a real baseline, or computed from the
per-glyph bounding boxes of the typeface the design is based on (e.g. Old
London for `old-english-gothic`). They are static data in the registry: the
engine stays pure and deterministic, with no font parsing at compose time.

An alphabet definition may also carry `glyphFileFallbackByChar`: alternate
file basenames tried when the primary `<char>.svg` is missing (e.g. the Old
English SS10 package names its i-glyph with a dotless ı).
