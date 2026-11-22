# ADR 0023: Text is one tool with a style gallery

**Status:** accepted · **Date:** 2026-11-22 · **Plan items:** A1 (first step), B6

## Context

The editor had two tools for making text (Text and Stone Font) and two more hidden behind the rail (Alphabet, Stencils).
They made text in different ways and nothing said how they differed. Choosing a font meant a drop-down of names, with the
Stone Font list showing no preview at all. Typing the same words again after switching tool was the only way to compare.

## Decision

- **One button, Text.** The tool rail has no Stone Font button. `rhinestone-font` is still a tool id (saved projects, deep
  links and the generator use it), but `railToolFor` makes Text stand for it.
- **A style gallery** (`app/editor/controls/TextStyleGallery.tsx`) in both panels shows the user's own words in every look:
  - *Letters traced with stones*: each outline font, and Dot matrix. Fonts are previewed with the font itself; Dot matrix is
    drawn from the real generator.
  - *Fonts with stones already placed*: each stone font, drawn from the real generator at the size the font was made for,
    fetched when the card is first shown and then cached.
  - If a stone font has none of the user's letters, the card shows the font's own sample and says so for screen readers.
- **Picking a look carries the words over** (`actionsForTextStyle`): the words of whichever text tool is in use are copied to
  the target, a stone font gets the size it was made for, but a stone size the user already chose for the same font is kept.
- The old Outline / Dot matrix switch, the outline font drop-down and the stone-font drop-down are gone; their job is the
  gallery's. Loading and error messages for outline fonts still show in the panel.
- Logic that is not drawing lives in `app/editor/textStyles.ts` and `textStyleThumbnails.ts` (pure, tested).

## Size of the words in a stone font (B9, B11 for stone fonts)

A stone font has its stones already placed, so the words cannot be scaled; the stone size is the only lever. The Stone
size control now lists every size the font has with the real measured size of the user's words (the same generator as the
canvas) and whether that fits a 12 × 12 in mat, a 12 × 24 in mat, or needs exporting in parts. When another size would fit
a smaller mat, one button switches to it. It does not nag when both fit. `app/editor/stoneFontSizes.ts` (pure logic, tested).

## Not done yet (stays in plan phase 4)

Alphabets and stencils in the gallery, several fonts in one text, per-letter style, bold / italic, kerning, text on a path,
auto stone size for outline text ("best stone size for 60 mm letters"), filled typography with the shared fill (B10).

## Consequences

- One place to start for text, and the choice is made by looking.
- Thumbnails cost one font fetch per stone font the first time the panel is opened (ten fonts, cached afterwards).
