# Browser, device and performance report

**Date:** 2026-11-19 · **Method:** production build (`next build` + `next start`) in a clean clone, Lighthouse 12 (Chrome,
default mobile profile = simulated slow 4G and 4x CPU slowdown, and the desktop preset), and a Playwright smoke test
(`scripts/e2e-smoke.mjs`) in real browser engines.

## Cross-browser smoke test

The same 13-step flow in every configuration: start page → open the studio from a goal card → stones generated → no sideways
scroll → type new text and the design regenerates → export dialog → download a valid SVG (mm units, circles only, no
`<use>`/`<image>`) → save to My Designs and see it listed → reload and restore the autosave → HTV studio loads → HTV 3D tab
renders (or falls back) → Fonts page → Setup page.

| Configuration | Engine | Result |
|---|---|---|
| Desktop 1440 × 900 | Chrome (Chromium) | 13 / 13 |
| Desktop 1440 × 900 | Firefox 150 | 13 / 13 |
| Desktop 1440 × 900 | WebKit 27 (Safari's engine) | 13 / 13 |
| iPhone 15 (touch, 393 px) | WebKit | 13 / 13 |
| iPad Pro 11 | WebKit | 13 / 13 |
| Pixel 7 | Chrome | 13 / 13 |
| 390 px window | Firefox | 13 / 13 |

On phones, *Save* and *3D preview* are in the menu sheet; the test uses them there, as a user would.

**What it found (all fixed):** on the iPhone the new first-run guide covered the zoom buttons; the project name of the default
two-line text came out as "YOURNAME"; the "Restored your last session" message was long; and the font picker's badge text
("OUTLINE DEFAULT (FILLED TYPOGRAPHY AVAILABLE)") wrapped inside its pill in every browser.

**Caveats, stated plainly.** This is *not* a physical device: the iPhone and iPad runs are WebKit with the device's viewport,
touch events and user agent, not Mobile Safari on iOS (no Xcode simulator is installed here, and desktop Safari could not be
driven without an administrator password). Real-device points still worth a hand check: iOS Safari's collapsing address bar,
the on-screen keyboard covering the bottom sheets, real two-finger pinch, and Android Chrome. WebGL ran in every engine here,
so the 3D fallback path was not exercised in a browser without WebGL.

WebKit also logs "access control checks" errors for Next.js `?_rsc=` prefetches, but only when the test navigates away while a
prefetch is in flight (WebKit reports an aborted fetch that way). A page left alone, or a normal click-through, logs nothing.

## Lighthouse

Scores are performance / accessibility / best practices / SEO. Mobile = simulated slow 4G, 4x CPU.

| Page | Mobile | LCP | TBT | CLS | Desktop |
|---|---|---|---|---|---|
| `/` | 100 / 100 / 100 / 100 | 0.9 s | 0 ms | 0 | – |
| `/designs`, `/settings`, `/setup` | 100 / 100 / 100 / 100 | 0.9 s | ≤ 20 ms | 0 | – |
| `/fonts` | 100 / 100 / 96 / 100 | 0.9 s | 10 ms | 0 | – |
| `/htv` | **90** / 100 / 100 / 100 | 3.6 s | 40 ms | 0 | 99 |
| `/rhinestone` | **86** / 100 / 100 / 100 | 4.1 s | 40 ms | 0.073 | 99 |

`/fonts` best practices is 96 only because this clone does not have the 3,691 imported font files (they are not in the
repository), so their requests 404.

### What changed because of it

| | Before | After |
|---|---|---|
| `/rhinestone` layout shift (CLS) | 0.127 | 0.073 (desktop 0.034) |
| `/htv` performance | 80 | 90 |
| `/htv` LCP / TBT | 5.0 s / 150 ms | 3.6 s / 40 ms |
| `/htv` transfer | 702 KiB | 441 KiB |
| SEO on studio pages | 90 | 100 |

- The "Restored your last session" bar and the 4-step guide were inserted above the canvas after the page loaded and pushed
  everything down; they are now a toast and an overlay.
- three.js (~300 KiB) and the dialogs load when first used (`next/dynamic`) instead of with the page.
- A link named just "Start" was flagged as non-descriptive ("Start page") and the font picker's accessible name did not
  contain its visible text.

### What remains

`/rhinestone` mobile LCP of 4.1 s is JavaScript running under a 4x CPU slowdown: the studio renders after the saved session
has been read, and `EditorShell` is one large client component. Splitting it (tool panels loaded per tool, canvas first) is the
next step; on a normal desktop the page paints in 0.9 s.
