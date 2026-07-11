# Rhinestone Engine Specification

## Purpose

The rhinestone engine is the core algorithmic component of the tool. It takes a set of SVG paths (in millimeter coordinates) and a stone size, and returns the exact positions of every rhinestone that fits inside those paths without overlapping.

The engine is a **pure TypeScript library** with no UI, no DOM, and no external runtime dependencies. It must be independently testable.

---

## Stone Sizes

| Size | Physical Diameter | Hole Diameter | Min Center-to-Center Gap |
|------|------------------|---------------|--------------------------|
| SS6  | 2.0 mm           | 1.8 mm        | 2.1 mm                   |
| SS8  | 2.4 mm           | 2.2 mm        | 2.5 mm                   |
| SS10 | 2.8 mm           | 2.6 mm        | 2.9 mm                   |
| SS12 | 3.2 mm           | 3.0 mm        | 3.3 mm                   |

> **Hole diameter** is slightly smaller than physical diameter to ensure the stone snaps in.
> **Min center-to-center gap** includes a small safety margin to prevent material tearing.

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
distance(candidateCenter, acceptedCenter) >= stoneSize.holeDiameter + safetyMargin
```

The safety margin is defined per material profile (see `docs/MATERIAL_PROFILES.md`).

Collision detection must run even after path filtering, because grid positions near path boundaries may be closer than the grid spacing suggests when both paths and offset grids are involved.

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
- Validation errors from `validateRhinestoneTemplate` (duplicate IDs, invalid hole sizes, `STONE_COLLISION`)

**Warnings** (do not block export):
- `REQUIRES_CALIBRATION`: material profile needs physical calibration
- `EXCEEDS_MAX_WIDTH`/`BELOW_MIN_WIDTH`: physical size out of range
- `EXCEEDS_MAX_HEIGHT`/`BELOW_MIN_HEIGHT`: same for height
- `UNSUPPORTED_STONE_SIZE`: stone size not in material profile's supported list

**Info** (always present):
- `PHYSICAL_SIZE`: estimated output dimensions including hole radii

The summary object includes `widthMm`, `heightMm`, `stoneCount`, `materialProfileId`, `cutter`, `stoneSizes`, `hasCollisions`, `hasCalibrationWarning`.

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

---

## Font Outline Text Module (v1 — Font Outline Foundation)

### Why TTF/OTF is deferred

Real font parsing requires either shipping a large WebAssembly binary (HarfBuzz ~2MB)
or a JavaScript font parser. Both increase bundle size and introduce file-upload
attack surface. The built-in vector font proves the complete end-to-end pipeline
(outline → polyline → stones → validated SVG) without any dependency risk.

Future phases: real font parsing, font upload, fill mode, centerline mode, better
kerning, text warping.

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
