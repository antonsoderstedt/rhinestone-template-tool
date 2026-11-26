# ADR 0047: Birds that stand upright

**Status:** accepted · **Date:** 2026-11-26 · Builds on ADR 0044 and 0046.

## Decision

- A **penguin** and an **owl**, built with `buildAnimal` from a body that runs up instead of forward: every section has a tilt of 90 degrees, so its ring is level, the body stands on its flat first face
  (the base) and the underside of the profile becomes the **front**. No new kind of body: `ringSweep` already stands a ring across any direction of the curve.
- The spec gets **`feet`** (a pair of limbs out of the two pads on the front between two sections, mirrored left and right: little feet that stick out forward at the bottom, resting on the ground) and **`beak`**
  (one limb out of the flat belly of the front). `legs` is optional. Flippers, wings and ear tufts are side faces pulled outward (`ears` with `edge: 'side'`; the faces must be flat, so the two sections have the same size).
- Same checks as every built-in model: a clean mesh, no edge under 8 mm at the default size, at most 100 faces, at most one glued edge with no room for a tab.

## Result (A4, 240 mm)

| Model | Faces | Parts | Edges to glue | Without a tab | Shortest edge |
|---|---|---|---|---|---|
| Penguin | 82 | 7 | 81 | 0 | 10.3 mm |
| Owl | 93 | 8 | 106 | 0 | 10.4 mm |

Both stand on a flat base, so they are stable without legs to bend. Both are rated expert by the rule of thumb. Not tried on real paper.
