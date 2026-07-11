# Project Handoff — Rhinestone Template Tool

> **For ChatGPT / new agent sessions.** Read this before continuing work on the project.

---

## 1. Project Purpose

Web app that generates **Cricut-ready rhinestone SVG templates** for Magic Flock workflows.

- Runs entirely in the browser (Next.js static export)
- Parses designs into rhinestone hole positions
- Exports SVGs containing only real vector `<circle>` elements sized in mm
- Designed for **Cricut Maker** cutting on **Magic Flock** material
- Supported stone sizes: **SS6, SS8, SS10, SS12**

**Critical constraint:** every exported circle is a cut hole, not a decoration. Wrong sizing tears the material. All provisional hole values require physical calibration before production use.

---

## 2. Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js (App Router, Turbopack, `/app/` not `/src/app/`) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 (PostCSS) |
| Tests | Vitest (`tests/**/*.test.ts`, node environment) |
| Script runner | `tsx` (for `npm run generate:examples`) |
| Engine | Pure TypeScript, no DOM, no browser APIs |

---

## 3. Directory Layout

```
/app/                    Next.js pages and React components
/app/components/         All UI components (client components, 'use client')
/src/lib/rhinestone-engine/   Pure engine — no DOM, no imports from /app/
/tests/                  Vitest test files
/docs/                   Architecture docs and ADRs
/examples/exports/       Pre-generated example SVGs
/scripts/                Node scripts (generate:examples)
```

---

## 4. Implemented Modules

### Engine (`src/lib/rhinestone-engine/`)

| Module | Path | What it does |
|---|---|---|
| Types | `types/index.ts` | `StoneSizeId`, `Stone`, `RhinestoneTemplate`, etc. |
| Stone profiles | `profiles/stoneSizes.ts` | SS6–SS12 hole diameters and min center distances |
| Material profiles | `profiles/materialProfiles.ts` | Magic Flock + Cricut Maker profile |
| Geometry | `geometry/` | Distance, collision, bounds, rounding |
| SVG export | `export/svgExport.ts` | `createBasicSvgExport` — Cricut-safe `<circle>` SVG |
| Template creation | `template/createTemplate.ts`, `gridTemplate.ts` | Manual and grid template builders |
| Template validation | `validation/templateValidation.ts` | Collision, duplicate IDs, etc. |
| Calibration sheet | `calibration/calibrationSheet.ts` | Multi-size calibration grid |
| Calibration overrides | `calibration/calibrationOverrides.ts` | Record measured diameters, apply to template |
| Physical sizing | `sizing/scalePolylines.ts`, `templateSizing.ts` | Scale polylines to target mm dimensions |
| Density controls | `spacing/density.ts` | `safe / standard / dense / loose / custom` presets |
| Export readiness QA | `exportQa/exportReadiness.ts` | Checks before download enable/disable |
| Cricut test pack | `testPack/cricutTestPack.ts` | Four ready-to-cut calibration SVGs |
| Polyline engine | `path/polyline.ts`, `pathTemplate.ts` | Sample stones along paths |
| Polyline cleanup | `path/polylineCleanup.ts` | Remove noise, simplify, de-dup |
| SVG upload / parser | `svg/svgParser.ts`, `svgToPolyline.ts`, `svgUnits.ts` | Parse uploaded SVG into polylines (never renders raw SVG) |
| Dot matrix text | `text/dotMatrixFont.ts`, `textTemplate.ts`, `textLayout.ts` | 5×7 bitmap font, multiline, alignment, scaling |
| Outline text font | `textOutline/vectorFont.ts` | Built-in vector stroke font (A–Z, 0–9, punctuation) |
| Outline text template | `textOutline/outlineTextTemplate.ts` | Text → glyph polylines → stones; fill mode supported |
| Fill mode | `fill/polygonFill.ts`, `fillTemplate.ts` | Grid/offset-grid fill inside closed shapes |
| Manual stone editor | `editor/templateEditor.ts` | Add/remove stones, undo/redo, commit |

### UI Components (`app/components/`)

| Component | Description |
|---|---|
| `CricutTestPack` | Download 4 test SVGs; start here before production |
| `CalibrationWorkflow` | Record measured diameters → apply to template |
| `OutlineTextGenerator` | Vector outline text with fill mode |
| `TextMatrixGenerator` | Dot matrix 5×7 text |
| `SvgUploadGenerator` | Upload SVG → parse → rhinestone template (raw SVG never rendered) |
| `ManualStoneEditor` | Add/remove/undo stones manually |
| `PolylineLogoGenerator` | Built-in demo shapes with fill mode (default: outline-fill) |
| `ManualGridGenerator` | Rectangular grid of stones |
| `CalibrationSheetGenerator` | Multi-size calibration sheet |
| `SvgPreview` | Inline preview — only accepts engine-generated SVG |
| `SvgExportActions` | Download + Copy buttons |
| `ExportReadinessPanel` | Pass/fail readiness display |
| `TemplateStatsCard` | Stone count, dimensions, extra stats |

---

## 5. Architecture Rules (Non-Negotiable)

