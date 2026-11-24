# ADR 0020 — Measure artwork quality; read SVG the way a viewer does

**Date:** 2026-11-20  
**Status:** Accepted

## Context

The improvement plan (`IMPROVEMENT_PLAN.md`) found that the Artwork tool could not be judged: only "cuttable" was checked,
never "does it look like the artwork". Probing the importer with the owner's real logos and small synthetic files showed it
dropped or mangled common real-world SVG: group transforms were ignored (shapes landed on top of each other), arc commands
and `<use>` threw, hidden shapes were included, `<style>` was flagged unsafe.

## Decision

1. **Measure first.** `measureArtworkQuality` (area and outline coverage, strays, outside stones, smallest gap) plus a fixture
   corpus (`tests/fixtures/artwork/`: the owner's two logos, 13 synthetic files, a git-ignored `local/` for third-party art)
   and `npm run quality`. A regression test holds every generator to `tests/quality/baseline.json`: a change may improve a
   number and may not worsen one; improvements ratchet the baseline forward in the same commit, with the reason.
2. **A real importer.** `importSvgArtwork` (see the spec) replaces the regex scan: element tree, group transforms, `<use>`,
   CSS classes and the cascade, `fill-rule`, arcs, rounded rects, hidden elements, units. `svgStringToPolylines` keeps its API
   as a wrapper, so the generators and the editor are unchanged.
3. **Safety rewritten, not loosened.** Local references (`#id`) and `<style>` are allowed because the importer parses them
   itself and never renders or follows anything; scripts, event handlers, embedded images, entity declarations, data URLs,
   `@import` and every non-local link are refused.
4. The importer returns colour, stroke and fill rule per shape so that colour layers (J6) can be built without re-parsing.

## Consequences

- 15 of the 16 fixtures import; the one that does not (text without outlines) says how to convert it.
- Baseline ratchet in this change: `group-transform` coverage figures moved because its shapes are now in the right places
  (before, all three overlapped at the origin); the `hidden-elements` and `style-classes` fixtures changed for the same kind
  of reason (invisible shapes are no longer generated).
- Not done here (next in the plan): colour layers and background removal (J6), a size / feasibility check (J7), centre-line
  layout for thin strokes (J8), fill and contour rewrites (J9, J10), one gap solver (J11).
