# ADR 0008 — Persistence model: Autosave, My Designs, project file

**Date:** 2026-11-19  
**Status:** Accepted

---

## Context

Saving was described with four overlapping words: "Save" (a silent file download), "Library" (a browser template library),
"My Designs" (a page reading that same library) and "Autosave". A new user could not tell where their work lived. Destructive
actions (delete design, delete asset, delete many stones) were immediate and permanent, rename used `window.prompt` (blocked in
embedded browsers), and opening a saved generated design while the editor was in an editable session showed an empty canvas or
asked an unrelated "Regenerate from source settings?" question.

Product decision D3 (`docs/COPILOT_FIX_PLAN.md`): stay browser-only (no backend), but make the concepts consistent and add a
project file for backup and sharing.

## Decision

Present exactly three concepts and use these words everywhere in the UI:

| Concept | What it is | Where it lives | UI |
|---------|------------|----------------|----|
| **Autosave** | Automatic safety net for the current session. Not a list of designs. | `rhinestone-template-library-autosave` | Status bar "Autosaved 14:03"; offered on next visit |
| **My Designs** | Designs the user saved on purpose, plus read-only **Starter** templates. | `rhinestone-template-library` (user templates), `rhinestone-workspace-vault` (HTV designs, assets) | Topbar **Save** and **My Designs**; `/designs` page |
| **Project file** | Explicit download (`<name>.rhinestone.json`) for backup or moving to another computer. | The user's disk | Topbar **Export file**, **Open ▸ Open project file…** |

Consequences for behaviour:

1. **Save** writes to My Designs (updating the active entry, or creating one). It no longer downloads a file.
2. **Export file** is the only action that downloads a project file. `parseRhinestoneProject` validates every import (schema
   version, field types, size limit of 20 MB) and only reads JSON; nothing in a file is executed.
3. **No `window.prompt`/`confirm`/`alert` in `app/`.** `PromptDialog` (rename, duplicate) is built on the shared `Modal`.
4. **Deletes are undoable for 8 seconds** (`UndoToast` on `/designs` and `/library`, an inline Undo in the editor toast).
   The delete happens immediately; Undo restores the removed entry from memory into the *latest* stored data, so edits made in
   the meantime are kept. Deleting ≥ 10 stones in one step also shows an Undo (the editor history already supports it).
5. **Starters always come from code.** The repository no longer trusts a previously stored starter list, so new starters reach
   existing browsers. Only the user's favourite flag on a starter is kept.
6. **Loading a project replaces the whole design.** It uses the raw reducer dispatch (no "Regenerate?" prompt) and discards a
   leftover editable session when the loaded project is a generated one.
7. `/designs` no longer shows calibration chips on every card or a "Ready" status derived from calibration profiles; the
   calibration state belongs to the export flow (ADR 0007), not to a design's list row.

## Consequences

- A new user has one place to look for saved work and one explicit way to back it up.
- Data is still only as durable as the browser: clearing site data removes My Designs. The page and the empty state say so and
  point to **Export file**.
- HTV designs have no project file yet (they live in the workspace vault only); this is the next gap to close.
- Opening another design still replaces the current one without a "discard changes?" step; autosave covers accidents. A
  dirty-state prompt would need a notion of "unsaved changes" that does not exist yet.
