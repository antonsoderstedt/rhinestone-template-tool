# ADR 0009 — Settings are new-project defaults, and only wired settings exist

**Date:** 2026-11-19  
**Status:** Accepted

## Context

The Settings page stored eleven free-text and numeric fields (machine model, cutting mat, blade strategy, materials, carrier,
output folder, quality checklist, a spacing in mm, …). Only the HTV weed margin was ever read. The rest looked like
configuration but changed nothing, and "spacing in mm" contradicted the engine, where spacing comes from the stone size and
material through a density preset (a fixed 4 mm is too tight for SS16/SS20).

## Decision

`WorkspaceSettings` (`app/lib/workspaceSettings.ts`) holds only settings a studio reads:

| Setting | Read by |
|---------|---------|
| `defaultStoneSize` | every editor tool, via `applyWorkspaceDefaults` |
| `defaultDensityPreset` (`safe`/`standard`/`dense`/`loose`) | text, grid and SVG tools |
| `defaultArtworkLongestSideMm` | SVG upload sizing (`SvgToolState.uploadLongestSideMm`) |
| `htvWeedMarginMm` | HTV export |

- Settings apply to **new projects** (first visit without autosave, "New project", "Start fresh"). Loaded or restored
  projects keep their own values; the page says "Applies to new projects".
- `sanitizeWorkspaceSettings` validates everything read from storage: invalid values fall back to defaults, numbers are
  clamped, and keys removed in this change are dropped (they disappear from storage on the next save).
- `applyWorkspaceDefaults(state, settings)` is pure and unit-tested.
- A setting is added only together with the code that consumes it.

## Consequences

- Changing the default stone size changes the next new project; verified in the running app.
- Previously saved free-text values (machine, mat, checklist, …) are discarded. They never had any effect.
- Not done: machine/mat selection. It becomes a setting once something (e.g. a mat-size-aware layout check) uses it.
