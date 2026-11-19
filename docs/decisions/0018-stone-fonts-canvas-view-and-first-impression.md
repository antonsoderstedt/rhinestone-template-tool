# ADR 0018 — Cuttable stone fonts, a canvas that stays in reach, and a better first impression

**Date:** 2026-11-19  
**Status:** Accepted

## Context

After Phase 13 the user looked at the studio themselves and found things the mechanical QA (axe, scroll widths, click counts)
had not: the first screen looked unfinished, the canvas could be scrolled out of its grid, the library stone fonts rendered as
lumps with "BLOCKED (1)", and several smaller defects. This ADR records what was found and changed.

## Findings and decisions

1. **First result.** The default text was `YOUR NAME` in the built-in "Simple block" font at 25 mm. Measured and compared visually:
   at SS10 (≈ 4.2 mm pitch) the strokes of a 25 mm Archivo Black letter are only about two stones wide, so the two outline rows
   touch and the letters turn to mush; at 60 mm each letter gets two clean rows. The default is now Archivo Black, 60 mm, on two
   lines (`YOUR` / `NAME`, ≈ 207 × 118 mm, fits a 12 × 12 in mat); the start-page example uses the same. ("Filled typography"
   at 25 and 45 mm looked broken and is **not** fixed here; see below.)
2. **Canvas scrolled out of the grid.** The grid was `<rect width="100%" height="100%">` starting at (0, 0), so it covered only
   the top-left of wherever the view was, and nothing limited panning. The grid now covers the visible view box, and
   `clampCanvasPan` (pure, idempotent, tested) keeps the centre of the view within 30 % of a screen of the design's edges. It is
   applied in one place, wrappers around `dispatch` and `onManualViewChange`, so wheel, drag, pinch and cursor-zoom all obey it.
3. **Stone fonts.** Measured with the library on this machine: only TRW Clean Stone (in the repository) has stones that do not
   overlap. Blessed, Forever, Cheer Block, Outline, Small Line, Atletico Real, Bride and Old English place stones at 0.2–0.65 ×
   the stone diameter, so the template was BLOCKED. This is identical on `main`; it was not a regression, but QA should have
   found it. Thinning (dropping stones) destroyed the letters; **enlarging the whole layout** until the stones fit keeps them
   (`enlargeToCuttableSpacing`, see the engine spec). The editor says so ("enlarged ×3.1 (about 231 mm wide)…") and a smaller
   stone size gives a smaller design. Huge Digits given letters made 0 stones, counted as a blocking error; an empty result now
   means "no design" (neutral), the panel already explains the unsupported characters.
4. **Calm chrome.** The "Live editor"/"Layer editor" badges squeezed the project name to a few letters and are gone. The
   amber "WARNING" pill on a normal first visit now says "Not calibrated" in a quiet tone (the full text is its tooltip) and
   no longer wraps; "Open Studio" is hidden on the studio page, "Manage Assets" and the studio label below 1280 px, and the topbar
   no longer overflows between 1024 and 1280 px. The four-step guide starts collapsed on every screen. Routine spacing nudges
   ("Adjusted 6 stones…") are no longer announced; only removed stones or too-dense designs are.
5. **HTV.** Black vinyl (the default) on the dark canvas was nearly invisible. The sheet behind the design now follows the vinyl
   colour (`pickArtboard`): a light sheet for dark vinyl, a dark one for light vinyl, mid-grey when mixed.

## Not done

- **"Filled typography"** (fill mode for text) leaves scattered stones that do not follow the letters; it needs real engine work.
- HTV's first view does not fit the design until the text is measured (the fit uses the estimated width); the fix is to refit
  when measured sizes arrive.
- Library fonts' glyphs are dense artwork; very large words (Huge Digits ≈ 330 mm) exceed a 12 × 12 in mat, and Fit to mat cannot
  resize stone fonts.
- Tested by measurement and in the in-app browser at 1100–1440 px; not on real devices or in other browsers.
