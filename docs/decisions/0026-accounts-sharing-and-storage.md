# ADR 0026: Accounts, sharing and where designs are kept

**Status:** accepted · **Date:** 2026-11-22 · **Plan items:** F1, F4, F5, F6 (revisits ADR 0008)

## Decision

- **No accounts and no cloud sync (F6).** ADR 0008 stands. The product has no server and holds no one's data; an account would
  mean storing other people's designs, privacy duties and running costs, for a need that backups, a share link and the project
  file already cover. Revisit only if people ask to use one design on several computers every day.
- **Storage stays localStorage, with a warning (F1).** Moving to IndexedDB is a data migration with its own risks. The things
  that go wrong are handled instead: the Designs page shows how full the storage is and warns at 80 % and 95 %, the browser is
  asked to keep the site's data (`navigator.storage.persist`), a backup reminder runs (F3), and the previous-session copies are
  limited (F2). If a real quota failure shows up in use, IndexedDB is the next step.
- **Share link (F4):** the project file, compressed (deflate) and made URL-safe, goes after `#share=` in the address. The browser
  never sends the part after `#` to a server, so nothing is uploaded or stored; whoever opens the link gets their own copy
  (opened as unsaved, the previous work is kept as a previous-session copy). A design whose link would be longer than 60,000
  characters is refused with advice to send the project file. Generated designs are a few hundred characters.
- **Version history (F5):** each time a save replaces an earlier version, that version is kept (5 per design, newest first,
  not twice in a row, not if it is over 150,000 characters of project JSON). Going back first keeps what is open now as a
  version. They live in localStorage next to the design.
