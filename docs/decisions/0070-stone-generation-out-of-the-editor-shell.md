# ADR 0070: Stone generation out of the editor shell

**Status:** accepted · **Date:** 2026-11-28 · follows ADR 0069

## Why

ADR 0069 left the stone generation inside `EditorShell.tsx`: one `switch` of about 250 lines, with `return` in the middle of its cases and
checks of a request number against a ref after each wait. Moving it meant touching control flow, so it was left until the behaviour
that matters (a newer request must win) had a test.

## The race

Generation is asynchronous (a font has to be fetched before its text can become stones). Every run of the generation effect takes a
new request number; when an earlier request finishes after a later one has started it must not change the design. Where it is checked:
after the outline-text wait, after the artwork waits, and after the spacing resolution, right before `SET_TEMPLATE`.

## Decisions

- **The test came first, against the old code.** `e2e/generation-race.spec.ts` chooses a slow font (its font file is held back by the
  browser's network layer), then a fast one, lets the fast one finish, then releases the slow one and checks that the canvas still shows
  the fast one's design (and, as a control, that the slow font really gives a different design). It passed on the old code, and
  failed when the two request-number guards were taken out of the old code (the slow font's 213 stones replaced the fast font's 181).
- **The `switch` moved word for word** to `app/editor/generation/produceSourceTemplate.ts` as `produceSourceTemplate(input)`. The
  effect keeps the request numbers and everything done with the result (spacing, toast, `SET_TEMPLATE`, errors). The function returns
  `{ template }`, or `SKIP_GENERATION` where the old code did a bare `return` (empty text, a tool that makes no stones, an outdated request).
  The only changes to the moved text: `return;` became `return SKIP_GENERATION;`, and `generationRequestRef.current` became
  `currentRequestId()`. A line-by-line comparison of the old and the new text (254 lines) found no other difference.
- **The dependency list of the effect is unchanged**, field by field, and is marked as intentional (`state` as a whole would start a
  generation on every edit). `OutlineFontStatusState` and `replaceOutlineFontStatus` moved with it.
- **Unit tests** (`tests/produceSourceTemplate.test.ts`) cover the function with the built-in font (no network): a grid, outline text,
  an outdated request reports nothing and dispatches nothing, the skip cases, and empty text giving no template.
- Quirk fixed afterwards: the font, alphabet and stencil cases used to dispatch their warnings (`UPDATE_*_TOOL`) before the request
  number was checked, so an outdated request could still overwrite the warnings of the tool (the design itself was protected). They now
  check `requestId !== currentRequestId()` right after the wait, before anything is dispatched. A unit test per tool (stored warnings
  that differ from the result, one current request that dispatches and one outdated request that does not) fails without the check.

## Result

`EditorShell.tsx` 2,079 → 1,821 lines, and the generation can be read and tested apart from the component.
