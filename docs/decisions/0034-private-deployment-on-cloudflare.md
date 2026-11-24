# ADR 0034: A private deployment on Cloudflare (Workers static assets + Access)

**Status:** accepted · **Date:** 2026-11-24

## Why

The studio is used by one person, from several computers and a phone. The design collection and the font library are that person's
licensed files and must not be public (the GitHub Pages site is public). Browser-only storage cannot serve a phone or a second
computer, and GitHub Pages cannot be password protected on a normal account.

## Decision

- Host the static export on **Cloudflare Workers static assets** (Cloudflare's recommended route for static sites; free plan: 20,000
  files per version, 25 MiB per file; the app plus both libraries are about 4,500 files).
- Protect the site with **Cloudflare Access** (Workers > Settings > Domains & Routes > workers.dev > Enable Cloudflare Access), with a
  policy that allows only the owner's email (one-time PIN). Access is switched on and checked **before** the libraries are uploaded.
- `scripts/deploy-private.sh` (`npm run deploy:cloudflare`, `npm run deploy:cloudflare:libs`) builds in a temporary copy (the working
  folder is untouched), optionally adds `public/design-library` and `public/font-library`, and runs `wrangler deploy`. Without
  `--with-libs` nothing licensed is uploaded.
- The static build leaves out the routes a static site cannot serve (ADR 0032); the font and design libraries are plain files plus a
  catalog, so no server code is needed.

## Consequences

- The libraries are only on Cloudflare behind Access and on the owner's machine, never in the repository.
- Saved designs and settings still live in each browser's storage; syncing them across devices is a separate step.
- `workers.dev` preview URLs stay off (the default with current Wrangler), so there is one address to protect.
