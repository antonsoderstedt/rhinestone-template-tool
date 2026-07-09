<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:rhinestone-project-rules -->
# Rhinestone Template Tool — Agent Rules

## File Verification

- **Never claim a file was created without verifying it.**  
  After creating any file, run `find . -maxdepth 6 -name "<filename>"` or `ls <path>` to confirm it exists.
- **Never summarize success unless the validation command output confirms the file is present.**

## Filesystem Rules

- The Next.js app lives in `/app/` (not `/src/app/`). Do not move or restructure it.
- Engine code lives in `/src/lib/rhinestone-engine/`. Do not import from `/app/` inside the engine.
- Do not create TypeScript engine files until the folder structure and tests are in place.

## Engine Rules

- All engine logic must be **pure functions** — no side effects, no DOM, no network.
- All internal measurements use **millimeters (mm)**. Do not use pixels in engine calculations.
- Engine output must be **deterministic**: same input → same output, always.
- Do not disable or skip collision detection under any circumstances.
- Do not use `Math.random()`, `Date.now()`, or any non-deterministic call inside engine functions.

## SVG Export Rules

- Every rhinestone hole must be a `<circle>` SVG element. No paths, rects, or canvas.
- **Do not rasterize.** Never route the export through `<canvas>`, `toDataURL()`, or any image encoder.
- The exported SVG must have `width` and `height` attributes in `mm` units.
- The SVG must be Cricut Design Space safe: no nested `<svg>`, no `<use>`, no opacity < 1 on cut shapes.

## Development Sequence

- **Engine first.** No UI feature work until the engine module is implemented and tested.
- **Tests before integration.** No engine function is wired to the UI until it has passing unit tests.
- Advanced features (image input, multi-size designs, sharing) must wait until the engine foundation is complete and calibrated.

## Documentation

- All architectural decisions must be recorded as ADRs in `docs/decisions/`.
- Do not change the engine algorithm without updating `docs/RHINESTONE_ENGINE_SPEC.md`.
- Acceptance criteria live in `docs/ACCEPTANCE_CRITERIA.md`. Check them before marking any phase complete.
<!-- END:rhinestone-project-rules -->
