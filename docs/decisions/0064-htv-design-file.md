# ADR 0064: The HTV design file

**Status:** accepted · **Date:** 2026-11-28

## Why

A Rhinestone design can be saved as a `.rhinestone.json` project file and kept as a template in the catalog (ADR 0061). An HTV design
could not: it lived only in the browser's vault (My Designs), so it could not be moved to another device, sent to someone, or kept as
a template. The catalog's admin panel therefore offered only SVG for HTV (ADR 0061). This adds the missing file format.

## Decisions

- **A design file** is JSON named `<name>.htv.json` (`app/htv/htvDesignFile.ts`):
  `{ format: "rhinestone-studio-htv-design", version: 1, projectName, layers, canvas, garment }`. It holds what makes the design: every
  layer (text with its font, size, spacing, curve; vector shapes with their polylines, hidden contours, colour, position, rotation,
  scale, flips, group), the garment (type, size, colour, placement zones) and the canvas view. It holds **no undo history and no
  selection** (a history can be many times the size of the design); an opened design starts with an empty history.
- **The suffix decides what a studio lists.** As for Rhinestone, a JSON template of the HTV studio must be named `….htv.json` to be
  listed under “From the catalog”, and the admin panel refuses another JSON name for HTV (`PROJECT_SUFFIX` in `studioCatalog.ts`;
  `STUDIO_FORMATS.htv` and `OPEN_FORMATS.htv` are now `svg` and `json`, and a test keeps them equal). The suffix constant lives in
  `catalogFormat.ts` so that the catalog code needs nothing of the HTV studio.
- **A file is untrusted input.** `parseHtvDesign` checks every value for its type and range (positions within 20 m, scale 0.001–1000,
  at most 300 layers, 5,000 shapes and 400,000 points in all, ids of a safe shape and unique, no hidden contour that is not there) and
  builds the state from the checked values only, so extra or hostile properties never come along. A bad value in a layer refuses the
  file with the reason; a bad garment or canvas falls back to the defaults, since they do not affect what is cut. An older garment name
  (`tshirt`) reads as `tee`. A newer `version` is refused with a message of its own. Files over 20 MB are not opened.
- **Opening** goes through the same import as a picked file (`handleImportFile` in `HtvShell.tsx`, so “From the catalog” and
  “Import” both work). It replaces the design on the screen, as opening from My Designs does.
- **Saving** (the “Save the design” section of the tools panel): “Save design file” downloads the `.htv.json` (counted as an export);
  “Save as a catalog template” keeps the file in the catalog with a small SVG picture of the cut shapes of the placement being worked
  on (`createHtvSvgExport`), as a new template that never replaces another (`saveHtvTemplate`, the same code as for Rhinestone:
  `saveTemplateToCatalog`). The picture is left out, not fatal, if it cannot be made. `SaveCatalogTemplate` now takes the studio.
- **Deterministic:** the same design gives the same file text, so a design can be compared and kept in version control.

## Consequences

- The file format has a `version`; a change that older versions cannot read must raise it, and `parseHtvDesign` then refuses the file.
- A design file is bigger than the vault's entry only by the missing history, so a design with many traced shapes is large; the limit
  of 400,000 points keeps a file within a size the Worker, the browser and the 20 MB catalog limit can all handle.
- Fonts are referred to by id, as in the vault and in Rhinestone projects. A design that names a font the device does not have falls back
  to the default font, as it does today.
- Not part of this decision: a file format for Papercraft drawings (they already have a JSON), and a conversion between the HTV and
  Rhinestone formats.
