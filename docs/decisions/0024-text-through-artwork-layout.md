# ADR 0024: Outline text uses the artwork layout

**Status:** accepted · **Date:** 2026-11-22 · **Plan items:** B10, C1, C2, H3

## Context

Text from a real font had its own generators (outline pass, glyph scanline fill). They placed stones on the outline whether
or not they fitted, so thin fonts at small sizes had overlapping stones, "Filled typography" left scattered stones that did
not follow the letters (B10), and counters and joins were uneven (C2).

## Decision

For every font except the built-in stroke font, and when the placement pattern is the default one, the glyph outlines are
laid out by `createArtworkTemplate` (ADR 0021), as one black shape with the non-zero rule:

- Outline = one row, Rows = the chosen number of rows, Solid (Filled typography) = every row plus a hex fill of the rest.
- Spacing comes from one rule and nothing is placed outside a letter.
- New option `overhang` in `layoutRows`: a part thinner than a stone gets one row down its middle, the stone reaching a
  little past the edge, instead of no stones at all. Only letters use it; artwork still refuses (and says so, see the
  feasibility advice).
- Stones keep the metadata names the editor already reads (`collisionSource`, `edgeBand`), and the template says
  `textPlacementStrategy: artwork-rows-v1`.
- The built-in stroke font (open lines) and the radial / custom placement patterns keep the old generators.

## Consequences

- Every bundled font at 25, 45 and 60 mm in every look is cuttable: `tests/textPhysicalValidity.test.ts` checks the export
  readiness and the closest pair independently (H3 for outline fonts).
- Thin fonts at small sizes give fewer, evenly spaced stones (e.g. SMOOCH in Archivo Black at 25 mm: 62 stones, not the
  earlier 100+ that overlapped).
