# ADR 0065: Bézier handles in the flat drawing tool, and resize handles in the 3D Build view

**Status:** accepted · **Date:** 2026-11-28

## Why

Two limits were written down when the Papercraft tools were made. The flat drawing tool had curves that were a spline through points,
"not a Bézier with handles" (ADR 0059), so the shape of a curve could only be changed by moving its points. The Build view moved and
turned the parts of a model but had "no resizing handles: sizes are still typed" (ADR 0058). This removes both.

## Bézier handles (the flat drawing tool)

- **Data** (`src/lib/papercraft-engine/draw/doc.ts`): an item can have `handles`, one `{ in, out }` pair for each point, as distances from the
  point in millimetres (`in` on the side the line comes from, `out` on the side it goes to). Each piece of the line between two points is then a
  cubic Bézier curve with control points `point + out` and `next + in`; a piece with no handle at either end is straight, and a point whose handles
  are both zero is a corner. An item with handles is not `smooth` (the two kinds of curve do not mix; `isCurved` is true for both).
- **Cut and drawn along the curve:** `flattenItem` cuts a Bézier piece into straight pieces about a millimetre long (at least 6, at most 80 for a
  piece), as it does for a smooth curve, so the Cricut SVG, the Silhouette DXF, the PDF, the hit test, the self-crossing check and the area all
  work on the same points (`drawingOf`). Output is deterministic and has no `<use>`, nested SVG or opacity, as before.
- **Operations** (pure, each returns a new document): `setBezier` (a smooth item keeps its shape: its handles are the ones that make a Catmull-Rom
  spline, `autoHandles`; a straight item gets handles of length zero, so it keeps its corners; off removes the handles), `setHandle` (moves
  one handle; by default the other follows to the other side at the same distance, which keeps the point smooth, and without that it stays, which
  makes a corner), `toggleCorner` (a corner gets handles that make the curve smooth through it, a smooth point becomes a corner), `hitHandle`
  (a handle of length zero is not there to be hit). Turning, mirroring and scaling move the handles with the points (a handle is an offset, so
  moving does not touch it). `setSmooth` takes the handles away. `addTab` refuses a curved edge, as for a smooth one.
- **Saving:** handles are saved with the drawing and checked when it is opened: there must be exactly one pair for each point, every number is
  finite and brought into ±5000 mm and a thousandth of a millimetre, otherwise the handles are dropped (the item is then straight, as in a drawing
  from before handles). Negative zero is avoided, so a saved and opened drawing is equal to the one that was saved.
- **Editor** (`DrawCanvas.tsx`, `DrawShell.tsx`): a selected item can be made a Bézier curve with “Edit with Bézier handles” (and back with
  “Remove the handles”). The one selected Bézier item shows its handles as round dots on lines from the points; **drag** one to bend the curve,
  hold **Alt** to move it without the other, and **double-click a point** to make it a corner or to give it handles. A drag is one step in the history
  (the same PREVIEW / COMMIT as for moving a point). The outline tool still makes straight or smooth lines; a curve is edited with handles afterwards.

## Resize handles (the 3D Build view)

- **Engine** (`src/lib/papercraft-engine/mesh/builder.ts`): `resizeBuildPart(parts, index, face, delta, gridMm)` moves one face of a part's box
  (`x+ x- y+ y- z+ z-`, as the part itself sees them) by `delta` millimetres outward: the width, the depth or the height changes and the **opposite face
  stays where it is**, so the centre of the base moves by half of what the face moved (all of it for the bottom, none for the top). The new size is rounded to the grid
  and kept within the size limits, and a face stops at a limit (the centre moves only by what the face really moved). It works along the part's own axes, so a part that
  is turned grows in the direction it is turned. `partFaceCentre` gives where a handle is (on the slope of a side that slopes in: a cone, a pyramid, a frustum), `partAxes` the
  three directions of the part.
- **View** (`PartsView3D.tsx`, `partsDrag.ts`): the selected part shows a white square handle in the middle of each of its faces. Dragging one measures where the
  pointer's ray comes closest to the handle's axis (`axisParameter`, a line-to-ray closest point) and the part is shown at its new size while the pointer is down; one change is
  made when it is let go (a click that does not move changes nothing), as for moving a part. The view-turning controls are off during the drag. The size is rounded to 1 mm.
- Typing a size in the Model panel still works; the handles are an addition.

## Consequences

- A Bézier curve is cut as a polyline like every curve here: a cutter or an SVG path takes straight pieces. The pieces are about a millimetre long.
- There is no way yet to add or remove a point of a Bézier curve (the outline tool is for new lines); an item's points are those it was drawn with.
- The Build view changes the size of a part, not its proportions together; each handle changes one dimension. A cylinder's width and depth are its two diameters.
- Checked in the running studio: the handles of a converted spline, dragging one (the curve peaks where the handle was pulled), undo and redo, Alt-drag, double-click on a point, and a
  Cricut SVG from the curve; in the Build view a real mouse drag of a handle made a cube wider with the opposite face staying put. Nothing has been cut on a machine or folded.
