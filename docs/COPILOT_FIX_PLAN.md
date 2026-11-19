# Copilot Fix Plan — UX / Reliability Audit (2026-11-16)

Hand this whole file to Copilot. It lists every defect, gap and redesign found in a full audit of the running app
(`http://localhost:3000`, desktop ≥ lg, tablet 820 px, mobile 390 px). Each task has an ID, the verified symptom,
the fix, the files to start in, and acceptance criteria (AC). Work phase by phase, in order.

---

## 0. Ground rules (read before touching code)

1. **Read `AGENTS.md` and `CLAUDE.md` first.** This is a Next.js 16 / React 19 / Tailwind v4 app with breaking changes —
   read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code.
2. **Engine rules (non-negotiable):** engine code lives in `src/lib/rhinestone-engine/`, is pure, mm-only, deterministic
   (no `Math.random()`, `Date.now()`, DOM, network). Never import from `/app/` inside the engine. **Never disable or
   skip collision detection.**
3. **SVG export rules:** every hole is a `<circle>`; no rasterizing (`<canvas>`, `toDataURL`); root `width`/`height` in
   `mm`; no nested `<svg>`, no `<use>`, no opacity < 1 on cut shapes.
4. **Sequence:** engine first, tests before UI wiring. No UI feature is wired to an engine function until that function
   has passing unit tests (`tests/`, Vitest).
5. **Docs:** changing engine behaviour → update `docs/RHINESTONE_ENGINE_SPEC.md`. Every architectural decision → new ADR in
   `docs/decisions/` (next number is `0006`). Check `docs/ACCEPTANCE_CRITERIA.md` before calling a phase done.
6. **Do not run `npm run build` while `npm run dev` is running** (shared `.next` dir hangs the dev server). Use
   `npm run lint`, `npx tsc --noEmit` and `npx vitest run` instead; verify UI in the running dev server.
7. **Verify against the running app**, not against roadmap/status docs — those lag the code.
8. After every phase run: `npx vitest run` (938 tests must still pass, plus new ones), `npm run lint`, `npx tsc --noEmit`.
9. After creating any file, confirm it exists (`ls <path>`).
10. Keep all user-facing copy in English, plain language, no jargon (see U-tasks for terms to replace).

### Decisions needed from the product owner (defaults given — implement the default unless told otherwise)

| # | Question | Default Copilot should implement |
|---|----------|----------------------------------|
| D1 | Should the 0.508 mm minimum edge gap apply to pre-authored vendor assets (Stone Font, Alphabet, Stencils)? | **Split the rule:** true overlap (gap < 0) stays a blocking error for everything. Gap between 0 and 0.508 mm is a **blocking error for user-generated templates** and a **non-blocking warning for vendor-authored assets** (flag via `template.source = 'vendor'`/asset metadata). Message must show the real measured gap. Record in ADR 0006. |
| D2 | Calibration approval: keep self-attested single click? | Keep one-click approval but require entering/confirming the measured diameter and show "Not verified by software" wording. Do not add heavier gating. |
| D3 | Where does persistent data live? | Stay localStorage/IndexedDB-only (no backend), but unify the concepts (P1) and add project file export/import (P4). |

---

## Phase 1 — Engine & data correctness (do first, with tests)

### E1. Import parser silently drops stones on single-line SVGs  *(P0 data-loss)*
- **Symptom:** an SVG with 5 `<circle>` on one line reports "1 stones ready to import". With newlines it reports 5.
- **Cause:** `src/lib/rhinestone-engine/templateImport/templateImport.ts` matches one shape per line
  (`line.match(/<(circle|ellipse|path)\s+([^>]+)>/i)`).
- **Fix:** replace line-based matching with a global tag scan (`/<(circle|ellipse|path)\b[^>]*>/gi` with `matchAll`) or a
  real SVG parser that is pure/deterministic. Preserve existing origin-normalisation behaviour and attribute parsing
  (handle `/>` and `>`, attributes in any order, single/double quotes, newlines inside a tag).
