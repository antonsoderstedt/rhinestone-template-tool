# ADR 0053: Paper sizes, size and detail up front, colours that can be turned off, tooltips

**Status:** accepted · **Date:** 2026-11-26

## Why

The owner used the studio and could not find or choose three things: the size of the model (the control was at the very bottom of the Model panel), how detailed it is (only an imported model could be simplified), and why the parts have different colours (the colours are only there to tell the parts apart on the screen, which nothing said).
There was no A3 sheet, a sheet of your own size, or any explanation of the settings.

## Decision

- **More paper**: `PAGE_PRESETS` gets A3 (297 × 420 mm), A5 (148 × 210) and US Tabloid (279.4 × 431.8); the studio gets **Your own size** (`paper.customWidthMm`, `customHeightMm`, 50 to 2000 mm) and shows the sheet size under the choice. The cover page is still printed on A4 (Letter for the American sizes).
- **Size and detail first** in the Model panel: the size (by longest side, width, depth or height), the built size (width × depth × height), the shortest edge and the number of faces. For a **built-in model** a Detail slider (30 to 100 %): the model is made with fewer faces by `simplifyMesh`
  (ADR 0043). 100 % is the model as it is made; the share is counted from what the model is made of once the triangles that only split a flat face are gone (a horse at 100, 80, 60, 40 and 30 % has 94, 82, 68, 46 and 34 faces). A change of detail starts the edge edits over, because their ids belong to the old model.
  An imported model keeps its own Detail section (a face count; ADR 0043). More detail than the built-in models have is not possible: the text says so.
- **Colours**: parts are in one paper colour by default; **Colour the parts** under View gives each its own colour on the screen (pattern and 3D). The pattern view says what the colours are: parts apart, mountain red and valley blue (on paper they are dash patterns), and that nothing is printed or cut in colour.
- **Tooltips**: every setting and every button in the studio has an explaining text (`title`) and the settings an "i" that shows it on focus too (`Tip` in `fields.tsx`); in both languages.
- Saved designs keep the new settings (optional fields: an older design opens with the defaults, and a design without them is written as before).

## Not done

More detail than a built-in model has (smoothing or subdividing would round off the corners and thin out the limbs), colours that mean something (paper colours per part), a free choice of mat shapes beyond the presets and the custom size.
