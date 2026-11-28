# ADR 0069: Splitting the large editor files

**Status:** accepted · **Date:** 2026-11-28

## Why

Four files of the Rhinestone editor held most of its code: `EditorShell.tsx` (2,288 lines), `EditorPropertiesPanel.tsx` (2,122),
`EditorCanvas.tsx` (1,889) and `EditorState.ts` (1,555). They were slow to read, easy to break by accident and hard to review.
The change is a **move only**: no behaviour changes.

## Decisions

- **Moved code is not retyped.** A declaration is cut out of the file as it is (with its comment) and put in a new file with only the
  imports it uses (relative paths rewritten); the file it came from imports it back. The compiler (`tsc`), the 2,855 unit tests (which
  render every tool panel) and the 15 end-to-end tests on a fresh build (ADR 0068) are the proof that nothing changed.
- **`EditorPropertiesPanel.tsx`** 2,122 → 184 lines: each tool's panel is a file of its own in `app/editor/properties/`
  (`TextToolProperties`, `RhinestoneFontToolProperties`, `SvgAlphabetToolProperties`, `LetterStencilToolProperties`,
  `TemplateImportToolProperties`, `SvgToolProperties`, `GridToolProperties`, `ManualToolProperties`, `SelectToolProperties`), with
  `PanelSection`, `GeneratorErrorBanner` and `ToolPropertiesProps` in `shared.tsx`.
- **`EditorState.ts`** 1,555 → 753 lines: the types, the defaults and the update normalisers are in `app/editor/editorState/`
  (`types.ts`, `defaults.ts`, `normalize.ts`). `EditorState.ts` still exports every name (`export *`), so no import elsewhere changed.
  The reducer stays together.
- **`EditorCanvas.tsx`** 1,889 → 1,694 lines: the ruler, colour and path helpers (`canvas/canvasHelpers.tsx`) and three parts of the
  picture that take plain props: `CanvasToolbar` (zoom, hand, shiny stones, grid), `CanvasRulers` and `CanvasStatus` (the empty-canvas
  hint, the zoom level and the manual and select tool status).
- **`EditorShell.tsx`** 2,288 → 2,079 lines: the four studio chrome components (`shell/StudioChrome.tsx`).

## Not done, on purpose

- The remaining mass of `EditorShell` and `EditorCanvas` is logic that shares state (the stone generation effect, project loading,
  the pointer handlers). The generation effect is one `switch` with `return` in the middle of its cases and checks of a request id
  against a ref, so moving it means rewriting its control flow, not moving it. That needs its own change and a test of the race
  (a newer request must win), not a move that the compiler can vouch for.
- Files under about 1,000 lines (`draw/doc.ts` 938, `projectFormat.ts` 904, `pdf/read.ts` 868 and so on) are cohesive and were left.
