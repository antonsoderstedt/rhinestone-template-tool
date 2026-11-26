# ADR 0046: Birds on two legs

**Status:** accepted · **Date:** 2026-11-26 · Builds on ADR 0044.

## Decision

- Three birds, built with the same body and limbs as the four-legged animals (`buildAnimal`): **duck**, **chicken** and **flamingo**. A bird has one pair of legs, grown from the two pads under the body.
  The body is long and level with the neck rising to the head (as for the giraffe), so no new kind of body is needed; a bird that stands upright (a penguin, an owl) would need a body along a vertical line and is not done.
- A leg ends in a **flat foot**: the last step is wider than the leg (scale 2) and short, so the bird stands on two plates. The wings are the side faces pulled outward and back; the bill grows out of the front box; the tail out of the rear box.
- **`crest`** in the spec grows one limb from the flat top between two sections (the comb of the chicken).
- The pads are narrower and further from the sides (`pad: [0.3, 0.75]`): the legs sit under the middle of the body, and the underside of a thin neck keeps an edge long enough to fold.
- The same checks as every built-in model: a clean mesh, no edge under 8 mm at the default size, at most 100 faces, at most one glued edge with no room for a tab.

## Result (A4, default sizes)

| Model | mm | Faces | Parts | Edges to glue | Without a tab | Shortest edge |
|---|---|---|---|---|---|---|
| Duck | 240 | 86 | 6 | 91 | 0 | 8.2 mm |
| Chicken | 240 | 87 | 9 | 91 | 0 | 8.5 mm |
| Flamingo | 350 | 92 | 8 | 103 | 0 | 8.0 mm |

All three are rated expert by the rule of thumb. Not tried on real paper: whether two thin legs hold a 350 mm flamingo (the flat feet help, but paper legs of 8 mm will bend).
