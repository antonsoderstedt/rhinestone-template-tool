# 0014 — Accessibility baseline and keyboard shortcuts

Status: accepted (Phase 10 of `docs/COPILOT_FIX_PLAN.md`)

## Context

The audit found: no headings or `<main>` in the studios, 11 Tab presses to reach the editor, controls with `outline: none` and no
replacement, 72 text nodes under 12 px, unnamed `<select>`s, nested `role="dialog"`s, and almost no keyboard shortcuts beyond
undo/redo and delete.

## Decisions

1. **Landmarks and headings.** Every page has one `<main id="main-content">` (the studios put it around the canvas) and one `<h1>`
   (visually hidden in the studios). Panels are labelled `<aside>`s; the studios' topbars are labelled sections, not second
   `<header>` banners. Panel titles are `<h2>`. A **skip link** is the first focusable element ("Skip to editor" in the studios,
   "Skip to main content" elsewhere) and moves focus to `#main-content`, so the editor is 2 Tab presses away instead of 11.
2. **One focus ring.** `app/globals.css` defines `--focus-ring` (a violet that reaches ≥ 6:1 on light surfaces; a lighter one on the
   dark studio and top bar) and a base-layer `:focus-visible` outline. Components may draw their own ring, but a class string that
   uses `outline-none` must contain a 2 px+ `focus:ring` / `focus-visible:ring` / `focus:outline` in the same string
   (`tests/focusStyleGuard.test.ts`). Faint 30 %-opacity rings were made opaque.
3. **Minimum text size is 12 px** (`text-xs`); `tests/minTextSize.test.ts` rejects `text-[<12px]`. The studio tool rail grew from
   52 to 68 px and the Rhinestone topbar now wraps instead of scrolling, so the larger text does not push *Export* off screen.
4. **Names and state.** Every `<select>`/icon-only control has an accessible name; toggles use `aria-pressed`; the panel tabs are a
   real `tablist`; the top-bar current page has `aria-current`. Modals keep the single `role="dialog"` from `Modal.tsx` (the three
   that nested a second one no longer do). Toasts are `role="status"`.
5. **Keyboard shortcuts** are defined in one pure module, `app/lib/studioShortcuts.ts`, and listed in a `?` sheet
   (`KeyboardShortcuts.tsx`, also opened from a topbar button). New: tool keys V/A/T/G/S/I (Rhinestone only), F fit, +/−/0 zoom,
   Ctrl/⌘+S save, Ctrl/⌘+E export, arrow-key nudge of selected stones (1 mm, Shift 5 mm), and in HTV Esc to clear the selection.
   Shortcuts do nothing while a text field, select, slider, tab or menu has focus, or while a dialog is open.
   Space no longer pans when a button/link/summary is focused (it used to swallow Space, so those could not be activated).
   Arrow nudging uses the same `MOVE_STONES` action as dragging, so collision checking is unchanged.

## Consequences

- Verified with axe-core 4.12 (WCAG A/AA + best-practice rules) on `/`, `/rhinestone`, `/htv`, `/library`, `/designs`, `/settings`,
  `/setup`, `/fonts`, plus the studios with the export dialog, the shortcuts sheet, the 3D view and the Setup steps open: 0 violations.
  That is an automated pass; it cannot judge reading order, wording or screen-reader behaviour, and Lighthouse was not run.
- Canvas content (stones, layers) is an SVG without a text alternative; moving and selecting there is possible by keyboard only
  through select-all, the arrow keys and the inspector fields. Selecting an individual stone by keyboard is not supported.
- The global top bar is still dark on light pages (ADR 0012), so its focus ring uses the light variant via `data-focus-surface`.
- `?` is detected by `event.key`, so it follows the user's keyboard layout.
