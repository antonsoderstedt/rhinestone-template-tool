# Acceptance Criteria — Rhinestone Template Tool

## How to Use This Document

These criteria define what "done" means for each phase. A phase is not complete until **all criteria in that phase pass**, including any physical cut tests where specified.

---

## Phase 0 — Foundation

- [x] Project scaffold exists (Next.js, TypeScript, Tailwind)
- [x] Folder structure matches the spec in `docs/TECHNICAL_SPEC.md`
- [x] All documentation files exist in `/docs/`
- [x] `src/lib/rhinestone-engine/` folder exists with sub-folders
- [x] AGENTS.md contains project-specific rules

> **Note on document scope (added after a 2026-08 audit):** several major features shipped after this document was last kept current — the rhinestone-font system, the SVG-alphabet system, the letter-stencil generator, the template library, and most of the canvas editor (selection, drag, box-select, pen tool, undo/redo) — without corresponding phase entries below. Rather than retroactively fabricating detailed phase checklists for functionality this document's author didn't build, the current source of truth for those features is their own code and test files (see `tests/rhinestoneFontSystem.test.ts`, `tests/svgAlphabetSystem.test.ts`, `tests/letterStencilSystem.test.ts`, `tests/editorState.test.ts`, `tests/*.test.ts` generally) — all 964+ tests pass as of this note. Treat any phase below marked "(Implemented)" as accurate for the area it covers; treat the *absence* of a phase entry as "undocumented here," not "not built."

---

## Papercraft — Phase 1: the engine (Implemented 2026-11-25)

Spec: `docs/PAPERCRAFT_ENGINE_SPEC.md` · ADR 0037 · Tests: `tests/papercraftMesh.test.ts`, `tests/papercraftUnfold.test.ts`,
`tests/papercraftLayoutExport.test.ts`.

