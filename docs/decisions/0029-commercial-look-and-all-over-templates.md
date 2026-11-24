# ADR 0029: Commercial look for shapes, and all-over templates

**Status:** accepted · **Date:** 2026-11-23

## Why

Shapes from the gallery looked unlike commercial rhinestone templates: stones packed at the tightest spacing, rings that ran into
each other in the middle, a lopsided fill, and a faint copy of the shape behind them that made the placement look worse. A
commercial SS10 heart of about 100 mm has 236 stones (a bridge of about 2 mm between holes); ours had about 410.

## Decision

- **Solid** is now an edge ring (one row along the outline) plus straight rows of stones inside, as one hex lattice centred on the
  shape, kept at least 0.92 of a pitch away from the ring (`layoutRows` options `fillRemainder`, `latticeClearance`). Rows look
  (a few rings) and Outline are unchanged.
- **Airy** spacing (about 1.55 hole diameters, 5.3 mm for SS10) is a new density preset, and ready-made shapes start with it. A
  100 mm heart now has 234 stones. Uploaded artwork starts at Standard, no longer Dense (tighter than recommended, needs
  calibration first). Anyone choosing a spacing explicitly keeps it.
- The original behind the stones is off by default (a checkbox turns it on).
- **All-over templates** (`allOver/allOverTemplate.ts`, Grid tool > "Cover an area"): grid, offset rows, diagonal, scatter
  (seeded Poisson-disc: random-looking but the same for a seed) and fade (spacing grows towards the bottom), for any area. Sizes for
  a back pocket, jeans leg, sleeve and so on are one click. Over 40,000 stones is refused. Saved as part of the grid project state.
- Twenty ready-made shapes (eleven new), every one tested to be cuttable in every look at 100 mm.
- The Artwork panel can pick a file from the Library as well as from the computer.
