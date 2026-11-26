# ADR 0054: Tracing patterns that are pictures

**Status:** accepted · **Date:** 2026-11-26 · Replaces "patterns made of pictures (tracing)" under "Not done" in ADR 0051.

## Why

A pattern PDF that was saved as a picture (a bitmap of black outlines, dashed folds and numbers, as many free patterns are) has no lines to read: the studio found one stray line and gave a useless file.
A first look at the owner's files: of 36 patterns, 31 are vector and the rest bitmaps.

## Decision

- **`traceLineArt(image)`** (`pdf/trace.ts`, pure, deterministic): the dark pixels (threshold from how dark the lines are, so pale grey prints work too) that are not in a photo (blocks that are mostly not white) are thinned to a one-pixel skeleton (Zhang and Suen),
  the skeleton is followed into lines between junctions and ends and simplified (Douglas and Peucker, 1.4 px), lines whose ends meet within 4 px are joined (a number that touched a line splits it) and a line whose ends meet is closed. Lines of at least 24 px are **cut lines**.
  Short thin straight pieces and dots are **dashes**: dashes that lie on one line (within 7 degrees and 3 px, gaps up to 30 px), three or more, with the dots between them, are a **fold line**, run on to the outline they belong to. Numbers, letters and a stray speck are not thin straight pieces in a row and are left out.
  A line has the colour of its darker half, in tenths, so one colour is one group.
- **In the PDF reader** every page now knows how much of it pictures cover (`pictureShare`), and `PdfDocument.tracePage(i)` gives the traced lines as ordinary strokes (solid for cuts, dashed for folds) in page points. A page with one big picture is traced at that picture's own resolution; a page of many pictures
  (tiles) is put together on one bitmap of the page first, at the finest resolution any tile has. Grey, RGB, CMYK, palette (Indexed) and one-bit pictures are read, uncompressed or Flate; **JPEG** goes to a decoder given by the caller (the studio gives the browser's). A picture under a fifth of the page (a logo) is not traced.
- **In the studio** a page that is a picture is traced when it is opened (the page buttons show a picture symbol), says it was traced and to check it, and everything after that is as for vector lines: groups, roles, scale, SVG and DXF. **All pages as SVG (zip)** and **as DXF (zip)** make one file for every page that has lines (picture pages are traced first).

## Result

On the owner's bitmap patterns: Mickey (8 pages, 1260 × 1782 px each) 12 to 56 cut lines and 37 to 112 fold lines per page in 60 to 160 ms; a bison skull made of 664 tiles per page 47 to 88 cut lines and 53 to 96 fold lines. A drawn test sheet in the browser: one closed outline, two fold lines, the number and the photo left out.

## Not done

Curves (they are short straight lines), a line thinner than a pixel or fainter than the page, colour-coded patterns where the colour is the only difference between a cut and a fold (the groups can be set by hand), text and numbers, rotated or skewed picture matrices beyond the placement matrix, pictures that are JPEG in a browser that cannot decode them. A pattern made for the studio should be a vector file: `docs/PAPERCRAFT_TEMPLATE_SPEC.md`.
