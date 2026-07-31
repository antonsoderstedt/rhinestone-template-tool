/**
 * SVG Alphabet System Tests
 *
 * Verifies the template composition motor works with per-letter SVG glyphs.
 * Uses an in-memory glyph loader so the test does not depend on the local
 * LETTER UTVALDA directory being present.
 */

import { describe, it, expect } from 'vitest';
import {
  createSvgAlphabetTemplate,
  DEFAULT_SVG_ALPHABET_ID,
  getSvgAlphabetDefinition,
  isKnownSvgAlphabetId,
  listSvgAlphabets,
  type SvgAlphabetGlyphLoader,
  type SvgAlphabetId,
} from '../src/lib/rhinestone-engine/index';

function makeCircleSvg(circles: Array<{ cx: number; cy: number; r: number }>): string {
  // viewBox uses 0.01mm units to match the CorelDRAW curated exports.
  // Circles are newline-separated because the importer's regex-based parser
  // needs whitespace between adjacent self-closing tags.
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

describe('SVG Alphabet System', () => {
  it('exposes at least one registered alphabet with sensible metadata', () => {
    const alphabets = listSvgAlphabets();
    expect(alphabets.length).toBeGreaterThan(0);
    expect(alphabets[0]!.category).toBe('Library');
    expect(alphabets[0]!.supportedTargetStoneSizeIds.length).toBeGreaterThan(0);
    expect(isKnownSvgAlphabetId(DEFAULT_SVG_ALPHABET_ID)).toBe(true);
  });

  it('rejects unknown alphabet IDs', () => {
    expect(() => getSvgAlphabetDefinition('does-not-exist' as SvgAlphabetId)).toThrow();
    expect(isKnownSvgAlphabetId('does-not-exist')).toBe(false);
  });

  it('composes a template from per-letter SVG glyphs', async () => {
    const loader = inMemoryLoader({
      A: makeCircleSvg([
        { cx: 200, cy: 200, r: 100 },
        { cx: 500, cy: 500, r: 100 },
        { cx: 800, cy: 200, r: 100 },
      ]),
      B: makeCircleSvg([
        { cx: 300, cy: 300, r: 100 },
        { cx: 700, cy: 700, r: 100 },
      ]),
    });

    const result = await createSvgAlphabetTemplate({
      text: 'AB',
      alphabetId: DEFAULT_SVG_ALPHABET_ID,
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
      letterSpacingMm: 2,
      lineSpacingMm: 0,
      glyphLoader: loader,
    });

    expect(result.template.stones.length).toBe(5);
    expect(result.unsupportedCharacters).toEqual([]);
    expect(result.template.metadata?.['textPlacementStrategy']).toBe('svg-alphabet-glyph-compose-v1');
    expect(result.template.metadata?.['svgAlphabetId']).toBe(DEFAULT_SVG_ALPHABET_ID);
    for (const stone of result.template.stones) {
      expect(stone.metadata?.['svgAlphabetId']).toBe(DEFAULT_SVG_ALPHABET_ID);
      expect(stone.metadata?.['presentationMode']).toBe('stones');
      expect(typeof stone.metadata?.['character']).toBe('string');
    }
  });

  it('produces deterministic geometry for the same input', async () => {
    const loader = inMemoryLoader({
      A: makeCircleSvg([{ cx: 400, cy: 400, r: 100 }, { cx: 600, cy: 600, r: 100 }]),
    });
    const options = {
      text: 'AAA',
      alphabetId: DEFAULT_SVG_ALPHABET_ID,
      targetStoneSizeId: 'SS10' as const,
      targetStoneSizeMm: 3.429,
      letterSpacingMm: 2,
      lineSpacingMm: 0,
      glyphLoader: loader,
    };
    const a = await createSvgAlphabetTemplate(options);
    const b = await createSvgAlphabetTemplate(options);
    expect(a.template.stones).toEqual(b.template.stones);
  });

  it('reports unsupported characters and still emits supported ones', async () => {
    const loader = inMemoryLoader({
      A: makeCircleSvg([{ cx: 400, cy: 400, r: 100 }]),
    });
    const result = await createSvgAlphabetTemplate({
      text: 'AZ',
      alphabetId: DEFAULT_SVG_ALPHABET_ID,
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
      letterSpacingMm: 2,
      lineSpacingMm: 0,
      glyphLoader: loader,
    });
    expect(result.template.stones.length).toBe(1);
    expect(result.unsupportedCharacters).toEqual(['Z']);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('advances horizontally between letters', async () => {
    const loader = inMemoryLoader({
      A: makeCircleSvg([{ cx: 400, cy: 400, r: 100 }]),
    });
    const single = await createSvgAlphabetTemplate({
      text: 'A', alphabetId: DEFAULT_SVG_ALPHABET_ID, targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429, letterSpacingMm: 5, lineSpacingMm: 0, glyphLoader: loader,
    });
    const doubled = await createSvgAlphabetTemplate({
      text: 'AA', alphabetId: DEFAULT_SVG_ALPHABET_ID, targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429, letterSpacingMm: 5, lineSpacingMm: 0, glyphLoader: loader,
    });
    const singleXs = single.template.stones.map((s) => s.center.x);
    const doubledXs = doubled.template.stones.map((s) => s.center.x);
    expect(Math.max(...doubledXs)).toBeGreaterThan(Math.max(...singleXs));
  });

  it('rejects target stone sizes the alphabet does not support', async () => {
    const loader = inMemoryLoader({ A: makeCircleSvg([{ cx: 400, cy: 400, r: 100 }]) });
    await expect(createSvgAlphabetTemplate({
      text: 'A', alphabetId: DEFAULT_SVG_ALPHABET_ID, targetStoneSizeId: 'SS20',
      targetStoneSizeMm: 5.283, letterSpacingMm: 0, lineSpacingMm: 0, glyphLoader: loader,
    })).rejects.toThrow(/supports/);
  });
});
