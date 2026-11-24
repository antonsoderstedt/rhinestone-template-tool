# ADR 0006 — Collision semantics and automatic stone spacing

**Date:** 2026-11-16  
**Status:** Accepted

---

## Context

The editor previously treated any close-but-non-overlapping pair as a collision, even when the measured gap was still above zero and the stones were otherwise safe to cut. This caused ordinary words to look export-blocked at default spacing, and the warning copy said “overlap” even when the holes were only 0.35 mm apart.

The underlying safety rule is distinct:

- true overlap: edge gap < 0 mm
- tight gap: 0 <= gap < material minimum

The product requirement for D1 is that user-generated templates block on tight gaps, while vendor-authored assets only warn.

---

## Decision

### 1. Split the collision semantics

We introduce two validation codes:

- `STONE_OVERLAP`: negative edge gap. Always an error.
- `STONE_TIGHT_GAP`: non-negative but below the material minimum. Error for user-generated templates and warning for vendor-authored assets.

Legacy `STONE_COLLISION` remains as a compatibility alias for overlap-only checks, but the engine now carries `measuredGapMm` and `requiredGapMm` on each issue so the UI can show the real numbers.

### 2. Measure gap from hole edges, not center distance alone

For two holes A and B:

```
measuredGapMm = centerDistanceMm - (radiusA + radiusB)
```

This makes the rule consistent with the physical safety floor used in the material profile. A negative value means the holes overlap; a value from 0 to the required minimum means the holes are close but still technically distinct.

### 3. Auto-spacing is deterministic, convergent, and pure

The engine adds `resolveStoneSpacing(template, { minGapMm, strategy })`.

- It operates on a cloned template and never mutates the input.
- It sorts stones by a stable order before resolving conflicts.
- It uses a deterministic `nudge` strategy with a spatial hash + iterative relaxation pass loop (500 pass cap).
- If violations remain at the pass cap, `remove-lesser` is used only as a last resort.
- It is idempotent: running it twice yields the same output.
- It reports `movedStoneCount`, `removedStoneCount`, `maxDisplacementMm`, `resolutionPasses`, and `tooDenseForStoneSize` in template metadata.

### 4. Default behavior for the generator pipeline

The default generator path must resolve tight gaps before requiring export readiness so common words and default templates stay producible without user intervention.

Vendor-authored templates remain a warning-only case for tight gaps, because they are already curated and may intentionally trade a little extra density for a specific design goal.

Auto-spacing is applied to generated templates (`text`, `svg`, `svg-alphabet`, `letter-stencil`) and intentionally skipped for `grid`, `template-import`, and vendor-authored templates.

---

## Consequences

- User-generated templates fail the export gate only when they actually violate the minimum gap or overlap.
- The UI can say, for example, “Stones 12 and 13 are 0.35 mm apart (minimum 0.51 mm)” without mislabeling this as an overlap.
- Auto-spacing keeps the engine deterministic, testable, and repeatable.
- The compatibility alias `STONE_COLLISION` remains available for downstream consumers that were already keyed off the old name, while the engine moves to the more explicit pair of gap-based codes.
