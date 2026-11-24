# ADR 0030: A browsable design collection, and Solid as contour rows

**Status:** accepted · **Date:** 2026-11-24 · **Changes:** part of ADR 0029 (what Solid is)

## Why

1. The user owns a folder of about 1.9 GB of ready-made rhinestone templates (zip files with SVG, DXF, EPS and previews) and
   wants to browse and pick from them in the tool.
2. The commercial heart template the user pointed to (SS10, 203 x 183 mm: 918 / 306 / 108 stones for solid / rows / outline)
   has every row following the outline of the one outside it. ADR 0029 made Solid an edge ring plus straight rows, which did not
   look like it.
3. The browser's storage filled up and the autosave threw.

## Decision

- **Solid** is `layoutRows` with `rows: 'all'`: every row follows the contour of the one outside it, and a lattice only fills
  what the rows leave in the middle. The lattice is tried at 16 shifts (the one that seats most stones wins), and a last pass
  adds a stone wherever the deepest remaining point is at least 0.82 of the pitch (never under the hard minimum) from every
  other stone, so narrow parts are not hollow. A 100 mm SS10 heart gives 229 stones (the reference scales to 229).
- **Design collection.** `npm run import:designs -- "<folder>"` reads zip files and loose SVGs, extracts only plain `.svg` entries
  (listed first, extracted to memory, never to an archive-chosen path), runs each through the engine's SVG safety check and
  `importRhinestoneTemplate`, drops files with no stones and duplicates, and writes `public/design-library/` (`index.json` and
  `d/<id>.json`: each design as compact numbers, see `compactDesign.ts`: stone positions, sizes and colours in hundredths of a mm;
  127 MB of SVG became about 11 MB, and the SVG of circles is made again when a design is opened). The folder is git-ignored: the designs are the user's own, large files. The Import tool has a "Browse the
  design collection" picker (search, category, thumbnails drawn from the stones, fetched when scrolled into view); a pick
  goes through the same check and "Import stones to canvas" step as a file from the computer.
- **Template import scale.** A file with a real page width (`width="300mm"`) and a viewBox in other units (CorelDRAW writes 100
  units per mm) is scaled to the page width. Without a real-world width, viewBox units are still read as mm.
- **Storage.** `writeStorageItem` never throws; on a full storage it frees leftovers and retries, else reports `full` and the
  autosave pauses with a notice.

## Consequences

- Imported commercial templates can contain holes closer than the tool's minimum gap (0.508 mm for the current profile); the
  export check reports them as errors, and collision detection stays on.
- The collection is local to the machine that ran the import. Sharing it needs the folder to be imported again there.
- Known follow-up: the 3,700 installed fonts are still copied into localStorage by the Fonts page (about 4 MB).
