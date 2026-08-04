# ADR 0003 — Letter Asset Scan Pipeline

Date: 2026-08-02

## Context

The project now depends on a growing local asset library under `~/Desktop/LETTER UTVALDA/`.
That library contains top-level folders, extracted package directories, and duplicate zip archives.
The current app registries are curated by hand, which does not scale once the user starts adding more desktop asset packs.

We need a deterministic first-pass ingest pipeline that can answer three simple questions before any UI or registry expansion work:

1. Which packages are present?
2. Which packages look duplicated?
3. Which packages appear to contain OpenType rhinestone fonts, SVG alphabets, or both?

## Decision

Add a scan-only pipeline that reads the three known LETTER UTVALDA source roots:

- `FONT GENERATED CHATGPT`
- `TEXT FONT TEMPLATE`
- `Rhinsestont font library`

The pipeline writes a JSON report with one summary per top-level package plus duplicate groups derived from normalized package names.

Important constraints:

- The scan is read-only.
- Zip archives are not unpacked automatically.
- Archive entries are classified from their names only.
- The scan does not auto-register new assets in app registries.
- Human curation still decides which packages become first-class product assets.

## Consequences

- We get a repeatable inventory and duplicate report without mutating the user's library.
- We can build a registry curation workflow from the generated manifest instead of manually comparing desktop folders.
- Zip archives remain intentionally shallow until we decide whether archive inspection is worth the added complexity.
- The next step after this ADR is a curation/import layer, not direct runtime auto-discovery.