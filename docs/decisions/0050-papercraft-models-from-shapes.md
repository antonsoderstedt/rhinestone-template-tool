# ADR 0050: Models from the tool's 2D shapes

**Status:** accepted · **Date:** 2026-11-26 · Replaces "shapes made from the tool's 2D shapes later" in the plan (ADR 0037).

## Decision

- **A flat shape becomes a model** in one of two ways: a **box in the shape** (the outline pulled up to a depth, `extrudeShape`) or **the shape spun round** its vertical middle like a vase (`latheShape`: at each height the radius is half the width of the shape there).
  The shape is the gallery's (heart, star, crown, cloud, paw and so on) or an **SVG file of the person's own** (up to 2 MB; the same safe reader as the Artwork tool: scripts, images and links are refused).
- **The artwork is a list of filled regions** (`ShapeRegion`: contours and a fill rule, any units, y up), read by `importSvgArtwork` in the studio's adapter (`papercraftShapes.ts`), which flips the SVG's y. Filled shapes count; a file with only outlines counts by its closed lines.
- **Overlap, holes and loose pieces are handled on a grid, not by polygon arithmetic.** The shape is drawn on a 256-cell grid (each region by its own fill rule, all of them added), pieces that are close are joined (the shape is grown until it is one piece and shrunk the same
  amount: gaps up to about 16 % of the shape), the outer edge of the biggest piece is followed along the cells, and the corners that matter least are taken away (smallest triangle with the neighbours first) until the number asked for is left.
  A single contour skips the grid and is simplified as it is, so a heart keeps its curves. The engine says how many separate pieces were left out; holes are filled.
- **In the studio** a new section, Make a model from a shape: pick a shape or an SVG file, a mode, then Corners and Depth (a box: 6 to 40 corners, 10 to 100 % deep) or Rings and Sides (spun: 4 to 14 and 5 to 16). The model is made at once and again on every change; it is an ordinary imported-style model (kept as a mesh), so Detail, saving,
  sharing and syncing work as they do for a file, and a change keeps the size and starts no new design.
- Pure and deterministic; the engine takes no SVG (the adapter does).

## Result

All 20 gallery shapes make a closed box (at most 18 faces at 16 corners) and a closed spun model (50 to 90 faces) that unfold into parts on A4 at 120 mm. A spun model has many faces and wants a bigger size than a box: a heart at 100 mm has narrow tabs.

## Not done

Holes kept as holes (a ring is a solid box), separate pieces as separate models, text and photos as shapes (an outline of letters needs the Text tool's outlines), a rounded or bevelled edge. Not tried on real paper.
