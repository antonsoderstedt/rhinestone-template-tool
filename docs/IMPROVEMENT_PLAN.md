# Improvement plan

**Date:** 2026-11-19 · **Covers:** every item in `IMPROVEMENT_BACKLOG.md` (A1–I4, 67 items) plus the new section **J — Result
quality and the Artwork tool** (J1–J15), which this plan puts first because it decides whether a user ever gets a result they
want to cut.

**Evidence labels.** *Measured* = I ran it in this repository (a probe test or the browser) and read the output.
*Read* = taken from the code, not run. *Screenshot* = seen in the screenshots the user sent. *Not verified* = a hypothesis. The
user's own files (`Resurs 3.svg`, `bubblegumstrawberrywatermelonice-logo.svg`) are **not on this machine**, so every artwork
measurement below uses stand-ins I wrote; they show the engine's behaviour, not the behaviour on those two files.

---

## 1. What "looks good with every setting" means

A result is good when it passes four gates, **for every combination of artwork × mode × stone size × size on the mat**. Today
only the first is enforced.

| Gate | Meaning | Today |
|---|---|---|
| **G1 Cuttable** | No overlaps, gaps ≥ the material minimum, fits the mat | Enforced (readiness check, spacing resolver) |
| **G2 Faithful** | The stones read as the source: silhouette overlap with the source (IoU) above a threshold, no stray stones, corners and counters kept | **Not checked anywhere** |
| **G3 Feasible** | The finest detail of the source is at least one stone wide at this size; if not, the tool says so *before* generating and offers a size or stone size that works | **Not checked anywhere** |
| **G4 Honest preview** | What the canvas shows is what will be cut: stones drawn to scale with their real gap, source art shown behind, problems marked | Stones are drawn with a stroke as wide as the gap, so a cuttable layout looks overlapped (Screenshot) |

The plan below builds the missing gates once (phase 0 and 1) and then every generator is judged by them.

## 2. What I found (the reasons behind the order)

### 2.1 Artwork import: the importer drops or mangles common real-world SVG (Measured)

Probe results, each a small SVG of the kind Illustrator / Figma / Inkscape / Canva produce:

