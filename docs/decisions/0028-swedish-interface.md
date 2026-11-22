# ADR 0028: Swedish interface

**Status:** accepted · **Date:** 2026-11-22 · **Plan item:** A9

## Decision

- Two languages, English and Swedish, chosen with a switch (top bar, status bar of the Rhinestone studio, and kept in this
  browser). `<html lang>` follows the choice.
- **`t('English text')`** (`useT()` in `app/lib/i18n.ts`) looks the English text up in `app/lib/i18n/sv.json`. A text with no
  Swedish entry shows in English. `{name}` in a text is replaced by a value.
- **A test** (`tests/i18n.test.ts`) fails if a `t('…')` in the source has no Swedish entry, if an entry is empty, or if the
  `{values}` of the English and the Swedish differ.
- **A safety net** (`DomTranslator`, `lib/domTranslation.ts`): texts that are not written through `t()` (labels in data tables,
  messages made far from a component, engine texts) are translated when shown, by exact match on the whole text, plus a few
  sentence patterns with numbers. It never touches text fields, `<textarea>`, or anything marked `data-no-translate`.
- The codemod that wrapped the texts only changed whole sentences. A sentence with `<strong>` or a link inside was left alone
  or rewritten as plain text, because cutting it into pieces gives bad Swedish.

## Not translated

The engine's messages that are built from numbers in code (some export-readiness issue texts), file names, the fonts' own names,
and a few mixed sentences. They show in English. mm / inch: one switch for the whole app (`lib/units.ts`; top bar and the studio's status bar) changes the unit of the size controls
and the status bar; the export dialog and HTV show both. Inside, lengths are always millimetres.