- **Also check** that the same parser is used by SVG alphabet/stencil loading (`svgAlphabet`, `letterStencil`) and fix there.
- **AC:** tests for: 5 circles on one line → 5 stones; minified whole-file SVG; tags split over multiple lines; mixed
  circle/ellipse/path; a file with zero shapes returns an explicit error (see E5), not an empty success.

### E2. Collision semantics + deterministic auto-spacing  *(P0 — most ordinary words fail export)*
- **Symptom:** 8 of 11 ordinary words fail export at default SS10 / 25 mm with `STONE_COLLISION`. Curated assets also fail:
  Stone Font default 13 errors, Alphabet default 16 errors, Stencils 16 errors. Measured "SCORE 2026": 426 stones,
  0 true overlaps, min gap 0.354 mm, 38 pairs < 0.508 mm — yet UI says "Overlapping holes will tear the material".
- **Files:** `src/lib/rhinestone-engine/validation/templateValidation.ts`, `.../exportQa/exportReadiness.ts`,
  `.../spacing/density.ts`, `.../profiles/materialProfiles.ts`, `.../types/index.ts`, `app/editor/collisionDetection.ts`.
- **Fix (per D1):**
  1. Introduce two distinct issue codes: `STONE_OVERLAP` (gap < 0, always error) and `STONE_TIGHT_GAP`
     (0 ≤ gap < `minimumEdgeSpacingMm`; error for user-generated, warning for vendor-authored). Keep `STONE_COLLISION`
     only if existing tests/consumers need it — otherwise migrate consumers and tests.
  2. Every issue must carry **measured gap (mm)** and **required gap (mm)** and the two stone ids. UI text:
     "Stones 12 and 13 are 0.35 mm apart (minimum 0.51 mm)". Never say "overlap" when gap ≥ 0.
  3. Add a pure, deterministic engine function `resolveStoneSpacing(template, {minGapMm})` that nudges/removes stones to
     satisfy the gap (stable order: sort by id/position; no randomness; documented tie-breaking; option
     `strategy: 'nudge' | 'remove-lesser'`). Output must be idempotent (running twice = same result).
  4. Generators (outline text, stone font, alphabet, stencil, artwork fill) must call the resolver by default so that
     "type a word → exportable result" works at default settings.
  5. Do **not** weaken or skip collision checks for user stones.
- **Docs:** update `docs/RHINESTONE_ENGINE_SPEC.md` (algorithm + codes) and write ADR `0006-collision-semantics-and-auto-spacing.md`.
- **AC:** unit tests: 11 common words (include "SMOOCH", "SCORE 2026", "Sulay 123", "Aabcdefg", "Glog") export-ready at
  SS10/25 mm after resolver; resolver is idempotent and deterministic (run twice, deep-equal); true overlaps still blocked;
  vendor tight-gap yields warning with measured numbers; message text snapshot tests.

### E3. Installed fonts fail in Rhinestone ("Unknown outline fontId")  *(P0 broken headline feature)*
- **Symptom:** Fonts → "Use representative in Rhinestone" opens
  `/rhinestone?font=installed-always-script-font-imported&text=Sulay%20123` → error
  `Unknown outline fontId: installed-always-script-font-imported`, 0 stones. HTV works for the same font.
- **Files:** `src/lib/rhinestone-engine/textOutline/outlineTextTemplate.ts` (throws at ~line 163),
  `app/fonts/page.tsx`, `app/editor/EditorShell.tsx` (outline text generation ~195–255), `app/editor/controls/FontPicker.tsx`,
  and wherever HTV resolves installed fonts (reuse that resolution path).
- **Fix:** make the outline-font registry resolve installed/zip fonts (same source HTV uses). If a font id is unknown,
  do not throw into an empty canvas: show an inline recoverable error ("Font not found — pick another") and fall back to
  the default font while keeping the typed text. Validate `?font=` / `?text=` query params.
- **AC:** the exact URL above produces stones; unknown id shows friendly message + fallback; test for registry resolution.

