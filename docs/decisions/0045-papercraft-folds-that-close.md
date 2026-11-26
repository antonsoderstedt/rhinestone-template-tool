# ADR 0045: Folds that close by themselves

**Status:** accepted · **Date:** 2026-11-26 · Extends the unfolding in ADR 0038 (`unfold`) and the tabs in ADR 0042.

## Why

When the first animals were unfolded, up to sixteen glued edges per model had no room for a glue tab, far more than any earlier model (at most one). A picture of the net showed why. Many of the edges
with no tab were between two faces that lay **edge to edge in the same part** already: the unfolding had placed them next to each other, but the edge between them was a cut. The neighbour is exactly where the tab
would go, so no tab fits on either side, and the person would be told to glue an edge that is already together.

That happens at a corner where the faces around it add up to 360 degrees: a box leg that meets a flat underside, an ear on a flat top. Going round the corner through the other faces brings the two
faces back to the same place. Convex solids and curved ones (cube, icosahedron, vase, bottle, swan) have no such corner.

## Decision

- After the parts are built, **`unfold` joins every cut edge whose two faces are in the same part and already lie on the same place** (both ends of the edge within 1e-6 mm). Nothing moves: no face is placed again, so no
  overlap can appear. Edges the person asked to cut (`forceCutEdges`) and edges shared by more than two faces are left alone.
- So a part is a tree of faces plus a few extra folds, and `joined edges = faces - parts` only holds for a model with no such corner. `Pattern.joinedEdgeIds`, `stats.foldCount` and `edgePairCount` count the extra folds.
  They are drawn as fold lines (mountain or valley by the angle between the faces) and have no number and no tab.
- The fold animation is unchanged: `buildFoldTree` hangs the faces from the first face along the folds and skips an edge that closes a loop, so the extra folds only matter in the finished model, where they agree.
- Clicking such an edge in the pattern cuts it, as for any fold.

## Result

The elephant at 200 mm had 8 glued edges with no tab; now it has none. Every earlier built-in model unfolds exactly as before (none has such a corner). All six animals are at most one edge from complete, and the
glued edges fell by up to ten on one model (the elephant).

## Consequences

- Fewer glued edges and fewer tabs on models that are made of boxes joined to flat faces (animals, houses with a porch, furniture).
- A cycle of folds is rigid: the finished model closes, but the flat net cannot be folded halfway along those edges independently. For paper that does not matter, and the fold animation in the studio uses the tree.
