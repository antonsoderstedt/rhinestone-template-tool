# Calibration Plan — Rhinestone Template Tool

## Recommended First Physical Test Sequence

**Before cutting any production design**, follow this sequence:

1. Download the **Cricut Test Pack** from the app home page.
2. Import all four SVG files into Cricut Design Space.
3. Cut the **Calibration Sheet** on a small scrap of Magic Flock. Place stones in each row and note which hole diameter seats correctly.
4. Update `kerfCompensationMm` in `src/lib/rhinestone-engine/profiles/materialProfiles.ts` with the measured offset.
5. Cut the **SS10 Grid** — verify stone spacing and seating.
6. Cut **SMOOCH** — check that stones fill the design neatly.
7. Cut the **Diamond** — verify path accuracy at corners.
8. Only after all four pass should you proceed to custom production designs.

**Skipping this sequence risks:**
- Holes that are too large (stones fall out)
- Holes that are too small (stones won’t seat, material tears)
- Incorrect physical scale (wrong cut size)

---

## Calibration UI

The calibration sheet is accessible directly from the home page via the **Calibration Sheet** section (`app/components/CalibrationSheetGenerator.tsx`).

### What the UI provides
- Generates the default Magic Flock calibration sheet using `createDefaultMagicFlockCalibrationSheet()`.
- Exports the sheet through `createBasicSvgExport()` — the same Cricut-safe pipeline used for production templates.
- Shows a description of the four diameter variants and instructions for interpreting the cut results.
- Provides a Download SVG button (`magic-flock-calibration-sheet.svg`) and a Copy SVG button.
- Displays a prominent warning that values are provisional until physically tested.

### Limitations (current)
- The material profile cannot yet be edited or saved from the UI.
- Calibration results (correct `kerfCompensationMm`) must be manually updated in the engine profile source code (`src/lib/rhinestone-engine/profiles/materialProfiles.ts`) until a settings UI is built.

---

## Calibration Sheet

The calibration sheet is generated programmatically by `createCalibrationSheet()` (or `createDefaultMagicFlockCalibrationSheet()`) in `src/lib/rhinestone-engine/calibration/calibrationSheet.ts`.

It is exported to SVG using **the same `createBasicSvgExport()` pipeline used for production templates** — not a separate code path. This means a calibration cut validates the full export system, not just the hole sizes.

### Diameter variants per stone size

For each supported stone size (SS6, SS8, SS10, SS12), the sheet includes four holes:

| Column | Diameter | Purpose |
|--------|----------|---------|
| 1 | recommendedHoleDiameterMm − 0.1 mm | Undersized — stone may not seat |
| 2 | recommendedHoleDiameterMm | Baseline estimate |
| 3 | recommendedHoleDiameterMm + 0.1 mm | Slightly oversize |
| 4 | recommendedHoleDiameterMm + 0.2 mm | Noticeably oversize |

Place stones in each hole after cutting. The column where the stone snaps in firmly without falling out or tearing the flock is the correct diameter for your machine and batch. Record that offset as `kerfCompensationMm` in the material profile.

---

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

### Step 1 — Generate and Cut the Calibration Sheet

Generate the calibration sheet using the engine:

```typescript
import { createDefaultMagicFlockCalibrationSheet, createBasicSvgExport } from './src/lib/rhinestone-engine/index.js';

const sheet = createDefaultMagicFlockCalibrationSheet();
const svg = createBasicSvgExport(sheet, { includeGuideBox: true, paddingMm: 5 });
// write svg to a .svg file and open in Cricut Design Space
```

The sheet contains:
- One row per stone size (SS6, SS8, SS10, SS12)
- Four holes per row at: recommended−0.1, recommended, recommended+0.1, recommended+0.2 mm
- All holes are real SVG `<circle>` elements — never rasterized

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
