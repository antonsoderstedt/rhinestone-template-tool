# ADR 0042: Glue tabs on curved models

**Status:** accepted · **Date:** 2026-11-26 · Replaces the "known limit" in ADR 0040.

## Why

On the curved built-in models (vase, bottle, egg, rocket, fish, swan) up to a quarter of the glued edges had no glue tab: the studio said "glue those edges edge to edge",
which is hard to do well. A look at where the room went showed two causes.

1. The net. Where the unfolding leaves only a thin slit between two parts of a net, there is no room for a tab on either side. The same model unfolds very
   differently depending on the order the edges are joined in; for the bottle the number of edges without a tab went from 10 to 0 just by choosing another order.
2. The tab. The narrowest tab was 3 mm, and the edges that were still left had 1 to 3 mm of room.

## Decision

- **Twelve rules for ordering the edges** (`UNFOLD_RULES`, the `weightVariant` of `unfold`): long and flat first (the old rule), long first, short first, by edge number
  either way, flat first, bent first, and two fixed pseudo-random orders. **`buildPattern` tries them and keeps the net with the lowest score** (`patternScore`): 10 for a
  glued edge with no tab, 3 for a very narrow tab, 2 for each part beyond the first, 0.5 for a narrowed tab. Ties keep the earlier rule, so the old net is kept when it is
  as good. How many are tried depends on the size (all twelve up to 150 faces, six up to 500, three up to 1 500, one above), so the work stays under about half a
  second. The result says which rule it used (`Pattern.rule`) and lists the edges still without a tab (`Pattern.missingTabEdgeIds`).
- **A very narrow tab is better than none.** Where nothing else fits, a tab can be as narrow as 0.4 times the minimum width (at least 1.2 mm). It is reported
  as its own warning (`tab-very-narrow`: use a thin line of glue) and counts for more than a narrowed one in the score.
- **Editing by hand does not move the net.** With edges cut or joined by hand, the rule that won without the edits is used, so one click on an edge changes the net only
  where that edge is.
- Tried and dropped: asking for an edge without a tab to be joined and building the net around it. It only moved the missing tab somewhere else.

## Result (built-in models at their default sizes, A4)

Edges without a tab before and after: vase 2 to 0, bottle 10 to 0, egg 10 to 0, rocket 3 to 0, fish 6 to 0, swan 10 to 1. A few tabs are very narrow (the vase 1, the egg 1, the rocket 4, the fish 1).

## Consequences

- Pattern building is up to twelve times slower for a small model (a few milliseconds each, 30 to 50 ms for the curved built-ins).
- The same model can get a different net than before: a design saved with hand edits keeps its edits, but the net around them may be laid out differently.
- A tab of 1.2 to 3 mm is hard to glue; the studio says so, and it is still better than no tab.
