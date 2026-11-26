# ADR 0048: Horns, manes and tufts

**Status:** accepted · **Date:** 2026-11-26 · Builds on ADR 0044 to 0047.

## Decision

- No new kind of limb: a horn, an antler, a mane and a tuft are the limbs of ADR 0044 pulled out of other faces. **`crest`** in the animal spec now takes a list: each entry grows a limb out of the flat top between two sections
  (a horn on the forehead, a mane as a long fin along the neck). Horns and antlers are `ears` (side or shoulder faces of the head pulled up and out); a nose horn is `nose` bent upward; a tail **tuft** is a last tail step
  that is wider than the step before it. Two limbs cannot grow from faces that share a corner (the model would pinch), so a top face and a shoulder face of the same pair are not both used.
- Five animals: **unicorn** (a horse with a horn and a mane along the neck), **deer** (antlers), **lion** (a big mane built as wide sections around the head, and a tufted tail), **rhino** (a horn on the nose and one on the
  forehead) and **bull** (horns and a tufted tail). Same checks as every built-in model: a clean mesh, no edge under 8 mm at the default size, at most 100 faces, at most one glued edge with no room for a tab.

## Result (A4)

| Model | mm | Faces | Parts | Edges to glue | Without a tab | Shortest edge |
|---|---|---|---|---|---|---|
| Unicorn | 300 | 94 | 8 | 100 | 0 | 8.8 mm |
| Deer | 280 | 98 | 7 | 105 | 0 | 8.3 mm |
| Lion | 240 | 78 | 5 | 89 | 0 | 9.8 mm |
| Rhino | 240 | 78 | 7 | 91 | 0 | 9.5 mm |
| Bull | 240 | 88 | 6 | 102 | 0 | 8.2 mm |

## Not done

Curled horns (a ram), branching antlers with more than two tines, a mane of separate tufts around a face. Not tried on real paper.