1. **All internal measurements are in millimeters.** No pixels in engine code.
2. **Never rasterize.** No `<canvas>`, no `toDataURL()`, no image encoder in the export path.
3. **Raw uploaded SVG is never rendered.** `uploadedSvgText` goes only to `svgStringToPolylines`. It is never passed to `SvgPreview` or `dangerouslySetInnerHTML`.
4. **All generated holes must be real `<circle>` SVG elements.** No paths, rects, or other shapes as cut holes.
5. **Engine logic belongs in `src/lib/rhinestone-engine/`.** Do not import from `/app/` inside the engine.
6. **React components only orchestrate and render.** No stone math, no spacing logic in components.
7. **Every major feature must have tests.** No engine function is wired to the UI without passing tests.
8. **All four checks must pass before any commit:** `npm run typecheck`, `npm run test`, `npm run lint`, `npm run build`.
9. **No deferred features:** no image upload, no TTF/OTF font parsing, no auth, no database, no payments, no saved cloud projects, no advanced visual editor.
10. **Output must be Cricut Design Space safe:** no nested `<svg>`, no `<use>`, no opacity < 1 on cut shapes.

---

## 6. Current Git Status

```
Branch:  main
Commit:  ec9c4ca  Add fill mode
Status:  clean (no uncommitted changes)
```

---

## 7. Current Test Status

```
Test files:  23 passed
Tests:       586 passed
typecheck:   ✓ no errors
test:        ✓ 586 passed
lint:        ✓ no warnings
build:       ✓ static pages generated
```

Run all checks with:
```bash
npm run typecheck && npm run test && npm run lint && npm run build
```

---

## 8. Known Risks / Physical Validation Required

| Risk | Notes |
|---|---|
| **Cricut Design Space SVG scale** | CDS sometimes imports SVGs with unexpected scaling. Always check mm dimensions after import. |
| **Magic Flock hole diameter** | All `recommendedHoleDiameterMm` values are provisional. Must be validated by cutting a calibration sheet on your specific machine + blade + material batch. |
| **SS stone supplier variance** | Stone diameter varies ±0.1–0.2mm between suppliers. Profile values are starting estimates only. |
| **Blade/pressure/material differences** | Kerf compensation and scale compensation start at 0. Must be measured from physical test cuts. |
| **Fill mode in real cutting** | Fill mode at standard density may be too tight for some shapes. Test at `loose` or `safe` density preset first. |
| **Complex SVG logos** | Logos with arc commands (A), clip paths, or gradient fills will not parse correctly. Simplify in Inkscape before upload. |
| **Smooch logo workflow** | The full Smooch logo-to-rhinestone workflow (upload → cleanup → cut) needs practical end-to-end testing with physical material. |

---

## 9. Recommended Next Steps (Before Next Sprint)

Before writing more code, complete this physical QA pass:

1. **Run `npm run dev`** and open `http://localhost:3000`
2. **Download Cricut Test Pack** — four SVGs covering all stone sizes
3. **Open each SVG in Cricut Design Space** — verify dimensions in mm
4. **Cut the calibration sheet** (`SS10` recommended first) on Magic Flock
5. **Measure actual hole diameters** with calipers
6. **Enter measurements in Calibration Workflow** on the app
7. **Download the calibrated template** and cut again
8. **Test stone placement** — rhinestones should snap in cleanly, not fall through or need force
9. **Record the best hole diameter** per stone size per material batch
10. **Test a simple logo SVG upload** — try a bold single-path shape first

---

## 10. Suggested Next Sprint Options

Listed in recommended priority order:

### Option A — Physical Cricut QA Workflow (Highest Value)
No code sprint. Validate the physical cutting pipeline. Record calibration data. Unblocks all production use.

### Option B — Manual Stone Editor v2
- Stone drag/move in the preview
- Multi-select with shift-click
- Click-on-preview to add stone at position
- Stone position input (type x/y mm coordinates)

### Option C — Project JSON Import/Export
- Save template + calibration + metadata as a `.json` file
- Load a saved project back into the UI
- Useful for sharing and re-editing designs

### Option D — Smooch Logo Workflow Improvements
- Improve SVG cleanup defaults for complex logos
- Add step-by-step workflow guidance in the SVG Upload section
- Better error messages when SVG fails to parse

### Option E — Custom Font Upload (Deferred / Advanced)
- Accept `.ttf` / `.otf` file
- Parse with `opentype.js`
- Generate stroke outlines from glyph contours
- **Defer until physical QA is complete** — large dependency

### Option F — Image Upload (Out of Scope)
Intentionally out of scope. Rasterizing images to rhinestone patterns is a different product category.

---

## 11. Key Files for Quick Orientation

| File | Why read it first |
|---|---|
| `AGENTS.md` | Agent rules — file structure, engine rules, SVG export rules |
| `docs/RHINESTONE_ENGINE_SPEC.md` | Full engine API reference |
| `docs/ACCEPTANCE_CRITERIA.md` | Pass criteria per phase |
| `docs/PROJECT_PLAN.md` | Phase history |
| `src/lib/rhinestone-engine/index.ts` | The engine's complete public API |
| `app/page.tsx` | Section order and component wiring |
| `tests/pathTemplate.test.ts` | Representative engine test pattern |
| `tests/fillTemplate.test.ts` | Fill mode test pattern |