| Input | What the importer does |
|---|---|
| Shape inside `<g transform="translate(200,0)">` | **Transform ignored**: the shape lands at x 0–50 instead of 200–250, on top of its neighbour. Only an element's own `transform` is read; group transforms never are |
| Path with arc commands (`a`, `A`), which is how most editors export circles and rounded corners | **Throws** "arc commands are not supported" |
| White `<rect>` background plus a coloured circle | The background becomes a stone shape too: a frame of stones around the artwork. **Fill colour is never read** |
| `<defs><style>.cls-1{fill:#f9b}</style>` (Illustrator's default) | The validator flags `<style>` as unsafe; the converter proceeds anyway. Whether the upload dialog blocks it was not tested |
| `<use href="#id">` (symbols, repeated shapes) | **Throws** "unsafe SVG content" (`href=` is on the block list) |
| `<text>` | "No supported SVG shapes found" |
| `display="none"`, `opacity="0"` elements | Included as if visible |
| Stroke-only line, `stroke-width="12"`, `fill="none"` | Becomes a zero-width centre line; the stroke width is ignored |

### 2.2 Generators: fine on tidy shapes, not on real artwork (Measured)

On two stand-in shapes (a blob with an inner shape; four block letters) at SS10, 90 mm wide: Outline, Fill, Outline + Fill
(default / hexagonal / radial) and Contour all gave cuttable output (smallest gap 0.51–0.71 mm, no overlaps). So the failures in
the screenshots are **not** a general collision bug. They come from input the generators were not built for:

- **Thin features** (Measured, four bars at 90 mm wide, SS10, stone hole 3.43 mm): a 2.4 mm stroke gives **24 `STONE_TIGHT_GAP`
  issues in Outline** (the two edge rows of the stroke collide) and **0 stones in Fill** (`NO_STONES`); a 3.9 mm stroke is
  cuttable but Fill keeps 20 stones where Outline keeps 60 (inset drops the rest); 6 mm is fine. The logo screenshots (62 and 9
  stones, unreadable) are consistent with this, but I could not run that file. The right fix is a **centre-line (skeleton)
  layout** for parts narrower than about two stones, plus telling the user the size is too small.
- **Shapes close to each other** (Measured): a frame 3 mm outside a shape gives **5 `STONE_COLLISION` and 9 `STONE_TIGHT_GAP`**
  in Outline: each shape is sampled on its own and nothing reconciles the two rows. Combined with "fill colour is never read"
  (§2.1) a stray background shape produces exactly this.
- **Inner shapes are treated as holes, never as another colour.** The pink blob with a dark inner shape (Screenshot) fills as a
  ring: the inner shape is subtracted. For a design with two colours that is wrong; it needs **colour layers** (backlog B4).
- **Contour** offsets with a simple per-vertex offset (Read, `offsetClosedLoops`), which breaks on concave shapes; on the user's
  blob it produced "No template" with 0 stones (Screenshot). The contour branch of `createPolylineFilledRhinestoneTemplate` also
  ignores `targetWidthMm` (Measured: 687 stones unscaled vs 300 scaled), so it only works because the app scales first.
- **Fill** is a grid clipped to the shape (Read), so edges come out ragged and stones near the edge are dropped, not
  redistributed.
- The collision filter keeps stones whose centres are one hole diameter apart (Read), i.e. touching; the cut gap comes from a
  later pass. Two different spacing rules in one pipeline.

### 2.3 Raster artwork (Read, not measured)

`createRasterArtworkTemplate` thresholds and samples dots; the vector tracing (`imageTrace`, marching squares + simplify) exists
but is used only by HTV. In the screenshot the "Number of stone colors" buttons 1–4 show no selection. Image artwork therefore
has none of the vector quality work (layers, skeleton, contours) and a separate, weaker pipeline.

### 2.4 The Artwork panel and canvas (Screenshot)

- With no design the canvas shows "Ready canvas / Text, artwork, grid, or pen tools…" **scaled with the zoom**, so at 449 % it
  is cropped and enormous.
- Placement-pattern cards clip their text ("Hexagon…", "determinis…").
- The native file button is in the browser's language ("Välj fil / Ingen fil har valts").
- The project name is taken from the file name and can be 25+ characters ("bubblegumstrawberrywaterm…").
- Everything is exposed at once (Vector / Artwork dots, Fill mode, Fill pattern, Spacing, Coverage, Placement, Cleanup,
  Contour, Radial): ten controls whose combinations have no preview, so the user has to experiment.
- Stones are drawn as stroked rings; at 4–10× zoom a 0.5 mm gap looks like overlap.
- The Next dev overlay's "1 Issue" badge was the render loop fixed in PR #3.

## 3. Principles for the rework

1. **One pipeline.** Source (SVG or image) → *layers* (by colour) → *regions* (clean polygons with holes) → *layout*
   (outline rows, centre line, hex fill, contour rows, radial) → *one* solver that enforces the gap and evens spacing →
   *gates* (cuttable, faithful, feasible). Vector and raster share everything after "regions".
2. **Analyse before generating.** Measure the finest feature (distance transform / medial axis) and tell the user what stone size
   and width will work, instead of generating mush.
3. **Few controls, a look gallery.** The user picks a *look* (Outline · Solid · Rows · Dots) from previews of their own art;
   the ten technical controls move under "Advanced".
4. **Judge by a test corpus, not by eye.** A committed set of ≈ 30 real-world files × a settings matrix, scored automatically
   (IoU, strays, gap, time), plus a contact sheet (PNG) for review.
5. **Every engine change keeps the AGENTS.md rules:** pure, deterministic, mm, no `Math.random()`, collision detection never
   skipped, spec and ADR updated. Skeleton and Lloyd-style relaxation therefore use fixed iteration counts and seeded-free
   ordering (sort by position).

## 3.5 Progress

| Item | Status |
|---|---|
| J1 fixture corpus, J2 quality harness | **Done** (ADR 0020, `npm run quality`, regression test) |
| J3 honest renderer, J4 canvas / panel polish, H5 error boundaries | **Done** |
| J5 importer | **Done** (ADR 0020) |
| J6 colour layers, J7 feasibility, J8 centre line, J9 fill, J10 contour, J11 one spacing rule | **Done** (ADR 0021): one pipeline, 100 % cuttable on the corpus |
| J12 Artwork panel | **Done in part**: three looks, colour list, advice; preview of the source behind the stones and a look gallery with thumbnails remain |
| J13 raster into the same pipeline, J14 raster controls | **Done** (ADR 0021) |
| A2 panel boilerplate removed ("Driven by generator settings", "These settings control the generated baseline…") | **Done** |
| J15 / B1 first step: several parts in one design ("Add to design", move, rename, remove, turn, mirror, duplicate, drag on the canvas, align, undo, saved) | **Done** (ADR 0022); live elements, rotate / flip / scale, drag on canvas and undo remain |
| Rest of phase 6, phases 3-7 | Next |

## 4. Phases

Effort: S ≤ 1 day · M = days · L ≈ a week+. Order is the order to build; items inside a phase can run in parallel unless a
dependency is given.

### Phase 0: Make quality measurable (≈ 1 week)

Nothing in later phases can be judged without this.

| Item | What | Effort |
|---|---|---|
| **J1** | **Fixture corpus**: ≈ 30 small committed artworks (real-world exports from Illustrator, Figma, Inkscape, Canva, Cricut Design Space; logos, badges, outlines, text-as-paths, thin line art, multi-colour, PNG/JPG/GIF) with a licence note. *Needs the user's two files and a few of their typical customer jobs.* (also **H3, H4**) | M |
| **J2** | **Quality harness** (`tests/quality/`): for each fixture × mode × stone size (SS6, SS10, SS16) × width, compute cuttable, IoU against the source silhouette (rasterise both at 0.25 mm), stray-stone count, smallest gap, time. Writes a table and a contact-sheet SVG/PNG; CI fails on regressions against a committed baseline | M |
| **J3** | **Honest renderer**: stones drawn to scale with a hairline stroke and the true gap, source silhouette optionally behind (30 % opacity), too-tight pairs marked | S–M |
| **J4** | Fix the empty-state text (constant screen size, not zoom-scaled), clipped placement cards, styled file picker, short project name from a file (C-level polish found in §2.4) | S |
| **H2** | Playwright flows in CI (design → export, save → reload, backup → restore, mobile layout); reuse `scripts/e2e-smoke.mjs` | M |
| **H5** | Error boundary per studio ("your work is safe, a copy was kept") | S |

**Done when:** `npm run quality` prints a table for the whole corpus on today's engine (the baseline will look bad on purpose),
and the canvas shows true gaps.

### Phase 1: Artwork rescue (≈ 3 weeks; the user's priority)

Depends on phase 0 (J1, J2).

| Item | What | Effort |
|---|---|---|
| **J5** | **Importer stabilisation**: nested `<g>` transforms; arc commands (convert to Béziers); `<use>`/`<defs>`/`<symbol>` resolved locally (no external refs); `<style>` class and inline-style colours; `fill-rule`; skip `display:none`, `visibility:hidden`, zero opacity; `<text>` → message "convert text to outlines" with how; `viewBox` / units (px, pt, mm, in; Illustrator's 72 dpi vs 96 dpi) so the *natural size is right*; clear messages instead of throws. Tests from J1 | M–L |
| **J6** | **Layers by colour**: parse fills into layers; drop background (a shape covering the viewBox in one colour, white/transparent); painter's order decides what is a hole; stroke-only art offered "stroke as outline" with the stroke width. Model: `ArtworkLayer { colour, regions[] , mode }` | M–L |
| **J7** | **Feasibility analysis**: distance transform of each region gives the smallest feature width and the share of area thinner than one stone. UI text: "Finest detail 1.4 mm. SS10 needs 3.4 mm. At 480 mm wide it works, at 100 mm it does not; SS6 works from 250 mm." Auto-suggest the stone size and width; replaces the silent mush. (also **B11**, **C3**) | M |
| **J8** | **Centre-line layout for thin parts**: medial axis / skeleton of strokes narrower than ≈ 2 stones, one row of stones along it, with branch handling. Thick parts keep outline + fill. Removes the Outline collisions measured in §2.2 | L |
| **J9** | **Fill v2**: distance-field based hex packing with a few fixed relaxation passes, so stones follow the edge rows (outline row first, then inner rows inset by one pitch) instead of a clipped grid; no strays, no ragged edge; same pitch rules everywhere | L |
| **J10** | **Contour v2**: real polygon offsetting (Clipper-style, with joins and holes), rows stop when the region is exhausted, centre row for thin parts; fixes "No template" and honours size in the engine, not only in the app | M–L |
| **J11** | **One solver**: a single gap-enforcing, spacing-evening pass at the end of every layout (replaces the two rules in §2.2); corner anchors kept; deterministic order | M |
| **J12** | **Artwork panel rebuild**: upload → live preview of source + stones → *Look gallery* (Outline · Solid · Rows · Dots, each a thumbnail of the user's own art) → size and stone size with the J7 advice inline → Advanced (the ten current controls). Layers list from J6 with eye / mode per layer. (also **A1**-style gallery pattern) | L |

**Done when:** on the corpus, ≥ 90 % of fixtures at a feasible size pass G1–G3 in the default look, no throws on
Illustrator / Figma / Inkscape / Canva exports, and the two user files give a result the user accepts (their call).

### Phase 2: Raster artwork joins the same pipeline (≈ 1–2 weeks)

| Item | What | Effort |
|---|---|---|
| **J13** | Raster → regions: background removal (corner colour, alpha), colour quantisation (k = 1–4) into layers, marching-squares tracing with simplification (reuse `imageTrace`), speckle removal; then the phase 1 layout. Replaces the dot-sampling path | L |
| **J14** | Preview of the trace and the threshold; fix the "stone colors" selection state; downsample large images; EXIF rotation; transparent PNG | M |
| **B8** | Colour-to-stone mapping and outline vs fill per colour (uses layers) | M |

### Phase 3: Several things in one design; whole-design controls (≈ 3–4 weeks)

| Item | What |
|---|---|
| **B1**, **J15** | A design is a list of **elements** (text, artwork, shape, stone font), each with position, rotation, scale, order; the generation effect runs per element and the solver merges them with collision checks. Switching tool adds or edits an element instead of replacing the design. *Large; its own ADR.* |
| **B2** | Rotate, flip / mirror, move, resize by width / height, align and centre, for the whole design and per element |
| **B3** | Undo / redo for everything, as snapshots of the element list |
| **B13**, **B14** | Arrow-key nudge, exact X / Y; dimension labels and centre guides, snap to the mat edge |
| **A4** | One idea instead of "Generated vs Editable": clicking a stone offers to edit stones (undoable) |
| **C4**, **C5**, **C6** | Worker for generation with progress; spatial index in nearest-neighbour code (needed by J11); canvas rendering above ≈ 5,000 stones |

### Phase 4: Text becomes one tool (≈ 2–3 weeks)

| Item | What |
|---|---|
| **A1**, **B6** | One Text tool with a live style gallery of the user's own text in every outline font, alphabet and stone font; several fonts in one text, per-letter style, bold / italic, kerning, text on a path / arc |
| **B9**, **B11** | Stone-font size control (scale = font's measured stone × factor) and auto stone size ("best stone size for 60 mm letters") |
| **B10** | Fix "Filled typography": same Fill v2 (J9) applied to glyph regions |
| **C1**, **C2** | Centre-line single row for small outline text (J8 applies directly); tidy joins and counters |
| **H3** | Physical-validity test for every font and alphabet (uses J2 harness) |

### Phase 5: Colour, preview, export formats (≈ 3 weeks)

| Item | What |
|---|---|
| **B4** | Stone colours per layer / per stone, multi-colour designs, counts per colour (layers from J6 are the model) |
| **B5** | Realistic preview: crystal / AB / jet rendering, on a fabric photo (reuse the HTV mockup pipeline) |
| **B7** | Shape / clipart gallery (stars, hearts, crowns, borders) as artwork layers |
| **B12** | Combine Rhinestone and HTV in one project (HTV letters with a rhinestone outline) |
| **D1**, **D2** | PDF / PNG at true size, DXF, EPS, "Copy SVG"; print-at-true-size placement sheet and customer-approval sheet |
| **D4**, **D5**, **D6**, **D7** | Test patch of the real design (≈ 5 × 5 stones); step-by-step Design Space import help with a 50 mm check square; material and cost; machine-specific cut settings in the export |
| **D3** (partly done) | Registration marks for split parts (the split itself shipped, ADR 0019) |

### Phase 6: Plain language and first impression (run alongside phases 1–2; ≈ 1 week, S each)

| Item | What |
|---|---|
| **A2**, **A3**, **A6**, **A7**, **A8** | Remove panel boilerplate, jargon, taglines, repeated cards, wording slips; one language |
| **A5**, **A12** | Hide "Recovery & status" until there is something to recover; starter gallery on the home page |
| **A10**, **A11** | Compact HTV status chips; name a project from its text; drop the permanent "Not saved yet" |
| **A9** | Swedish interface and mm / inch switch (needs a string table; do after A2/A3 so only final copy is translated) |

### Phase 7: Machines, calibration, data, HTV, devices (≈ 3–4 weeks, partly parallel)

| Item | What |
|---|---|
| **E1–E4** | Machine and material profiles, one-screen guided calibration, per-size status, several saved profiles |
| **F1**, **F2**, **F3**, **F7** | IndexedDB storage with quota warning, stop duplicate "(previous session)" copies, backup reminder, backup includes fonts, images, calibration |
| **F4**, **F5**, **F6** | Share link / read-only view, version history, optional accounts (revisit ADR 0008 first) |
| **G1–G5** | HTV: per-colour cut files, fit to print area, weld / offset / arc text, own garment photo, fonts without Å Ä Ö |
| **H1**, **H6**, **H7** | Lighthouse budget and font CDN, opt-in problem report, legacy path audit |
| **I1–I4** | Screen-reader pass and canvas text alternative, one-finger pan, real-device checks (iOS Safari, Android), forced-colors and reduced motion |

## 5. Coverage check

Every backlog ID and where it lives: A1 P4 · A2 P6 · A3 P6 · A4 P3 · A5 P6 · A6 P6 · A7 P6 · A8 P6 · A9 P6 · A10 P6 · A11 P6 ·
A12 P6 · B1 P3 · B2 P3 · B3 P3 · B4 P5 · B5 P5 · B6 P4 · B7 P5 · B8 P2 · B9 P4 · B10 P4 · B11 P1+P4 · B12 P5 · B13 P3 · B14 P3 ·
C1 P4 · C2 P4 · C3 P1 · C4 P3 · C5 P3 · C6 P3 · C7 P1 (retire once J11 lands) · D1 P5 · D2 P5 · D3 P5 (marks) · D4 P5 · D5 P5 ·
D6 P5 · D7 P5 · E1–E4 P7 · F1–F7 P7 · G1–G5 P7 · H1 P7 · H2 P0 · H3 P0+P4 · H4 P0 · H5 P0 · H6 P7 · H7 P7 · I1–I4 P7.

## 6. Suggested order for the next sessions

1. Phase 0 (J1–J4, H5): small, and it turns every later step into something that can be checked.
2. Phase 1 in this order: **J5** (nothing else matters if the file does not import right) → **J6** → **J7** → **J11** → **J10** →
   **J9** → **J8** → **J12**. J7 before the new generators because it is cheap and already removes the "mush" complaint.
3. Phase 6 in parallel (copy changes are independent).
4. Then phases 2, 3, 4, 5, 7.

## 7. Decisions I made, and what I need

- **Decided:** build on the existing engine rather than adopt a library, except polygon offsetting (J10): implement a
  deterministic Clipper-style offset in `src/lib/rhinestone-engine/` (the engine must stay pure and deterministic; a vetted
  library may be used as a reference, not a dependency, unless a licence and bundle-size check says otherwise). Revisit if J10
  takes longer than a week.
- **Decided:** vector and raster share one layout pipeline (J13) instead of improving the dot sampler.
- **Decided:** multi-element designs (B1) wait until after the artwork rescue, because the element model should be built once
  the layer model (J6) exists.
- **Needed from the user (not blocking phase 0):** the two files from the screenshots and 5–10 typical customer artworks
  (SVG and PNG), plus the stone sizes and mat sizes they actually use, to seed J1. Where to put them: a folder such as
  `tests/fixtures/artwork/` in the repository, or tell me the path.
- **Not verified:** the upload dialog's behaviour for `<style>` SVGs (§2.1); what exactly "No template" in the Contour
  screenshot was caused by on the user's file (my stand-in blob works); raster pipeline output quality (§2.3).
