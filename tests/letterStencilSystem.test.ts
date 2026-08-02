/**
 * Letter Stencil Template Tests
 *
 * Verifies the stencil engine produces per-letter cards with typographically
 * correct widths, uniform card height, and proper cutShapes + stones geometry.
 * Uses an in-memory glyph loader so tests don't touch the local library.
 */

import { describe, it, expect } from 'vitest';
import {
  createLetterStencilTemplate,
  createBasicSvgExport,
  DEFAULT_SVG_ALPHABET_ID,
  type SvgAlphabetGlyphLoader,
  type SvgAlphabetId,
} from '../src/lib/rhinestone-engine/index';

function makeCircleSvg(circles: Array<{ cx: number; cy: number; r: number }>): string {
  const body = circles.map((c) => `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}"/>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 1000 1000">
${body}
</svg>`;
}

function inMemoryLoader(glyphs: Record<string, string>): SvgAlphabetGlyphLoader {
  return {
    async loadGlyphSvg(_alphabetId: SvgAlphabetId, character: string) {
      return glyphs[character] ?? null;
    },
  };
}

function svgAlphabetSource(glyphLoader: SvgAlphabetGlyphLoader) {
  return {
    type: 'svg-alphabet' as const,
    alphabetId: DEFAULT_SVG_ALPHABET_ID,
    glyphLoader,
  };
}

// Narrow glyph (I-like) → single vertical row of circles at cx=500.
const narrowGlyph = makeCircleSvg(
  Array.from({ length: 5 }, (_, i) => ({ cx: 500, cy: 100 + i * 200, r: 30 })),
);

// Wide glyph (W-like) → three vertical rows spread across cx=100/500/900.
const wideGlyph = makeCircleSvg([
  ...Array.from({ length: 5 }, (_, i) => ({ cx: 100, cy: 100 + i * 200, r: 30 })),
  ...Array.from({ length: 5 }, (_, i) => ({ cx: 500, cy: 100 + i * 200, r: 30 })),
  ...Array.from({ length: 5 }, (_, i) => ({ cx: 900, cy: 100 + i * 200, r: 30 })),
]);

describe('Letter Stencil System', () => {
  it('emits one card per non-space character', async () => {
    const loader = inMemoryLoader({ A: narrowGlyph, B: narrowGlyph, C: narrowGlyph });
    const res = await createLetterStencilTemplate({
      text: 'ABC',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
    });
    expect(res.cards.length).toBe(3);
    expect(res.cards.map((c) => c.character)).toEqual(['A', 'B', 'C']);
  });

  it('gives wide letters a wider card than narrow letters', async () => {
    const loader = inMemoryLoader({ I: narrowGlyph, W: wideGlyph });
    const res = await createLetterStencilTemplate({
      text: 'IW',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
    });
    const cardI = res.cards.find((c) => c.character === 'I')!;
    const cardW = res.cards.find((c) => c.character === 'W')!;
    expect(cardW.widthMm).toBeGreaterThan(cardI.widthMm);
  });

  it('uses uniform card height across every card in the sheet', async () => {
    const loader = inMemoryLoader({ I: narrowGlyph, W: wideGlyph });
    const res = await createLetterStencilTemplate({
      text: 'IWIW',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
    });
    const heights = new Set(res.cards.map((c) => c.heightMm));
    expect(heights.size).toBe(1);
  });

  it('respects minCardWidthMm so single-stroke glyphs get a usable card', async () => {
    const loader = inMemoryLoader({ I: narrowGlyph });
    const res = await createLetterStencilTemplate({
      text: 'I',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
      minCardWidthMm: 20,
    });
    expect(res.cards[0]!.widthMm).toBeGreaterThanOrEqual(20);
  });

  it('produces edge-to-edge cards in preview mode (no gap between adjacent cards)', async () => {
    const loader = inMemoryLoader({ A: narrowGlyph, B: narrowGlyph });
    const res = await createLetterStencilTemplate({
      text: 'AB',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
      layoutMode: 'preview',
    });
    const frames = res.template.cutShapes!;
    expect(frames.length).toBe(2);
    expect(frames[1]!.x).toBeCloseTo(frames[0]!.x + frames[0]!.widthMm, 3);
  });

  it('inserts inter-card gap in cut-sheet mode', async () => {
    const loader = inMemoryLoader({ A: narrowGlyph, B: narrowGlyph });
    const res = await createLetterStencilTemplate({
      text: 'AB',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
      layoutMode: 'cut-sheet',
      cutSheetGapMm: 5,
    });
    const frames = res.template.cutShapes!;
    expect(frames[1]!.x).toBeCloseTo(frames[0]!.x + frames[0]!.widthMm + 5, 3);
  });

  it('centres the glyph inside its card horizontally', async () => {
    const loader = inMemoryLoader({ I: narrowGlyph });
    const res = await createLetterStencilTemplate({
      text: 'I',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
    });
    const frame = res.template.cutShapes![0]!;
    const xs = res.template.stones.map((s) => s.center.x);
    const glyphMidX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const frameMidX = frame.x + frame.widthMm / 2;
    expect(Math.abs(glyphMidX - frameMidX)).toBeLessThan(0.5);
  });

  it('exports a Cricut-safe SVG with both frame rects and stone circles', async () => {
    const loader = inMemoryLoader({ A: narrowGlyph, B: narrowGlyph });
    const res = await createLetterStencilTemplate({
      text: 'AB',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
    });
    const svg = createBasicSvgExport(res.template);
    // Frame rects — one per card, with rounded corners.
    const rectCount = (svg.match(/<rect id="cut-/g) ?? []).length;
    expect(rectCount).toBe(2);
    expect(svg).toContain('rx="2"');
    // Stone circles — one per stone.
    const circleCount = (svg.match(/<circle id="stone-/g) ?? []).length;
    expect(circleCount).toBe(res.template.stones.length);
    // Cricut safety: mm units on the root svg.
    expect(svg).toMatch(/width="[\d.]+mm"/);
    expect(svg).toMatch(/height="[\d.]+mm"/);
  });

  it('reports unsupported characters without dropping the whole sheet', async () => {
    const loader = inMemoryLoader({ A: narrowGlyph });
    const res = await createLetterStencilTemplate({
      text: 'AZ',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
    });
    expect(res.unsupportedCharacters).toEqual(['Z']);
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.cards.length).toBe(1);
    expect(res.cards[0]!.character).toBe('A');
  });

  it('produces deterministic geometry for the same input', async () => {
    const loader = inMemoryLoader({ A: narrowGlyph, B: narrowGlyph });
    const options = {
      text: 'AB',
      source: svgAlphabetSource(loader),
      targetStoneSizeId: 'SS10' as const,
      targetStoneSizeMm: 3.429,
    };
    const a = await createLetterStencilTemplate(options);
    const b = await createLetterStencilTemplate(options);
    expect(a.template.stones).toEqual(b.template.stones);
    expect(a.template.cutShapes).toEqual(b.template.cutShapes);
  });
});
