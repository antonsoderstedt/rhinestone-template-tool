# ADR 0036: A lighter Fonts page that shows fonts as stones

**Status:** accepted · **Date:** 2026-11-24

## Why

The Fonts page showed three different kinds of cards, a block of metrics and a "group by family" switch, and only ever showed letters,
while the tool makes stones. Judging a font for a rhinestone design needs the stones.

## Decision

- One kind of card per **family** (`fontFamilies.ts`: bundled, library and uploaded fonts grouped, filtered and sorted by pure
  functions), with a variant choice when the family has several, a favourite star, buttons for the Rhinestone and HTV studios, and a
  "Details" fold with tags, archive (the whole family) and, for the user's own uploads, the fields they can edit.
- **Show as stones** (on by default, stone size SS6-SS20): the text is traced with the font and drawn as the stones it would be at
  25 mm letter height, with the stone count and any letters the font lacks (`outlineFontThumbnail`, the same generator the canvas
  uses). It runs only for cards that are on screen, after typing has paused, two fonts at a time, and is cached. Off: the text in
  the font itself (the file is fetched only for cards on screen).
- A toolbar with the preview text, search, favourites, sort, source, "show archived" and category chips that show how many families
  a click would give. Cards are added as the page is scrolled (24 at a time). The toolbar is sticky on large screens only.
- The studio's text style list now loads the library fonts' files too (it showed a fallback font before).

## Consequences

- The stone preview is a guide at one letter height, not a promise: very thin strokes or small letters behave differently.
- No stroke-weight rating is shown: the font's glyph shapes alone gave no reliable measure.
