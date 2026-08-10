/**
 * SVG Alphabet System Tests
 *
 * Verifies the template composition motor works with per-letter SVG glyphs.
 * Uses an in-memory glyph loader so the test does not depend on the local
 * LETTER UTVALDA directory being present.
 */

import { describe, it, expect } from 'vitest';
import {
  clearSvgAlphabetGlyphCacheForTests,
  createSvgAlphabetTemplate,
  DEFAULT_SVG_ALPHABET_ID,
  defaultSvgAlphabetGlyphLoader,
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

  it('ships the curated library alphabets with unique IDs', () => {
    const alphabets = listSvgAlphabets();
    const ids = alphabets.map((a) => a.alphabetId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('big-bold');
    expect(ids).toContain('blessed-script');
    expect(ids).toContain('broadway-retro');
    expect(ids).toContain('bride-script');
    expect(ids).toContain('cheer-block');
    expect(ids).toContain('college-varsity');
    expect(ids).toContain('disney-script');
    expect(ids).toContain('forever-script');
    expect(ids).toContain('huge-digits');
    expect(ids).toContain('line-font');
    expect(ids).toContain('real-college');
    expect(ids).toContain('scoreboard-block');
    expect(ids).toContain('toys-bubble');
    expect(ids).toContain('birthday-script');
    expect(ids).toContain('retro-wide');
    expect(ids).toContain('varsity-collage-a');
    expect(ids).toContain('old-english-gothic');
  });

  it('offers SS6 and SS10 for the Cheer package via libraryRelativeDirBySize', () => {
    const cheer = getSvgAlphabetDefinition('cheer-block');
    expect(cheer.supportedTargetStoneSizeIds).toContain('SS6');
    expect(cheer.supportedTargetStoneSizeIds).toContain('SS10');
    expect(cheer.libraryRelativeDirBySize?.SS6).toBeDefined();
    expect(cheer.libraryRelativeDirBySize?.SS10).toBeDefined();
  });

  it('resolves uppercase, lowercase, and digit glyphs for Forever from separate directories', async () => {
    clearSvgAlphabetGlyphCacheForTests();
    const upper = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('forever-script', 'A', 'SS10');
    const lower = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('forever-script', 'a', 'SS10');
    const digit = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('forever-script', '0', 'SS10');

    expect(upper).toContain('<svg');
    expect(lower).toContain('<svg');
    expect(digit).toContain('<svg');
  });

  it('resolves Real College glyphs from combined strip files', async () => {
    clearSvgAlphabetGlyphCacheForTests();
    const a = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('real-college', 'A', 'SS10');
    const n = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('real-college', 'N', 'SS10');
    const zero = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('real-college', '0', 'SS10');

    expect(a).toContain('<svg');
    expect(n).toContain('<svg');
    expect(zero).toContain('<svg');
  });

  it('resolves Broadway glyphs from zip-backed uppercase, lowercase, and digit paths', async () => {
    clearSvgAlphabetGlyphCacheForTests();
    const upper = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('broadway-retro', 'A', 'SS10');
    const lower = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('broadway-retro', 'a', 'SS10');
    const digit = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('broadway-retro', '0', 'SS10');

    expect(upper).toContain('<svg');
    expect(lower).toContain('<svg');
    expect(digit).toContain('<svg');
  });

  it('resolves Blessed and Bride glyphs from zip-backed uppercase, lowercase, and digit paths', async () => {
    clearSvgAlphabetGlyphCacheForTests();
    const blessedUpper = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('blessed-script', 'A', 'SS10');
    const blessedLower = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('blessed-script', 'a', 'SS10');
    const blessedDigit = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('blessed-script', '0', 'SS10');
    const brideUpper = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('bride-script', 'A', 'SS10');
    const brideLower = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('bride-script', 'a', 'SS10');
    const brideDigit = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('bride-script', '0', 'SS10');

    expect(blessedUpper).toContain('<svg');
    expect(blessedLower).toContain('<svg');
    expect(blessedDigit).toContain('<svg');
    expect(brideUpper).toContain('<svg');
    expect(brideLower).toContain('<svg');
    expect(brideDigit).toContain('<svg');
  });

  it('resolves Old English uppercase and lowercase glyphs from separate directories at SS10', async () => {
    clearSvgAlphabetGlyphCacheForTests();
    const upper = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('old-english-gothic', 'S', 'SS10');
    const lower = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('old-english-gothic', 'a', 'SS10');

    expect(upper).toContain('<svg');
    expect(lower).toContain('<svg');
  });

  it("resolves the SS10 lowercase i through the dotless-ı filename fallback", async () => {
    clearSvgAlphabetGlyphCacheForTests();
    const oldEnglish = getSvgAlphabetDefinition('old-english-gothic');
    expect(oldEnglish.glyphFileFallbackByChar?.i).toBe('ı');

    const lowerI = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('old-english-gothic', 'i', 'SS10');
    expect(lowerI).toContain('<svg');
  });

  it('resolves Old English uppercase and lowercase glyphs from separate directories at SS6', async () => {
    clearSvgAlphabetGlyphCacheForTests();
    const upper = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('old-english-gothic', 'S', 'SS6');
    const lower = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('old-english-gothic', 'a', 'SS6');
    // Lowercase 'i' is correctly named at SS6 (unlike SS10's dotless-ı file).
    const lowerI = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('old-english-gothic', 'i', 'SS6');

    expect(upper).toContain('<svg');
    expect(lower).toContain('<svg');
    expect(lowerI).toContain('<svg');
  });

  it('SS6 and SS10 Old English glyphs resolve from different directories', async () => {
    clearSvgAlphabetGlyphCacheForTests();
    const oldEnglish = getSvgAlphabetDefinition('old-english-gothic');
    const ss6Dir = oldEnglish.libraryRelativeDirBySizeAndCharacterClass?.SS6?.uppercase;
    const ss10Dir = oldEnglish.libraryRelativeDirBySizeAndCharacterClass?.SS10?.uppercase;
    expect(ss6Dir).toBeDefined();
    expect(ss10Dir).toBeDefined();
    expect(ss6Dir).not.toBe(ss10Dir);
  });

  it('reports Old English as supporting SS6 and SS10 with no digit glyphs', () => {
    const oldEnglish = getSvgAlphabetDefinition('old-english-gothic');
    expect(oldEnglish.supportedTargetStoneSizeIds).toEqual(['SS6', 'SS10']);
    expect(oldEnglish.characterCoverage.uppercase).toBe(true);
    expect(oldEnglish.characterCoverage.lowercase).toBe(true);
    expect(oldEnglish.characterCoverage.digits).toBe(false);
    expect(oldEnglish.style).toBe('Gothic');
  });

  it('resolves Huge Digits from its zip-backed digit directory', async () => {
    clearSvgAlphabetGlyphCacheForTests();
    const zero = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('huge-digits', '0', 'SS10');
    const eight = await defaultSvgAlphabetGlyphLoader.loadGlyphSvg('huge-digits', '8', 'SS10');

    expect(zero).toContain('<svg');
    expect(eight).toContain('<svg');
  });

  it('offers SS6 and SS10 for size-variant alphabets via libraryRelativeDirBySize', () => {
    const toys = getSvgAlphabetDefinition('toys-bubble');
    expect(toys.supportedTargetStoneSizeIds).toContain('SS6');
    expect(toys.supportedTargetStoneSizeIds).toContain('SS10');
    expect(toys.libraryRelativeDirBySize?.SS6).toBeDefined();
    expect(toys.libraryRelativeDirBySize?.SS10).toBeDefined();
    expect(toys.libraryRelativeDirBySize?.SS6).not.toBe(toys.libraryRelativeDirBySize?.SS10);
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

  it('hangs metric descenders below the shared baseline for alphabets with baseline metrics', async () => {
    // old-english-gothic ships baselineBelowFractionByChar (B: 0.139, o: on
    // baseline). Two synthetic glyphs of identical height: B must end up
    // sitting lower than o by its below-baseline fraction of the glyph height.
    const column = Array.from({ length: 5 }, (_, i) => ({ cx: 500, cy: 100 + i * 200, r: 30 }));
    const loader = inMemoryLoader({
      B: makeCircleSvg(column),
      o: makeCircleSvg(column),
    });

    const result = await createSvgAlphabetTemplate({
      text: 'Bo',
      alphabetId: 'old-english-gothic',
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.0,
      letterSpacingMm: 2,
      lineSpacingMm: 0,
      glyphLoader: loader,
    });

    const bottomOf = (ch: string) => Math.max(
      ...result.template.stones
        .filter((s) => s.metadata?.['character'] === ch)
        .map((s) => s.center.y + s.holeDiameterMm / 2),
    );
    const heightOf = (ch: string) => {
      const ys = result.template.stones
        .filter((s) => s.metadata?.['character'] === ch)
        .map((s) => s.center.y);
      return Math.max(...ys) - Math.min(...ys) + 3.0;
    };

    const expectedDrop = heightOf('B') * 0.139;
    expect(bottomOf('B') - bottomOf('o')).toBeCloseTo(expectedDrop, 1);
  });

  it('raises a bottom-shortened glyph (Old English z) above the shared baseline', async () => {
    const column = Array.from({ length: 5 }, (_, i) => ({ cx: 500, cy: 100 + i * 200, r: 30 }));
    const loader = inMemoryLoader({
      x: makeCircleSvg(column),
      z: makeCircleSvg(column),
    });

    const result = await createSvgAlphabetTemplate({
      text: 'xz',
      alphabetId: 'old-english-gothic',
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.0,
      letterSpacingMm: 2,
      lineSpacingMm: 0,
      glyphLoader: loader,
    });

    const bottomOf = (ch: string) => Math.max(
      ...result.template.stones
        .filter((s) => s.metadata?.['character'] === ch)
        .map((s) => s.center.y + s.holeDiameterMm / 2),
    );

    // z's bottom sits above the baseline (negative below-fraction), x sits on it.
    expect(bottomOf('z')).toBeLessThan(bottomOf('x'));
  });

  it('blames a missing asset library instead of character coverage when isLibraryAvailable reports false', async () => {
    const unreachableLoader: SvgAlphabetGlyphLoader = {
      async loadGlyphSvg() {
        return null; // every character fails — as it would if the library folder is gone
      },
      isLibraryAvailable: () => false,
    };

    const result = await createSvgAlphabetTemplate({
      text: 'AB',
      alphabetId: 'real-college',
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.0,
      letterSpacingMm: 2,
      lineSpacingMm: 0,
      glyphLoader: unreachableLoader,
    });

    expect(result.unsupportedCharacters.sort()).toEqual(['A', 'B']);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/library is unavailable/i);
    expect(result.warnings[0]).not.toMatch(/not supported by/i);
  });

  it('blames character coverage, not the library, when isLibraryAvailable reports true', async () => {
    const loader: SvgAlphabetGlyphLoader = {
      async loadGlyphSvg(_alphabetId, character) {
        return character === 'A' ? makeCircleSvg([{ cx: 500, cy: 500, r: 30 }]) : null;
      },
      isLibraryAvailable: () => true,
    };

    const result = await createSvgAlphabetTemplate({
      text: 'AZ',
      alphabetId: 'real-college',
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.0,
      letterSpacingMm: 2,
      lineSpacingMm: 0,
      glyphLoader: loader,
    });

    expect(result.unsupportedCharacters).toEqual(['Z']);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/not supported by/i);
    expect(result.warnings[0]).not.toMatch(/library is unavailable/i);
  });

  it('treats a loader with no isLibraryAvailable method as always-available (backward compatible)', async () => {
    const loader = inMemoryLoader({ A: makeCircleSvg([{ cx: 500, cy: 500, r: 30 }]) });

    const result = await createSvgAlphabetTemplate({
      text: 'AZ',
      alphabetId: 'real-college',
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.0,
      letterSpacingMm: 2,
      lineSpacingMm: 0,
      glyphLoader: loader,
    });

    expect(result.unsupportedCharacters).toEqual(['Z']);
    expect(result.warnings[0]).toMatch(/not supported by/i);
  });
});
