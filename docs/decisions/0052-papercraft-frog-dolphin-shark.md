# ADR 0052: Frog, dolphin and shark

**Status:** accepted · **Date:** 2026-11-26 · Builds on ADR 0044 to 0048.

## Decision

- Three more built-in animals, made from nothing but the existing body and limbs (`buildAnimal`); no new engine function. Own designs: the owner's reference renders of low-poly models were only a guide to which animals to make, nothing in them was copied.
- **Frog**: a wide, low body with the hind legs folded in two steps and ending in a flat foot (`scale` above 1), short front legs with flat feet, and the eyes as two limbs out of the shoulders of the head.
- **Shark** and **dolphin**: swimmers that lie on their flat belly (the belly is level where the body is widest, so the model rests on it). Dorsal fin as a `crest` limb, flippers or side fins as `ears` on the side faces, a tail from the rear box (the shark's is tall, the dolphin's is a wide flat wedge made by a rear section that is wide and low), a nose or beak from the front box.
- The same checks as every built-in model (clean mesh, no edge under 8 mm at the default size, at most 100 faces, at most one glued edge with no room for a tab).

## Result (A4)

| Model | mm | Faces | Parts | Edges to glue | Shortest edge |
|---|---|---|---|---|---|
| Frog | 200 | 91 | 6 | 92 | 11.2 mm |
| Dolphin | 280 | 71 | 6 | 66 | 8.1 mm |
| Shark | 280 | 69 | 6 | 60 | 10.8 mm |

All three are rated expert. Not tried on real paper.
