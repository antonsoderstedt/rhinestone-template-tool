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
3. **Stone fonts: the real cause was the scale.** `layoutRhinestoneFontText` scaled every font by a constant taken from TRW
   Clean Stone (72 font units per stone at 2048 per em). The vendor packages draw their stones 22 units wide (SS10) or 14
   (SS6) at 1000 per em, so their holes came out about three times too big for the spacing between them and every stone
   overlapped, and every design was BLOCKED. Measured in the font files themselves (using the engine's own extraction), the
   stones in all of them are separate (centre distance / diameter 1.07-2.3); the vendor READMEs and previews confirm dotted,
   cuttable letters (SS6 stones 2.1 mm, SS10 3.3 mm at 420 pt). The scale is now `target stone size / measured circle
   diameter of the font` (`measureNativeStoneDiameterFontUnits`, the median over the stones of the text; TRW's 72 is only the
   fallback), which is also what the code's comment always said it did. Result: no overlaps and no errors in any font at SS6
   and SS10, TRW Clean Stone unchanged, and sizes that match the designed 420 pt (Old English "Sulay" SS10 is 425 x 192 mm,
   an em of 148 mm). The designs are physically large; a smaller stone size gives a smaller design.
   Two earlier attempts were wrong and are recorded so they are not repeated: thinning dropped stones and destroyed the
   letters, and automatic enlargement (a guess at the scale) was applied by default and the user rightly called it ruined
   because the old overlapping view was what they had been looking at. The opt-in, undoable **"Enlarge ×N to make cuttable"**
   quick fix (`enlargeToCuttableSpacing`) stays for other layouts whose stones overlap, but no stone font needs it now.
   The Alphabet tool (SVG alphabets) was measured too and was already correct.
   Also: the "Test Fixture Font" (it only exists for the test suite) was listed in the font picker and failed with "no browser
   asset URL"; it is hidden. A generator that produces no stones (a digits-only font given letters) now means "no design"
   (neutral), not a blocking error.
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
