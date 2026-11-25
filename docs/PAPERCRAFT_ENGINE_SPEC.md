# Papercraft engine specification

**Status:** implemented · **Date:** 2026-11-25 (studio: ADR 0038) · **Decision:** ADR 0037 · **Plan:** `docs/PAPERCRAFT_PLAN.md`

Code: `src/lib/papercraft-engine/`. Tests: `tests/papercraft*.test.ts`. All lengths are millimetres. 2D coordinates have y up; SVG export
flips y so the picture is not mirrored. Everything is deterministic.

## Pipeline

`createPapercraft({ mesh, scale?, build?, pattern?, page? })`:

1. **scaleMesh** to a chosen width, depth, height, largest side or factor.
2. **buildSolid** (clean-up, below) gives a `Solid`: vertices, faces (counter-clockwise from outside), edges with their faces, warnings.
3. **buildPattern** unfolds the solid and decorates the parts: `Pattern` with parts, tabs, fold lines, labels, cut outlines.
4. **layoutPages** packs the parts onto pages.
5. **renderPages** gives drawings; **exportPageSvg** and **exportPdf** write files.

## Cleaning a mesh (`buildSolid`)

In this order: weld vertices (distance 1e-6 of the model's diagonal, found with a spatial hash); remove repeated corners and faces with fewer
than 3 distinct corners; split polygons that are not flat (deviation over 1 % of the face's size) into triangles; remove zero-area faces;
remove duplicate faces; make the winding consistent (breadth-first over manifold edges, flipping a face that traverses a shared edge in
the same direction as its neighbour; a conflict that cannot be fixed is `non-orientable`); turn closed shells with negative signed volume
(inside out); merge connected faces that are coplanar (normal within 0.5 degrees of the seed face and every corner within 1e-4 of the
diagonal from the seed plane) when their boundary is one simple loop; drop unused vertices; build the edge table.

Warnings (code, plain-language default text, count): `degenerate-faces-removed`, `duplicate-faces-removed`, `nonplanar-face-split`,
`orientation-fixed`, `non-orientable`, `inverted-normals-fixed`, `multiple-shells`, `open-edges`, `non-manifold-edges`, `empty`. The app
translates by code. Open edges (one face) are cut and have no tab; edges with more than two faces are always cut.

## Unfolding (`unfold`)

Each face gets 2D corners in its own frame (`planarCoordinates`: origin at its first corner, x along its first edge, counter-clockwise from
its normal) and a triangulation (ear clipping; collinear corners dropped). Faces start as one-face parts.

Edges that have two faces and are not forced cut are visited in this order: forced joins first, then by weight `length * (1 + 0.5 * max(0,
n1 . n2))` (long and nearly flat first), ties by edge id. For an edge between two different parts, the smaller part is moved by the rigid
motion (rotation and translation, no mirroring) that makes the shared edge coincide; the faces then lie on opposite sides of it because
both are counter-clockwise. The join is made only if (a) no triangle of the moved faces overlaps a triangle of the staying faces (SAT on
convex triangles, bounding-box prefilter, touching within 1e-4 mm is not overlap) and (b) when a page limit is set, the convex hull of the
joined part fits the limit in some rotation. Otherwise the edge stays cut. Joined edges form a spanning forest, so
`joined edges = faces - parts`. Edges within one part that are not joined are cut and glued.

`maxPartSize` for the faces is the page's usable size minus two tab widths, so tabs always fit.

## Tabs, numbers and lines (`buildPattern`)

- **Numbers.** Every cut edge with two faces is a pair and gets a number 1..N in part order (faces by id, edges in face order).
- **Tab.** For a pair, the side in the part with fewer tabs so far is tried first (ties by face id), then the other. A tab on edge P-Q
  (outward normal to the right of P to Q) is the quadrilateral P, Q, Q + w*o - d*i, P + w*o + d*i where w is the width and i = min(w / tan(a),
  0.4 * |PQ|). Tried in order: width from `tabWidthMm` down by factors of 0.75 to `minTabWidthMm`; for each width the side angle from `tabAngleDeg`
  then 30, 20 and 12 degrees. A tab is accepted when it overlaps no face triangle and no earlier tab of the part. The first full-width
  tab wins; otherwise the widest found on either side; if none, `tab-missing`. Narrowed tabs give `tab-narrowed`.
- **Folds.** Each joined edge is a fold line: `flat` when the faces differ by less than 0.5 degrees; otherwise mountain or valley. Seen from
  the printed side a convex corner (ridge toward the viewer) is a mountain fold, a concave corner a valley fold; `printedSide: 'inside'`
  swaps them. The base of every tab is a `tab` fold line.
- **Labels.** The number is drawn on the tab (if it is at least 1.4 times the text height wide) and on the opposite face's edge; if there
  is no wide tab it is drawn on both faces. Part numbers sit at the centre of the largest face when it is large enough. Text is kept
  readable (never upside down).
- **Cut outlines.** Directed cut segments (an edge with a tab becomes P, P', Q', Q) are chained into closed outlines per part.
- Parts are moved so the lower left of their bounding box (including tabs) is at 0, 0, and numbered by area, largest first.

## Pages (`layoutPages`)

`PageSettings.rotation` decides how parts may be turned. `none`: as unfolded. `quarter` (default): 0 and 90 degrees, and the free turns
below only for a part that fits no other way. `free`: for each part the candidate rotations are the ones that align a convex hull edge
with the x axis, plus 90 degrees; the smallest box wins and the unrotated one wins near-ties. Parts are placed largest first with MaxRects (best short side fit), first on existing pages then on a new
one. A gap is kept between parts and a margin around the page. A part that does not fit an empty page in any rotation gets its own page and
`part-too-large`. Presets: A4, Letter, and the usable area of the Cricut 12x12 and 12x24 inch mats (292.1 x 292.1 and 292.1 x 596.9 mm, the figures the Rhinestone studio uses; to be confirmed on the machine).

## Fold animation (`buildFoldTree`, `foldPoses`)

`buildFoldTree(solid, pattern.joinedEdgeIds, partFaceIds)` gives, for every face, its parent (the first face of the part is the root, the
others hang from it along folded edges), the hinge line in the finished model and `flatAngle`: the signed angle about the hinge that
lays the face flat with its parent, both facing outward. `foldPoses(tree, folded)` returns one 4x4 matrix per face for a fold amount from 1
(the finished model: identity) to 0 (each part flat): the face's pose is its parent's pose times a rotation about the hinge by `flatAngle * (1 - folded)`.
Faces stay rigid at every step, and at 0 the corner distances equal the pattern's. `faceTriangles` triangulates a face for drawing.

## Edges for editing

Every part lists `edgeSegments`: each face edge with the edge id of the solid, its two points in the part's frame, a state (`joined`,
`cut` with its glue number, or `open`) (joined edges once). `Pattern.joinedEdgeIds` lists the folded edges. The studio uses them to let the
owner cut or join an edge and to build the hinge tree.

## Export

- **SVG** (`exportPageSvg(drawing, 'cricut' | 'print')`): `width` and `height` in mm and a matching `viewBox`; plain `<path>` elements in `<g>`
  groups. Cricut: `cut` black, `score` red (all folds except `flat`), `numbers` blue, all solid, 0.1 mm. Print: `cut` black, `fold-mountain`
  dash-dot, `fold-valley` and `fold-tab` dashed, `fold-flat` thin grey, `numbers` black. No `<use>`, no nested `<svg>`, no opacity, no
  `<text>`, no raster.
- **PDF** (`exportPdf`): PDF 1.4, one page per drawing, size in points from mm, lines only, dash patterns for folds, no fonts, no
  images, no dates; correct cross-reference table; same drawings always give the same bytes.
- **Numbers** are drawn with a seven-segment stroke font (`strokeText`): digits, `-`, `/`, `.`, `x`.

## Not in this version

Cover page and instructions, page map, parts bigger than a page split along a fold with registration marks, coloured/textured faces, GLB
reading in the engine (done in the app), import of finished PDF patterns, Silhouette DXF, mesh simplification, true polygon nesting.
