# ADR 0038: Papercraft studio (phase 2)

**Status:** accepted · **Date:** 2026-11-25 · Builds on ADR 0037 (the engine).

## Why

The engine makes patterns from models; the owner needs a place to pick or import a model, see it, change the cuts and get a PDF or a
Cricut SVG.

## Decision

- A third studio at `/papercraft` (`app/papercraft/`), next to Rhinestone and HTV, with the shared top navigation entry, home page
  card, theme, language and unit. It needs no calibration, so the status pill says so.
- **Three views of one pattern:** *3D model* (three.js through react-three-fiber, loaded only when opened), *Pattern* (all parts on one
  big canvas that can be panned and zoomed) and *Pages* (the sheets as they will be printed or cut). Parts have one colour each in 3D and
  in the pattern, and a click on a part selects it in both.
- **Folding in 3D is a real hinge animation** (`foldPoses` in the engine): every face turns about its hinge edge relative to its parent,
  so faces stay rigid at every step. At 0 each part lies flat and matches the pattern (a test checks the corner distances), at 1 it is the model.
  Parts also move apart a little while unfolded so they do not cut through each other.
- **Edges are edited by clicking.** Clicking a fold cuts it, clicking a cut edge folds it; the edit is stored as `forceCutEdges` /
  `forceJoinEdges` (edge ids of the current model) and the unfolding runs again. A join that would make a part overlap itself or
  not fit the page is refused with a warning. The edits are dropped when the model changes.
- **Models:** the built-in shapes of ADR 0037 and files (OBJ, STL; GLB and self-contained glTF through three.js `GLTFLoader`, turned from
  y-up to z-up). Files over 40 MB and models over 3 000 faces are refused with a clear message: the unfolding checks every join for
  overlap and would freeze the page. Heavy models are to be simplified later.
- **The pattern is computed in the browser only** (the studio is loaded client-side): the server's and the browser's floating-point
  results could differ in the last digit and React would refuse to hydrate. It is computed from the inputs that decide it, deferred,
  so typing in a field stays responsive; moving the fold slider or switching view never recomputes it.
- **Page turning:** parts are turned by quarter turns on the page (neat, easy to cut) and freely only when a part does not fit otherwise
  (`PageSettings.rotation`: `none`, `quarter`, `free`). The Pattern view uses `none`.
- **Cricut mats** use the usable cutting area the Rhinestone studio already uses (292.1 x 292.1 and 292.1 x 596.9 mm).
- **Export:** a PDF (print at 100 %), and a Cricut SVG per page (a zip when there are several), with the layer colours explained next
  to the button. Nothing is rasterised.
- All text goes through `t()` with Swedish in `sv.json`; warnings from the engine are shown by code, not by the engine's English text.

## Not in this phase

Saving models to My Designs and sync (phase 5), a cover page with instructions and a page map (phase 3), undo of single edge edits
(there is "undo all my edge changes"), moving or turning parts by hand on the pattern, coloured faces, simplifying heavy models.

## Consequences

- The studio has not been checked on a real phone or with the owner's machine; the Cricut steps are still unverified (see the
  acceptance criteria).
- The 3 000 face limit is a guess from the cost of the overlap checks; it should be measured on real models.
