# 0015 — Phone and tablet layout

Status: accepted (Phase 11 of `docs/COPILOT_FIX_PLAN.md`)

## Context

At 390 px the studios were a vertical stack with a clipped top bar, a tool rail that scrolled out of view, a status bar of
five wrapped rows and side panels pushed below the fold. At 820 px the global navigation was cut off. Controls were 28–40 px
tall, and the canvas had no touch gestures. There was also a latent bug that only shows on a tall screen: the canvas SVG was
letterboxed, but pointer positions and "fit to screen" assumed the view box filled the whole element, so on a phone drags landed
in the wrong place and fit left the design small and off-centre.

## Decisions

1. **One touch layout below 1024 px (`lg`)**, used for phones and tablets alike. Desktop is unchanged (everything new is
   `max-lg:` or `lg:hidden`).
2. **Studio shape on touch:** a compact top row (menu, project name, undo/redo), the canvas filling the remaining height, and a
   bottom tab bar. Rhinestone: *Tools · Design · Inspect · Export*; HTV: *Add · Inspect · Export*. A tab opens its panel as a
   44 dvh sheet *under* the canvas (not over it), so the canvas shrinks and stays usable. Picking a tool opens that tool's
   settings; adding something in HTV opens the inspector. *Export* opens the existing export dialog.
3. **Menu sheet** (`StudioMenuSheet`) holds what the desktop top bar shows as buttons (new/save/open/recent/garment/setup, the
   canvas/garment/3D choice, theme) plus links to the rest of the app. On studio routes the global header is hidden on touch,
   since the sheet replaces it. On other pages the global navigation collapses into a *Menu* button below `xl` (1280 px).
4. **Touch targets:** below 1024 px, and on any `(pointer: coarse)` device, buttons, tabs, summaries, selects and text fields
   are at least 44 × 44 px; checkboxes are 22 px inside labels at least 44 px tall; text fields are 16 px so iOS does not zoom on
   focus. The rule is unlayered so it beats mouse-sized utilities such as `h-8`. Inline text links are exempt.
5. **Gestures** (`app/lib/touchGestures.ts`): two fingers pinch-zoom and pan. The step is a pure function
   (`computePinchStep`): the drawing point under the fingers stays under them. A second finger cancels whatever the first had
   started (drag, draw, box-select), the finger that remains is ignored until it lifts, and the click it would produce is
   suppressed. One finger keeps working as the active tool. The gesture tracks the view itself because touch events can arrive
   faster than React re-renders.
6. **The canvas view box now follows the canvas shape** (`expandViewBoxToAspect`), so it fills the element and pointer ↔ mm
   conversion is exact on any screen. `calculateFitViewTransform` solves for that shape, so *fit* fills the canvas. HTV's square
   view box is letterboxed, so its pointer conversion and fit use the drawn area (`fitRect`). Zoom limits are shared
   (`MIN_CANVAS_ZOOM`/`MAX_CANVAS_ZOOM`, 0.1–100) so fit can no longer produce a zoom the controls then clamp back.
7. **Smaller things:** the first-run guide and long status messages collapse (tap to expand); the status bar scrolls sideways
   (and is focusable there); the Fonts page grid can no longer widen the page; the viewport meta sets `viewport-fit=cover` and the
   bottom bar pads for the home indicator. Zoom stays enabled.

## Consequences

- Verified in the in-app browser at 390 × 844 and 820 × 1180 (emulated viewports, pointer-event gestures): no horizontal scroll on
  `/`, `/library`, `/designs`, `/settings`, `/setup`, `/fonts`, `/rhinestone`, `/htv` (with every sheet open); no control under
  44 px apart from the skip link (hidden until focused) and one inline text link; axe-core 4.12 reports 0 violations at 390, 820
  and 1280; on 390, changing the design text in the Design sheet, opening the menu and opening the export dialog work.
- **Not tested on a physical phone or tablet.** Emulation does not reproduce iOS Safari's address-bar resizing, real multi-touch
  or `pointer: coarse` detection, or keyboard-overlay behaviour with the sheets open.
- One finger on empty canvas still box-selects (Select tool) or draws (Pen), so panning on touch needs two fingers. A one-finger
  pan mode would need a dedicated pan tool.
- The HTV text inspector lists every bundled font as a button (~3,700 DOM nodes). It works on a phone but is heavy; windowing it,
  as the Fonts page already is, is the obvious follow-up.
- Landscape phones (≈ 800 × 390) get the same layout with very little canvas height when a sheet is open.
