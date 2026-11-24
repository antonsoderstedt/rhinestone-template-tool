# ADR 0033: The font library is a catalog of small files, not data in the browser

**Status:** accepted · **Date:** 2026-11-24

## Why

The Fonts page copied a manifest of 3,691 imported fonts (about 4 MB) into the browser's localStorage on every visit. That filled the
storage (autosave failed), slowed the studio (the whole list was parsed on each lookup) and tied the fonts to one browser. The font
files themselves came to 653 MB, mostly the same font in several file formats and thousands of glyphs the tool never uses.

## Decision

- `npm run build:fonts` (`scripts/build-font-library.ts`) reads the imported fonts and writes `public/font-library/` (git-ignored: the
  fonts are the user's own licensed files): `catalog.json` and one `f/<fontId>.woff` per font. Each font is reduced to Latin letters,
  digits, punctuation and Nordic / western European accents (HarfBuzz via `subset-font`), the same font in several formats is kept
  once (the smallest result), and a font with no outline for A, a or 0 is left out. 641.6 MB became 38.1 MB; 3,691 files became 1,370
  fonts in 562 families. Outlines for ordinary text are identical to the originals (68 of 69 sampled; the one difference is a
  character the original font draws as an empty box).
- The format is WOFF, not WOFF2: `opentype.js` reads WOFF but needs an extra decompressor for WOFF2.
- The catalog also maps every earlier font id to the one kept (`aliases`), so saved designs and links still find their font.
- The app fetches `catalog.json` once (`FontCatalogLoader`) and keeps it in memory in the font registry (`setFontCatalog`). Screens
  that list fonts subscribe (`useFontCatalogRevision`). The browser storage keeps only the user's own uploaded fonts and their
  choices (favourites, tags); library copies left by older versions are dropped and the space is freed.
- Anything that needs a library font at start-up (`?font=` links) waits for the catalog, which is always reported as loaded, empty if
  there is no library.

## Consequences

- Without a library (the public GitHub Pages site) the catalog is empty and only the bundled fonts exist.
- The same files can later be hosted privately (see the plan for a private deployment).
