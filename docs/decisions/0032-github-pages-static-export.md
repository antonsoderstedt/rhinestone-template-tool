# ADR 0032: Publishing on GitHub Pages as a static export

**Status:** accepted · **Date:** 2026-11-24

## Why

GitHub Pages was set to "deploy from branch", which publishes the repository's files as they are, so only the README showed. A
Next.js app has to be built first, and Pages can only serve static files, under `/<repo-name>/`.

## Decision

- `.github/workflows/pages.yml` builds with `GITHUB_PAGES=true` and publishes `out/` (Settings > Pages > Source = GitHub Actions).
  It runs on pushes to `main` (the `github-pages` environment only accepts `main`) and by hand.
- `next.config.ts` turns on `output: 'export'`, `trailingSlash` and unoptimised images only when `GITHUB_PAGES=true`, and sets
  `basePath` from `NEXT_PUBLIC_BASE_PATH`. Dev and a normal server are unchanged.
- Next adds the base path to its own links, not to addresses the app builds itself. Those go through `withBasePath()`
  (`src/lib/rhinestone-engine/deploy/basePath.ts`): font and alphabet URLs, garment photos and 3D models, the design collection,
  the font manifest, share links and the two `location` redirects.
- The outline-font route lists its fonts with `generateStaticParams` and is written out as files at build time. The rhinestone-font
  and SVG-alphabet routes read libraries from the machine and use query strings, so `scripts/prepare-pages-build.mjs` leaves them
  out of the CI build; the app already treats a missing library as "not available on this deployment".

## Consequences

- The published site has the studios, the bundled outline fonts, shapes and mock-ups. It has no imported font library, letter
  alphabets or design collection: those live on the user's machine and are not in the repository (and are licensed files).
- Users' designs stay in their own browser (localStorage), so the site has no accounts or shared storage.
- The site is public because the repository is.