### E4. Sensible default sizing for uploaded artwork
- **Symptom:** a 100×100 SVG star becomes 274×262 mm / 1768 stones with no explanation; "Fit to screen" cannot help.
- **Fix:** on upload, fit artwork to a default target (e.g. `min(garment print area, 100 mm)` longest side, user-configurable
  in Settings), show a one-line "Scaled to X × Y mm — change" note and a visible size field; cap/estimate stone count and warn
  above a threshold (see N2). Pick a sensible default fill mode.
- **AC:** 100×100 star → ≈100 mm output; note visible; stone count shown.

### E5. Reject / report invalid assets instead of accepting them
- **Symptom:** a corrupt SVG ("not an image") is accepted into Library as a normal asset (broken image icon, "Open in
  Rhinestone/HTV" buttons); opening it gives an empty canvas with no error.
- **Files:** `app/library/page.tsx`, `src/lib/rhinestone-engine/assetLibrary/`, import code.
- **Fix:** validate on upload (parseable SVG, has ≥ 1 usable shape, size limit). Reject with a clear per-file message in a
  results summary ("3 added, 1 rejected: not a valid SVG"). Opening an asset that yields zero shapes shows an error state
  with a retry/back action, never an empty canvas.
- **AC:** tests + manual: corrupt file rejected with message; zero-shape SVG gives explicit error.

### E6. Calibration gate must not be counted as a design "error"
- **Symptom:** a valid 5×3 grid shows "BLOCKED (1)" / "1 error" purely because no profile is approved.
- **Fix:** separate **design issues** (overlaps, gaps, empty) from **export prerequisites** (calibration). UI shows design
  health independently; calibration shows as a single, clearly-worded step ("Approve your material to unlock export").
  Engine keeps `REQUIRES_APPROVED_CALIBRATION_PROFILE` (tests exist in `tests/exportReadiness.test.ts`) — do not break them;
  change only how the UI aggregates/labels.
- **AC:** valid grid with no profile: design status "OK", export step "Needs calibration"; error counter = 0.

---

## Phase 2 — Layout shell & first-load behaviour  *(P0)*

### L1. Studios are not viewport-fit
- **Symptom (≥ lg):** Rhinestone page 2061 px tall, HTV 3004 px; canvas SVG 1678 / 2765 px; design sits bottom-left or off-screen;
  Export scrolls away; wheel over canvas zooms the canvas instead of scrolling; "Fit to screen" can't fit.
- **Cause:** `app/layout.tsx` body is `min-h-full flex flex-col`; studio roots use `h-full` → unconstrained height.
- **Files:** `app/layout.tsx`, `app/globals.css`, `app/editor/EditorShell.tsx`, `app/htv/HtvShell.tsx`,
  `app/editor/EditorCanvas.tsx`, `app/htv/HtvCanvas.tsx`, `app/components/workspace/WorkspaceChrome.tsx`.
- **Fix:** studio routes use a fixed app-shell: `h-dvh` column (`GlobalTopNav` + chrome + `flex-1 min-h-0` workspace);
  canvas container `min-h-0 overflow-hidden`, SVG sized by viewBox to container (not intrinsic mm height); side panels scroll
  internally (`overflow-y-auto`); top bar and Export button always visible. Marketing/settings pages keep normal page scroll.
  Wheel on canvas: Ctrl/⌘+wheel = zoom, plain wheel = pan/scroll (document it in the shortcuts sheet).
- **AC:** at 1440×900 and 1920×1080 `document.documentElement.scrollHeight === innerHeight` on /rhinestone and /htv;
  Export always visible; design centred and fully visible after load; tablet (820) still stacks correctly.

### L2. Modals/dialogs render outside the viewport
- **Symptom:** HTV silhouette converter modal appears at top ≈ 1262 px (page just blurs); Garment preview modal clipped.
- **Fix:** render every modal via a portal to `document.body`, `position: fixed; inset: 0`, centred, internal scroll, focus trap,
  `Esc` to close, restore focus on close. Fix `EditorDialog.tsx`, `HtvSilhouetteConverterModal.tsx`, `GarmentPreviewPanel.tsx`,
  `HtvGarmentPreviewPanel.tsx` — ideally one shared `Modal` primitive in `app/editor/ui/`.
- **AC:** every modal fully visible at 1440×900 and 390×844; `Esc` closes; focus returns to trigger.

### L3. "Restore autosave?" modal appears late and swallows clicks
- **Symptom:** appears 2–4 s after load on every visit, overlays the app, eats early clicks; studio first shows an empty
  canvas then generates "SMOOCH".
- **Files:** `app/editor/EditorShell.tsx` (~line 146 dialog), `app/editor/projectPersistence.ts`.
- **Fix:** decide restore-vs-new **before first paint** (read autosave synchronously/early; render a skeleton until decided).
  Replace the modal with a non-blocking inline banner ("Restored your last session · Start fresh") or show a single
  decision screen before the canvas mounts. Never generate the default text until the decision is made.
- **AC:** no modal appearing after interactive; first click always lands; no empty-canvas flash.

### L4. Hydration mismatch
- **Symptom:** /designs "Resume autosave" vs "Review calibration" differs between server and client.
- **Cause:** `useState(() => readWorkspaceVault())` / `readActiveCalibrationProfileId()` reads localStorage during render
  (used in `app/setup/page.tsx`, `app/designs/page.tsx`, others).
- **Fix:** initialise with a stable server-safe value, hydrate in `useEffect`/`useSyncExternalStore` with a server snapshot;
  render skeleton until hydrated. Grep for every `readWorkspaceVault(` / `localStorage` use in render paths.
- **AC:** zero hydration warnings in console on every route.

### L5. Auto-fit/centre after Generate and on load
- After any generate/import/open: fit design to the visible canvas with margin; "Fit" button always works; remember zoom per project.
- **AC:** Grid 5×3 (20×12 mm) is clearly visible and centred, not a dot in a corner.

### L6. Reduce stacked chrome and duplicated warnings
- **Symptom:** 5 stacked chrome rows; the same warning shown ×6 (banner, status bar, panel, inspector, topbar chip, toast).
- **Fix:** one status model, one place. Single compact top bar; one "Status" popover/panel listing issues (deduped by code);
  status bar shows only a count + state. Keep `WorkspaceModeBanner` out of studios or collapse to a thin line.
- **AC:** an unapproved-calibration state is communicated in exactly one primary location (+ the export button state).

---

## Phase 3 — Calibration & export flow

### C1. Calibration gate redesign (new-user lockout)
- **Symptom:** export locked for every new user until a profile is saved AND approved; defaults say "Measured values are
  present"; "HIGH CONFIDENCE" shown while uncalibrated. (`app/components/CalibrationWorkflow.tsx` ~196–222, ~552.)
- **Fix (per D2):** first-run path = guided 3-step wizard (Cut test sheet → Measure → Approve) reachable from the export
  dialog; offer **"Export anyway (uncalibrated) — I understand"** as an explicit, logged-in-file-metadata override so beginners
  aren't stuck; honest confidence labels ("Uncalibrated defaults" ≠ "High confidence"); remove misleading "Measured values
  are present" when values are defaults.
- **AC:** brand-new profile can reach a downloaded SVG in ≤ 3 clicks with a clear warning; labels truthful.

### C2. HTV must not show the rhinestone calibration gate
- **Symptom:** HTV shows calibration gate / status "Warning" although export works (`app/htv/HtvShell.tsx` ~428).
- **Fix:** remove rhinestone-calibration coupling from HTV status; HTV status reflects HTV concerns only (size vs garment,
  empty layers, minimum feature size).

### C3. Export dialog with preview
- New export dialog (both studios): preview of the SVG, physical size in mm, stone count, mat-size fit warning
  (Cricut 12×12 / 12×24 in), calibration state, file name field, "Download SVG" button. Replaces silent immediate download.
- Files: `app/components/SvgExportActions.tsx`, `ExportReadinessPanel.tsx`, `app/htv/htvExport.ts`.

### C4. HTV export completeness
- Add **mirror (flip horizontally) option** (default ON for HTV), **weed border** and **registration marks** options,
  wire the unused Settings value "HTV weed margin". Export must stay mm-sized with no raster, no `<use>`, no nested `<svg>`.
- Files: `app/htv/htvExport.ts`, `app/settings/page.tsx`, `app/lib/workspaceVault.ts`.
- **AC:** exported HTV SVG has `width`/`height` in mm; mirrored output verified by test (coordinates reflected about vertical axis);
  weed border present when enabled; tests in `tests/`.

---

## Phase 4 — Persistence & data safety

### P1. One mental model for saving
- Today: Save = silent file download; Library = browser template library (`rhinestone-template-library`); My Designs reads
  the library; autosave (`rhinestone-template-library-autosave`); workspace vault. Confusing.
- **Fix:** present exactly three concepts: **Autosave** (automatic, invisible, "Saved just now" indicator), **My Designs**
  (browser-saved projects; "Save" saves here), **Export project file** (explicit download for backup/sharing). Rename UI
  labels accordingly; "Library" = assets/templates only. Document in ADR `0007-persistence-model.md`.

### P2. Destructive actions need confirm / undo; no `window.prompt`
- **Symptom:** My Designs and Library delete immediately, permanently. Rename uses `window.prompt`
  (`app/designs/page.tsx` ~122/330, `app/editor/EditorShell.tsx` ~1163/1172) which throws "prompt() is not supported" in
  embedded contexts and does nothing. Delete-all (canvas) runs with no confirm/toast.
- **Fix:** shared `ConfirmDialog` and `PromptDialog` (from the shared `Modal`, L2) replacing every `window.prompt/confirm/alert`
  (grep the whole of `app/`). Deletes: toast with **Undo** (soft-delete for ~8 s) or a confirm with item name. Canvas
  delete-all: confirm if > N stones or toast with Undo.
- **AC:** no `window.prompt|confirm|alert` left in `app/`; delete is undoable; rename works in all contexts.

### P3. My Designs quality
- Thumbnails (render SVG preview), human dates ("2 hours ago" + tooltip), remove the "NEEDS CALIBRATION / REVIEW BEFORE
  EXPORT" chips from list rows (move to detail), search/sort, correct empty-state copy.

### P4. Project export/import
- Export/import a `.rhinestone.json` project file (versioned schema, validated on import, never executes content). Pure
  serialisation in `src/lib/rhinestone-engine/project/`; tests for round-trip.
- `app/editor/projectPersistence.ts`, `app/lib/projectUtils.ts`.

### P5. Starter templates worth using
- Library "Starter" templates are 5–6 stones. Add 8–12 real starters (names, monograms, hearts, stars, borders, numbers,
  scoreboard, team name + number) generated by the engine so they're deterministic; thumbnails.

---

## Phase 5 — Settings that actually do something

### S1. Settings are stored but never consumed
- **Symptom:** default stone, spacing (4 mm), machine, HTV weed margin saved in vault but never read by studios.
  (`app/settings/page.tsx`, `app/lib/workspaceVault.ts`)
- **Fix:** studios read settings for new-project defaults (stone size, spacing, machine mat, weed margin, default artwork size
  from E4); changing a setting shows "Applies to new projects" or offers to apply to current. Remove any setting that is
  not wired.
- **AC:** changing default stone size in Settings changes the next new project; test via a pure `applyDefaults` function.

---

## Phase 6 — Fonts page

### F1. Performance
- **Symptom:** /fonts is 311,508 px tall, 44,338 DOM nodes, 3,720 `@font-face`. Search works (85 results for "script", ~225 ms)
  but all results render at once.
- **Fix:** virtualise (windowed list, e.g. `@tanstack/react-virtual`) or paginate (24/page); lazy-load `@font-face` only for
  visible rows (FontFace API / IntersectionObserver); preview text input shared across cards.
- **AC:** < 1,500 DOM nodes on initial render; scrolling smooth; search still < 300 ms.

### F2. Corrupt fonts
- `fredoka-one` (WOFF header size mismatch) and `cane-light` (zero-length glyf) are corrupt. Detect/validate at registry-build
  time, exclude or repair, and list excluded fonts in a build report. Add a test that every registered font loads.

### F3. Copy & dev leaks
- Remove dev command / local filesystem path text from the UI; default preview text "Sulay 123" → neutral "Your Text";
  label the unlabeled tag inputs; "Legacy / Original" font label → clear name.

### F4. Launch buttons
- "Use in Rhinestone/HTV" must pass a font id both studios can resolve (E3), preserve typed text, and land with the design
  generated and fitted (L5).

---

## Phase 7 — First-run & onboarding  *(beginner experience)*

### O1. Start page
- Replace marketing jargon with 3 clear goals: **"Make a rhinestone template from text"**, **"…from my artwork"**,
  **"Design an HTV transfer"**; each launches the studio with a sensible example already generated. Add 1-line explanation of
  the workflow (Design → Check → Export → Cut).

### O2. Empty state & labels
- Empty studio: inviting prompt with big text field + "Try an example" chips. Fix copy that says "on the left" when the panel is
  on the right; make **Generate** an action, not a tab; default text "SMOOCH" → neutral "Your name" placeholder with example;
  rename "Legacy / Original" font label; Library/Designs empty states use correct text.

### O3. Guided first project
- Optional 4-step coach-marks tour (dismissible, stored in settings): pick stone → type text → fix spacing → export.
  Short tooltips on jargon terms. Tools: remove duplication between the rail and the "Tools" accordion (keep rail; accordion
  becomes tool options only). Inspector tip text still references old tool names ("Text, SVG, Grid, or Manual") — update.

---

## Phase 8 — Studio UX polish

- **U1.** "Next action" cards are washed out — fix contrast (≥ 4.5:1) and make them real buttons with a single clear next step.
- **U2.** Theme consistency: light pages vs dark studio; light-mode studio washed out; header always dark; black text on dark
  HTV canvas. Define tokens in `app/lib/studioTheme.ts` / `globals.css`; audit every page in both themes.
- **U3.** Garment preview: replace placeholder copy ("Flat mockup — swap in real product photos…") with real guidance; fix clipped modal (L2).
- **U4.** Setup page (6315 px): restructure into tabs/steps (Test pack → Measure → Approve); remove duplicated machine card;
  fix stale "SS6–SS12" copy; resolve "Stone Ø" vs hole inconsistency (values 2.0/2.4/2.8/3.1 vs 3.43) — pick one definition,
  label "Stone diameter" vs "Hole diameter" explicitly; replace jargon `kerfCompensationMm` with "Blade cut offset (mm)" + help text.
- **U5.** Replace marketing/jargon copy across the app with plain language; add inline help (?) on Density, Fill mode, Placement.
- **U6.** Toasts for every state-changing action (Make Editable, Delete, Save, Export) with Undo where applicable. Undo/Redo
  (already working) get visible buttons + shortcuts.

---

## Phase 9 — HTV specifics

- **H1.** 3D tab: blank pane with "3D preview lost its graphics context" (may be sandbox GPU, but still must degrade). Detect
  WebGL/context loss (`webglcontextlost` event) → show fallback (flat garment view) with a "Retry 3D" button; no blank pane.
  (`app/htv/HtvGarment3D.tsx`)
- **H2.** Silhouette converter modal — fixed by L2; add progress state and error state.
- **H3.** Black text on dark HTV canvas — contrast fix (U2).
- **H4.** Warn if design exceeds garment placement zone or Cricut mat size; show size in mm and inches.

---

## Phase 10 — Accessibility & keyboard

- **A1.** Add real headings (h1 per page, h2/h3 in studios — currently none); landmarks (`main`, `nav`, `aside`); skip link
  ("Skip to editor") as first focusable element — currently 11 Tab presses to reach the editor.
- **A2.** Visible focus everywhere: the "Open" button and "Project name" input have `outline:none` and no replacement. Global
  `:focus-visible` ring token; grep and remove all unreplaced `outline-none`.
- **A3.** 72 text nodes ≤ 11 px → minimum 12 px (prefer 13). Contrast ≥ 4.5:1 body, 3:1 large/UI.
- **A4.** All icon-only buttons get `aria-label`; modals use `role="dialog"` + `aria-modal` + labelled title; live region for toasts.
- **A5.** Keyboard shortcuts sheet (`?`): tools, undo/redo, select all, delete, fit, zoom, export; arrow keys nudge selection.
  Respect `editorDomGuards.ts` (no shortcuts while typing in inputs).
- **AC:** axe/Lighthouse a11y ≥ 95 on /, /rhinestone, /htv, /library, /designs, /settings, /setup, /fonts.

---

## Phase 11 — Mobile & tablet

- 390 px is currently unusable. Provide a mobile layout: bottom tab bar (Design / Settings / Export), canvas on top fills width,
  panels as bottom sheets, touch gestures (pinch zoom, drag pan), 44 px touch targets, nav that doesn't clip.
- Tablet 820 px: nav is cut off horizontally — make it wrap/collapse into a menu.
- **AC:** no horizontal scroll at 390 and 820; every primary flow completes on 390 px.

---

## Phase 12 — New helpful features (after everything above is green)

- **N1.** Stone count + estimated cost/pack-size estimator (stones per gross, per size).
- **N2.** Warnings for very high stone counts (> 1500) and mat-size overflow with a "Fit to mat" action.
- **N3.** "Auto-fix issues" button in the status panel (runs `resolveStoneSpacing` from E2 and reports what changed).
- **N4.** Share/export project link-less backup (P4) — no server work required.
- **N5.** Recent projects on the start page with thumbnails (P3).

---

## Phase 13 — QA & verification checklist

Run in the browser against `npm run dev` after each phase:

1. Typing any of: `SMOOCH`, `SCORE 2026`, `Sulay 123`, `Aabcdefg`, `Glog`, `Hello World` → export-ready at default SS10/25 mm.
2. `/rhinestone?font=installed-always-script-font-imported&text=Sulay%20123` → generates stones.
3. Minified single-line SVG with 5 circles → imports 5.
4. Upload corrupt SVG → rejected with message. Upload 100×100 SVG → ≈100 mm result.
5. New browser profile (clear localStorage): start → text → export in ≤ 3 clicks, truthful warnings, no late modal.
6. No page vertical scroll in studios at 1440×900; Export always visible; all modals visible.
7. Delete in My Designs/Library/canvas → undo works; rename works without `window.prompt`.
8. HTV export has `mm` width/height, mirror option, weed border; 3D tab never blank.
9. Console: no hydration errors, no unhandled errors on any route in dark and light theme.
10. Tab from page load reaches "Skip to editor" first; every control shows focus.
11. 390 px and 820 px: no horizontal scroll; flows complete.
12. `npx vitest run`, `npm run lint`, `npx tsc --noEmit` all clean.

Not verifiable by the auditor (please check manually): Safari/Firefox rendering, screen readers, real-GPU 3D, real file
downloads into Cricut Design Space, uploading real font files/zips.

---

## Traceability — every audit finding → task

| Audit finding | Task |
|---|---|
| Studio layout not viewport-fit (2061/3004 px page; canvas 1678/2765 px; Export scrolls away; wheel zoom) | L1 |
| Ordinary words fail export (STONE_COLLISION) | E2 |
| Vendor Stone Font/Alphabet/Stencils fail new 0.508 rule; misleading "overlap" message | E2 (D1) |
| Calibration gate locks new users; self-attested approval; "HIGH CONFIDENCE" uncalibrated | C1 |
| Calibration gate counted as design error ("BLOCKED (1)") | E6 |
| HTV wrongly shows calibration gate / WARNING | C2 |
| /fonts 311k px, 44k nodes, 3,720 @font-face | F1 |
| Corrupt fonts (fredoka-one, cane-light) | F2 |
| Hydration mismatch on /designs | L4 |
| Settings never read by studios; HTV weed margin unused | S1, C4 |
| Fonts → "Use in Rhinestone" → "Unknown outline fontId" | E3, F4 |
| Minified SVG import drops stones silently | E1 |
| Modals below fold (HTV silhouette, garment preview clipped) | L2, H2, U3 |
| Late "Restore autosave?" modal swallows clicks; empty-canvas flash | L3 |
| Delete immediate/permanent; rename via `window.prompt`; delete-all no confirm | P2 |
| Corrupt asset accepted; opens empty canvas without error | E5 |
| Uploaded SVG oversized (274×262 mm, 1768 stones) | E4, N2 |
| 3D tab blank ("lost its graphics context") | H1 |
| 11 Tab presses, no skip link; invisible focus on Open/Project name | A1, A2 |
| Starter templates tiny (5–6 stones) | P5 |
| HTV export lacks mirror/weed/registration | C4 |
| Three overlapping save concepts; raw timestamps; no thumbnails | P1, P3 |
| Duplicated warnings ×6; 5 stacked chrome rows | L6 |
| Empty first-run copy wrong ("on the left"); Generate is a tab; "Legacy / Original"; "SMOOCH" default | O2 |
| Marketing-jargon start page | O1 |
| Tools duplicated rail + accordion; Inspector tip references old tool names | O3 |
| Wrong empty-state text on Library/Designs | O2, P3 |
| Theme inconsistencies; washed-out light studio; black text on dark HTV canvas | U2, H3 |
| Washed-out "Next action" cards | U1 |
| Garment preview placeholder copy | U3 |
| Fonts page leaks dev command/path; "Sulay 123" default; unlabeled tag inputs | F3 |
| Setup page 6315 px, duplicate machine card, stale SS6–SS12 copy, Stone Ø vs hole, `kerfCompensationMm` | U4 |
| a11y: no h1–h3, no skip link, 72 text nodes ≤ 11 px | A1, A3 |
| Mobile 390 px unusable; tablet nav clipped | Phase 11 |
| localStorage-only data / no backup | P4 |
| Grid 5×3 renders as a tiny dot; Fit can't help | L1, L5 |
| Missing: auto-fix overlaps | E2, N3 |
| Missing: auto-fit/centre after Generate | L5 |
| Missing: templates / onboarding | P5, O1, O3 |
| Missing: export preview dialog | C3 |
| Missing: mat-size warnings | C3, H4, N2 |
| Missing: stone count/cost estimator | N1 |
| Missing: thumbnails | P3, N5 |
| Missing: project export/import | P4 |
| Missing: keyboard shortcuts | A5 |

---

## Suggested commit / PR slicing

1. `engine: robust SVG import parser (E1)` + tests
2. `engine: collision semantics + resolveStoneSpacing (E2)` + spec + ADR 0006 + tests
3. `fix: installed font resolution + graceful fallback (E3)`
4. `ui: fixed app shell, modal primitive, autosave flow, hydration (L1–L6)`
5. `export: calibration flow, HTV gate removal, export dialog, HTV mirror/weed (C1–C4, E6)`
6. `persistence: confirm/undo/prompt dialogs, My Designs, project file, starters (P1–P5)`
7. `settings wiring (S1)` · 8. `fonts page (F1–F4)` · 9. `onboarding (O1–O3)` · 10. `polish (U1–U6, H1–H4)`
11. `a11y + keyboard (A1–A5)` · 12. `mobile (Phase 11)` · 13. `new features (N1–N5)`

Each PR: tests pass, lint + tsc clean, manual verification from Phase 13 for the touched area, docs/ADR updated.
