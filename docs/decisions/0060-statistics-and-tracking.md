# ADR 0060: Statistics and tracking

**Status:** accepted · **Date:** 2026-11-27

## Why

The owner wants to see how the private site is used (which studios, which exports, which catalog templates) and to be able to
connect Google Analytics 4 and Google Tag Manager. This is the second part of the admin program (ADR 0057).

## Decisions

- **Two independent things.** Own events go to the private D1 database and are shown in the admin panel. Google Analytics 4 and
  Tag Manager are optional and switched on by an id the owner types in the admin panel. Either, both or neither can be on.
- **Settings live on the server** (table `site_settings`, key `tracking`), not in the build, because the site is a static export and
  an id must be changeable without a deploy. A browser asks `GET /api/track/config` once per page load. Where there is no Worker
  (GitHub Pages, `next dev`) the app is built without `NEXT_PUBLIC_SYNC_ENABLED=1` and tracking does not run at all.
- **Server** (`worker/track.ts`; `worker/index.ts` routes `/api/track/*` and `/api/admin/{tracking,stats,events}` to it; `/api/track/*`
  is added to `run_worker_first`): `GET /api/track/config`, `POST /api/track/event`, `GET|PUT /api/admin/tracking`,
  `GET /api/admin/stats?days=`, `DELETE /api/admin/events`. Every route checks the Access token.
- **Pure shared code** (`src/lib/tracking/trackingConfig.ts`): the settings, id patterns, event validation, `studioOfPath`. The Worker
  and the browser both use it, so what the browser builds is what the Worker accepts.
- **An event** is `{ name, path, label, props, session }`. `name` is snake_case (max 40); `path` has no query or hash; `label` is one
  short value to count by (the file type of an export, the id of a template); `props` has at most 8 keys of small strings, numbers or
  booleans; `session` is a random id made per browser tab (`sessionStorage`). The Worker adds the time, works out the studio from the
  path (a browser cannot claim a studio), and stores the signed-in person as the first 8 bytes of a SHA-256 hash (to count people).
  **No IP address, no user agent, no names or e-mail.** At most 20 events and 16,000 characters per request.
- **What is recorded** (`app/lib/tracking/track.ts`): `page_view` on every route change (not in `/admin`), `export` on each download
  (label = file type; Rhinestone, HTV, Papercraft, the drawing tool), `catalog_template_used` (label = template id; prop `kind`) and
  `template_saved` (label `design` or `drawing`). Adding an event is one `track(...)` call.
- **Delivery** (`tracker.ts`): events wait until the settings have arrived (at most 50), are sent in batches every 3 seconds and when
  the page is hidden (`fetch` with `keepalive`), and failures are ignored.
- **Google** (`thirdParty.ts`): GTM is loaded as Google's snippet does (`gtm.start`, then `gtm.js`); GA4 with `gtag` and
  `send_page_view: false`, because the app never reloads the page and page views are sent by us. With a GA4 id events go to `gtag`; with
  only a GTM id they are pushed to the `dataLayer` as `{ event: <name>, ... }`. If both ids are set, the owner must not also add a GA4
  tag in Tag Manager (the admin panel says so). Ids are checked against patterns (`G-…`, `GTM-…`) before they go into a script URL.
- **Privacy:** a browser that sends Do Not Track or Global Privacy Control is not counted anywhere (own database or Google) while
  “Respect Do Not Track” is on (the default). Google, if switched on, receives the page address, the events and the IP address like
  on any site; the admin panel warns about this. Own events older than the retention (default 180 days, 7–730) are deleted, at most
  once an hour, by the Worker when an event arrives or the statistics are opened. “Delete all events” empties the table.
- **Statistics** are counted by the database (`COUNT`, `COUNT(DISTINCT)`, `GROUP BY`), never by parsing rows in the Worker (10 ms of
  CPU on the free plan): totals, per day, by event, by studio, most opened pages, and most used labels. The admin page shows them
  with a plain bar chart (no chart library).
- **Admin page** has three tabs: Templates (ADR 0057), Statistics and Tracking.

## Consequences

- Anyone who passes Cloudflare Access can read the statistics and change the settings, as for the catalog (ADR 0057). If a second
  person is ever let in, an allow-list for `/api/admin/*` is needed first.
- Counts are per browser tab (a visit) and per login (a person), not per device; a person who opens two tabs is two visits.
- The page-view events of a person using an ad blocker are lost on the Google side but still counted in the own database, since the
  own endpoint is on the same site.
- Not part of this decision: metadata settings (title, description, social picture), a consent banner (the site is private and the
  owner chooses what to switch on), and events seen in a real Google account (needs the owner's ids).
