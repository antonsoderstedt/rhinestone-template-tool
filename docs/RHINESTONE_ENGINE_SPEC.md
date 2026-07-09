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
