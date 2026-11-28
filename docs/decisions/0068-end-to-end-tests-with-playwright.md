# ADR 0068: End-to-end tests with Playwright

**Status:** accepted · **Date:** 2026-11-28

## Why

The unit tests check the engine and the Worker, but not that the pieces work together in a browser: that the built site opens, that a
real mouse draws and edits, that a file saved by one page opens in the next, that the admin panel changes what the studios show. Until
now that was checked by hand, once, after each feature (and only with synthetic events for the drawing tool). The earlier
`scripts/e2e-smoke.mjs` runs by hand across browsers and was never part of CI.

## Decisions

- **`@playwright/test`, in `e2e/`, run by `npm run test:e2e`.** The tests drive the real static build, served by the real Worker on
  a local D1 (`scripts/deploy-private.sh --dev`, started by Playwright's `webServer`): no login, an empty database every start, no
  network and nothing on Cloudflare is touched. Chromium only; the cross-browser run stays in `scripts/e2e-smoke.mjs`.
- **What is covered** (15 tests): every page opens with status 200, the site title and no console or page error; the Worker routes
  answer on the real build; a name becomes stones and exports as an SVG in millimetres with only circles (no `<use>`, `<image>`,
  `<canvas>`, nested `<svg>`); the drawing tool with a **real mouse** (draw a square, put two points on its sides with the new tool,
  choose both with Shift-click, take them away with Delete, undo, and with the "Take them away" button; checked by saving the drawing
  file and counting the points); an HTV design saved as `.htv.json`, opened again with the same layers, and a damaged file refused; the
  admin panel (a site title shows on the studios and goes back; a design exported from the Rhinestone studio is uploaded to the library,
  hidden, shown and deleted, with the Worker's answers checked; a visit is counted); and the 3D Build view draws its canvas.
- **Tests do not depend on the owner's libraries.** `scripts/deploy-private.sh --dev` includes `public/design-library` when it is
  there; CI does not have it. The tests use only what they create themselves.
- **Tests set their own language and unit.** The app keeps both on the server so that they follow the owner between devices, so any
  other browser open on the same server (a developer's own tab, an earlier run) can change them. A fixture (`e2e/fixtures.ts`) sets
  English and millimetres before every test.
- **CI** has a job of its own (`e2e`, Node 22, Playwright's Chromium with software WebGL), so a browser problem never hides the unit
  test result. A failing run keeps the report and traces as an artifact for 7 days.
- **Locally**: `E2E_CHANNEL=chrome npm run test:e2e` uses the installed Chrome (no download). The tests reuse a server that is already
  running on port 8787; stop it first for an empty database.

## Not covered

- The 3D handles (resize squares, turn rings) are dragged with a real mouse by hand, not here: they sit at positions that depend on
  the camera, and a test that finds them would be as complicated as the code it tests. The Build view test checks that the canvas is
  drawn without error.
- Touch input, Firefox and Safari engines (see `scripts/e2e-smoke.mjs`), and the logged-in Cloudflare Access flow (not possible
  outside Cloudflare; the Access check itself is unit-tested).
- Uploading a font (there is no font file the repository may carry).
