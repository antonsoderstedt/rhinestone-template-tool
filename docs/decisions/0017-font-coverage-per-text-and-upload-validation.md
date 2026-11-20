# ADR 0017 — Font coverage per typed text; artwork upload validation

**Date:** 2026-11-19  
**Status:** Accepted

## Context

The Phase 13 QA pass (`docs/COPILOT_FIX_PLAN.md`, checklist items 2–4) found two defects:

1. `/rhinestone?font=installed-always-script-font-imported&text=Sulay%20123` produced **0 stones**. `loadOutlineFont` rejected every
   font that lacked `Å Ä Ö å ä ö` or common punctuation, for *all* text, so a script font with a complete basic alphabet was
   unusable even for text that needs none of those characters.
2. Uploading a corrupt or non-SVG file in the **Artwork** tool was accepted silently: the file name appeared, the design stayed
   empty and nothing said why. (The Import tool already explained itself.)

## Decision

- **Coverage is checked against what the user typed.** The always-required set is `A–Z a–z 0–9`. The rhinestone studio loads
  fonts with `allowMissingExtendedCharacters: true` and then calls `findUnsupportedCharacters` on the actual text; a missing glyph
  produces a precise message naming the characters. HTV still requires the full set (it has no per-text check yet, and a missing
  glyph there would draw an empty box). The parsed font stays cached; the coverage rule is applied on each call so a lenient
  caller cannot loosen it for a strict one (tested).
- **Artwork uploads are validated before they change the design.** Files over 5 MB and SVGs that are not SVG or contain no
  supported shapes are refused with an inline alert under the file picker ("bad.svg: SVG contains no supported shapes. Nothing
  was changed — pick a different file."). The current design is left as it was. Uses the existing `validateAssetUpload`.
- **Light studio colours.** Components written for the dark studio use pale text utilities (`text-violet-100…300`, `rose`,
  `amber`, `emerald`). `globals.css` now gives them darker equivalents inside `[data-theme='light']` (all ≥ 4.5:1), and
  `tests/lightThemeTextGuard.test.ts` fails when a new pale utility is used without a mapping. Dialogs are portalled to `<body>`,
  outside `[data-theme]`, so the always-dark export dialog is untouched.

## Consequences

- Fonts that lack Å Ä Ö are usable for text without them; with them the user sees which characters are the problem.
- HTV text in such a font is still refused outright; extending per-text checks to HTV is the obvious follow-up.
- Development note: Turbopack served a stale `globals.css` until `.next` was deleted and the dev server restarted. If CSS edits
  do not appear, do that (not `npm run build` while the dev server runs).
