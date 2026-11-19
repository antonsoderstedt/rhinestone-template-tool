# ADR 0012 — Studio UX polish: contrast tokens, stepped Setup, inline help, toasts

**Date:** 2026-11-19  
**Status:** Accepted

## Context

Shortcut cards washed out on light pages because they used the studios' `--studio-*` variables, which default to dark.
The Setup page was a 6,300 px dark page whose embedded light-themed components were unreadable, with two machine cards, a
duplicated production-gate card, stale "SS6–SS12" copy, "Stone Ø" next to hole sizes without saying which was which, and the
raw field name `kerfCompensationMm`. Shared control styles hard-coded dark colours, so the light studio theme showed dark chips.
Muted text measured 3.3–3.5:1.

## Decision

- **Contrast tokens** (measured with a computed-style scanner over every page): `ink-secondary` → sand-700, `ink-muted` →
  sand-600, `success/warning/info-600` darkened, `-700` variants defined (several `text-*-700` classes did not exist and
  silently inherited), studio `ink-subtle`/`ink-muted` raised in both themes, primary buttons and status bars use the `-600`
  shade. Result: 0 failing text nodes on `/rhinestone` dark; 1–4 left on light studio/HTV (gradient backgrounds the scanner
  cannot resolve, and the always-dark top bar).
- **Studio controls follow the theme:** `controlStyles.ts` and the tool rail use `--studio-*` tokens instead of fixed dark
  hexes. The HTV canvas background uses the theme tokens, so dark artwork is visible in the light theme.
- **Shortcut cards** (`WorkspaceQuickActions`) are real links on light workspace tokens; the meaningless "Next action" eyebrow
  is gone.
- **Setup** is a light workspace page with three steps — Test pack, Measure, Approve — as an ARIA tablist. Steps 2 and 3 share
  one `CalibrationWorkflow` instance (`view="measure" | "approve"`) so entered values persist. One machine card (in the test
  pack), no duplicated gate card. Copy: SS6–SS20; **stone diameter** (the rhinestone) vs **hole diameter** (what the machine
  cuts) are labelled explicitly; `kerfCompensationMm` is explained as the "blade cut offset".
- **Inline help:** `FieldHeader` adds a (?) button that reveals a plain-language note (real text, keyboard/touch/screen-reader
  friendly) on Spacing, Fill mode, Fill pattern, Coverage and Placement pattern.
- **Feedback:** every stone delete shows an Undo toast; Make Editable explains what changed. Undo/Redo buttons already exist
  in the top bar.
- Garment preview copy now describes what the preview shows instead of "swap in real photos".

## Not done

- The global top bar is still always dark on light pages (deliberate navigation chrome). Dialogs (`EditorDialog`,
  `PromptDialog`) stay dark in both themes.
- No full WCAG audit: contrast was checked for text nodes only, not for non-text UI or focus rings (Phase 10).
