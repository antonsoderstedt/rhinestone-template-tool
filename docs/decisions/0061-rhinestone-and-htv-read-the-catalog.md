# ADR 0061: Rhinestone and HTV read the template catalog

**Status:** accepted · **Date:** 2026-11-27

## Why

The catalog (ADR 0057) was only read by Papercraft. The owner wants the Rhinestone and HTV studios to offer the templates uploaded
for them in the admin panel too.

## Decisions

- **What each studio opens** (`app/lib/catalog/studioCatalog.ts`, `OPEN_FORMATS`):
  - **Rhinestone:** an **SVG** opens as artwork, exactly like an asset from the library (the SVG tool, after `validateAssetUpload`;
    the project takes the template's name), and a **`.rhinestone.json` project file** (the file “Save project file” makes) opens
    as a project through the same `applyProjectToEditor` as “Open project file”.
  - **HTV:** an **SVG** is added as a vector layer through the same import as a picked SVG (`handleImportFile`).
  - HTV has no design file format (its designs live in the browser's vault), so the admin panel now offers only SVG for HTV
    (`STUDIO_FORMATS.htv`). A test keeps the admin's list and `OPEN_FORMATS` equal.
- **A Rhinestone JSON template must be named `….rhinestone.json`** (what “Save project file” makes): only those are listed, and the admin panel refuses another JSON name for Rhinestone with a message that says so (a papercraft JSON is unaffected).
- **Only published templates of the studio's own kind with a file it can open** are listed; a draft, a template for another studio and
  a file of another type are not.
- **One component, two studios** (`app/components/CatalogTemplates.tsx`): a grid of pictures with a search box from six templates up.
  It fetches the list (`listCatalog({ studio })`) and, on a click, the file, and hands the `File` to the studio, which answers whether it
  could open it (“The template could not be opened.” otherwise). It renders nothing where there is no catalog or nothing published, so
  the static site and local development look as before. A `wrap` prop lets each studio put its own heading or panel section around
  it only when there is something to show.
- **Where:** Rhinestone: at the top of the “My Designs” panel (it closes when a template is opened). HTV: a “From the catalog”
  section in the tool panel, above “Workspace library”.
- **Opening a project replaces the design** and leaves the active “My Designs” entry empty, so a later save does not overwrite one of
  the owner's own designs. Opening is like “Open project file” and the asset links: no extra confirmation.
- **Counted:** each opening is a `catalog_template_used` event (label = template id, prop `kind` = file type) in the statistics (ADR 0060).

## Consequences

- A catalog SVG that has no shapes Rhinestone can use, or a project file that does not parse, is refused with the generic message.
- Not done: saving an HTV design as a catalog template (HTV would need a design file format first).
- Template names are shown as the owner wrote them, but the studio's Swedish text translator may still translate a name that equals a
  known English phrase (a template called “Heart” shows as “Hjärta”).

## Update: Save as a template from Rhinestone

- “Save as a catalog template” (a collapsed section in the My Designs panel, `app/editor/SaveCatalogTemplate.tsx`) puts the design on the screen in
  the catalog: the project (`serializeRhinestoneProject`, with the chosen name) as `<id>.rhinestone.json` and a small SVG picture of the stones
  (the same SVG the My Designs thumbnails use), plus details (studio, name, category, published, field `Made in: Rhinestone Studio`).
- **A new template every time**: the id comes from the name and never one that exists (`box`, `box-2`, …), so nothing is overwritten. A failed picture is
  reported (“its picture could not be saved”) but does not fail the save. A project over 20 MB (what the studio opens again) is refused.
- The list under “From the catalog” fetches again after a save. The section shows only where there is a catalog.
- What the studios share (`uniqueTemplateId`, `saveTemplateToCatalog`, the options and result types) is in `app/lib/catalog/saveTemplate.ts`;
  Papercraft's own saves keep their code and re-export `uniqueTemplateId`.
- Counted as a `template_saved` event with label `rhinestone` (ADR 0060).
