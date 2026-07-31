# ADR 0002 — Integrating the LETTER UTVALDA library

Date: 2026-07-31

## Context

The user's `~/Desktop/LETTER UTVALDA/` folder contains three tiers of source material:

1. **`Rhinsestont font library/`** — seven curated rhinestone OpenType packages, each with SS6 and SS10 variants (Blessed, Bride, Real, Old English, Outline, Small Line, Huge Numbers). **Already integrated** into the tool as first-class Stone Font sources.
2. **`FONT GENERATED CHATGPT/`** — 11 complete rhinestone alphabet packages (F1 Forever, F2 Cheer, F4 Real, F5 Bride, F6 College, F7 Huge Digits, F11 Big Bold, F14 Line Font, F20 Collage Line, F21 Collage Outline, F23 Alphabet Design). Each package ships:
   - A per-package OpenType font (e.g. `RS02 AW Atletico Bold.otf`) sized for real rhinestone use
   - A combined SVG alphabet (`SVG_Alphabet02_All.svg` + per-case SS10 SVGs)
   - Cricut/Silhouette/EPS/PDF/DXF exports
3. **`TEXT FONT TEMPLATE/`** — 13 additional rhinestone template packages (F10 Retro, F12 Broadway, F17 Toys, F18/F30 Disney, F19 Birthday, F24 Retro Wide, F26 Small Line, F28 Scoreboard, F31/F32 Varsity 3-Color, plus Huge Letter and Monogram specials). Similar structure but with preview JPGs and often just zip archives at the top.

Currently only tier 1 is wired into the engine. Tiers 2 and 3 hold approximately **24 unused, licensed, engine-ready assets**.

## Decision

Integrate LETTER UTVALDA in three staged deliveries, from lowest effort/highest value to highest effort:

### Stage A — Register more OpenType rhinestone fonts (small effort, immediate value)

For each package in `FONT GENERATED CHATGPT/` and `TEXT FONT TEMPLATE/`, unzip if needed, then register the `.otf`/`.ttf` file as a new entry in `rhinestoneFontRegistry.ts`. This reuses the existing Stone Font pipeline with zero new engine code.

Priority order (based on rhinestone-community popularity):

| Font ID | Source | Style | Sample |
|---|---|---|---|
| `atletico-real` | F4 REAL / `RS02 AW Atletico Bold.otf` | Block | REAL2026 |
| `cheer-block` | F2 CHEER | Block | CHEER |
| `college-varsity` | F6 COLLEGE | Varsity | COLLEGE |
| `big-bold` | F11 BIG BOLD | Block | BOLD |
| `broadway-retro` | F12 BRODWAY | Retro | BROADWAY |
| `line-font-line` | F14 LINE FONT | Line | LINE |
| `retro-wide` | F24 RETRO WIDE | Retro | RETRO |
| `scoreboard-digits` | F28 SCOREBOARD | Digits | 2026 |
| `disney-script` | F18/F30 DISNEY | Script | Disney |
| `birthday-script` | F19 BIRTHDAY | Script | Happy |
| `toys-bubble` | F17 TOYS | Bubble | TOYS |
| `monogram-special` | xx-MONOGRAM | Monogram | ABC |

Each entry reuses the existing per-size file variants pattern from ADR-implicit work (see `libraryRelativePathBySize`), extended for SS6 where applicable. Category `'Library'`, `isPrivate: true` (non-distributable).

**Effort**: ~2 hours per batch of 4 fonts. Tests: extend `rhinestoneFontSystem.test.ts` with one probe per new font id.

### Stage B — SVG Alphabet source type (medium effort, opens new usage patterns)

Add a new Design Source alongside Text, Stone Font, SVG, Import Template, Grid, Manual:

- **Name**: **SVG Alphabet**
- **UI**: Dropdown of registered alphabets → letter buttons `A-Z 0-9` → the tool composes clicked letters into a horizontal string of stones. Each letter is picked from a curated per-letter SVG glyph.
- **Engine**: Reuse the existing SVG parser to extract circles from the raw glyph SVG (each glyph SVG already contains `<circle>` elements). No new fill/outline algorithm needed — the glyph IS the placed stones.
- **Layout**: Reuse `layoutRhinestoneFontText` glue: horizontal advance = glyph bounding box width + `letterSpacingMm`. Vertical baseline = glyph bottom.

Each alphabet becomes an entry in a new `svgAlphabetRegistry.ts`:

```ts
{
  alphabetId: 'f4-real',
  displayName: 'Real (College SVG)',
  category: 'Varsity',
  glyphSvgBySize: {
    SS10: 'FONT GENERATED CHATGPT/F4-REAL-ALPHABET/F4-COLLEGE-FONT-REAL/SVG/SVG_Alphabet02_ss10_uppercase_1.svg',
    SS10Numbers: '.../SVG_Alphabet02_ss10_number.svg',
  },
  supportedTargetStoneSizeIds: ['SS10'],
  characterCoverage: { uppercase: true, lowercase: false, digits: true, swedish: false },
}
```

The SVG_Alphabet02_All.svg format packs all letters into one file with per-letter `<g id="A">` groups. The engine splits by group id and lays them out.

**Effort**: ~1 day for the new source type + parser + layout + UI panel. Tests: extend engine with `svgAlphabetTemplate.test.ts` covering split-by-group-id, per-letter stone counts, deterministic output.

### Stage C — Alphabet browser UI (larger effort, best UX polish)

Grid preview showing every registered alphabet as an image (there are already preview JPGs like `preview-SS10.png`, `rhinestone-college-font-real-letters-1.jpg`). User clicks a preview → alphabet becomes active in the SVG Alphabet source.

**Effort**: 1-2 days including preview asset resolution, thumbnail caching, keyboard nav. Ships as a modal that replaces the current dropdown.

## Alternatives considered

- **Ship everything at once**: high risk of registry-file bloat and untested edge cases per font. Rejected in favor of stage-by-stage delivery.
- **Auto-scan the library folder at startup**: convenient but non-deterministic (folder contents can change), and puts unaudited fonts in front of users. Rejected — every asset must be an explicit registry entry with licence attribution.
- **Convert SVG alphabets to OpenType fonts server-side**: adds a font-generation build step and loses per-letter SVG fidelity. Rejected — the raw SVGs are already Cricut-ready.

## Consequences

- Users get access to the full 30+ curated rhinestone alphabets that already exist in their library.
- Stone Font list grows from 7 library fonts to ~19 library fonts after Stage A.
- New "SVG Alphabet" source type (Stage B) makes the second folder tier addressable without pretending they are OpenType fonts.
- No engine algorithm changes — everything reuses the pure-function extraction and layout code already in `src/lib/rhinestone-engine/`.
- Licence: every asset stays flagged `isPrivate: true` and non-distributable per existing convention; no assets are copied into the repo.

## Status

Proposed. Stage A is next up (small, low-risk font-registry expansion). Stage B and Stage C follow if the added assets are used enough in practice to justify a new source type.
