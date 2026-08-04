# ADR 0004 — Magic Flock Profile Correction: Vendor Hole Diameters, Dynamic Edge Spacing, Cricut Maker 3

**Status:** Accepted
**Date:** 2026-08-05

---

## Context

The Magic Flock material profile shipped with provisional, unverified hole diameters (e.g. SS10 = 3.0 mm) and a static `minCenterDistanceMm` per stone size. Vendor (TRW) physical stone measurements give more accurate hole diameters for SS6, SS8, SS10, SS16, and SS20; SS12 has no verified vendor source and must stay marked provisional. Separately, Magic Flock requires at least 0.508 mm of material left between any two hole *edges* (not a fixed center-to-center distance) to avoid tearing — a requirement that scales with hole size rather than being a single constant.

## Decision

### 1. Central hole-preset data source

`MaterialProfile` gained an optional `holePresets: HolePreset[]` field. Each `HolePreset` carries `stoneSize`, `holeDiameterMm`, a 5-value `calibrationValuesMm` test series, and a `status: 'verified' | 'provisional'` (with an optional `note`). `MAGIC_FLOCK_HOLE_PRESETS` in `src/lib/rhinestone-engine/profiles/materialProfiles.ts` is the single source of truth — `getRecommendedHoleDiameter` and `getCalibrationSeries` consult it first, falling back to the generic material-agnostic `StoneSizeProfile` (`profiles/stoneSizes.ts`, left unchanged) only when a material has no explicit preset for a size.

SS12's preset is `status: 'provisional'` with an explanatory `note`. `isHolePresetProvisional()` lets both the engine and the UI check this without duplicating the threshold logic.

### 2. Dynamic minimum edge spacing, not a static per-size constant

`getMinimumCenterDistance(holeRadiusAMm, holeRadiusBMm, materialProfileId)` replaces per-size static minimums for collision/placement purposes:

```
minimumCenterDistance = holeRadiusA + holeRadiusB + minimumEdgeSpacingMm
```

`minimumEdgeSpacingMm` (0.508 mm for Magic Flock) lives on `MaterialProfile`. This formula is symmetric and handles mixed stone sizes correctly (e.g. an SS6 hole next to an SS20 hole), which a single `minCenterDistanceMm` per stone size cannot express. `getRecommendedCenterDistance` now derives from this same floor plus `spacingSafetyMarginMm`, so "recommended" is always ≥ "minimum" by construction regardless of which hole diameter is actually in effect.

Every call site that previously hardcoded `minGapMm: 0` (collision detection in `app/editor/collisionDetection.ts`, fill placement in `fill/placementPatterns.ts` and `fill/contourPlacement.ts`, path sampling in `path/pathTemplate.ts`, export validation in `exportQa/exportReadiness.ts`, density presets in `spacing/density.ts`) now resolves it from the active material profile instead. Other material profiles' own spacing rules are untouched — this only changes how Magic Flock's *own* `minimumEdgeSpacingMm` is looked up and applied.

### 3. Cricut Maker 3, not "Cricut Maker"

The profile's `cutter` field and all UI copy now say "Cricut Maker 3" specifically. A `MachineRecommendation` type captures blade, pressure, passes, multi-cut, mirror, liner/mat handling, help text, and an `alternativePressure` (340, explicitly labeled as an alternative for older/thinner material requiring its own test cut — never the primary recommendation).

### 4. Saved-project protection

No new versioning/migration system was added. `Stone.holeDiameterMm` is a plain literal value on each saved stone, not a live reference to the material profile — so existing projects are unaffected by this change by construction; only newly generated geometry (or an explicit profile/preset re-selection) picks up the new defaults. This follows the existing Generated-vs-Editable distinction already in the editor rather than introducing parallel state.

## Consequences

- Automatically-generated layouts (fill, contour, path outline) now honor a real physical safety floor instead of `0`, which changes stone counts for existing generator call sites at the same font size / stone size (fewer stones fit per mm). Test fixtures and thresholds across the suite were updated to reflect this — see `tests/spacing.test.ts`, `tests/fontSystem.test.ts`, `tests/pathTemplate.test.ts`, `tests/calibration.test.ts`, `tests/examples.test.ts`.
- `path/pathTemplate.ts`'s consecutive-sample collision guard (used by outline text and polyline outlines) was updated to use `getMinimumCenterDistance` instead of raw `holeDiameterMm`, fixing same-path self-collisions that the larger SS10 hole diameter now exposes.
