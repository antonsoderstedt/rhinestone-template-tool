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

Then one more fold is made wherever it costs nothing (ADR 0045): a cut edge, not forced cut and with two faces, whose two faces are in the same part and already lie on the same place
(both ends within 1e-6 mm) becomes a fold. That happens at a corner where the faces around it add up to 360 degrees (a box leg on a flat underside). Nothing moves. For a model with no such corner
`joined edges = faces - parts` still holds; otherwise `joined edges` is larger and a part is a tree of faces with a few folds that close loops. `buildFoldTree` skips an edge that closes a loop.

`maxPartSize` for the faces is the page's usable size minus two tab widths, so tabs always fit.

## Choosing the net (`buildPattern`)

`unfold` takes a `weightVariant`, the rule that orders the edges: 0 long and flat first (`length * (1 + 0.5 * flatness)`), 1 long, 2 flat then long, 3 and 4 flat weighted more, 5 and 6 by edge
number (descending, ascending), 7 short first, 8 long and bent first, 9 bent first, 10 and 11 two fixed pseudo-random orders. `buildPattern` tries `UNFOLD_RULES` (0, 1, 7, 6, 8, 5, 9, 2, 4, 3, 10, 11) in that order, as many as
`rulesToTry(faces)` says (12 up to 150 faces, 6 up to 500, 3 up to 1 500, else 1), builds the whole pattern with each (`buildPatternWithRule`) and keeps the lowest `patternScore` (10 for each glued edge with no tab, 3 for each very narrow tab, 2 for each
part beyond the first, 0.5 for each narrowed tab; the earlier rule wins a tie; it stops early only at a score of 0: one part, no missing, very narrow or narrowed tab). With `weightVariant` given, only that rule is used. With edges cut or joined by hand, the rule
that won without the edits is used, so the net stays as it was. `Pattern.rule` is the rule used and `Pattern.missingTabEdgeIds` the glued edges that got no tab.

## Tabs, numbers and lines (`buildPattern`)

- **Numbers.** Every cut edge with two faces is a pair and gets a number 1..N in part order (faces by id, edges in face order).
- **Tab.** The pairs are placed from the tightest to the roomiest (room measured per pair with the faces only, before any tab is placed). For a pair, the side in the part with fewer tabs so far is tried first (ties by face id), then the other. A tab on edge P-Q
  (outward normal to the right of P to Q) is the quadrilateral P, Q, Q + w*o - d*i, P + w*o + d*i where w is the width and i = min(w / tan(a),
  0.4 * |PQ|). Tried in order: width from `tabWidthMm` down by factors of 0.75 to `minTabWidthMm`; for each width the side angle from `tabAngleDeg`
  then 30, 20 and 12 degrees, then a triangle that comes to a point in the middle of the edge; widths go down to 0.4 times `minTabWidthMm` (at least 1.2 mm), and a tab under `minTabWidthMm` is reported as `tab-very-narrow`. A tab is accepted when it overlaps no face triangle and no earlier tab of the part. The first full-width
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
- **PDF** (`exportPdf`): PDF 1.4, one page per drawing, size in points from mm, lines and filled shapes, dash patterns for folds, no
  embedded fonts, no images, no dates; correct cross-reference table; same drawings always give the same bytes. Text is only on a
  cover page (`TextRun`), in the built-in Helvetica and Helvetica-Bold with WinAnsi encoding; the two font objects are added only when
  some page has text.
- **Numbers** are drawn with a seven-segment stroke font (`strokeText`): digits, `-`, `/`, `.`, `x`.

## Built-in shapes and repair

Generators (all in `mesh/shapes.ts`, sizes in mm, scaled by the studio): `lathe(profile, segments)`, `extrude(outline, depth)` (outline in any winding), `sweep(sections,
sides)`: a ring of `sides` corners at every section of a curve in the x-z plane (x forward, z up), the ring standing across the curve with the sideways direction fixed
as y; `top` and `bottom` stretch the top or bottom corner of a section (a fin; needs a multiple of 4 sides); both ends are a point (width and height 0) or a flat cap; four-sided
rings of triangles where the corners are not flat. Named models: `vase`, `bottle`, `lantern`, `egg`, `rocket`, `house`, `heartBox`, `starBox`, `fish`, `swan`, `gem`, the animals with legs below, and the solids of ADR 0037.
`fillHoles(mesh, maxLoopSize = 400)` cleans the mesh, follows each loop of open edges in the direction the faces run along it, and caps it with the loop reversed: one polygon when the
loop is flat (deviation under 2 % of the square root of its area) and triangles around its centre otherwise; it returns the new mesh with the number of holes `filled` and `skipped`.
`flipFaces(mesh)` reverses every face. `boundaryLoops(solid)` lists the loops. `projectSolid(solid, colourOf)` draws a solid without unfolding it (for the pictures in the model list).

