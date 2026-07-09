# ADR 0001 — Technology Stack

**Status:** Accepted  
**Date:** 2026-07-09

---

## Context

We are building a browser-based rhinestone template tool that generates physically accurate SVG cut files. We need to choose:

1. A web framework
2. A language
3. A testing framework
4. An SVG generation strategy
5. A styling approach

The primary constraint is that the rhinestone engine must be **independently testable** with no browser or DOM dependency.

---

## Decision

### 1. Web Framework: Next.js (App Router)

**Rationale:**
- App Router supports React Server Components for fast initial load.
- Well-supported TypeScript integration.
- Easy deployment to Vercel if needed.
- File-based routing reduces boilerplate.

**Rejected alternatives:**
- Vite + React SPA — no server-side features, but acceptable. Rejected only because Next.js gives more flexibility without additional cost.
- SvelteKit — smaller ecosystem, team is more familiar with React.

### 2. Language: TypeScript (strict mode)

**Rationale:**
- The engine involves complex geometric types. Strong typing prevents entire classes of bugs (mm vs. px confusion, wrong stone size references).
- Strict mode catches null-safety issues early.

### 3. Testing Framework: Vitest

**Rationale:**
- Native TypeScript support without separate `ts-jest` config.
- Fast, compatible with the Node.js environment needed to test the engine without a browser.
- Compatible with the existing Vite-style config.

**Rejected alternatives:**
- Jest — slower TypeScript setup, ESM compatibility issues.

### 4. SVG Generation: Hand-constructed strings (no library)

**Rationale:**
- The SVG output is simple: one `<svg>` root, many `<circle>` elements, no complex nesting.
- A library like `svgjs` or `d3` would add unnecessary dependency weight and might abstract away the `width`/`height` mm attribute handling we need.
- String construction is transparent, auditable, and keeps the export path free of rasterization risk.

**Rejected alternatives:**
- `svgjs` — abstracts SVG in ways that could silently drop physical size attributes.
- `d3-selection` — designed for data-binding, not deterministic string output.
- Canvas → `toDataURL()` — explicitly forbidden (rasterizes the output).

### 5. Styling: Tailwind CSS

**Rationale:**
- Fast iteration on UI without context-switching to CSS files.
- Utility classes keep component files self-contained.

---

## Consequences

- The engine (`/src/lib/rhinestone-engine/`) must never import from `/app/` or use any browser API.
- SVG output will be constructed as plain strings. Any change to the export format must be reviewed for Cricut compatibility.
- If we ever need server-side SVG generation (e.g., API endpoint), the engine already works in Node.js without modification.
