# ADR 0062: Site metadata settings

**Status:** accepted · **Date:** 2026-11-27

## Why

The owner wants to choose the title and the description of the site in the admin panel instead of in the code. Every page has had
the one title “Rhinestone Template Tool”, so several open studio tabs cannot be told apart. This is the third part of the admin
program (ADR 0057, 0060).

## Decisions

- **What can be set:** the site title (never empty, at most 70 characters), the description (at most 200; empty means no
  description tag) and an optional title for each of Rhinestone, HTV and Papercraft Studio (empty means: use the site title).
  Pages outside those studios (home, settings, admin) use the site title. Line breaks and runs of spaces are collapsed to one space.
- **Pure shared code** (`src/lib/siteMeta/siteMeta.ts`): `parseSiteMeta`, `metaFromStored`, `titleForPath` (uses `studioOfPath` from
  ADR 0060, so the studio is worked out the same way everywhere) and the defaults. `app/layout.tsx` takes its built-in title and
  description from the same defaults, so there is one source for “the original text”.
- **Server** (`worker/siteMeta.ts`; `worker/index.ts` routes `/api/site/*` and `/api/admin/metadata` to it; `/api/site/*` is added to
  `run_worker_first`): `GET /api/site/meta` (what a browser applies), `GET|PUT /api/admin/metadata`. Every route checks the Access
  token. The settings are one row in `site_settings` (key `metadata`), next to the tracking settings. A stored value that no longer
  passes falls back to the defaults.
- **Applied by the browser** (`app/components/SiteMetaManager.tsx`, `app/lib/siteMeta/siteMetaClient.ts`). The site is a static
  export, so the HTML always carries the built-in text; the manager asks `GET /api/site/meta` once per page load and sets the tab
  title and the description tag. The last answer is kept in `localStorage` and applied at once, so the title does not flash. The
  admin panel sends a window event after a save, so the open tab changes without a reload. A route change picks the title of the new
  page from settings already in memory.
- **Next puts its own title back.** On a hard load of a studio page the title came back to the built-in one when a late part of the
  page arrived. The manager therefore watches `<head>` with a `MutationObserver` and applies the owner's title again; setting the
  same title changes nothing, so it cannot loop.
- **Admin page** has a fourth tab, “Site text”, with the fields, a character count and “Use the original text”.

## Consequences

- Only the browser tab title and the description are changed, and only after the page has loaded. Nothing that reads the HTML
  without running scripts (a link preview, a search engine, a “view source”) sees the new text. The site is behind Cloudflare Access,
  so such readers get the login page anyway. If the site is ever made public, the Worker would have to rewrite the HTML (for
  example with `HTMLRewriter`), which needs every page to go through the Worker; that is a separate decision.
- A browser on a site without the Worker (GitHub Pages, `next dev`) keeps the built-in text, as with tracking.
- Anyone who passes Cloudflare Access can change the text, as for the catalog (ADR 0057).
- **Not part of this decision: a social picture (Open Graph image).** It needs an upload and, to be of any use, HTML that is
  rewritten per request, for the same reason as above.
