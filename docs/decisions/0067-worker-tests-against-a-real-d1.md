# ADR 0067: Worker tests against a real D1

**Status:** accepted · **Date:** 2026-11-28

## Why

The Worker tests (`tests/worker*.test.ts`, `tests/library*.test.ts`, `tests/siteMeta.test.ts`) use a database that records what is asked
and answers from a script. They check that the Worker asks for the right thing, but a database that never executes the SQL cannot
catch a wrong column name, a bad `ON CONFLICT`, a `batch` that does not hold together, or text that is not returned in order. Every
one of those would only show on the live site.

## Decisions

- **`tests/workerRealD1.test.ts` runs the whole Worker on a real D1.** `worker/index.ts` is called with real `Request`s (the same
  routing as in production) and a D1 binding from Miniflare (`miniflare`, a dev dependency): SQLite in the same runtime Cloudflare
  uses, in memory, one database per test file. It needs no login, no network and no account, so it runs in CI like every other test.
- **What it covers**: Access (every route refuses without a token or configuration); sync (write, list, older write refused,
  a 700,000-character text in three chunks returned whole and in order, replaced by a shorter one, deleted, settings not deletable);
  the catalog (details, a chunked file, update in place, unpublished hidden from visitors, no move between studios, a delete that
  takes its chunks); the libraries (uploaded design and font stored and served, a patch that keeps the earlier fields, a row that says
  nothing removed, an upload deleted with its chunks and overrides, a built item not deletable); site text (stored, a bad stored
  value falls back to the default); statistics (events stored, counted per studio, pruned by retention, cleared, nothing stored when
  switched off); and that all nine tables exist.
- **It has teeth.** Reversing the chunk order in `worker/sync.ts` fails the new test; the old recording test did not notice.
- **The old tests stay.** They are fast and check exactly which statements are asked and with what; the new ones check what the
  statements *do*.
- **Dev dependency hygiene.** Miniflare pins an older `undici` and `sharp` with advisories. Both are raised with `overrides` in
  `package.json` (`sharp` 0.35.5, `undici` 7.30.2 under Miniflare) so `npm audit` stays at 0 (ADR 0066). They are test tooling only and
  are never part of the site.

## Not covered

- Cloudflare's own D1 (the network service) is not used, so its limits (statement size, row size, query time) are not exercised by a
  test; the 300,000-character chunks (ADR 0057) were chosen with them in mind and have worked on the live site.
- The Access check with a real signed token is covered by `tests/workerAccess.test.ts`, not here.
- CPU time (10 ms on the free plan) is not measured.
