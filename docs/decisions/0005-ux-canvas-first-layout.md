# ADR 0005 — Canvas-First Layout and UX Rebuild

**Date:** 2026-11-04  
**Status:** Accepted

---

## Context

The editor's original layout had two always-visible side panels (source 220px left + inspector 220px right) flanking the canvas. This left the canvas with roughly 440px less width than the viewport, and the panel roles were communicated only by small passive badges ("Source controls" / "Inspector") that users rarely read. The setup page used a separate light-mode styling inconsistent with the dark studio, and `/setup` was not in the global navigation.

The template library was a right-side full-screen overlay that destroyed the spatial context of the canvas every time it opened.

The HTV Studio had no calibration-awareness in its status banner, and `WorkspaceModeBanner` was hardcoded with static status values.

---

## Decision

### 1. Single tabbed right panel (canvas-first)

Replace the two side panels with one `StudioContextPanel` (260px) anchored to the right. The panel has two explicit tabs:

- **Generate** — generator settings (the old "source" panel content)
- **Inspect** — selection, alignment, export, readiness (the old "inspector" panel content)

The canvas gets the freed 220px back and is now the dominant element. The `StudioToolRail` on the left handles primary tool switching.

**Auto-tab rule:** when the `select` tool is active → switch to Inspect; all other tools → Generate. Users can override manually; the override clears when the tool changes (derived-state reset with `setPrevTool`).

### 2. Canvas action strip

A 32px bar pinned above the canvas shows `getCanvasHint(activeTool)` and a contextual primary CTA ("Make Editable" when the template is generated but not yet editable). This surfaces the most common next action without requiring panel interaction.

### 3. Template library as bottom drawer

`TemplateLibraryPanel` changed from `absolute inset-0 flex justify-end` (right-side overlay) to `absolute inset-0 flex flex-col justify-end` (bottom drawer, max-h 65vh). Cards are now a horizontal scroll row (`flex gap-3 overflow-x-auto`) with 200px fixed-width tiles. The canvas stays visible above the drawer.

### 4. Navigation

`/setup` added to `GlobalTopNav` with a `Ruler` icon between My Designs and Settings. It was completely absent before despite `getModeMeta` already handling the path.

### 5. Dark theme consistency

`WorkspaceModeBanner` replaced hardcoded `bg-white/90 text-zinc-600 border-zinc-200` with `var(--studio-*)` CSS variables. `/setup/page.tsx` ported to `data-theme="dark"` with CSS var fallbacks.

### 6. Dynamic calibration banners

Both `EditorShell` and `HtvShell` now compute calibration status dynamically from `readActiveCalibrationProfile()` and sync on `storage` and `focus` events. `WorkspaceModeBanner` status/guidance/calibrationState all reflect the actual profile state.

### 7. Open recent menu

Both `EditorTopbar` and `HtvTopbar` gained a `recentDesigns + onOpenRecent` prop pair. The "Open" button becomes a `<details>` dropdown showing the last 5 designs. Uses the native `<details>` element — no JS state, no new dependency.

### 8. Settings: calibration profiles

`/settings/page.tsx` gained a Calibration Profiles section below the existing form cards — lists all saved profiles with Active/Approved badges, Set active / Approve (toggle) / Delete actions.

### 9. Server component boundary fix

`WorkspaceQuickActions` had `'use client'` while being consumed from server pages with `icon: LucideIcon` props (React components), which fails Next.js static prerendering. Removed `'use client'` — the component has no hooks or event handlers and works as a server component.

---

## Consequences

- The canvas has ~220px more horizontal space on desktop.
- Users who previously relied on seeing both source settings and selection details simultaneously must now switch tabs. This is acceptable: the workflows rarely overlap.
- The `<details>` dropdown for recent designs closes naturally on blur — no JS needed.
- `StudioContextPanel` causes one extra render pass when `activeTool` changes (due to derived-state `setPrevTool` pattern), which is negligible.
- `TemplateLibraryPanel` no longer has a Rename button visible by default (it's in the card actions). The prop is preserved for future re-exposure.
