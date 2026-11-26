# ADR 0044: Animals with legs

**Status:** accepted · **Date:** 2026-11-26 · Replaces "low-poly animals with legs" under "Not in this phase" in ADR 0040.

## Why

The built-in animals were a fish and a swan, both a single body swept along a curve. An animal with legs, ears, a tail and a trunk is the shape people ask for first,
and ADR 0040 left it out because those are several bodies that have to be joined: loose parts glued on at the end would have no glue tabs where they meet the body and
would not unfold as one net.

## Decision

- **A limb grows out of a face of the body** (`extrudeFaces(mesh, [{ face, steps }])` in `mesh/limbs.ts`). The face is taken away and a tube takes its place: every step is a ring that is a copy of the
  ring before it, moved and scaled about its own centre, with a wall of flat four-sided faces between the two; the last ring is closed with a flat face (the foot, the tip of an ear). Rings are only
  moved and scaled, so every wall is flat and no face has to be split. The result is **one closed solid** (Euler number 2 is kept) that unfolds into one net.
  It refuses a face that does not exist, no steps, a scale of 0, one face used twice, and two faces that touch, even at a corner (the model would pinch there).
- **A body along a curve with any cross-section** (`ringSweep(sections, profile)`): like `sweep`, but the cross-section is a list of corners, so the underside can have flat pads where the legs grow, and a flat face
  between two sections is kept as one four-sided face (`quad(section, edge)`) instead of two triangles. A section can have a `tilt` of its own (two neighbouring sections with the same size and tilt give flat side faces, which is
  what an ear grows out of) and a `profile` of its own with the same number of corners: corners that are the same point count once, so a section can be a box (four corners) where the others have eight.
  The two ends are flat faces: the rear one is where a tail grows, the front one where a trunk or a snout grows.
- **Six animals** (`mesh/animals.ts`, `buildAnimal(spec)`): dog, cat, pig, horse, elephant and giraffe. Each is a list of sections from the tail to the nose and a few limbs: a pair of legs at two places under the body (the
  steps say how far down, how far forward and how much narrower each ring is), ears, a tail and a nose or trunk. Left and right are mirrored, the feet stand on z = 0 (the last step of a leg takes what is left of the way down), and the
  body is level where the legs grow. All six are in the model list under Animals, with default sizes from 200 to 320 mm.
- **Made to fit the checks every built-in model has to pass**: a clean mesh, no edge under 8 mm at the default size, at most 100 faces, at most one glued edge with no room for a tab. Details that came out too small were
  made bigger (a tail or a muzzle is a box, not an eight-sided tube; an ear is one step; the neck has few sections) rather than the check being relaxed.

## Result (A4, default sizes)

| Model | mm | Faces | Parts | Edges to glue | Without a tab | Shortest edge |
|---|---|---|---|---|---|---|
| Dog | 240 | 94 | 6 | 104 | 1 | 8.9 mm |
| Cat | 200 | 90 | 6 | 94 | 0 | 8.3 mm |
| Pig | 210 | 88 | 5 | 93 | 0 | 8.5 mm |
| Horse | 280 | 94 | 7 | 103 | 1 | 8.2 mm |
| Elephant | 200 | 92 | 8 | 98 | 0 | 8.8 mm |
| Giraffe | 320 | 95 | 9 | 107 | 0 | 8.1 mm |

All six are rated expert by the rule of thumb (about 100 glued edges is hard, and a shortest edge under 15 mm makes it one step harder): three to three and a half hours by that rule. They are not first models.

## Consequences

- The animals are blocky: eight-sided bodies, tubes for legs, a few faces for a head. That is what keeps them buildable; the owner's own models are what the studio is for.
- The legs are tubes of four sides, so a leg is a strip of four faces with a foot, glued along one seam.
- Not done: horns, manes, toes, a second kind of body (a bird on two legs needs a body that stands up), faces that are not flat as the start of a limb.
- A model built on real paper has not been tried: whether the legs hold the weight of a 300 mm giraffe, and whether the glue tabs of a 4 mm tail tip are workable, need the owner.
