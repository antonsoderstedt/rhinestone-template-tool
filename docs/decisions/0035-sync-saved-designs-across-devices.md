# ADR 0035: Syncing saved designs between devices

**Status:** accepted · **Date:** 2026-11-24

## Why

Saved designs live in each browser's localStorage, so a second computer or a phone starts empty. The private deployment
(ADR 0034) already has one signed-in user and a Worker, so the saved work can follow the user.

## Decision

- **What is synced**, item by item, each with an id and an `updatedAt`: saved templates (My Designs), files in the Library, saved HTV
  designs and calibration profiles. Not synced yet: settings, font choices and uploaded fonts (no change times), and the autosave.
- **Server** (`worker/`): a Worker that only receives `/api/sync/*` (`run_worker_first`), with a D1 database: `items`
  (owner, kind, id, updated_at, deleted) and `chunks` (the data as text in pieces of 300,000 characters, so an item of several MB fits
  a row). Data is never parsed in the Worker (the free plan allows 10 ms of CPU). A deletion is kept as an item without data (a
  tombstone). `PUT` refuses an older version (409).
- **Who may use it**: Cloudflare Access already stops visitors; the Worker also verifies the `Cf-Access-Jwt-Assertion` token
  (RS256 signature against the team's keys, audience, issuer, expiry) and keeps each user's rows apart (owner = token subject). It
  fails closed if `TEAM_DOMAIN` / `POLICY_AUD` are missing. `ALLOW_UNAUTHENTICATED` exists for local development only.
- **Client** (`app/lib/sync/`): `planSync` compares three views per item (this device now, the server, and what this device had at the
  end of its last sync) and decides push, pull, delete here, or delete there. The newer `updatedAt` wins; a deletion beats an older
  edit and an edit made after a deletion beats the deletion. `SyncManager` runs a round on load, when the tab is shown, when back
  online, every minute and a few seconds after something is saved (it watches the size of the two stores). A Web Lock keeps tabs from
  syncing at once. A site without the API (GitHub Pages, `next dev`) answers 404 and the sync stays off, with nothing shown.
- A small status pill shows "Synced hh:mm" and syncs now when clicked.

## Consequences

- Two edits of the same item on two devices between syncs: the later one wins and the other is lost (no merge).
- The free D1 and Workers plans are enough for one user; a very large library (tens of MB of images) syncs slowly the first time.
- `scripts/deploy-private.sh` needs `.env.cloudflare` (git-ignored) with the team domain and the Access application's AUD tag, and creates
  the database `rhinestone-sync` on first deploy. `--dev` runs everything locally (no login, local database).
