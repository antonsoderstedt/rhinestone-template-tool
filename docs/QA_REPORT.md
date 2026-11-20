# QA report — Phase 13

**Date:** 2026-11-19 · **Branch:** `ux/copilot-plan-phases-1-4` · **Checklist:** `docs/COPILOT_FIX_PLAN.md`, Phase 13  
Run in the in-app browser against `npm run dev` (Chromium). "New profile" means `qa.localhost:3000`, which has its own empty
`localStorage` (the real profile's data was not cleared).

| # | Check | Result |
|---|-------|--------|
| 1 | `SMOOCH`, `SCORE 2026`, `Sulay 123`, `Aabcdefg`, `Glog`, `Hello World` export-ready at SS10 / 25 mm | **Pass** by automated test (`generateAndResolveTemplate.test.ts`: `ready`, no removed stones). In the app, `YOUR NAME` (Archivo Black) gave 123 stones; the other five were not typed by hand |
| 2 | `/rhinestone?font=installed-always-script-font-imported&text=Sulay%20123` generates stones | **Failed, fixed** (ADR 0017). Was 0 stones; now 59 stones, 100 × 27 mm. `Åsa` with that font names the missing `Å` |
| 3 | Minified single-line SVG with 5 circles imports 5 | **Pass** (Import tool: "5 stones ready to import", 5 stones on the canvas, 43.0 × 3.0 mm) |
| 4 | Corrupt SVG rejected with a message; 100 × 100 SVG ≈ 100 mm | **Partly failed, fixed.** The Import tool already refused with a message; the Artwork tool accepted a corrupt file silently. Now an inline alert, design unchanged. 100 × 100 → 98.3 × 97.8 mm (stone-hole extent) |
| 5 | New profile: start → text → export in ≤ 3 clicks, truthful warnings, no late modal | **4 clicks, by design.** Goal card → Export → tick "I understand this file uses unverified default hole sizes" → Download. With an approved calibration the tick is not shown (3 clicks). No modal appeared after load. The file name gets `-uncalibrated` |
| 6 | No page scroll in studios at 1440 × 900; Export visible; modals visible | **Pass** in both themes. Export dialog, rename dialog and "Fix errors before export" were fully visible |
| 7 | Delete/undo; rename without `window.prompt` | **Pass** on My Designs (dialog rename, delete → Undo restores, no `prompt`/`confirm` call). Library and canvas deletes were verified in Phase 8 |
| 8 | HTV export `mm`, mirror, weed border; 3D never blank | **Pass.** `width="296.36mm" height="40.48mm"`, `data-mirrored="true"`, weed border path, no `<use>`/`<image>`. The 3D tab rendered a shirt |
| 9 | No hydration or unhandled errors on any route, dark and light | **Pass.** The only console errors are the dev server's HMR websocket after restarts. axe-core 4.12: **0 violations** on `/`, `/rhinestone`, `/htv`, `/designs`, `/library`, `/fonts`, `/settings`, `/setup` at 1440 px in dark and light (light had 9 before this phase) |
| 10 | First Tab reaches "Skip to editor" | **Pass** |
| 11 | 390 px and 820 px: no horizontal scroll, flows complete | **Pass** on all 8 routes, dark and light, plus axe 0 at those widths. Quick fixes and Fix spacing were also used at 390 px |
| 12 | `npx vitest run`, `npm run lint`, `npx tsc --noEmit` | **Pass:** 92 files, 1300 tests; eslint and tsc clean |

## Fixed in this phase

1. Fonts lacking `Å Ä Ö å ä ö` were unusable for all text (item 2).
2. Artwork upload accepted corrupt files without any message (item 4).
3. Light studio theme had 9 contrast failures (pale violet/amber/rose text, white text on translucent violet). Mapped to darker
   colours, with a guard test.

## Found, not fixed

- **HTV: default black vinyl on the dark canvas is barely visible** (dark theme). Readable in the light theme and in the 3D view.
- **HTV still refuses fonts without `Å Ä Ö`** (ADR 0017); the rhinestone studio does not.
- **HTV text wider than its placement** (here 296 mm on a 290 mm front area) is cut at the edge in 3D; the size warning is shown.
- The auto-mode safety classifier refused clearing the real profile's `localStorage`, so "new profile" used another origin.
  `127.0.0.1:3000` does not hydrate in dev (Next blocks dev resources for that origin); `*.localhost` works.

## Not verifiable here (check by hand)

Safari and Firefox, a real phone or tablet, screen readers, real-GPU 3D, opening downloaded SVGs in Cricut Design Space,
uploading real font files or zips, and cutting a calibration sheet. Downloads in this run were captured in the page, not saved.
