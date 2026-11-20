# ADR 0021 — Artwork layout from distance fields, colour layers and a feasibility check

**Date:** 2026-11-20  
**Status:** Accepted

## Context

Measured on the owner's logos (see `docs/QUALITY_REPORT.md`, ADR 0020): the outline generator put two rows of stones in
strokes narrower than two stones (collisions, tight gaps), shapes close to each other collided, the fill was a clipped grid that
dropped thin parts and left strays, the contour generator offset polygons vertex by vertex, fill colour was never read, and a
logo too small for the stone simply came out as scattered dots with no explanation.

## Decision

1. **One pipeline for every look.** Layers by colour (painted in order), a signed distance field per layer, rows that are the
   field's iso-contours one pitch apart, one spacing rule at the end. Outline, Rows and Solid are the same algorithm with
   one row, a few rows, or all rows plus a hex fill of the remainder. Details are in the spec.
2. **Raster fields instead of polygon clipping.** Overlap, holes, touching letters, narrow necks and offsets all come from one
   distance transform, deterministic and short, at the cost of about 0.1-0.4 mm of resolution, far below a stone.
3. **Narrow parts get one row down the middle** (merge of the two edge rows, then centring along the ridge), never two
   colliding rows.
4. **Say it before generating it:** a feasibility analysis per stone size gives the share of detail thinner than a stone, the
   shapes that get none, and the width at which it works. The panel offers "Make it N mm wide" and "Use SS6 stones".
5. **The tool keeps its stored fields** (coverage mode, contour settings): Outline, Rows and Solid map onto them, so every
   saved project opens. New persisted field: `layerRoles`. Raster images join the same pipeline (plan J13, below).
6. The old generators stay in the engine for text and other tools, and in the quality harness for comparison.

## Raster images (J13, J14)

`buildRasterLayers` (artwork/rasterLayers.ts): the image is box-filtered to at most 1200 px, the background removed (transparent
pixels, or the colour that fills 85 % of the border; a picture with neither is cut by a brightness cutoff, with a note), the
rest reduced to 1-4 colours by a deterministic k-means (start: quantiles of brightness), smoothed according to `detail`, and
placed on the millimetre grid as one mask per colour. From there it is the same layout as SVG artwork. A newly chosen image starts
as Solid. The colour-count buttons show their state, the panel has the same look, colour list, size advice and mm / in switch as
SVG artwork.

## Results (full matrix, 16 fixtures, 90 runs per look; `npm run quality`)

| Look | Cuttable runs | Outside | Strays |
|---|---|---|---|
| old Outline | 73 % | 0 | 0 |
| old Outline + Fill | 82 % | 0 | 0 |
| new Outline | 100 % | 0 | 0 |
| new Rows | 100 % | 0 | 0 |
| new Solid | 100 % (area covered 95 %) | 0 | 2 |

Generation takes 25-700 ms for the owner's logos (the large solid lips at 500 mm, 8,700 stones, is the slowest); the
feasibility analysis 50-170 ms.

## Consequences and limits

- Small text lines in a large logo (for example "DEMON HUNTERS" under a big "KPOP") are shown as single dotted lines; that is
  what the stone size allows, and the advice says so by shape count, not by area share.
- Corners come from a 35° turn on the simplified contour; very soft corners are rounded.
- Not yet: colours as separate stone colours (B4), a worker for large designs
  (C4), and a preview of the source behind the stones (J3 extension).
