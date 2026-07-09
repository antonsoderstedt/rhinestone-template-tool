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
  calibration/          — Apply calibration offsets to profiles
```

No module in `/src/lib/rhinestone-engine/` may import from `/app/`.
