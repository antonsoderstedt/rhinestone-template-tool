# ADR 0022 — A design made of several parts ("Add to design")

**Date:** 2026-11-22  
**Status:** Accepted (first step of plan item J15 / B1)

## Context

A Rhinestone design was exactly one source: one text, one artwork. A name and a number, or text and a logo, could not be in the
same design (backlog B1). The editor keeps one slice of state per tool and generates one template, so a full element model
(every element a live generator with its own transform, undo for all of it) would touch every tool, the canvas and the save
format at once.

## Decision

A first step that gives the result without rebuilding the editor:

1. **Parts.** "Add to design" freezes what the tool has made as a *part* (name, stones, offset) and the tool goes on with the next
   piece. Parts are plain data (`DesignPart`), moved by an offset, renamed and removed from a list in the Design panel.
2. **One place for "where".** The piece being worked on has a `workingOffset`. The generators still draw at their own origin;
   the reducer applies the offset whenever a template is set, and moves the current template (and editable stones) by the
   difference when the offset changes. After "Add to design" the next piece is placed directly below everything kept, left
   edges aligned, 10 mm apart.
3. **The whole design is composed, not stored twice.** `buildEffectiveTemplate` is the working piece plus every part, so export,
   the stone estimate, the readiness check, the status bar and "Fit to mat" / "Split across mats" all see the whole design.
   Part stones get ids `part-N:id` and `metadata.partId`, are drawn with the rest and are not edited on the canvas.
4. **Saved with the design.** The project file gets optional `parts` and `workingOffset` (validated; duplicate ids and bad numbers
   are refused). A design with parts but nothing being generated is saved as an empty manual design plus its parts. Older files
   open unchanged.

## Turning, mirroring, duplicating, undo (B2, B3 for parts)

Each part can be turned a quarter turn either way, mirrored left to right or top to bottom (about the middle of its bounding
box, so it stays put; stones are round, so spacing is untouched) and duplicated (the copy goes below everything kept). Every
change to the parts is one undo step (`UNDO_PARTS` / `REDO_PARTS`, 50 deep): adding, removing, turning, duplicating and moving;
typing a position is one step, a rename none, and opening a design clears the history. This is separate from the stone-edit
history of the editable stones.

## Dragging and aligning (B13, B14 for parts)

A part is dragged on the canvas by any of its stones (any tool except the pen): it moves by the pointer's travel, rounded to
0.1 mm, and one drag is one undo step (`END_PARTS_STEP` marks the ends). Each part, and the piece being worked on, can be lined
up with the rest by left edge, middle or right edge (`ALIGN_PART`, `ALIGN_WORKING`; no-op when alone or already there).

## Limits (next steps)

- A part is frozen: its text or artwork cannot be changed afterwards. Free-angle rotation, scaling, vertical alignment and snapping while
  dragging, turning and mirroring the piece being worked on, and one undo for everything (settings included) are the
  remaining parts of J15, B2, B3 and B13.
- Fit to mat resizes the piece being worked on, not the parts.
- The parts list is in the Design panel and is hidden while the Select tool is active.

## Verified

In the browser: a name kept as a part (168 stones), a second piece typed below it (200 stones in all, as the status bar says),
and both restored after a reload with the text of the second piece intact.


## Update 2026-11-22

- Turn by any angle (about the middle of the part; spacing is unchanged) and "spread out" (stones move apart about the middle and keep
  their size; never closer, so a part cannot be made to touch itself).
- Align top / middle / bottom as well as left / centre / right, for parts and for the piece being worked on.
- Dragging a part snaps its edges and middle to the edges and middles of the other pieces within 2 mm; hold Alt to move freely.
- "Edit the stones of this part" takes a part back as editable stones, only when there is no piece in progress (it would be
  mixed with it otherwise), and undoes in the parts history.
- The parts list also shows in the Select tool.
