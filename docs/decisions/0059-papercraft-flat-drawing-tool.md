# ADR 0059: A tool to draw a pattern flat (2D)

**Status:** accepted · **Date:** 2026-11-27

## Why

The owner wants to make their own papercraft templates in four ways (ADR 0058 covers parts, parametric templates and saving a model as a
template). This is the fourth: draw the pattern flat, with cut outlines, fold lines, glue tabs and numbers, and cut it with a Cricut or
Silhouette or print it.

## Decisions

- **Own page and own engine, not in the 3D flow:** `/papercraft/draw` (`app/papercraft/draw/`) and `src/lib/papercraft-engine/draw/doc.ts`.
  A flat drawing has no 3D model, so it does not go through the unfold and the page layout.
- **Document** (`DrawDoc`): a sheet (mm, y up, origin lower left) and items: `cut` (a closed shape or an open line), `mountain` / `valley`
  (fold lines) and `text` (a number: digits and `- / . x`, drawn as stroke lines). Every operation returns a new document (history is
  a list of documents). Numbers are clamped and rounded to 0.001 mm; limits: 2000 items, 2000 points per item, ±5000 mm, sheet 20–2000 mm.
- **Operations** (pure): add, remove, move, move one corner, turn, mirror, scale, copy, swap mountain/valley, set a number's text;
  `rectanglePoints`, `regularPolygonPoints`; `hitTest` (corner, then edge, then the inside, smallest shape first); `snapPoint`
  (corner of another item, else grid).
- **Glue tabs** (`addTab`): the two extra corners of the tab are put *into* the outline (so the tab is part of the cut line, as in a
  real pattern) on the chosen edge, on the outside whichever way the shape runs, and a valley fold line is drawn along the edge (not doubled).
  The slant is limited to 40 % of the edge so the corners never cross.
- **Checks** (`drawProblems`): nothing to cut, off the sheet, an outline that crosses itself, an open outline, a speck under 0.5 mm.
- **Output** (`drawingOf`) is the `PageDrawing` the studio's own patterns use, so the Cricut SVG (cut and score layers, no `<use>`, no
  opacity), the Silhouette DXF and the PDF come from the existing exporters. Optionally the sheet is cropped to the drawing plus a margin
  (for the cutting machine).
- **Saving:** a drawing is saved as a JSON file (`kind: 'papercraft-drawing'`, `version: 1`) and the work in progress is kept in
  localStorage (not synced). `parseDoc` refuses anything that is not ours and brings numbers into range.
- **Editor:** tools Select, Outline (polygon by clicks), Rectangle, Polygon (regular, many sides = circle), Fold line, Glue tab, Number
  (counts up); grid snap 0–10 mm; zoom and pan; undo/redo with a drag counted as one step (`drawState.ts`); keyboard (Esc, Enter,
  Backspace, Delete, arrows, Ctrl+Z).

## Consequences

- Curves are polygons (a circle is up to 200 sides). A real Bézier curve is not supported.
- One sheet per drawing; several pages are made by several drawings.
- **Catalog** (added; `drawCatalog.ts`, `DrawCatalogPanel.tsx`): “Save as a template” puts the drawing in the template catalog (ADR 0057) as a Papercraft JSON template with the field `Kind: drawing` (so the studio's “From the catalog” does not offer it as a design), plus a small SVG picture; the id comes from the name and never replaces another template. “Drawings from the catalog” in the drawing tool lists the published ones and opens them (after a confirm if something is drawn). Both only show where there is a catalog. A failed picture upload is reported but does not fail the save.
- Fixed on the way: the first click on the sheet was read after the canvas took the focus, and the focus could scroll the page, so the first corner landed in the wrong place on a narrow screen; the point is now read first and the focus does not scroll.
- The mouse editing was checked with synthetic pointer events in the running page (rectangle, tab, outline, number, move, undo, four downloads),
  not with a real mouse or touch screen; nothing has been cut on a machine.

## Update: pages and smooth curves

- **Pages:** a drawing has `pageCount` (1–20) sheets of the same size; every item has a `page`. The canvas works on one page: what is hit,
  snapped to and drawn is `pageView(doc, page)`, while a change is made to the whole drawing. Pages can be added, removed (with what is on them; later pages
  move up) and items moved between pages. Exports: the PDF has every page; the Cricut SVG and Silhouette DXF are one file per page (a zip when there are
  several; empty pages are left out). A page with nothing on it is pointed out. Drawings saved before pages open on one page (`parseDoc` raises the count to the
  highest page used).
- **Smooth curves:** an item (a cut or a fold line with three or more points) can be `smooth`: its points are control points and the line is a centripetal
  Catmull-Rom curve through them (closed for a closed cut), cut into straight pieces about a millimetre long (`flattenItem`). The cutting files, hit
  tests, the checks and the area use the flattened line; the handles stay on the control points. The outline tool has “Draws a” (cut or a fold line), “Smooth curve”
  and “Leave it open”, and a selection can be made smooth or straight. A glue tab cannot be put on a smooth edge. The curve is a spline, not a Bézier with handles.
