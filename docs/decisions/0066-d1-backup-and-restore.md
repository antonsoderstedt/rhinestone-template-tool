# ADR 0066: Backing up and restoring the database, and keeping Next up to date

**Status:** accepted · **Date:** 2026-11-28

## Why

Everything the owner has made on the private site lives in one Cloudflare D1 database (`rhinestone-sync`): synced designs, the template
catalog, uploaded designs and fonts, site text, tracking events. There was no routine for getting it back after a mistake (a wrong
`DELETE`, a bad upload, a deploy that changed a table). The same audit found that the app ran Next 16.2.10, which `npm audit` marked
critical (fixed in 16.4.6), and several high-severity dependencies.

## Decisions

- **Two layers of backup.**
  1. *Cloudflare Time Travel* is already on for every D1 database: it restores the whole database to any minute of the last 30 days
     (7 on the free plan). It is the first choice for "undo what happened this morning":
     `scripts/backup-d1.sh timetravel` shows the current bookmark, and
     `npx wrangler d1 time-travel restore rhinestone-sync --timestamp=<time>` goes back to a time. Nothing to set up.
  2. *A file on the owner's computer*: `npm run backup:d1` writes `backups/rhinestone-sync-<UTC time>.sql` (`wrangler d1 export`,
     read-only on the live database) and keeps the newest 20. The folder is git-ignored: it holds the owner's data and must never be
     committed. This survives losing the Cloudflare account or the time window, and can be opened in any SQLite tool.
- **A backup file is restorable only after a rewrite** (`scripts/d1-restore-sql.mjs`, pure and tested). D1's export creates tables but
  does not drop them, and writes each 300,000-character text chunk (ADR 0057/0063) as one `INSERT`, which D1 and SQLite refuse
  (about 100 KB per statement). The rewrite puts `DROP TABLE IF EXISTS` for every table first and turns every long `INSERT` into a short
  `INSERT` plus `UPDATE … SET col = col || '…'` statements of at most 60 KB, cutting only between characters and never inside a
  doubled quote. Statements are found by scanning for a `;` outside quotes, so a line break in a text value does not matter.
- **Restore is deliberate**: `scripts/backup-d1.sh restore FILE --yes` refuses without `--yes` or on a file with no tables, takes a
  fresh backup of the current data first, then runs the rewritten file against the live database. Restoring replaces every table in
  the file.
- **Tested for real, but not on the live database.** The export of the live database was restored into a local D1 twice (so a restore
  over existing data was covered) and every row came back, every long text equal to the original down to the byte. Restoring into the
  *live* database was not run, by design; the safety backup and `--yes` are there for the day it is needed, and Time Travel is the
  tried path for production.
- **Next 16.4.6** (exact version, as before) and `npm audit fix` for the rest: 0 vulnerabilities left. Type check, the unit tests (2,841)
  and the static build were run, and the three studios were opened on the local Worker with no console errors.

## Not done

- No scheduled backup. A scheduled Worker could export to R2, but it needs a bucket and a token the owner has to create; the owner
  can run `npm run backup:d1` by hand or from a calendar reminder. The Time Travel window covers the gap in the meantime.
- The remote restore of a file is untested against the live D1 (see above).
