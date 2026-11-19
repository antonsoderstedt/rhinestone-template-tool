# Improvement backlog

**Date:** 2026-11-19 · **Basis:** a walk through the whole tool as a first-time user (start page, every Rhinestone tool,
select/edit, export, My Designs, Library, Fonts, Settings, Setup/calibration, HTV studio and garment preview), plus what was
measured and found during phases 1–13. Evidence is what was actually seen or measured; nothing here is speculation about
code that was not read. **Impact** = how much it changes what a user can make or how fast they get a good result.
**Effort**: S ≈ a day or less, M ≈ days, L ≈ a week or more.

## Top ten (suggested order)

| # | Item | Impact | Effort |
|---|------|--------|--------|
| 1 | **Several elements in one design** (name + number, text + artwork + shape), each movable | Very high | L |
| 2 | **One "Text" tool with a live style gallery** (every font, alphabet and stone font shown with the user's own text) | High | M |
| 3 | **Mat overlay and fit-to-mat for every generator**, and a size control for stone fonts | High | M |
| 4 | **Export beyond SVG**: true-size PDF/PNG for placing stones, DXF, a small test patch | High | M |
| 5 | **Real undo/redo for every change**, plus whole-design rotate / flip / move / numeric resize | High | M |
| 6 | **Stone colours and a realistic preview** (crystal / AB / jet), with counts per colour | High | M–L |
| 7 | **Plain-language copy and calmer page chrome** (remove engine jargon and repeated cards) | Medium | S |
| 8 | **Machine and material profiles** instead of the fixed Cricut Maker 3 + Magic Flock | Medium | M |
| 9 | **End-to-end tests and a physical-validity test for every font** that runs on CI | Medium (prevents regressions) | M |
| 10 | **Move storage to IndexedDB** and stop duplicates piling up in My Designs | Medium | S–M |

## A. Clarity and first impression

| # | Suggestion | What was seen |
|---|-----------|---------------|
| A1 | Merge Text / Stone Font / Alphabet / Stencils into one Text tool with a style gallery (stencils as an option) | Four tools make text, with no explanation of the difference; Alphabet and Stone Font pick from a plain list with no previews |
| A2 | Remove the boilerplate at the top of every tool panel | Every panel starts "Generated – Driven by generator settings" and "X Source – These settings control the generated baseline for the current design source" |
| A3 | Rewrite jargon: "Filled typography", "mode stones", "Private · Script", "Authoritative hole diameter", "the engine reuses the letters as-is", "Make Editable" | Seen in the Text, Stone Font, Alphabet and Select panels |
| A4 | Replace "Generated vs Editable" with one idea: clicking a stone offers to edit stones individually (undoable) | The Select panel says "Generated output… use Make Editable"; nothing can be selected until then |
| A5 | Home page: hide "Recovery & status – WARNING – Calibration is the main production gate" (and the duplicated "Review calibration" button) until there is something to recover; show starter templates instead | A brand-new user sees a WARNING block and three counters at zero |
| A6 | Drop the "RHINESTONE OS – Studios, assets, fonts, production workflow" tagline and the "Workflow / Mode split" strip | Vague wording on every page |
| A7 | Plain page headings and remove the quick-action cards that repeat the navigation (My Designs, Settings) | "Asset command center", "Everything you have already made, still usable", "optimized for returning to production work fast…" |
| A8 | Fix wording slips ("The standardvalue is…" on Setup) and keep one language | English with a Swedish word in the calibration step |
| A9 | Offer a Swedish interface and a mm / inch switch for the whole app | Everything is English; inches only appear in HTV |
| A10 | Compact HTV status (chips) instead of the three-line paragraph above the canvas | "1 layer … ready to export. Design size … The cut file is … which needs a 12 × 24 in mat …" |
| A11 | Name a new project from its text ("YOUR NAME design") and stop the permanent "Not saved yet" nag | Status bar always shows "My Designs: Not saved yet" |
| A12 | Starter gallery on the home page (names, numbers, jerseys, monograms, hearts), with recent and favourite fonts | Only three goal cards; starters exist but are hidden in the library |

## B. What users cannot do yet

| # | Suggestion | What was seen |
|---|-----------|---------------|
| B1 | **Multiple elements per design** with move / rotate / scale / align / order | A Rhinestone design is exactly one source (one text, or one artwork, …); switching tools swaps the whole design. HTV already has layers |
| B2 | **Whole-design transforms**: rotate, flip / mirror, move, resize by width or height after generation | Only the generator's own size fields exist; to rotate you edit stones |
| B3 | **Undo / redo for everything** (text, font, size, tool settings), not only stone edits | The Undo button is disabled while typing and changing settings; it only works after "Make editable" |
| B4 | **Stone colours**: per-stone or per-layer colour, multi-colour designs, counts per colour for ordering | Every stone is the same purple circle; colour exists only as metadata |
| B5 | **Realistic preview**: glossy crystals, AB / jet / clear, on a fabric photo | Canvas shows hollow circles; the Rhinestone "Garment" preview is a crude flat tee silhouette with dotted text, far below the photo-real HTV mockup |
| B6 | Text features: several fonts in one text, per-letter styling, text on a path or shape, kerning, bold / italic | One font per text block |
| B7 | A shape / clipart gallery for rhinestone designs (stars, hearts, crowns, borders) | HTV has shapes; Rhinestone has only grid and pen |
| B8 | Artwork: preview of the trace, colour-to-stone mapping for photos, outline vs fill per colour | Artwork tool is a file picker plus settings, with no preview of what the trace will do |
| B9 | **Stone font size control** (stone size is the only lever) | Old English "Sulay" at SS10 is 425 × 192 mm, Huge Digits 500 mm: larger than a 12 × 12 in mat with no way to shrink except SS6 |
| B10 | **Fix "Filled typography"** (text fill) | Fills at 25 and 45 mm leave scattered stones that do not follow the letters |
| B11 | **Auto-size and auto stone size**: "make this fit the mat" or "best stone size for 60 mm letters" | Fit to mat only works for text and uploaded artwork; stone fonts, hand-made and imported designs cannot be resized (they can now be cut in parts instead; ADR 0019) |
| B12 | Combine Rhinestone and HTV in one project (HTV letters with a rhinestone outline) | Two separate studios and separate saved designs |
| B13 | Keyboard editing: arrow-key nudge, Tab through stones, type exact X / Y | Stones can only be selected and moved with a pointer |
| B14 | Dimension labels and centre guides on the canvas; snap to the mat edge | Size is only in the status bar |

## C. Engine and layout quality

| # | Suggestion | What was seen |
|---|-----------|---------------|
| C1 | Cleaner outline text at small sizes: single row along the centre line when strokes are under two stones wide | 25 mm outline text turns to mush; the default now avoids it by being 60 mm, but small text still does |
| C2 | Tidy joins and counters (stray stones inside "A", "O", uneven clusters at corners) | Visible in outline text at 45–60 mm |
| C3 | Warn before generating huge designs and offer a smaller stone size | A stone font at SS10 silently becomes 500 mm wide |
| C4 | Move generation to a web worker and show progress | Fills and large fonts run on the main thread; first load of a big font shows only a status line |
| C5 | Use a spatial index in the nearest-neighbour code (enlarge, auto-fix) | O(n²); fine up to ~4,000 stones, which is why the enlarge fix is capped there |
| C6 | Render above ~5,000 stones with canvas instead of SVG | Measured: 2,060 stones pan at ≈ 21 ms per frame (OK); the DOM grows by one node per stone |
| C7 | Keep the "enlarge to make cuttable" quick fix, or retire it | Stone fonts no longer need it after the scale fix; it only triggers for other overlapping layouts |

## D. Export and production

| # | Suggestion | What was seen |
|---|-----------|---------------|
| D1 | More formats: PDF and PNG at true size, DXF, EPS; "Copy SVG" in the dialog | Only SVG is exported |
| D2 | **Print-at-true-size sheet** to place stones by hand, and a customer-approval sheet (preview, stone counts, sizes) | Not present; useful for sellers |
| D3 | ~~Split big designs across mats~~ **Done (ADR 0019)**; registration marks remain | Designs over 12 × 24 in now split into parts that each fit a 12 × 12 or 12 × 24 in mat, with a layout file |
| D4 | Export a small **test patch** of the real design (about 5 × 5 stones) to test-cut | Calibration uses a separate generic test pack |
| D5 | Step-by-step "open in Design Space" instructions in the export dialog, plus a 50 mm check square in the file to verify import scale | The dialog explains calibration but not the import |
| D6 | Material and cost: flock area, number of mats, stone cost (cost exists) | Stone estimate exists; material does not |
| D7 | Machine-specific cut settings in the export (they exist only on the Setup page) | Cut settings live only on `/setup` |

## E. Calibration, machines and materials

| # | Suggestion | What was seen |
|---|-----------|---------------|
| E1 | Machine and material selector (Cricut Explore / Joy, Silhouette, other flocks or template materials, custom) | Setup is fixed to "Cricut Maker 3 + Magic Flock" |
| E2 | One-screen guided calibration with photos, "pick the closest hole", and a clear skip-with-defaults path | Three text-heavy steps; "Export unlocks once your material is approved" while an override also exists |
| E3 | Show calibration status per stone size in the studio | The studio only shows "Needs calibration" |
| E4 | Several saved calibration profiles with names and dates | One active profile |

## F. Data, backup and sharing

| # | Suggestion | What was seen |
|---|-----------|---------------|
| F1 | Store designs in IndexedDB and warn near the quota | All in localStorage (≈ 5 MB); a few 2,000-stone designs plus the autosave copy can reach it |
| F2 | Stop "(previous session)" copies piling up in My Designs; merge or prune | Test profile ended with dozens of "Crowded test (previous session)" entries |
| F3 | Backup reminder and a "last backed up" indicator | Backup exists but is entirely manual |
| F4 | Share link / read-only view of a design | Nothing between "send the file" and nothing |
| F5 | Per-design version history | Autosave keeps only the latest state |
| F6 | Optional accounts and cloud sync | Browser-only by decision (ADR 0008); revisit if multi-device matters |
| F7 | Backup should include uploaded fonts, images and calibration | Today only saved designs are included |

## G. HTV studio

| # | Suggestion | What was seen |
|---|-----------|---------------|
| G1 | Per-colour cut files and layer order for multi-colour transfers | One export for the whole design |
| G2 | One-click "fit to print area" and centre guides | Design size is reported but not offered as an action |
| G3 | Boolean / weld, offset (shadow) and arc text tools | Basic text and shapes only |
| G4 | Upload your own garment photo as a mockup | Five built-in garments |
| G5 | HTV text in fonts without Å Ä Ö (the Rhinestone studio already allows them) | HTV still refuses such fonts outright |

## H. Performance and technical debt

| # | Suggestion | What was seen |
|---|-----------|---------------|
| H1 | Run Lighthouse and set a budget; lazy-load the 3,691 imported fonts and serve them from a CDN | Only axe has been run; fonts live in `/public` |
| H2 | **Playwright end-to-end tests**: design → export, save → reload, backup → restore, mobile layout | Every flow was verified by hand in this project |
| H3 | **A physical-validity test for every font and alphabet** with small committed fixtures | The stone-font scale bug (all fonts overlapping) passed every test because they checked sizes, not validity |
| H4 | Commit small licensed fixture fonts so the 15 library-dependent tests run on CI | They skip themselves on CI today |
| H5 | An error boundary around each studio with "your work is safe, a copy was kept" | One bad saved project crashed the page until this was fixed |
| H6 | Opt-in "report a problem" that attaches the design state | No feedback path |
| H7 | Review the old synchronous outline pipeline and other legacy paths for removal | Noticed while reading the generation code and tests; not audited |

## I. Accessibility and devices

| # | Suggestion | What was seen |
|---|-----------|---------------|
| I1 | Screen-reader pass; the canvas has no text alternative for the design | Not audited; axe finds no violations but axe cannot judge this |
| I2 | One-finger pan on touch (a pan tool) and better landscape phones | Two fingers needed to pan |
| I3 | Test on Safari, Firefox and real phones / tablets | Only Chromium emulation so far |
| I4 | Forced-colors and reduced-motion support | Not handled |

## What is already good (keep)

The goal-based start, the one-click fixes (spacing, fit to mat), stone and cost estimate, backup / restore, the HTV garment
mockups and 3D with fallback, undoable deletes, the keyboard shortcut sheet, the mobile layout, and the honest calibration gate
with an informed override.