Limbs and animals (ADR 0044, `mesh/limbs.ts`, `mesh/animals.ts`). `extrudeFaces(mesh, [{ face, steps: [{ by, scale }] }])` takes each listed face away and grows a tube out of its edges: one ring per step, a copy of the ring
before it moved by `by` (from the centre of that ring) and scaled by `scale` about its own centre, a wall of flat four-sided faces between two rings, the last ring closed. A wall that runs along an edge of the removed face
goes the same way along that edge, so the walls join the faces next to the hole and the result is closed. It throws a `RangeError` for a face that does not exist, no steps, a scale of 0 or less, a face used twice, or two faces that share a corner.
`ringSweep(sections, profile)` is `sweep` with any cross-section: `sections` are `{ x, z, width, height, tilt?, profile? }` along a curve in the x-z plane, `profile` lists the corners as [sideways, up] between -1 and 1 counter-clockwise
seen from the front with y to the right. The ring of a section stands across the curve (the direction from the section before to the section after, or `tilt` radians above the x axis when given); a section's own `profile` must have as
many corners, and corners next to each other that are the same point share one vertex. A face between two sections is one four-sided face when its four corners are flat (to 1e-9) and two triangles when not; `quad(p, i)` gives
the index of the flat face between section p and p + 1 at profile edge i. The two ends are flat faces (`startCap`, `endCap`). `buildAnimal(spec)` makes the body from `sections` with an eight-corner profile (two flat pads and a flat belly,
a side and a shoulder on each side, a flat top; pads from `pad[0]` to `pad[1]` of the half width), then grows the legs from the pads of a pair of sections (left and right, the last step reaching z = 0), the ears from the shoulder or side faces, a
tail from the rear end and a nose or trunk from the front end; `boxRear` and `boxFront` make the end sections boxes. `crest: { pair, steps }` grows one limb from the flat top (a comb). Named animals: `dog`, `cat`, `pig`, `horse`, `elephant`, `giraffe`, and the birds on two legs (ADR 0046) `duck`, `chicken`, `flamingo`; a leg can end in a flat foot (a last step with a scale above 1).

## Simplifying (`simplifyMesh`)

`simplifyMesh(mesh, { targetFaces, minNormalCosine = 0.2 })` returns `{ mesh, inputFaces, outputFaces, reached }`. Steps: weld corners (1e-6 of the diagonal), cut polygons into triangles (ear
clipping on the plane of the face), drop faces with no area and duplicates, scale to a diagonal of 1. Every corner gets a quadric (ten numbers) from the planes of its faces (weight: the area)
and, on an open border, from a plane through each border edge perpendicular to its face (weight: the edge length squared). Every edge goes in a min-heap by cost (error at the new place plus
1e-9 times the edge length squared, so flat areas go shortest first), then lower corner id, then higher. The place of a collapse: the corner that is locked (on a non-manifold edge) or alone on a
border; for two border corners an end or the middle, only when they share one face; otherwise the least-error one of both ends, the middle and the point where the three planes meet (when the
quadric is well-conditioned and the point is within three edge lengths of the middle). A collapse needs: a shared-neighbour set equal to the far corners of the faces on the edge, no neighbouring face
turned over, shrunk to nothing or bent past `minNormalCosine`, and at least four faces left in its piece. Heap entries carry the versions of their two corners and are skipped when stale; when
the heap is empty and the target is not reached, the heap is rebuilt and the pass repeated until a pass collapses nothing. The output mesh is back in the units of the input.

## Cover page (`renderCover`, `projectModel`, `assessBuild`)

`renderCover(content, solid, pattern, layout, {widthMm, heightMm})` returns a `PageDrawing` with `fills`, `texts` (Helvetica runs), cut
and fold lines (the legend samples) and stroke text (numbers). Layout, top to bottom, inside 15 mm margins: title (shrunk to fit, at most
two lines) and subtitle; the facts on the left (label and wrapped value) and the picture of the model on the right; the legend (left)
and the page map (right); the steps at the bottom (shrunk down to 2.8 mm if they are many). Text width is measured with the Helvetica
metrics (`textWidthMm`) and wrapped (`wrapText`); `toWinAnsi` encodes it. `CoverContent` holds only strings, written by the app.
`projectModel` gives the polygons of the finished model seen from azimuth 35 and elevation 28 degrees (z up), back faces left out, sorted
back to front, coloured by part and shaded. The page map draws each page as a sheet with the hulls and numbers of its parts, with
4 columns or fewer to start with and up to 8 when there are many pages; pages that do not fit are counted in `pageMapMore`.
`assessBuild(pattern, solid)` gives a difficulty and minutes: glued edges up to 15 easy, 45 medium, 120 hard, more expert, one step
harder for a shortest edge under 15 mm; minutes = 10 + parts + 0.4 folds + 1.5 glued edges, rounded to 5 (at least 5).

## Not in this version

Parts bigger than a page split along a fold with registration marks, coloured/textured faces, GLB
reading in the engine (done in the app), import of finished PDF patterns, Silhouette DXF, true polygon nesting.