- [x] OBJ (quads, `v/vt/vn`, negative indices) and STL (ASCII and binary) are read; other files and broken files give a readable error
- [x] A mesh is cleaned: vertices welded, degenerate and duplicate faces removed, winding made consistent and outward, flat neighbours merged (cube from 12 triangles gives 6 faces), with a warning per problem
- [x] Built-in shapes (cube, tetrahedron, octahedron, icosahedron, dodecahedron, prism, pyramid, lathe/gem, L block) are closed, have Euler number 2 and the asked edge length
- [x] A model can be scaled to a width, depth, height or largest side in mm; smallest edge and face are reported
- [x] After unfolding every face has the same corner distances as in 3D, joined faces share their edge on opposite sides, no part overlaps itself, joined edges = faces - parts
- [x] Every cut edge pair has one number shown twice, exactly one tab (or a `tab-missing` warning), and a tab never overlaps a face or another tab
- [x] Convex folds are mountain and concave folds valley with the print outside, swapped with the print inside
- [x] Parts are packed on pages inside the margins without overlap; a model bigger than the page is split; a face bigger than the page is reported
- [x] SVG export is in mm, vector only, no `<use>`, nested `<svg>`, opacity or raster; Cricut and print variants
- [x] PDF export is vector only with a valid cross-reference table and the right page size
- [x] All of it is deterministic (same input gives the same JSON, SVG and PDF bytes)
- [ ] Physical test: print the cube test sheet, cut and score it on the Cricut Maker 3 and build it; confirm mountain/valley, tab tolerance, scoring and the usable mat area (needs the owner's machine)

---

## Papercraft — Phase 2: the studio (Implemented 2026-11-25)

ADR 0038 · Tests: `tests/papercraftStudio.test.ts` (state, computation, downloads, files, texts), the fold animation in `tests/papercraftUnfold.test.ts`.

- [x] `/papercraft` opens with the test cube, in the shared navigation and on the home page; light/dark theme, English/Swedish, mm/inches
- [x] Choose a built-in model, or import OBJ, STL, GLB or glTF (also by dropping a file); wrong, broken, empty or oversize files give a readable message
- [x] Set the size by height, width, depth or longest side; the built size and the shortest edge are shown
- [x] Three views of one pattern: 3D model (orbit, fold slider and play, parts coloured), Pattern (pan, zoom, numbers, mountain and valley colours), Pages (the sheets)
- [x] Clicking an edge in the pattern cuts a fold or folds a cut and the pattern is rebuilt; a join that cannot be made is refused with a warning; "undo my edge changes" resets
- [x] The 3D fold animation keeps every face rigid and lies flat exactly like the pattern at 0
- [x] Paper (A4, Letter, Cricut mats), margin and spacing, tab width and angle, which side is printed, number height are settings
- [x] Warnings from the engine are shown in plain language (by code, translated)
- [x] Download a PDF, and a Cricut SVG (a zip for several pages); a model over 3 000 faces is refused with a message instead of freezing
- [x] Works on a phone-sized screen (bottom bar with Model, Settings, PDF)
- [ ] Checked by the owner on a real phone and with a real print and cut (needs the owner)

---

## Papercraft — Phase 3: the cover page (Implemented 2026-11-25)

ADR 0039 · Tests: `tests/papercraftCover.test.ts` (engine), `tests/papercraftStudio.test.ts` ("cover page content").

- [x] The PDF starts with a cover page (on by default, can be turned off): title, picture of the finished model, finished size in mm and inches, parts, faces, edges to glue, pages, paper, difficulty, time
- [x] The cover explains the lines (cut, mountain, valley, tab fold, numbers) with real samples of the line styles, shows a map of what is on each page, and gives seven build steps
- [x] Everything on the cover is inside the margins on A4 and Letter, for one page and for many; long titles and long steps are shrunk to fit; pages that do not fit on the map are counted
- [x] The words come from the app in the language in use; Swedish å, ä and ö come out right in the PDF; text uses only characters a PDF can show
- [x] Text is Helvetica built into the PDF reader (no font file, no image, no date), the cross-reference table and stream lengths are right, and the same input gives the same bytes
- [x] The Pages view shows the cover first
- [x] Rendered with a real PDF renderer (macOS Quick Look): the cover reads cleanly in English and Swedish with 3 and 18 pages
- [ ] Difficulty and time tuned against real builds (needs the owner to build a few models)

---

## Papercraft — Phase 4: models and repair (Implemented 2026-11-25)

ADR 0040 · Tests: `tests/papercraftMesh.test.ts` ("more built-in shapes", "repairing a mesh"), `tests/papercraftStudio.test.ts` ("built-in models are good first models", "size warning", "repairing an imported model"), the new models in `tests/papercraftUnfold.test.ts`.

- [x] Twenty built-in models in four groups with a picture of each; every one is a closed solid with nothing to warn about, no edge under 8 mm, at most 100 faces at its default size, and unfolds with every invariant of the engine
- [x] An imported model with holes shows the problem and "Close the holes" makes it a closed model (flat holes as one polygon, others as triangles around the middle); big openings are left alone and the studio says so
- [x] "Turn the model inside out" turns every face of an imported model; both fixes reset the hand edits and say what they did, and only work on an imported model
- [x] A shortest edge under 8 mm is warned about for every model, in both languages
- [x] Glue tabs are placed from the tightest edge first and a triangular tab is the last resort; edges with no room are reported
- [x] On curved models (vase, bottle, egg, rocket, fish, swan) at most one glued edge has no tab, and the edges that need it get a very narrow tab (ADR 0042: twelve ways of ordering the edges are tried and the best net is kept)
- [ ] The built-in models built and glued on paper (needs the owner)

---

## Papercraft — Phase 5: save, share and sync (Implemented 2026-11-26)

ADR 0041 · Tests: `tests/papercraftSave.test.ts` (snapshot, vault, opening, draft, versions, share link, sync, backup, My Designs and the home page).

- [x] "Save to My Designs" keeps the model, size, paper, tab settings, hand edits, cover choice and name; a dot and a line say there are unsaved changes; choosing another model starts a new design instead of overwriting
- [x] Saved models are listed in My Designs (filter, a picture of the model, rename, favourite, archive, delete with undo, open) and under "Pick up where you left off" on the start page
- [x] `/papercraft?designId=` opens a saved design; a design that is gone opens the test cube and says so; the work in progress comes back after a reload (a draft, not synced)
- [x] The version a save replaces is kept (five per design) and can be opened again as unsaved changes
- [x] A link carries a model in the part after `#` (nothing uploaded) and opens as a new unsaved copy; a damaged link or one from another tool gives a readable message; a link that would be too long is refused
- [x] Saved models are a sync kind: the app and the Worker know `papercraft`; a design from another device is accepted only if it can be opened (unknown model, damaged mesh and wrong id are refused)
- [x] The backup file holds saved models (older backups still read; damaged entries are skipped and counted) and a restore adds, updates or keeps the newer copy
- [x] A browser with no room left says so when saving
- [ ] Opened on a real second device and a phone (needs the owner)

---

## Papercraft — glue tabs on curved models (Implemented 2026-11-26)

ADR 0042 · Tests: "glue tab placement" in `tests/papercraftUnfold.test.ts`, the built-in model test in `tests/papercraftStudio.test.ts`.

- [x] Every rule for ordering the edges gives a valid net (faces keep their size, nothing overlaps, joined edges = faces - parts)
- [x] `buildPattern` keeps the best of several nets and is never worse than the first rule; it says which rule it used and which glued edges got no tab
- [x] The curved built-in models have at most one edge with no tab; a very narrow tab (1.2 mm up to the minimum width) is reported as such
- [x] Cutting or joining an edge by hand keeps the net: most folded edges stay folded
- [x] A big model tries fewer rules, so the work stays small
- [ ] A very narrow tab glued on real paper (needs the owner)

---

## Papercraft — simplifying heavy models (Implemented 2026-11-26)

ADR 0043 · Tests: `tests/papercraftSimplify.test.ts`, "simplifying a heavy model" in `tests/papercraftStudio.test.ts`.

- [x] A dense closed model is reduced to the target and stays closed with the same Euler number; its size and volume stay close to the original
- [x] The cut-up sides of a cube become a cube again (six faces); an open sheet keeps its border and its area
- [x] Same mesh and target give the same mesh; a mesh already under the target is returned as it was; never fewer than four faces; separate pieces are not joined
- [x] 82 000 faces to 500 in well under 15 s (330 000 in about 2 s)
- [x] A model over the limit is simplified when it is imported; the studio can simplify again from the imported mesh and undo it (when under the limit)
- [x] The simplified mesh is saved, shared and synced; the heavy original is not
- [ ] A simplified model built on real paper looks like the model (needs the owner)

---

## Papercraft — animals with legs and folds that close (Implemented 2026-11-26)

ADR 0044 and 0045 · Tests: `tests/papercraftAnimals.test.ts`, "built-in models are good first models" in `tests/papercraftStudio.test.ts`.

- [x] A limb grown out of a face gives one closed solid (Euler number 2, no face split, the volume of the body plus the tube); several steps can bend and shrink; faces that do not exist, no steps, a scale of 0, a face twice or two faces that touch are refused
- [x] A body along a curve with any cross-section keeps a flat face between two sections as one four-sided face and a face that is not flat as two triangles; a section can be a box where the others have eight corners
- [x] Dog, cat, pig, horse, elephant and giraffe are closed solids with nothing to warn about, the same left and right, standing on four flat feet (16 corners on the ground), and are in the list of models under Animals
- [x] At its default size each animal has at most 100 faces, no edge under 8 mm and at most one glued edge with no room for a tab
- [x] A cut edge whose two faces already lie edge to edge in the same part becomes a fold (no tab, no number); a model with no such corner unfolds as before; no part overlaps itself; an edge cut by hand stays cut; the net lies flat when unfolded and folds up to the finished model
- [x] Duck, chicken and flamingo (ADR 0046) stand on two flat feet (8 corners on the ground) and pass the same checks
- [x] Penguin and owl (ADR 0047) stand upright on a flat base with two feet at the front and pass the same checks
- [x] Unicorn, deer, lion, rhino and bull (ADR 0048) have horns, a mane or tufts and pass the same checks; two limbs on faces that touch are refused
- [x] Frog, dolphin and shark (ADR 0052) pass the same checks; the swimmers lie on a flat belly
- [ ] An animal built on real paper stands, holds its weight and looks like the animal (needs the owner)

---

## Papercraft — Silhouette DXF (Implemented 2026-11-26)

ADR 0049 · Tests: `tests/papercraftDxf.test.ts`.

- [x] A page is a release 12 ASCII DXF in millimetres with the layers CUT (black), SCORE (red) and NUMBERS (blue); closed outlines are closed polylines, folds and tabs are lines, flat folds are left out; same drawing, same text
- [x] The studio gives one DXF for one page and a zip for several, named after the project, next to the Cricut download
- [ ] The DXF opens in Silhouette Studio at the right size, with each colour settable to Cut or Score (needs the owner's machine)

---

## Papercraft — models from 2D shapes (Implemented 2026-11-26)

ADR 0050 · Tests: `tests/papercraftShapes.test.ts`.

- [x] The outline of a shape keeps the corners that matter, is counter-clockwise, and is the union when regions overlap; a hole is filled; pieces that are close are joined and far small ones are left out and counted; nothing to draw gives nothing
- [x] A box in the shape is a closed prism as deep as asked; a spun shape keeps its way up, a rectangle becomes a cylinder and a tip becomes a point
- [x] Every gallery shape makes a closed box and a closed spun model that unfold; an SVG with scripts, too big, not an SVG or empty is refused; settings stay in range
- [x] The studio makes the model at once and again on every change without starting a new design
- [ ] A shape model built on real paper (needs the owner)

---

## Papercraft — cutting files from PDF patterns (Implemented 2026-11-26)

ADR 0051 · Tests: `tests/papercraftPdfImport.test.ts`.

- [x] The lines of a PDF are read: lines, rectangles, curves, closed paths, colours, widths and dashes (from `d` and from a graphics state), transforms and saved states, form XObjects (and a form that calls itself ends), page rotation and a MediaBox that does not start at 0
- [x] Content in several streams, Flate, ASCIIHex and ASCII85 streams, object streams and nested page trees are read; text, strings with brackets, comments and inline images do not upset the lines around them
- [x] A file that is not a PDF, is encrypted, has no pages or is too big is refused; a stream with a filter that is not known is skipped with a warning
- [x] The studio's own PDF reads back: the page size, the cut outlines as closed lines of the same length, the folds as dashed lines
- [x] Lines are grouped by colour and solid or dashed, the frame of a page is left out, roles are guessed (dashed score, solid cut, white left out) and can be changed; the drawing is in millimetres, scaled, cropped on request, and feeds the Cricut SVG and the Silhouette DXF
- [x] The page at /papercraft/pdf reads a PDF in the browser and shows its styles, a preview and the downloads (checked in the dev server)
- [ ] A cutting file made from a finished pattern cuts at the right size on a real machine (needs the owner)

---

## Papercraft — paper sizes, detail, colours, tooltips (Implemented 2026-11-26)

ADR 0053 · Tests: `tests/papercraftSizesDetail.test.ts`.

- [x] A3, A5, US Tabloid and a sheet of your own size make pages of that size; a bigger sheet makes the same or fewer pages
- [x] A built-in model can be made with less detail (30 to 100 %): fewer faces at each step, still closed; a new model starts at 100 %; the edge edits start over
- [x] Parts are one colour until Colour the parts is turned on; the pattern view says what the colours mean
- [x] The size, detail and colour settings are saved and shared; an older design opens with the defaults
- [x] Settings and buttons have tooltips in both languages (checked in the dev server)

---

## Papercraft — page layout by hand, and tracing pictures (Implemented 2026-11-26)

ADR 0054 and `docs/decisions/0055-papercraft-page-layout.md` · Tests: `tests/papercraftLayoutEditor.test.ts`, `tests/papercraftLayoutHelpers.test.ts`, `tests/papercraftPdfTrace.test.ts`.

- [x] A part can be placed on a page and turned by hand (a pin); the others are placed round it and never over it; a pin for a part that has changed is ignored; empty pages are dropped
- [x] A limit on parts per page and a tight packing (several orders, turns and rules; never more pages than the plain packing) are options of the layout
- [x] Parts that stick out over the page or lie over each other are found and shown
- [x] The Pages view lets a part be dragged (with snapping to the margin and to other parts), dropped on another page, turned, nudged with the arrow keys and moved to a page by name; the layout is saved and shared
- [x] A pattern that is a picture is traced: outlines as closed cut lines, dashed lines (and dash-and-dot) as fold lines, numbers and photos left out, pale lines and lines split by a number handled; tiles are put together first; grey, RGB, CMYK, palette and one-bit pictures, and JPEG through a decoder
- [x] The PDF page traces a picture page when it is opened, says so, and gives all pages as one zip of SVG or DXF
- [ ] A traced pattern cuts right on a real machine (needs the owner)

---

## Papercraft — a square to measure, and the build order (Implemented 2026-11-26)

ADR 0056 · Tests: `tests/papercraftBuildOrder.test.ts`.

- [x] A square of 100 mm can be added to the lower left corner of the first page: no part is put on it, it is cut and printed with its size written, it is on the Cricut and Silhouette files; too small, too big or not asked for gives none; a page with only the square is kept
- [x] The build order starts with the part glued to the most others and takes the part with the most glued edges to what is built; a separate piece starts again; every glued edge is in exactly one step for every built-in model; a join names only parts built before
- [x] The parts can be numbered by the build order (new designs) or by size (older designs); the choice is saved
- [x] The settings list the steps in both languages (a click shows the part); the PDF gets the build order as pages after the cover, wrapped and on more pages when needed
- [ ] The build order is easy to follow on a real build (needs the owner)

---

## Phase 16 — Canvas Pen Tool + Full-Tool Audit Fixes (Implemented)

- [x] Fill's default "offset-grid" pattern advances rows by the hexagonal close-pack pitch (`spacingMm * sqrt(3)/2`), matching `docs/RHINESTONE_ENGINE_SPEC.md`'s "Grid Generation" section, instead of a full `spacingMm` that left visible gaps
- [x] Pen tool supports three draw modes — `freehand` (existing smart-assist), `grid` (hard snap, skips on collision instead of nudging), `row` (locks to a straight horizontal/vertical line from the drag's dominant axis)
- [x] Pen tool's freehand mode shows Figma-style alignment guides against existing stones' x/y centers and the workspace centerline (reuses `alignmentGuides.ts`, previously only wired to single-stone drag)
- [x] `react-hooks/preserve-manual-memoization` lint error in `EditorCanvas.tsx` resolved — `npm run lint` is clean
- [x] Generator errors (`outlineFontStatus`) are surfaced in the rhinestone-font, svg-alphabet, and letter-stencil panels, not just the outline text tool
- [x] Legacy vector outline font tracks and warns about characters with no real glyph instead of silently drawing `?`
- [x] `test-fixture` rhinestone font (backing file doesn't exist outside the test run) excluded from the production font picker
- [x] Ctrl/Cmd+A suppresses the browser's native select-all even when there's nothing editable to select yet
- [x] Undo history capped at `MAX_HISTORY_LENGTH` (100 entries) — verified to evict oldest entries, not most recent
- [x] Duplicate/paste stone IDs are deterministic (`generateSequentialStoneIds`, scans existing ids for `{prefix}-N`) — no `Date.now()`/`Math.random()`
- [x] SVG-alphabet loader can report `isLibraryAvailable()`; when the asset library itself is unreachable, the warning says so instead of implying the alphabet doesn't include those characters
- [x] `checkExportReadiness` warns (does not block) when `includeLabels` is on, since Cricut Design Space doesn't reliably import raw SVG `<text>`; same message shown next to the "Include labels" checkbox
- [x] `polyline-logo` generator type removed from `projectFormat.ts` (schema, validation, serialization) — it was fully speced but no generator UI or template-building function was ever implemented for it
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass (964 tests)

---

## Phase 15 — Fill Mode v1 (Implemented)

- [x] `pointInPolygon` returns true for inside points, false for outside
- [x] `calculatePolygonBounds` returns correct AABB
- [x] `generateFillPointsForClosedPolyline` places points inside a closed rectangle
- [x] Open polylines produce no fill points (no error)
- [x] Grid and offset-grid patterns are deterministic
- [x] `spacingMm <= 0` throws an error
- [x] Polygon with fewer than 3 points throws an error
- [x] Fill generation does not mutate input
- [x] `createPolylineFilledRhinestoneTemplate` outline mode equals `createPolylineRhinestoneTemplate`
- [x] Fill mode creates stones inside closed shapes
- [x] Outline-fill creates more or equal stones than outline alone
- [x] All modes support densityPreset and targetWidthMm
- [x] Fill mode passes `validateRhinestoneTemplate` (no collision errors)
- [x] Fill mode passes `checkExportReadiness`
- [x] Exported SVG from fill mode contains `<circle>` elements
- [x] Exported SVG does not contain `<image>` tags
- [x] Fill output is deterministic (same input → same positions)
- [x] `createOutlineTextTemplate` supports `fillMode` and `fillPattern`
- [x] Filled outline text passes validation and exports correctly
- [x] SVG Upload, Polyline Demo, Outline Text UI all expose fill mode controls
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass
- [x] Raw uploaded SVG is never rendered

---

## Phase 14 — Font Outline Text Foundation v1 (Implemented)

- [x] `BUILT_IN_VECTOR_FONT` covers A–Z, 0–9, space, `. , ! ? - _`
- [x] `getVectorGlyph` maps lowercase to uppercase glyph
- [x] `getVectorGlyph` returns `?` fallback for any unsupported character; `isVectorGlyphSupported` and `createOutlineTextTemplate`'s `unsupportedCharacters` metadata let callers detect and surface this instead of it being silent (Phase 16)
- [x] Space glyph has advance width but zero polylines
- [x] All supported glyphs have at least 2 points per polyline
- [x] All glyph coordinates are finite numbers
- [x] `createOutlineTextTemplate` creates stones for single-character text
- [x] `createOutlineTextTemplate` creates stones for multi-character text (SMOOCH)
- [x] Lowercase input maps to uppercase glyphs (stone count equal)
- [x] Multiline text lays glyphs on separate rows
- [x] Center / right alignment shifts stone positions
- [x] `fontSizeMm` scales stone positions
- [x] `targetWidthMm` / `targetHeightMm` scale the final layout
- [x] `densityPreset` and `customSpacingMm` pass through to stone spacing
- [x] Template metadata includes `generatedBy`, `text`, `fontMode`, `fontSizeMm`, `align`, spacing fields
- [x] Throws on empty id / name / text
- [x] Throws on invalid `fontSizeMm` (zero, negative, non-finite)
- [x] Generated template passes `validateRhinestoneTemplate` (no collision errors)
- [x] Generated template passes `checkExportReadiness`
- [x] Exports through `createBasicSvgExport` without error
- [x] Exported SVG contains `<circle>` elements
- [x] Exported SVG does not contain `<image>` tags
- [x] Output is deterministic (identical input → identical stone positions)
- [x] `OutlineTextGenerator` component renders and generates valid SVG
- [x] All engine outline logic in `src/lib/rhinestone-engine/textOutline/`
- [x] No TTF/OTF parsing, no font file upload, no system font access
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass

---

## Phase 13 — Manual Stone Editor v1 (Implemented)

- [x] `addStoneToTemplate` adds stone, rejects duplicate ids, rejects invalid holes
- [x] `removeStoneFromTemplate` removes stone, throws for missing id
- [x] `generateManualStoneId` returns deterministic `manual-N` ids
- [x] `createStoneAtPoint` uses recommended hole diameter
- [x] `undoEdit`/`redoEdit` restore previous/next states immutably
- [x] `commitEditedTemplate` pushes present to past, clears future
- [x] Edited templates carry `edited: true` and `editMode` metadata
- [x] Edited templates pass `validateRhinestoneTemplate` (when no collisions)
- [x] Edited templates pass `checkExportReadiness` (when valid)
- [x] Exported SVGs contain real `<circle>` elements, no `<image>`
- [x] `ManualStoneEditor` component uses all engine editor functions
- [x] All editor math in engine; React only manages state
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass

---

## Phase 12 — Text Layout v2 (Implemented)

- [x] `calculateDotMatrixTextLayoutBounds` returns correct bounds for single and multiline text
- [x] `alignDotMatrixLine` returns 0 for left, correct offsets for center/right
- [x] `computeTextScaleFactors` preserves aspect ratio and stretches independently
- [x] `createDotMatrixTextTemplate` supports `targetWidthMm`, `targetHeightMm`, `align`, `letterSpacingColumns`, `lineSpacingRows`
- [x] Invalid target dimensions throw with clear errors
- [x] Scaled templates pass `validateRhinestoneTemplate` and `checkExportReadiness`
- [x] Template metadata includes layout fields
- [x] `TextMatrixGenerator` exposes layout controls (alignment, spacing, sizing)
- [x] Physical text size shown in stats
- [x] Text layout logic lives in the engine
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass

---

## Phase 11 — SVG Cleanup + Logo Quality v1 (Implemented)

- [x] `removeDuplicatePolylinePoints` removes exact and near-duplicate consecutive points
- [x] `removeShortPolylineSegments` removes intermediate points creating short segments
- [x] `simplifyPolyline` (RDP) reduces collinear point count; preserves endpoints
- [x] `removeTinyPolylines` removes polylines below minimum arc length
- [x] `cleanupPolylines` throws if all polylines removed
- [x] Cleanup does not mutate input
- [x] `svgStringToPolylines` runs cleanup by default
- [x] Cleanup can be disabled with `cleanup: false`
- [x] Cleaned templates pass `validateRhinestoneTemplate` and `checkExportReadiness`
- [x] Exported SVGs contain real `<circle>` elements, no `<image>`, no raw SVG content
- [x] `SvgUploadGenerator` exposes cleanup controls
- [x] All cleanup logic in the engine
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass

---

## Phase 10 — Calibration Workflow v1 (Implemented)

- [x] `createCalibrationOverrideSet` validates holeDiameterMm > 0 and throws on invalid values
- [x] `getCalibratedHoleDiameter` returns override when present, falls back when not
- [x] `applyCalibrationOverridesToTemplate` updates matching stone sizes, leaves others unchanged
- [x] Original template is never mutated
- [x] Calibrated stones have `calibrated: true`, `calibratedHoleDiameterMm`, `originalHoleDiameterMm` in metadata
- [x] Exported SVG uses calibrated hole radius (not default)
- [x] Output is deterministic
- [x] `CalibrationWorkflow` component shows per-size inputs, comparison table, calibrated preview
- [x] All calibration math lives in the engine
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass

---

## Phase 9 — Cricut Test Pack (Implemented)

- [x] `createCricutTestPack()` returns 4 templates: grid, SMOOCH text, calibration, diamond
- [x] Every template has `unit: 'mm'` and at least one stone
- [x] Every template passes `validateRhinestoneTemplate` and `checkExportReadiness` (no errors)
- [x] Every `recommendedFilename` ends in `.svg`
- [x] Exported SVGs contain `<circle>` elements, no `<image>`
- [x] Pack is deterministic
- [x] `CricutTestPack` component shows stone count, physical size, readiness status per item
- [x] Download button gated by readiness
- [x] Stone size selector changes grid, text, and diamond templates
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass

---

## Phase 8 — Export Readiness / Cricut QA v1 (Implemented)

- [x] `checkExportReadiness` returns `ready: false` for empty, non-mm, or colliding templates
- [x] `checkExportReadiness` returns errors for duplicate IDs, invalid holes, collisions
- [x] `checkExportReadiness` returns calibration warning (not error) — template stays ready
- [x] `checkExportReadiness` returns physical size warnings for out-of-range dimensions
- [x] `checkExportReadiness` returns `PHYSICAL_SIZE` info issue always
- [x] `minStoneCount` option produces error when count is too low
- [x] Summary includes `stoneCount`, `widthMm`, `heightMm`, `materialProfileId`, `cutter`, `stoneSizes`, `hasCollisions`
- [x] Result is deterministic
- [x] Grid, text, and polyline templates pass readiness with no errors
- [x] `ExportReadinessPanel` shows ready/not ready status with errors, warnings, info
- [x] All four generators and `CalibrationSheetGenerator` render `ExportReadinessPanel`
- [x] `SvgExportActions` is disabled when `readiness.ready === false`
- [x] Calibration sheet download is never blocked by calibration warning alone
- [x] Readiness math lives in engine, not duplicated in React
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass

---

## Phase 7 — Stone Spacing / Density Controls v1 (Implemented)

- [x] `standard` preset equals recommended center distance
- [x] `safe` preset is recommended + 0.25 mm
- [x] `dense` preset is recommended − 0.15 mm, clamped to `minCenterDistanceMm`
- [x] `loose` preset is recommended + 0.5 mm
- [x] `custom` preset uses caller-supplied value, validated against `minCenterDistanceMm`
- [x] `custom` with missing value throws; `custom` below min throws
- [x] Dense never produces spacing below `minAllowedSpacingMm` (safe to cut)
- [x] `createDotMatrixTextTemplate`, `createPolylineRhinestoneTemplate`, `createStoneGridTemplate` all support `densityPreset`
- [x] Templates with any preset pass `validateRhinestoneTemplate`
- [x] `densityPreset` and `resolvedSpacingMm` recorded in template metadata
- [x] All four UI components have density preset dropdown and custom spacing input
- [x] Density math is in the engine — React only passes the preset name and optional value
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass

---

## Phase 6 — Physical Size Controls v1 (Implemented)

- [x] `calculatePolylineBounds` returns correct bounds for one and multiple polylines
- [x] `scalePolylinesToWidth` scales to exact target width (aspect preserved)
- [x] `scalePolylinesToHeight` scales to exact target height (aspect preserved)
- [x] `scalePolylinesToFit` with both dimensions + `preserveAspectRatio:true` fits inside box
- [x] `scalePolylinesToFit` with `preserveAspectRatio:false` stretches independently
- [x] Scaling moves minX/minY to `originXmm`/`originYmm`
- [x] Scaling does not mutate input polylines
- [x] Throws on empty polylines, invalid target dimensions
- [x] `getTemplateStoneBounds` includes full hole radius
- [x] `getTemplatePhysicalSize` returns `widthMm`/`heightMm`
- [x] `createPolylineRhinestoneTemplate` accepts `targetWidthMm`, `targetHeightMm`, `preserveAspectRatio`
- [x] Scaled template passes `validateRhinestoneTemplate`
- [x] Exported SVG width/height are in mm (not px)
- [x] `SvgUploadGenerator` shows estimated physical output size
  > `PolylineLogoGenerator`/`polyline-logo` was removed in the 2026-08 audit — it was fully speced in `projectFormat.ts` (schema, validation, serialization) but no generator UI or template-building function was ever built for it, so the editor threw on load for any saved project of that type. Physical-size display for polyline-based content now lives in `SvgUploadGenerator`.
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass

---

## Phase 5 — SVG Upload v2: Curves + Transforms (Implemented)

- [x] C/c cubic Bezier flattened to `curveSegments` polyline points
- [x] S/s smooth cubic Bezier (reflected control point)
- [x] Q/q quadratic Bezier flattened
- [x] T/t smooth quadratic Bezier (reflected control point)
- [x] A/a arc throws with message `"arc commands are not supported"`
- [x] `curveSegments` option controls smoothness (default 24)
- [x] translate, scale, rotate, matrix transforms applied to element points
- [x] Transform chain (multiple transforms) applied in SVG left-to-right order
- [x] Unsupported transforms (skewX/skewY) throw with clear error
- [x] Malformed matrix throws with clear error
- [x] `parseSvgViewBox` returns `{minX,minY,width,height}` or null
- [x] `getSvgRootAttributes` returns viewBox, width, height from root `<svg>`
- [x] `<style`, `data:`, `@import` added to safety block list
- [x] `SvgUploadGenerator` banner updated for v2
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass

---

## Phase 4 — SVG Upload v1: Safe Primitive Parsing (Implemented)

- [x] `validateSafeSvgInput` returns safe for simple primitive SVG
- [x] `validateSafeSvgInput` flags script, foreignObject, image, javascript:, onload=, href=, xlink:href=
- [x] `extractSvgElements` extracts line, polyline, polygon, rect, circle, ellipse, path elements
- [x] `svgStringToPolylines` converts all supported primitives to Polylines
- [x] Circle/ellipse approximated with configurable segment count (default 64)
- [x] Path M/L/H/V/Z commands supported
- [x] Bezier curve commands (C/Q/A/…) throw with clear error mentioning “flatten”
- [x] `transform` attribute throws with clear error
- [x] Unsafe SVG throws
- [x] SVG with no supported shapes throws
- [x] Generated polylines pass through `createPolylineRhinestoneTemplate`
- [x] Generated template passes `validateRhinestoneTemplate`
- [x] Exported SVG contains real `<circle>` elements, no `<image>`, no raw uploaded SVG data
- [x] `SvgUploadGenerator` component never passes uploaded SVG to `dangerouslySetInnerHTML`
- [x] Preview shows only engine-generated rhinestone SVG
- [x] `npm run build`, `typecheck`, `lint`, `test` all pass

---

## Phase 3 — SVG/Logo Foundation v1: Polyline Sampling (Implemented)

- [x] `getPolylineLength` returns correct length for single segments, multi-segment, and closed polylines
- [x] `normalizePolylineInput` clones input, throws on < 2 points, throws on non-finite values
- [x] `samplePolylineBySpacing` always includes the first point
- [x] `samplePolylineBySpacing` returns deterministic results
- [x] `samplePolylineBySpacing` throws if spacingMm <= 0
- [x] `samplePolylineBySpacing` supports closed polylines (more points than open)
- [x] `createPolylineRhinestoneTemplate` returns `RhinestoneTemplate` with `unit: 'mm'`
- [x] Template passes `validateRhinestoneTemplate` with zero issues
- [x] Template exports via `createBasicSvgExport` — each stone is a `<circle>`
- [x] Exported SVG has no `<image>` elements
- [x] `PolylineLogoGenerator` component uses `createPolylineRhinestoneTemplate` from the engine
- [x] Demo shapes (diamond, triangle, rectangle, zigzag) work correctly
- [x] No raw SVG input accepted by the component
- [x] `npm run build`, `typecheck`, `lint`, and `test` all pass

---

## Phase 2 — Text-to-Rhinestones v1: Dot Matrix (Implemented)

- [x] `DOT_MATRIX_5X7_FONT` has entries for all uppercase A–Z, 0–9, space, and . , ! ? - _
- [x] Every glyph is exactly 7 rows of 5 characters each
- [x] All glyph cells are only `"0"` or `"1"`
- [x] `getDotMatrixGlyph(char)` returns the `?` glyph for unsupported characters
- [x] `createDotMatrixTextTemplate` returns a `RhinestoneTemplate` with `unit: 'mm'`
- [x] `createDotMatrixTextTemplate` generates 18 stones for text `"A"` (SS10)
- [x] Stone IDs are deterministic and unique
- [x] Lowercase input is uppercased by default
- [x] Multiline text (split on `\n`) produces stones on separate rows
- [x] Generated template passes `validateRhinestoneTemplate` with zero issues
- [x] Generated template exports via `createBasicSvgExport` — each stone is a `<circle>`
- [x] Exported SVG has no `<image>` elements
- [x] `TextMatrixGenerator` component uses `createDotMatrixTextTemplate` from the engine
- [x] `TextMatrixGenerator` uses shared `SvgPreview`, `SvgExportActions`, `TemplateStatsCard`, `ValidationIssuesList`
- [x] Filename is deterministic: `rhinestone-text-dot-matrix-{size}.svg`
- [x] `npm run build`, `typecheck`, `lint`, and `test` all pass

---

## Phase 1.7 — Shared SVG UI Components (Implemented)

- [x] `SvgPreview` renders engine-generated SVG safely; shows empty state when svg is empty
- [x] `SvgPreview` has a code comment explaining the `dangerouslySetInnerHTML` security contract
- [x] `SvgExportActions` handles Download and Copy with disabled state when svg is empty
- [x] `SvgExportActions` shows copy success/error state
- [x] `TemplateStatsCard` renders any combination of stone count, size, columns, rows, material, cutter, and extra stats
- [x] `ValidationIssuesList` shows valid/invalid status, issue list with codes, and stone IDs
- [x] `ManualGridGenerator` uses all four shared components
- [x] `CalibrationSheetGenerator` uses `SvgPreview`, `SvgExportActions`, `TemplateStatsCard`
- [x] `npm run build`, `typecheck`, and `lint` all pass
- [x] Duplicate download/copy/preview logic removed from individual components

---

## Phase 1.6 — Calibration Sheet UI (Implemented)

- [x] `CalibrationSheetGenerator` component exists at `app/components/CalibrationSheetGenerator.tsx`
- [x] Uses `createDefaultMagicFlockCalibrationSheet()` — no engine logic duplicated in React
- [x] Exports via `createBasicSvgExport()` — same pipeline as production templates
- [x] Exported SVG has `width`/`height` in `mm` units, no `<image>`, all holes are `<circle>`
- [x] Shows material, cutter, stone sizes, and total hole count
- [x] Shows description of diameter variant columns and how to use them
- [x] Prominent provisional warning banner
- [x] Download button creates a Blob (`magic-flock-calibration-sheet.svg`)
- [x] Copy SVG button
- [x] Component appears on home page below the grid generator
- [x] No raw user SVG input accepted
- [x] `npm run build`, `typecheck`, and `lint` all pass

---

## Phase 1.5 — First UI: Manual Grid Generator (Implemented)

- [x] `ManualGridGenerator` component exists at `app/components/ManualGridGenerator.tsx`
- [x] Component uses `createStoneGridTemplate` from the engine — no engine logic duplicated in React
- [x] Component calls `validateRhinestoneTemplate` before export
- [x] Validation status (valid/invalid + issue list) is shown in the UI
- [x] Export uses `createBasicSvgExport` — all holes are `<circle>` elements
- [x] Exported SVG has `width`/`height` in `mm` units
- [x] Exported SVG does not contain `<image>` or raster data
- [x] Download button creates a Blob and uses `URL.createObjectURL`
- [x] Filename is deterministic: `rhinestone-grid-{size}-{cols}x{rows}.svg`
- [x] Copy SVG button copies the SVG string to clipboard
- [x] Template stats (stone size, count, columns, rows) are displayed
- [x] SVG preview renders inline using `dangerouslySetInnerHTML` on engine-only output
- [x] No raw SVG input from the user is accepted
- [x] `npm run build`, `typecheck`, and `lint` all pass

---

## Phase 0.5 — Template Creation and Validation (Implemented)

- [x] `createRhinestoneTemplate(input)` returns a `RhinestoneTemplate` with `unit: 'mm'`
- [x] `createRhinestoneTemplate` throws on empty id, empty name, duplicate stone ids, invalid hole diameters
- [x] `createStoneGridTemplate(options)` generates a correct rectangular grid with deterministic ids
- [x] `createStoneGridTemplate` uses recommended hole diameter and spacing from material profile
- [x] `createStoneGridTemplate` throws on rows/columns < 1 or insufficient spacing
- [x] `validateRhinestoneTemplate` returns `valid: true` for a clean template
- [x] `validateRhinestoneTemplate` returns `valid: false` and error codes for unit mismatch, empty fields, bad hole diameter, duplicate ids, collisions
- [x] Collision issues include the `stoneIds` of both offending stones
- [x] `requireNoCollisions: false` option suppresses collision errors
- [x] `requireUniqueStoneIds: false` option suppresses duplicate-id errors
- [x] Grid templates pass `validateRhinestoneTemplate` with zero issues

---

## Phase 1 — Engine Core

### Geometry
- [ ] `generateHexGrid(bounds, stoneProfile, materialProfile)` returns a sorted array of `Point` objects
- [ ] Grid covers the full bounding box
- [ ] Grid spacing matches the stone size + safety margin formula from `RHINESTONE_ENGINE_SPEC.md`

### Collision Detection
- [ ] `filterCollisions(candidates, accepted, minDistance)` correctly removes overlapping points
- [ ] A pair of stones at exactly `minDistance` apart is **accepted**
- [ ] A pair of stones at `minDistance - 0.001` apart is **rejected**
- [ ] Performance: 10,000 candidates resolved in < 100 ms

### Path Fill Filter
- [ ] `filterInsidePaths(candidates, paths)` retains only points inside the path
- [ ] Points on the path boundary are included
- [ ] Compound paths (holes) are handled correctly: points inside a hole are excluded

### Determinism
- [ ] Running the engine twice with identical inputs produces byte-identical `StonePosition[]` arrays
- [ ] Output is sorted by `(y ASC, x ASC)`

---

## Phase 2 — Text Input

### Functional
- [ ] User can type text and select a font
- [ ] Text is converted to SVG path (vector outline)
- [ ] Engine fills the path with stones using the selected size
- [ ] Preview renders in-browser without canvas

### Output Quality
- [ ] Stones are distributed evenly inside all characters
- [ ] No stones overlap
- [ ] Characters with holes (O, B, D, etc.) correctly exclude the interior hole
- [ ] Design is legible at 50 mm height for SS10 stones

### Export
- [ ] Downloaded SVG opens in Cricut Design Space at correct physical size
- [ ] SVG passes the export checklist in `docs/EXPORT_REQUIREMENTS.md`

---

## Phase 3 — SVG/Logo Input

### Functional
- [ ] User can upload an SVG file
- [ ] Upload is parsed and normalized to mm-coordinate paths
- [ ] Engine fills the paths with stones
- [ ] Preview renders correctly

### Edge Cases
- [ ] SVG with nested groups is flattened correctly
- [ ] SVG with `transform` attributes is resolved before path extraction
- [ ] Very small paths (< 3 stones fit) produce 0–2 stones without error

### Export
- [ ] Output SVG is Cricut-safe (passes export checklist)

---

## Phase 4 — Calibration

### Engine (Implemented)
- [x] `createCalibrationSheet(profile, options?)` returns a `RhinestoneTemplate` with `unit: 'mm'`
- [x] Sheet contains one row per supported stone size
- [x] Default variant mode produces 4 holes per size (−0.1, 0, +0.1, +0.2 mm)
- [x] Variant-off mode produces 1 hole per size
- [x] All stones carry `calibration: true`, `materialProfileId`, `testedHoleDiameterMm`, `variantLabel` in metadata
- [x] Generated IDs and positions are deterministic
- [x] Calibration sheet exports via `createBasicSvgExport()` without error
- [x] Exported SVG contains `<circle>`, `data-stone-size`, `data-hole-diameter-mm`
- [x] Exported SVG does not contain `<image>`

### UI (Pending)
- [ ] User can trigger calibration sheet download from the UI
- [ ] User can enter measured offsets in the UI
- [ ] Offsets are applied to engine output
- [ ] Calibrated profile is saved to `/calibration/`

### Physical Test (Required)
- [ ] Calibration sheet is cut on Magic Flock with a Cricut Maker
- [ ] Holes at all four diameter variants are tested with real stones
- [ ] Correct diameter variant identified; `kerfCompensationMm` updated
- [ ] All stone sizes seat correctly with no tearing after calibration

---

## Admin panel and template catalog (ADR 0057)

- [x] `/api/catalog/*` and `/api/admin/*` refuse a request without a valid Access token (tested)
- [x] Details are validated: id, studio, format, name, tags, own fields; a template cannot change studio (tested)
- [x] A file is stored in chunks, with name, type and size on the template, and is served back whole (tested)
- [x] Published templates only are listed unless `all=1`; a draft cannot be published without a file
- [x] `/admin`: list, search, studio filter, new / edit / delete, publish, file and picture upload, own fields
- [ ] Checked on the deployed private site behind Cloudflare Access
- [x] Papercraft: published OBJ/STL/GLB models of the catalog are listed under “From the catalog” and open like an imported file (nothing shows where there is no catalog)
- [x] Rhinestone and HTV read the published templates (ADR 0061): “From the catalog” in Rhinestone's My Designs panel (SVG as artwork, `.rhinestone.json` as a project) and in HTV's tool panel (SVG as a layer); nothing shows where there is no catalog or nothing published; a file the studio cannot open says so; each use is counted as `catalog_template_used` (checked in the running page on the local Worker)
- [ ] A saved HTV design as a catalog template (HTV has no design file format yet) and “Save as a template” from Rhinestone
- [x] Statistics and tracking: see the next section (metadata settings are still to do)

---

## Statistics and tracking (ADR 0060)

- [x] `/api/track/*` and the statistics routes of `/api/admin/*` refuse a request without a valid Access token (tested)
- [x] An event is checked before it is stored: name, path, label, at most 8 small props, a random session id; the studio is worked out by the Worker (tested)
- [x] No IP address and no user agent is stored; the login is a 16-character one-way hash (tested)
- [x] Settings (own events on/off, GA4 id, GTM id, Do Not Track, retention 7–730 days) are validated and used at once (tested)
- [x] Nothing is stored when own events are off; events older than the retention are deleted, at most once an hour (tested)
- [x] Statistics over 7/30/90/365 days come from the database's own counts; “Delete all events” empties the table (tested)
- [x] A browser with Do Not Track / Global Privacy Control is not counted anywhere (own database, GA4, GTM) when the owner respects it (tested)
- [x] GA4 and GTM scripts load only for a valid id, only on the private site, and only after the settings say so (tested)
- [x] `/admin` has the tabs Templates, Statistics and Tracking; checked in the running page on the local Worker
- [ ] Checked on the deployed private site behind Cloudflare Access
- [ ] Events seen in a real Google Analytics / Tag Manager account (needs the owner's ids)
- [ ] Metadata settings (title, description, social picture) — a later part

---

## Papercraft: own models (ADR 0058)

- [x] Parts (box, cylinder, cone, pyramid, frustum) are closed solids with outward faces; open ends leave out the lid (tested)
- [x] Every parametric template builds from its defaults and its extremes and unfolds to parts that fit an A4 page (tested)
- [x] The recipe is saved with the design and comes back; a damaged recipe or a design from before recipes still opens (tested)
- [x] “Build your own model” in the Model panel: templates, values, part editor (checked in the running studio)
- [x] Save the model as a template in the catalog (JSON design + picture); it opens again from “From the catalog” with its recipe, size and settings (checked on the local Worker)
- [x] Draw the pattern flat in 2D (`/papercraft/draw`, ADR 0059): outlines, fold lines, glue tabs, numbers; Cricut SVG, Silhouette DXF, PDF and JSON download (checked with synthetic pointer events in the running page)
- [x] Several pages per drawing (PDF with all pages, SVG/DXF per page) and smooth curves through points (tested; checked in the running page with synthetic events)
- [ ] A drawing cut on a real machine
- [x] Save a drawing in the catalog and open it from “Drawings from the catalog” (checked on the local Worker); the studio does not list drawings
- [x] Move the parts of a built model with the mouse in the Build view: select, drag on the ground, Shift-drag to lift (math tested; checked in the running studio with synthetic pointer events)
- [ ] A real model built from one of the templates has been folded and glued

---

## General Non-Regression Rules

These must hold across all phases:

1. The engine never imports from `/app/`.
2. No `<canvas>` element is used in the export pipeline.
3. All SVG output has `width` and `height` in `mm`.
4. Collision detection is never disabled.
5. All engine functions have corresponding unit tests.
6. A new stone size can be added by adding one profile entry — no algorithm changes needed.
