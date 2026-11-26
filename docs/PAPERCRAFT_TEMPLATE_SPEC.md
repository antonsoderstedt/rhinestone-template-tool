# Specification: papercraft pattern files that work with the Papercraft Studio

For whoever makes a pattern. The aim is a file that can be printed **and** turned into a cutting file (Cricut SVG, Silhouette DXF) without redrawing anything.
Everything below is checked by the studio's PDF page (`/papercraft/pdf`), which reads the lines of a PDF.

## 1. What to deliver (best first)

1. **One SVG per sheet** with the layers `CUT` and `SCORE` (and `DRAW` for numbers). This is what Cricut Design Space and Silhouette Studio want and needs no conversion.
2. **One PDF** with the same sheets as **vector lines** (section 3). This is what prints, and what the studio can read.
3. The pattern pages and the instruction pages **in separate files**, or the pattern pages first with nothing else on them.

A PDF that is only pictures (a scan, a screenshot, tiles of bitmaps) is a last resort: the studio can trace clean line art (section 6) but vector is exact.

## 2. The sheet

- **One sheet per page**: A4 portrait, 210 × 297 mm (say so if A3 or US Letter is wanted). Page rotation 0.
- **Scale 1:1.** 100 mm in the pattern is 100 mm on the page. No "fit to page", no reduced copies.
- **Margin** at least 10 mm on every side. **No part touches the margin or crosses the edge of the page.**
- **3 mm or more** between two parts. Big models are split so every part fits a sheet.
- A **calibration square of 100 × 100 mm** on the first sheet, outside the parts, drawn as a cut line and labelled "100 mm", so the size can be checked after printing and after cutting.

## 3. The lines (what makes the file readable)

- Every line is a **stroked path** (a real line with a stroke, not a shape that has been "outlined", "expanded" or filled to look like a line). In Illustrator: do **not** use Object > Expand. In Inkscape: do **not** use Stroke to Path.
- **Cut lines**: solid, black, 0.25 pt or thicker, **one closed path per part**, glue tabs included in the outline.
- **Fold lines**: **dashed strokes** made with the stroke's dash setting (not many separate short lines).
  - Mountain fold: dash and dot, for example 3 mm dash, 1 mm gap, 0.6 mm dot, 1 mm gap.
  - Valley fold: dashes, for example 1.6 mm dash, 1.2 mm gap.
  - Use the same colour for both kinds (black), or one colour for each kind, but **always the same dash for the same kind**.
- No other lines on the pattern sheets. No frame round the page, no crop marks, no background grid.
- **No** photos, shading, textures, gradients, watermarks, drop shadows, transparency or clipping masks on a pattern sheet. A picture of the finished model belongs on the cover, not on the pattern sheets.
- **Numbers and labels** (edge numbers that pair the glue edges, part numbers) go on their own layer as text or outlines. The studio leaves text out of the cutting file, so they do not disturb it. The two edges of a pair carry the same number.

## 4. Glue tabs and sizes

- Tabs 8 mm deep (6 mm minimum), sides at 45 degrees, on **one** of the two edges that are glued together. The other edge has none.
- No edge shorter than 8 mm; no part thinner than 8 mm. A tab on an edge under 15 mm is narrowed to fit.
- Paper: 160 to 250 g/m². Say which the pattern is made for.

## 5. The file

- PDF 1.4 to 1.7 (or SVG 1.1). **Not password protected, not encrypted** (the studio refuses an encrypted PDF). Under 60 MB.
- Transparency flattened. Fonts embedded or text outlined (the text is not used).
- One colour mode (RGB). The colours of the lines are used to group them, so use as few as possible: black for cut, black dashed for fold.

## 6. If it can only be a picture

Only when a vector file is not possible. The studio traces black-and-white line art, so:

- **300 dpi or more**, black lines on **pure white**, nothing behind the lines.
- Lines **at least 3 pixels thick** at 300 dpi (0.25 mm), solid for cuts, regular dashes (at least 3 mm long, gap at least 1.5 mm) for folds.
- **PNG or Flate, not JPEG** (JPEG blurs thin lines).
- **No photo, colour fill or shading on the same sheet.** The photo of the model goes on its own page.
- Numbers can stay: text is left out when tracing. Do not let a number touch a line.
- The traced result is checked by eye (a very thin or faint line can be missing); vector has no such risk.

## 7. How to check a file before it is sent

1. Open the PDF in a vector editor. Click a cut line: it must select as **a path with a stroke**, one path per part. Click a fold line: one dashed path.
2. Open it in the studio at `/papercraft/pdf`. You should see **two or three groups of lines** per sheet (solid = cut, dashed = fold). If you see hundreds of groups, or none, the lines are not strokes.
3. The size under Size must match the sheet (for example 210 × 297 mm at 100 %). The 100 mm calibration square must measure 100 mm.
4. Download the SVG and open it in Cricut Design Space: the cut lines should be one layer and the fold lines another.
