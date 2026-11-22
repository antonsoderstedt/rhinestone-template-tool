# Legacy generation paths (plan H7)

Checked 2026-11-22. What is still used, why, and what could go.

| Path | Used by | Verdict |
|---|---|---|
| `createOutlineTextTemplate` (sync, built-in stroke font) | the built-in "Simple block" font (open lines, not shapes) and tests | Keep: the stroke font has no outline shape to lay out |
| `createPolylineFilledRhinestoneTemplate`, `createPolylineRhinestoneTemplate` (`fill/`, `path/`) | stroke font, the radial and custom placement patterns, the quality harness as the baseline to beat | Keep until the special placement patterns are rebuilt on the artwork layout; the harness needs it as the "old" column |
| `createGlyphScanlineFillTemplate` (`textOutline/glyphScanlineFill.ts`) | bundled fonts with a non-default placement or fill pattern only | Could go when the radial / custom patterns go |
| Outline text for bundled fonts | **artwork layout** since ADR 0024 | Done: the old text generators no longer run for the default patterns |
| SVG upload with the old coverage modes (`outline`, `fill`, `outline-fill`, `contour`) | the stored `coverageMode` names are kept so saved projects open; they map to the three looks (ADR 0021) | Keep the names, not the generators: nothing in the editor calls the old SVG generators any more |
| `svgToPolyline` | thin wrapper over `importSvgArtwork` (ADR 0020) | Keep: HTV and the harness still read polylines |

Nothing was deleted: each removal would change saved-project behaviour or the quality baseline, and none of them is in the way.
