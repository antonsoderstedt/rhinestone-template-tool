# ADR 0041: Saving, sharing and syncing Papercraft models (phase 5)

**Status:** accepted · **Date:** 2026-11-26 · Builds on ADR 0035 (sync) and ADR 0038 (the studio).

## Why

Until now the studio forgot everything on reload, and a model could not be kept, found again in My Designs, sent to a friend or opened on a
phone.

## Decision

- **A saved model is a design in the workspace vault** (`papercraftDesigns`, next to the HTV designs): the model (a built-in model's id, or an
  imported mesh as flat lists of numbers kept to seven digits), the size, the paper, the tab settings, the edges cut or joined by hand, the
  cover choice and the name. Not the view, the selection or the fold amount. `serializePapercraft` / `deserializePapercraft` are the only way in and
  out, and `deserializePapercraft` is strict about the shape (it refuses anything it cannot open: an unknown built-in model, a damaged mesh,
  indices out of range) and brings numbers out of range into range. The vault drops saved entries it cannot open when it is read.
- **Save is explicit** ("Save to My Designs", in the Save section and the top bar), like the HTV studio, and a dot says there are unsaved changes. Choosing another model or
  importing a file starts a *new* design, so a save never overwrites the one that was open by mistake.
- **The work in progress is kept as a draft** (not synced, not a saved design) and comes back when the studio is opened again; a draft that was a saved
  design is that design only while it still exists. `?designId=` opens a saved design and wins over the draft.
- **Earlier versions:** the version that a save replaces is kept (the last five per design, in this browser, not synced, not kept when over 200 000 characters), and
  "Open this version" brings it back as unsaved changes (the one that was open is kept as a version first). Same rules as the Rhinestone studio.
- **A link to a model** (`/papercraft#share=...`): the whole design deflated and made URL-safe, in the part after `#` that is never sent to a server, so nothing is
  uploaded. Opening it gives a new, unsaved copy. A link over 60 000 characters is refused (an imported model is usually too big: save it and let sync carry it).
- **Sync** gets a kind, `papercraft` (the app's list of kinds and the Worker's): the same plan as every other saved item (newest wins, tombstones). A design from
  another device is accepted only if the studio can open it, and an older build that does not know the kind ignores it (the guard of ADR 0035). A mesh is chunked like
  any big item. The limit of what is saved is 12 000 faces and 450 000 numbers, far above the studio's own 3 000 face limit for unfolding.
- **My Designs, the home page and the backup** know the models: a Papercraft filter, a card with a picture of the model (drawn from the model itself as a small SVG), rename,
  favourite, archive and delete with undo; "Pick up where you left off" on the start page; the backup file has an optional `papercraftDesigns` list (older backups read as before; a damaged
  entry is skipped and counted).

## Consequences

- The vault is one localStorage item and an imported model can be a few hundred kilobytes: saving says so when the browser has no room left, and offers no partial save.
- Versions and the draft are per browser; only the design itself moves between devices.
- Two devices editing the same design: the newest save wins (no merge), as for every other kind.
