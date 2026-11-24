# ADR 0010 — Fonts page windowing, font integrity checks, launch links

**Date:** 2026-11-19  
**Status:** Accepted

## Context

`/fonts` rendered every font at once (≈44,000 DOM nodes, 3,720 `@font-face` rules, a 311,000 px page). Two fonts were
unusable and nothing said so: `fredoka-one` (its WOFF header declares fewer bytes than the file has, so browsers reject it
although `opentype.js` parses it) and `cane-light` (empty glyph table). The page also leaked a dev command and a local path,
used a personal sample text, had a tag field in which a comma could not be typed, and its "Use in …" buttons were enabled for
fonts that could not work.

## Decision

- **Windowing.** Cards render 24 at a time with "Show more" and an IntersectionObserver. Preview fonts are loaded per visible
  card with the `FontFace` API (`useFontPreviewLoader`) instead of one giant stylesheet; a font that fails to load is marked
  on its card and its launch buttons are disabled. Search uses a deferred value.
- **Font integrity** is a pure engine function, `inspectFontBytes` / `repairFontBytes` (`textOutline/fontInspection.ts`):
  WOFF length mismatch (repairable by trimming), truncated WOFF, unparseable data, and fonts with no outlines.
  - `/api/outline-fonts/:id` serves repaired bytes. Bundled font URLs carry `?v=2` because the route sends `immutable`
    caching and browsers had cached the rejected copy.
  - `npm run audit:fonts` reports bundled and imported fonts; `--fix` drops unusable imported fonts from the manifest
    (`meta.excluded`, `meta.excludedCount`) and repairs the rest. `import:font-zips` applies the same check.
  - Uploads are inspected before they are added; refused files are listed with the reason.
  - A test requires every registered bundled font to be usable as served.
- **Launch links.** `buildFontLaunchUrl` always encodes the typed text and falls back to neutral "Your Text".
  `getFontLaunchAvailability` disables both studios for an unloadable font and HTV for the built-in simple font (which has no
  outline file).
- **A launch link wins over restoring the last session**, which is copied into My Designs ("… (previous session)") instead of
  being overwritten. Before this, `?font=…&text=…` was silently replaced by the autosave.
- Copy: no dev commands or filesystem paths; "Legacy / Original" is now "Simple block (built-in)"; the unused "Fallback
  sample" field was removed (nothing read it).

## Consequences

- Initial `/fonts` render is ≈950 DOM nodes (was 44,338); search over 3,700 fonts takes < 100 ms.
- Fonts that are damaged beyond repair are visible instead of silently rendering in a fallback face.
- `applyWorkspaceDefaults` (ADR 0009) must return the same object when nothing changes; a version that always allocated new
  tool objects made the editor's template-generation effect loop. Covered by a test.
