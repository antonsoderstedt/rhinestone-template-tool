# ADR 0011 — First-run experience: goal-based start page, empty state, quick-start guide

**Date:** 2026-11-19  
**Status:** Accepted

## Context

The start page was a marketing page ("Design ops for rhinestone and HTV teams", audience cards, proof stats) with five buttons
and no clear first action. In the studio, copy told users to adjust settings "on the left" (the panel is on the right) and to
"Generate" (generation is automatic; "Generate" was also a tab name). The default text was a brand word ("SMOOCH"), the tool
list appeared twice (rail and a "Tools" accordion), and nothing explained stone sizes, spacing or calibration.

## Decision

- **Start page** (`app/page.tsx`): "What do you want to make?" with three goals — rhinestone from text, rhinestone from artwork,
  HTV transfer. The text and HTV goals open the studio through the font launch link with an example already generated; the
  artwork goal opens the Artwork tool (`/rhinestone?tool=svg`). A four-step "How it works" line (Design → Check → Export → Cut),
  the existing "continue where you left off" panel, and a row of secondary links replace the rest.
- **Launch parameter `tool`:** `/rhinestone?tool=<tool id>` selects a tool. Like the other launch parameters it wins over
  restoring the last session, which is copied to My Designs first (ADR 0010).
- **Empty studio:** default text is "YOUR NAME"; the text field's placeholder is "Your name" and offers one-tap examples. If the
  text is cleared, a centred prompt with a large text box and the same examples appears over the canvas.
- **Copy:** canvas hints point to the panel on the right and never ask the user to press Generate; the "Generate" tab is now
  "Design". The "Tools" accordion is removed (the rail is the only tool switcher); the Inspector tip lists the tools by their
  real names.
- **Quick-start guide** (`GettingStartedGuide`): four steps (pick a stone size, type text, check spacing, export), dismissible,
  remembered in `rhinestone-onboarding-dismissed-v1`; Settings has "Show the quick-start guide again". It is a strip, not
  floating coach-marks, so it cannot cover the canvas or break on small screens.
- **Jargon:** plain-language `GLOSSARY` entries (stone size, spacing, collision, calibration) are shown as tooltips on the
  Stone Size and Spacing labels. "Density" is now called "Spacing", matching Settings.

## Consequences

- A first-time visitor has one obvious action and sees a working example within one click.
- Returning users who click a goal card keep their previous session in My Designs, not lost.
- Not done here: tooltips for collision and calibration terms in every place they appear, and a guided overlay on specific
  controls. The glossary entries exist for those.
