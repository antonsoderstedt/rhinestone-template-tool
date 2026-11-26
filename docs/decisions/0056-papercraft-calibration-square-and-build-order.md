# ADR 0056: A square to measure, and the order to build in

**Status:** accepted · **Date:** 2026-11-26

## Why

Two things the studio could not say: whether the size on the paper (or after the cutting machine) is right, and in which order to glue the parts. The numbers on the parts were their place in the order of size, which says nothing about what to build first.

## Decision

- **A test square** (`LayoutOptions.calibrationMm`, in the studio *Test square on the first page*, 100 mm): a square in the lower left corner of the first page, a part of the page (`Page.marks`) that no part is put on (the packing keeps that corner free, also with tight packing and pins). It is drawn as a cut square with its size written in it (`100x100`, in the number font), so it is on the printed page and on the Cricut SVG and the Silhouette DXF.
  A square under 10 mm, or one that does not fit inside the margins, is left out. A page with only the square is kept. Switching it on or off places the parts again. Off at first.
- **The build order** (`buildOrderOf`, `Pattern.buildOrder`, pure and deterministic): from the glued edge pairs and the parts they are on. It starts with the part glued to the most other parts (ties: the bigger part, then the lower number) and then always takes the part with the most glued edges to what is built, so every step has something to be glued to; a piece that is
  not glued to the rest starts again with the biggest part left. Each step is a part, the edges glued together on the part itself (a seam) and, for each part built before, the edge numbers to glue to it. Every glued edge is in exactly one step.
- **The numbers on the parts** can be the build order (`numberPartsBy: 'build'`, the default in the studio) or the order of size (`'size'`, the default of the engine, and what a design saved before has). With the build order, part 1 is the first to build, so "start with part 1, continue in number order" is true.
- **In the studio**: a Build order section in the settings (each step as sentences in the reader's language; a click shows the part), a choice of what the numbers on the parts are, and the PDF gets the build order as pages (`renderBuildOrderPages`) after the cover when the model has more than one part, with the cover's steps saying so.

## Not done

Pictures of each step, grouping steps (do the head, then the body), a step that says which side of the paper is up, a build order that takes into account what is hard to reach once other parts are glued on (it is an order that works on the flat net, not a proof that every edge can be reached by a finger). Not tried on a real build.
