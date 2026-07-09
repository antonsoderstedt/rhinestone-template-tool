# Technical Specification — Rhinestone Template Tool

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS |
| Engine | Pure TypeScript, no DOM dependency |
| Testing | Vitest |
| SVG output | Hand-constructed SVG strings (no canvas) |

---

## Internal Units

**All engine calculations use millimeters (mm).**

Conversion to SVG user units happens only at the final export step, using a fixed scale factor:

```
1 mm = 3.7795275591 px  (at 96 DPI)
```

The SVG output must include a `viewBox` and `width`/`height` attributes in millimeters so that Cricut Design Space can read the physical size correctly.

---

## Architecture

```
Input Layer (UI)
    ↓
Path Extraction (text → SVG path, SVG upload → normalized paths)
    ↓
Rhinestone Engine (pure functions, no DOM)
    ├── Grid Generator      — produces candidate stone positions (hex grid)
    ├── Collision Detector  — removes overlapping positions
    ├── Path Fill Filter    — keeps only positions inside the target path
    └── Stone Placer        — assigns stone size to each accepted position
    ↓
SVG Exporter (constructs final SVG string)
    ↓
Output Layer (download / preview)
```

---

## Engine Contract

The engine is a set of **pure, deterministic functions**. It has:
- No side effects
- No DOM access
- No network calls
- No randomness

Given the same input parameters, the engine always produces byte-identical output.

### Core Input Type

```typescript
interface RhinestoneEngineInput {
  paths: SvgPath[];           // fill target paths in mm coordinates
  stoneSize: StoneSize;       // SS6 | SS8 | SS10 | SS12
  materialProfile: MaterialProfile;
  spacing: number;            // additional gap between stones (mm)
}
```

### Core Output Type

```typescript
interface RhinestoneEngineOutput {
  stones: StonePosition[];    // accepted stone positions
  boundingBox: BoundingBox;   // in mm
  stoneCount: number;
}
```

---

## SVG Export Constraints

1. **Every hole is a `<circle>` element.** No paths, no rectangles.
2. **No rasterization.** Never use `<image>` or canvas-derived content.
3. **Physical dimensions in output.** `width` and `height` on `<svg>` must be in `mm` units.
4. **No transforms that alter physical scale.** A 100mm design must cut as 100mm.
5. **Cricut-safe structure.** Single layer, no groups with nested transforms that confuse Design Space.

---

## Folder Structure

```
/app                        — Next.js app directory (UI only)
/src/lib/rhinestone-engine  — Engine (pure TypeScript, no DOM)
  /types                    — TypeScript interfaces and enums
  /profiles                 — Stone size and material profile data
  /geometry                 — Grid generation, collision, path fill
  /export                   — SVG construction and serialization
  /calibration              — Calibration offset application
/tests                      — Unit and integration tests
  /golden                   — Golden SVG files for snapshot tests
/docs                       — All project documentation
/calibration                — Calibration cut sheets and data
/examples                   — Sample SVG inputs and outputs
```

---

## Testing Strategy

1. **Unit tests** for every geometry utility (grid generation, collision, point-in-path).
2. **Golden file tests** — known input → expected SVG snapshot, checked byte-by-byte.
3. **No UI tests until the engine is fully covered.**
4. Test runner: Vitest.
5. Tests live in `/tests/`. Engine code must not import from `/app/`.
