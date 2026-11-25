# ADR 0039: Papercraft cover page (phase 3)

**Status:** accepted · **Date:** 2026-11-25 · Builds on ADR 0037 (engine) and 0038 (studio).

## Why

The owner's reference patterns start with a cover page: the finished size, the number of parts, the paper, a difficulty and a time, a
picture of the model, and how to build it. A pattern without it is a pile of shapes.

## Decision

- **The PDF gets a cover page first** (on by default, a checkbox in the studio): the title, a picture of the finished model, the facts
  (finished size in mm and inches, parts, faces, edges to glue, pages, paper, difficulty, time), how to read the lines (cut, mountain,
  valley, tab fold, the numbers), a map of what is on each page, and seven steps to build it. The Pages view shows the cover first, so what
  is downloaded can be seen before it is.
- **The engine places the words, the app writes them.** `renderCover(content, solid, pattern, layout, size)` takes a `CoverContent` of
  strings; the studio fills it in `t()` in the language in use (Swedish when the owner uses Swedish). The engine has no English text on
  the cover.
- **Real text in the PDF through the built-in Helvetica** (regular and bold, WinAnsi): every PDF reader has it, so no font file is
  embedded and the bytes stay deterministic. The widths are the standard Helvetica metrics, so lines can be wrapped; å, ä and ö work.
  Only the cover has text; the pattern pages still have lines only. The SVG exports never contain text (Design Space handles `<text>` poorly).
- **A picture of the model without three.js:** `projectModel` projects the faces (z up, seen from the front right and above), leaves out the
  faces turned away and sorts the rest back to front; faces are coloured by part and shaded by a light. It is drawn as filled polygons.
  The same part colours are used in 3D, in the pattern and on the page map (`partRgb`).
- **The page map** shows every page as a small sheet with its parts and part numbers, as big as the room allows (more, smaller columns when
  there are many pages) and says how many do not fit.
- **Difficulty and time are a rule of thumb** (`assessBuild`): the number of glued edges decides the difficulty (up to 15 easy, 45 medium,
  120 hard, then expert; one step harder if the shortest edge is under 15 mm) and the time is 10 minutes plus 1 per part, 0.4 per fold and
  1.5 per glued edge, rounded to 5. It is not measured on real builds and should be tuned when the owner has built some.
- The cover is A4, or Letter when the pages are Letter (also when the pages are a cutting mat: a mat is not a printer page).
- The test cube stays the built-in "Test cube"; its cover tells the same things, so the owner can check every line on a small model first.

## Consequences

- The PDF is not text-free any more; "no fonts" now means "no embedded fonts".
- The cover has seven fixed steps. A model that needs something special (a base, a stuffing) has to say so in its name.
- Texts must be in Latin-1 (Swedish fits); a language with other letters would need an embedded font.
