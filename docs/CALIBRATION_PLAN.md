# Calibration Plan — Rhinestone Template Tool

## Why Calibration is Required

Magic Flock is a physical material. The same SVG cut file may produce slightly different hole sizes depending on:

- **Blade depth** — even a small change alters hole diameter
- **Blade wear** — a dull blade drags and enlarges holes
- **Mat tackiness** — a sticky mat holds the material tighter; a worn mat allows slip
- **Ambient conditions** — humidity affects flock stiffness
- **Cricut unit variation** — motor calibration varies between machines

Without physical calibration, holes may be too large (stones fall out), too small (stones don't fit), or inconsistently spaced (stones overlap or leave gaps).

---

## Calibration Workflow

### Step 1 — Cut the Calibration Sheet

A calibration sheet is a pre-defined SVG containing:
- A row of individual circles at each stone size (SS6, SS8, SS10, SS12)
- A grid of each stone size to check spacing
- A scale bar (10 mm reference line)

The calibration sheet is stored in `/calibration/calibration-sheet.svg`.

Cut the calibration sheet on Magic Flock at your normal Cricut settings.

### Step 2 — Measure the Cut Holes

Using digital calipers or a loupe with a scale:

1. Measure the **actual cut diameter** of 5 circles at each stone size.
2. Average the measurements.
3. Compare to the **intended hole diameter** from the stone profile.

Record the **delta** (actual − intended) for each size.

### Step 3 — Place Stones in the Grid

Place stones in the grid section:
- Check for stones that sit too high (hole too large).
- Check for stones that won't seat (hole too small).
- Check for material tearing between adjacent holes (spacing too tight).

### Step 4 — Enter Calibration Offsets

In the tool's calibration UI, enter:

```
SS6  hole diameter adjustment:  [measured delta] mm
SS8  hole diameter adjustment:  [measured delta] mm
SS10 hole diameter adjustment:  [measured delta] mm
SS12 hole diameter adjustment:  [measured delta] mm
Spacing adjustment:             [observed gap issue] mm
```

A positive diameter adjustment = make holes larger.
A negative diameter adjustment = make holes smaller.

### Step 5 — Re-cut and Validate

Re-cut a test design with the calibrated offsets applied. Confirm that:
- All stone sizes seat correctly.
- No holes are torn.
- Spacing looks consistent.

---

## Calibration File Storage

Calibration profiles are stored in `/calibration/` as JSON files:

```json
{
  "material": "magic-flock",
  "machine": "Cricut Maker (my machine)",
  "date": "2026-07-09",
  "offsets": {
    "SS6":  { "holeDiameterAdjustment": 0.0, "spacingAdjustment": 0.0 },
    "SS8":  { "holeDiameterAdjustment": 0.0, "spacingAdjustment": 0.0 },
    "SS10": { "holeDiameterAdjustment": 0.0, "spacingAdjustment": 0.0 },
    "SS12": { "holeDiameterAdjustment": 0.0, "spacingAdjustment": 0.0 }
  }
}
```

The tool loads the most recent calibration profile for the selected material.

---

## Recalibration Triggers

Recalibrate when:
- Replacing the blade
- Using a new mat
- Switching Magic Flock batches or suppliers
- Getting unexpected results after a long idle period
- Moving the Cricut to a new environment

---

## Calibration in the Development Workflow

The calibration system is built in Phase 4. **Do not skip calibration for production use.** All acceptance tests in `docs/ACCEPTANCE_CRITERIA.md` that involve physical cuts require a calibrated profile.
