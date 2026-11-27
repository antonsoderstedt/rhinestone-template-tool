# ADR 0063: Curating the design and font libraries

**Status:** accepted · **Date:** 2026-11-28

## Why

The design library (about 2,650 ready stone layouts) and the font library (about 1,370 fonts) are built on the owner's computer
(`npm run import:designs`, `npm run build:fonts`) and published as static files with `npm run deploy:cloudflare:libs`. The files are
licensed and never in the repository. Until now the only way to remove a bad design, rename one, or keep a font out of the pickers
was to rebuild and deploy. This is the fourth part of the admin program (ADR 0057, 0060, 0062).

## Decisions

- **The files are not touched.** What the admin panel changes is an *overlay* kept in the database: an item can be **hidden**, and
  its **name** and **category** can be changed. An item without a row is exactly as the library was built. A row that is back to
  normal (not hidden, no name, no category) is deleted, so the table holds only what the owner has changed.
- **Pure shared code** (`src/lib/library/library.ts`): validation of a change (`parsePatch`, `parseIds`), the overlay type,
  `patchOverlay` (the same rule the Worker applies, so the admin list can update without a reload) and `applyDesignOverlay` /
  `applyFontOverlay` (what the studios do with the lists).
- **Server** (`worker/library.ts`; `worker/index.ts` routes `/api/library/*` and `/api/admin/library/*`; `/api/library/*` is added to
  `run_worker_first`): `GET /api/library/overlay` and `PUT /api/admin/library/overrides` with `{kind, ids, patch}`. A patch holds
  only the fields that change, and a request covers 1–200 ids, so “hide these 600 designs” is three requests (the client splits it).
  Names are at most 120 characters, categories 60, and line breaks and runs of spaces are collapsed. Every route checks the Access token.
  Table `library_overrides (kind, id, hidden, name, category, updated_at)`.
- **The studios apply it** when they list a library, asking `GET /api/library/overlay` once per page load
  (`app/lib/library/libraryClient.ts`; where there is no Worker the answer is empty and the library shows as it was built):
  the design collection picker (`DesignCollectionPicker.tsx`), the font catalog loader (`FontCatalogLoader.tsx`) and the font page.
  A hidden design is left out of the list; the owner's title and category are shown instead of the library's own.
- **A hidden font is not removed from the engine.** A saved design or project stores a font id; if hiding a font made that id
  unknown, the text would silently switch to the default font. So `setFontCatalog` takes a `hidden` flag: `listOutlineFonts()` (what
  the pickers list) leaves hidden fonts out, while `getOutlineFontDefinition()` (how an id is resolved) still finds them. This is a
  change to the font registry, not to the text-outline algorithm.
- **Admin page**: a fifth tab, “Libraries”, with Designs and Fonts. A list of 50 rows a page with search, category and status filter
  (all / visible / hidden / changed by me), selection of a page or of everything found, and bulk Hide / Show / Reset / Set category.
  A row can be edited inline. The lists are read from the library's own `index.json` / `catalog.json`; where there is no library the
  tab says so.

## Consequences

- A change reaches a browser the next time a page is opened (the lists are fetched once per page load). Nothing is cached.
- The font a person has already chosen in an open editor stays chosen if it is hidden afterwards, but it is no longer in the list of
  fonts to pick from.
- Renaming a font changes only its display name; designs refer to the font by id, so nothing saved breaks.
- Anyone who passes Cloudflare Access can change the overlay, as for the catalog (ADR 0057).
- **Not part of this decision:** uploading new designs and fonts (next part), and deleting an item from the library (that is a
  rebuild of the library on the owner's computer).
