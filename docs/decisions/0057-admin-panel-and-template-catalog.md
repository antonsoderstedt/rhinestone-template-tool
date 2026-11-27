# ADR 0057: The admin panel and the template catalog

**Status:** accepted · **Date:** 2026-11-26

## Why

The owner wants one place to upload and manage the templates the studios use (Rhinestone, HTV, Papercraft), and later to see
statistics, add tracking and keep metadata. Until now a template is either built into the app or imported by hand in each browser.
This is a program of several parts; the first part, decided with the owner, is **the template catalog**.

## Decisions

- **Who may use it:** only the owner. The private site is already behind Cloudflare Access (ADR 0034) and the Worker verifies the
  Access token (ADR 0035), so the Access policy decides who gets in, and anyone who passes is an admin. There are no roles or
  accounts of our own. If a second person is ever let into the site, a separate allow-list for `/api/admin/*` must be added first.
- **One catalog for the site, not per user** (unlike synced items, which are per owner): the studios of every signed-in device read
  the same published templates.
- **Server** (`worker/catalog.ts`; `worker/index.ts` routes `/api/catalog/*` and `/api/admin/*` to it; both are added to
  `run_worker_first` in `scripts/deploy-private.sh`):
  - `GET /api/catalog/templates[?studio=][&all=1]` – the details of the templates (published only, unless `all=1`).
  - `GET /api/catalog/file?id=&part=file|preview` – one file, raw.
  - `PUT /api/admin/template` – JSON details (studio, format, name, description, category, tags, licence, own `fields`, `published`).
  - `PUT /api/admin/file?id=&part=&name=&type=` – the file as text.
  - `DELETE /api/admin/template?id=` – the template and its files.
- **Storage:** D1, as for the sync (no R2 needed): `catalog_templates` (the details and the name/type/size of the file and of a small
  picture) and `catalog_chunks` (the file as text in chunks of 300,000 characters). The Worker never parses a file (10 ms of CPU on
  the free plan). A text format (OBJ, SVG, JSON, DXF) is stored as it is; a binary one (PDF, PNG, JPG) is sent as base64 by the browser
  (`app/lib/catalog/catalogFormat.ts`). Limits: 30,000,000 characters per file, 1,500,000 for the picture.
- **Details are small JSON and are validated** (`parseDetails`): id `a-z0-9._-` (max 80), a known studio, a format of 1–12
  letters/digits, a name, at most 20 tags and 30 own fields. A template cannot move to another studio. The id is chosen once.
- **Publishing:** a draft is only visible in the admin panel. A template can be published only when it has a file.
- **Own metadata:** free key/value `fields` per template (source, designer, difficulty, finished size, …) next to the fixed
  category, tags and licence.
- **Admin page** (`/admin`, a static client page like the others): list with search and studio filter, a picture per row, publish /
  edit / delete, and a form with file and picture upload. Where there is no catalog (GitHub Pages, `next dev`) the page says so.
- **Papercraft reads the catalog** (added): the Model panel has a “From the catalog” section (`app/papercraft/CatalogModels.tsx`) with the published Papercraft templates that have an OBJ, STL or GLB file; a click fetches the file and runs it through the same import as a file the person picked. It renders nothing where there is no catalog or nothing published.
- **Rhinestone and HTV read the catalog** (added, ADR 0061). **Statistics and tracking** are ADR 0060.
- **Not in this part, planned next:** metadata settings, and managing the other content (designs, fonts, library).

## Consequences

- Deleting a template is permanent (the owner is asked to confirm).
- A catalog file larger than about 29 MB (21 MB as binary) is refused.
- The static build still works without the Worker: nothing outside `/admin` asks the catalog yet.
