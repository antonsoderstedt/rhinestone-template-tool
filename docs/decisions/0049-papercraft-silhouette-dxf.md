# ADR 0049: Silhouette DXF export

**Status:** accepted · **Date:** 2026-11-26 · Replaces "Silhouette DXF later" in the plan (ADR 0037).

## Decision

- `exportPageDxf(drawing)` writes one page as a **DXF in millimetres** (AutoCAD release 12, ASCII, `$INSUNITS` 4), which Silhouette Studio and most other cutting software open. y points up as in the drawing, so nothing is flipped.
- **Three layers with a colour each**, so the software can give each its own setting: `CUT` (black, the outlines: closed polylines), `SCORE` (red: the mountain, valley and tab lines, as lines; flat folds are left out) and `NUMBERS` (blue: the edge numbers as
  open polylines, to be deleted or drawn). The same split as the Cricut SVG (black, red, blue).
- Release 12 on purpose: `POLYLINE` and `LINE` are read everywhere; newer entities (`LWPOLYLINE`) are not needed. No dates, no handles: the same drawing gives the same text. Numbers are rounded to 0.0001 mm.
- In the studio: **Download DXF for Silhouette** next to the Cricut button; one file for one page, a zip of `<name>-silhouette-page-<n>.dxf` for several. The panel says to give each colour its own setting.

## Not done

Registration marks for print and cut (Silhouette's own marks), a layer per fold kind, curves (the engine only has straight lines). Not tried in Silhouette Studio: needs the owner's machine.
