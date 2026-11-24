# ADR 0007 — Export dialog, uncalibrated override and HTV export options

**Date:** 2026-11-19  
**Status:** Accepted

---

## Context

- A brand-new user could not download anything until a calibration profile was saved *and* approved. The UI also showed the missing
  approval as a design error ("BLOCKED (1)") and labelled uncalibrated files "High confidence".
- Export downloaded silently. Users never saw the physical size, whether the file fits a Cricut mat, or which warnings applied.
- The HTV studio showed the rhinestone calibration gate although HTV export does not depend on it, and its export had no mirror
  (iron-on vinyl is cut reversed), weed border or registration marks. The Settings value "HTV weed margin" was stored but unused.

Product decision D2 (see `docs/COPILOT_FIX_PLAN.md`): keep self-attested approval, do not add heavier gating, and make the
beginner path honest rather than blocked.

## Decision

1. **Calibration is a separate export step, not a design error.** `summarizeExportStatus` reports `needsCalibration` only for the engine
   error `REQUIRES_APPROVED_CALIBRATION_PROFILE`. The generic `REQUIRES_CALIBRATION` warning (emitted for every calibration-requiring
   material, even with an approved profile) never flips that state. `getExportGate` decides the Export action; real design errors always
   block and can never be overridden.
2. **Explicit uncalibrated override.** With only calibration missing, the user can export after ticking "I understand…".
   `createBasicSvgExport(…, { uncalibratedOverride: true })` writes `data-calibration="uncalibrated-override"` and a note in `<desc>`;
   the download is named `<name>-uncalibrated.svg`. Geometry and Cricut-safety rules are unchanged.
3. **Honest labels.** The software verifies geometry only: "Design checks passed", "Uncalibrated defaults", "Needs review", "Blocked".
   Approving a profile is self-attested and requires confirming the stone fit ("not verified by software").
4. **One shared export dialog for both studios** (`app/components/ExportDialog.tsx`): preview of the exact SVG, physical size read from
   the file's root `width`/`height`, mat fit (12×12 and 12×24 in; usable 292.1 mm wide, 596.9 mm long), warnings, calibration state,
   file-name field, Download. It replaces the silent download. Studio options are passed as children.
5. **HTV status reflects HTV concerns only** (`summarizeHtvStatus`): empty design, layers on other placements, ready.
6. **HTV export options** (`createHtvSvgExport(…, options)`): `mirror` (default **on** in the studio dialog, off for the pure function),
   `weedBorder`, `registrationMarks`, and `marginMm` wired to Settings "HTV weed margin". Mirroring is baked into each layer's transform
   (`translate(W − tx) · rotate(−θ) · scale(−sx, sy)`) so every layer stays a plain `<g>` + `<path>`. Output stays mm-sized with no raster,
   no `<use>` and no nested `<svg>`.

## Consequences

- Beginners reach a downloaded SVG in at most three clicks (Export → acknowledge → Download), with a visible warning and a marked file.
- Calibrated users need two clicks (Export → Download).
- Mat sizes are conservative usable areas, not nominal mat sizes; a design that fits only when rotated is reported as such.
- The engine's `ExportOptions` gained one optional field, documented in `docs/RHINESTONE_ENGINE_SPEC.md`.
