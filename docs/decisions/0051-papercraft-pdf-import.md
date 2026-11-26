# ADR 0051: Cutting files from finished PDF patterns

**Status:** accepted · **Date:** 2026-11-26 · Replaces "import finished PDF patterns" under "Later" in the plan (ADR 0037).

## Why

The owner has many finished patterns as PDFs for printing (free and bought templates). With a cutting machine the lines of such a pattern are what is wanted: the outlines to cut and the fold lines to score, without printing and cutting by hand.
A PDF has no 3D data, so it cannot become a model (ADR 0037); but its lines can be read.

## Decision

- **A reader for the lines of a PDF** (`readPdf`, `pdf/read.ts`) in the engine: a small, tolerant parser of its own, no library. It finds every object by scanning (so damaged cross-reference tables and incremental updates do not matter), unpacks object streams, walks the page tree
  (inherited MediaBox, Resources and Rotate; CropBox preferred), joins a page's content streams and runs the drawing operators: `q Q cm`, `m l c v y h re`, `S s B b` (stroke) and `f F n` (paint nothing we keep), `w d RG G K SC SCN gs`, and form XObjects (`Do`, with their own matrix and resources, at most 8 deep).
  The result per page is its size in points and its **stroked paths** with colour, width and dash, in page coordinates (y up, rotation applied). Curves are flattened to ten segments. Fills, text, images, shadings and clipping are skipped.
  Flate, ASCIIHex and ASCII85 streams are read; others (and predictors) are skipped with a warning. Encrypted files are refused. Only `DecompressionStream`, a web standard that Node has too, is used; it is the one asynchronous part.
- **Lines are grouped by how they are drawn** (`lineStyles`): colour and solid or dashed. Each group is a style with a count and a total length; a line round the whole page (a frame) is left out. `defaultRoles` guesses: dashed is **score** (a fold), solid is **cut**, nearly white is left out.
  The person can change any group (cut, score, leave out): patterns differ in what their colours mean.
- **`patternDrawing(page, roles, { scalePct, crop, marginMm, minLengthMm })`** makes the same `PageDrawing` the studio makes for its own patterns (millimetres, y up): cut lines as outlines (a line that comes back to its start is closed), score lines as lines, specks under 0.5 mm left out, optionally scaled and cropped to the pattern with a margin.
  So the **Cricut SVG** and the **Silhouette DXF** (ADR 0049) come from the same code, with the layers cut, score and numbers.
- **In the studio**: a page at `/papercraft/pdf` (linked from Model, under the import of a model file): choose a PDF, a page (each shows how many lines it has; covers and text pages have few), the role of each group of lines, the scale and whether to crop, a preview, and the two downloads. The file is read in the browser and never sent anywhere.

## Result

Tried on 35 finished patterns from several makers (kept on the owner's computer, not in the repository): all 35 are read in under half a second each, and 31 have vector lines, usually a solid group (cuts) and a dashed group (folds) in the same colour, which the guess handles. Four are made of pictures
(scanned or tiled bitmaps) and have no lines to read: the page says so.

## Not done

Reading text (the numbers on the edges are not cut or drawn), filled shapes as outlines, patterns made of pictures (they would have to be traced), several pages in one download, curves kept as curves (they are ten short lines), mountain and valley told apart (a score is a score), and registration marks.
The file's own scale is trusted: a PDF that was scaled when it was made gives a scaled cutting file, so the page says to check the size against a ruler. Not tried on a cutting machine.
