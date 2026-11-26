# ADR 0043: Simplifying heavy models

**Status:** accepted · **Date:** 2026-11-26 · Replaces "heavy models are to be simplified later" in ADR 0038.

## Why

A model over 3 000 faces (after flat neighbours are merged) was refused: the unfolding checks every join for overlap and would freeze the page. Most models
found on the web, or scanned or sculpted, have tens of thousands of faces, so the studio could not open them at all. A paper model is made of a few hundred
faces at most (the owner's reference patterns have 49 parts), so a heavy model has to be reduced anyway.

## Decision

- **`simplifyMesh(mesh, { targetFaces, minNormalCosine? })`** in the engine (`mesh/simplify.ts`): edge collapse with quadric error metrics (Garland and Heckbert, 1997). Each
  corner carries the planes of its faces, weighted by area; the cheapest edge is collapsed first and the new corner goes where the error is smallest (the point where the planes
  meet when there is one near the edge, else an end or the middle). Flat areas lose the most faces; edges and corners that carry the shape lose the least.
- **It keeps the surface a surface.** A collapse is refused when the two corners share a neighbour that is not on the edge (that would pinch the surface), when a face would turn over
  or fold sharper than 78 degrees (`minNormalCosine` 0.2), or when a piece would be left with fewer than four faces. A corner on an open border is held in place by a plane along the border
  and only collapses along the border; corners on non-manifold edges are not touched. Pieces that are not connected never join. A closed model stays closed (Euler number kept) and an open one keeps its border.
- **Pure and deterministic**: millimetres in and out (worked on at a diagonal of 1 inside), tie-breaks by cost, then by corner ids; no random numbers. 330 000 faces down to 400 take about 2.3 s.
- It returns triangles with the winding of the input and says whether the target was `reached` (not when each piece is at its floor).
- **In the studio** a model over 3 000 faces is simplified to 500 when it is imported (the page says so and shows what it was). Under Model, Detail shows the faces and the average edge and lets the person
  simplify to another number, always starting again from the imported mesh. The simplified mesh is the model from then on: it is what is saved, shared and synced (a heavy original would not fit).
  The imported mesh is kept for the visit only (`source.original`, never saved) so "Use the original" can undo it when it is under the limit.
- A model under the limit is not simplified without being asked: it works as before.

## Not done

- Keeping sharp features by angle, textures or colours (the engine has none); a limit on how far the surface may move in millimetres (the target is a number of faces).
- Remeshing to even triangles. The result is what edge collapse gives: some long thin triangles, which the unfolding handles but which make narrow parts.

## Consequences

- A simplified design opens on another device without the file. The original is gone from the design, so a person who wants more detail later imports the file again.
- Edges the person cut or joined by hand belong to the model and start over when the mesh changes (as for repair).
