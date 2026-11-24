# ADR 0019 — Split a design that does not fit one mat into parts

**Date:** 2026-11-19  
**Status:** Accepted

## Context

A Cricut mat is 12 × 12 in (about 30 × 30 cm, 292.1 mm usable) or 12 × 24 in (about 30 × 60 cm, 596.9 mm usable). Until now a
design larger than the mat only got a warning, and Fit to mat could only shrink text and artwork (not stone fonts, hand-made or
imported designs). Cutters routinely solve this by cutting the design in parts and laying the parts side by side on the garment
(backlog items B11 and D3).

## Decision

1. **Engine**: `planSplitForMat` / `buildPartTemplate` (`src/lib/rhinestone-engine/split/splitForMat.ts`, specified in
   `RHINESTONE_ENGINE_SPEC.md`). Pure, deterministic, millimetres. Stones are never cut or moved: each goes whole to the part its
   centre is in. Seams are placed where the fewest circles cross, preferring a line no circle touches, as far along as the mat
   allows so that the number of parts is minimal. Both orientations of the mat are tried.
2. **Export dialog**: for any design that does not fit a 12 × 12 in mat the dialog has a "Split across mats" section: a choice of
   mat (default 12 × 24 in), the number of parts, a colour overview, the size and stone count of every part, a download per part
   and "Download all parts (.zip)". The zip also holds `<name>-layout.txt` with the column / row, the offset of each part from the
   design's top-left and whether to turn it 90°.
3. **Same gates as the single export**: the downloads follow the calibration rule of the main button (uncalibrated files are
   named `-uncalibrated` and need the acknowledgement). `ExportDialog` children may be a function receiving that gate.
4. **A second way out in the quick fixes**: "Or cut it in parts" next to "Fit to … mat" opens the dialog. This is the only route
   for designs that cannot be resized automatically (stone fonts, hand-made, imported).
5. **ZIP**: a small dependency-free "stored" writer (`app/lib/zip.ts`, CRC-32, UTF-8 names) rather than a library, because
   the archive is a few SVGs and a text file.
6. The padding added by the SVG export is subtracted from the mat before planning, so each exported part file (with padding)
   fits the mat.

## Consequences and limits

- No registration marks yet: the parts are aligned from the layout file's offsets. Marks (and a join check square) are a
  possible next step.
- Cut shapes (outlines) belong to the whole design and are left out of the parts; the dialog says so.
- A seam may pass through stones that are packed edge to edge (the count is shown); those stones are kept whole on one side, so
  the join can show a slightly uneven gap there.
- Verified in the in-app browser: a 404 mm wide design is offered as 2 parts on a 12 × 12 in mat (280 mm and 123 mm, 215 + 117
  stones, no seam crossings), the zip holds both SVGs and the layout file with valid checksums, and the files are named
  `-uncalibrated` until the notice is acknowledged.
