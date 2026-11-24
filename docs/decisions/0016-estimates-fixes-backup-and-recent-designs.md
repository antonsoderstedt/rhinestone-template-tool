# ADR 0016 — Stone estimate, one-click fixes, backup and recent designs

**Date:** 2026-11-19  
**Status:** Accepted

---

## Context

Phase 12 of `docs/COPILOT_FIX_PLAN.md` adds five helpful features on top of the engine and persistence work of earlier phases:
N1 stone/cost estimate, N2 warnings for very large designs with *Fit to mat*, N3 *Auto-fix issues*, N4 a backup that needs no server,
N5 recent designs with thumbnails on the start page.

## Decisions

1. **Estimate (N1).** `estimateStoneUsage` (engine) turns a stone list into packs to buy: count per size, a spare allowance
   (default 10 %), rounded up to whole packs (1, 5 or 10 gross). The user may type a price per pack for each size; the app
   remembers the inputs in `localStorage` (`rhinestone-stone-estimate`, validated on read). **The tool never supplies a price**:
   it does not know what the user's supplier charges, so a size without a typed price shows no cost, and a total over only some
   sizes says so. Shown in the Inspect panel under *Stones to buy*.
2. **Large-design warnings (N2).** `checkExportReadiness` now emits two **warnings** (they never block export): `HIGH_STONE_COUNT`
   above 1500 stones and `EXCEEDS_MAT_SIZE` when the design is bigger than a 12 × 24 in mat in both orientations. The mat
   definitions moved from `app/components/exportDialogHelpers.ts` into the engine (`sizing/matFit.ts`) so the dialog and the check
   cannot disagree; the helpers still re-export them. The Inspect panel lists these as **Quick fixes**, together with an info
   item when a design needs a 12 × 24 mat.
3. **Fit to mat (N2).** Stones are not moved closer together (the holes would overlap). Instead the design is regenerated smaller:
   `buildFitToMatPlan` sets the target width/height (aspect ratio locked) of the text or artwork tool that produced it, with a 3 %
   margin because generated designs snap to whole stones. It works for outline text, dot-matrix text and uploaded SVG/images,
   also from the Select tool. Hand-made, imported, stone-font, alphabet and stencil designs have no size setting, so the button is
   disabled with an explanation. If the design has hand edits, the existing "replace your edits?" question appears first.
4. **Auto-fix (N3).** `autoFixSpacing` runs the same nudge algorithm used at generation time on a design that has spacing
   problems, and the editor applies the result with the new `REPLACE_STONES` action: one undo step, also when the design was
   generated (it becomes editable, and Undo restores the stones as they were). The result is validated again; the toast says how
   many stones were moved or removed, and warns when errors remain. Offered in Quick fixes and as a third button in the
   "Fix errors before export" dialog.
5. **Backup (N4).** *Back up all designs* (on `/designs`) downloads one `rhinestone-studio-<date>.backup.json` with every saved
   rhinestone and HTV design. *Restore from backup…* reads it, validates every entry (the rhinestone project goes through the same
   `parseRhinestoneProject` as *Open project file*; unreadable entries are skipped and counted), and merges: missing designs are
   added, a design that exists in both places is replaced only by a **newer** copy, nothing is deleted, and restoring the same
   file twice changes nothing. A backup cannot create built-in or read-only entries, and a thumbnail must be a `data:image/` URI
   (a web address would make the browser contact it). Not included: uploaded fonts and images, calibration profiles, settings.
6. **Recent designs (N5).** The start page shows the four most recently changed, non-archived designs of both studios under
   *Pick up where you left off*, each linking to `/rhinestone?designId=…` or `/htv?designId=…`. Rhinestone designs reuse the
   thumbnail saved with them (`previewRef`); HTV designs show their text. The section is hidden until something is saved.

## Consequences

- Verified in the in-app browser: oversize text → *Too big for a 12 × 24 in mat* (677 × 91 mm) → *Fit to 12 × 24 in mat* → 582 × 79 mm
  → *Shrink to fit a 12 × 12 in mat* → 287 × 40 mm; a Stone Font design with 12 tight places → *Fix spacing automatically*
  moved 17 stones and Undo brought them back; a project with overlapping stones is blocked at Export and fixed from the dialog;
  backup of 54 designs (~1 MB), restore after deleting one design added exactly one, a non-backup file is rejected with a clear
  message; start page and `/designs` have 0 axe violations (dark theme) and no horizontal scroll at 390 px; Quick fixes work on a
  phone-sized viewport.
- Known limits: the estimate knows nothing about prices, stone colours or packs of other sizes; *Fit to mat* cannot resize
  hand-made designs; auto-fix moves stones by a small nudge and removes the ones that cannot fit (reported, undoable) rather than
  re-flowing the design; a backup of many large designs can be many megabytes (limit 50 MB when restoring); HTV designs restored on
  a computer without the uploaded font use a default font (ADR 0010).
- Found while testing, **not fixed here**: in the *light* studio theme axe reports contrast failures in untouched chrome (the
  *Inspect* tab label, the *Pen* tool badge and similar `text-violet-300` styles). Dark theme is clean. Belongs in the Phase 13 pass.


## Update 2026-11-22: calibration profiles

Backups now also carry the calibration profiles (an optional field, so older backups still restore). They are merged by id, a profile is replaced only by a newer copy, and a damaged one is skipped and counted. Fonts, images and settings are still not included.
