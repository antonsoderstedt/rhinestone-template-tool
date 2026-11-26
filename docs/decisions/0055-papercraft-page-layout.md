# ADR 0055: Placing the parts on the pages by hand

**Status:** accepted · **Date:** 2026-11-26 · Builds on the page packing in ADR 0038.

## Why

The pages were laid out by the program with no way to change them: no moving a part to use a mat better, no choosing how many parts go on a page, no way to see why a page is half empty.

## Decision

- **`layoutPages(parts, settings, options)`** takes `LayoutOptions`: `pins` (parts the person has placed, by part id: page, turn, corner of the box, and the size of that box), `maxPartsPerPage` and `tight`.
  Pinned parts stay where they were put, as long as the part still has the size it had when it was pinned (otherwise the pin is ignored, so a changed model never gets a part in the wrong place); the others are packed round them (MaxRects) on pages that have room and fewer parts than the limit.
  With `tight` several orders (area, longest side, height, width, perimeter), turns (as set, and free) and fit rules (best short side, best area, bottom left) are tried and the layout with the fewest pages is kept (never more than the plain packing). Pages with no part are dropped.
  `layoutProblems(layout, parts)` finds parts that stick out over the page and parts that lie over each other; `partBox(part, rotation)` gives the box of a turned part.
- **In the studio** the Pages view is a place to work: drag a part (it snaps to the margin and to other parts within 2.5 mm), drop it on another page, turn it a quarter turn (R, Shift+R), nudge it with the arrow keys (Shift for 5 mm), move it to a page or a new page by name. The first change pins **every** part where it is, so the layout stays as the person left it;
  **Place them again** gives the pages back to the program. A new limit, a change of packing, a new model, a new detail or a repaired mesh places the parts again. Each page says how many parts it has and how full it is.
  The layout is part of the design (saved, shared, synced).

## Result

Tight packing uses fewer pages on one of 39 built-in models at their default size (the horse, 5 to 4): the bounding-box packing was already close for these parts. The gain for the person is the control: a mat can be filled by hand, a page given at most so many parts, a part turned to fit.

## Not done

Packing by the real outline of a part (polygon nesting), which would use the gaps between irregular parts; automatic scrolling while dragging is only near the top and bottom edge; undo of a single move (Place them again undoes all).
