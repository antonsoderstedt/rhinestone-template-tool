# Artwork fixtures

Used by `tests/quality/` and `npm run quality` to judge every artwork generator on the same inputs.

- `smooch-*.svg`: the project owner's own logos (real Illustrator exports).
- `synthetic/`: small files written to exercise one importer feature each (group transforms, arcs, `<use>`, CSS classes,
  hidden elements, strokes, thin letters, two colours, units).
- `local/`: git-ignored; third-party artwork for local runs only.

Every `.svg` here is run at the widths, stone sizes and modes listed in `tests/quality/harness.ts`.
