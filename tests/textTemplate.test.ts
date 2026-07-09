import { describe, it, expect } from 'vitest';
import {
  DOT_MATRIX_5X7_FONT,
  SUPPORTED_DOT_MATRIX_CHARACTERS,
  getDotMatrixGlyph,
  createDotMatrixTextTemplate,
  validateRhinestoneTemplate,
  createBasicSvgExport,
  getRecommendedHoleDiameter,
  getRecommendedCenterDistance,
} from '../src/lib/rhinestone-engine/index.js';

// ─── Dot matrix font ──────────────────────────────────────────────────────────

describe('DOT_MATRIX_5X7_FONT', () => {
  it('A glyph exists', () => {
    expect(DOT_MATRIX_5X7_FONT['A']).toBeDefined();
  });

  it('0 glyph exists', () => {
    expect(DOT_MATRIX_5X7_FONT['0']).toBeDefined();
  });

  it('space glyph exists', () => {
    expect(DOT_MATRIX_5X7_FONT[' ']).toBeDefined();
  });

  it('all supported glyphs are 7 rows high', () => {
    for (const [char, glyph] of Object.entries(DOT_MATRIX_5X7_FONT)) {
      expect(glyph.length, `glyph "${char}" should have 7 rows`).toBe(7);
    }
  });

  it('all supported glyph rows are 5 columns wide', () => {
    for (const [char, glyph] of Object.entries(DOT_MATRIX_5X7_FONT)) {
      for (let r = 0; r < 7; r++) {
        expect(glyph[r]!.length, `glyph "${char}" row ${r} should have 5 columns`).toBe(5);
      }
    }
  });

  it('all glyph cells are only "0" or "1"', () => {
    for (const [char, glyph] of Object.entries(DOT_MATRIX_5X7_FONT)) {
      for (const row of glyph) {
        for (const cell of row) {
          expect(['0', '1'], `glyph "${char}" has invalid cell "${cell}"`).toContain(cell);
        }
      }
    }
  });
});

describe('getDotMatrixGlyph', () => {
  it('returns the correct glyph for "A"', () => {
    const glyph = getDotMatrixGlyph('A');
    expect(glyph).toEqual(DOT_MATRIX_5X7_FONT['A']);
  });

  it('returns the space glyph for " "', () => {
    const glyph = getDotMatrixGlyph(' ');
    expect(glyph).toEqual(DOT_MATRIX_5X7_FONT[' ']);
  });

  it('unknown character falls back to "?" glyph', () => {
    const fallback = getDotMatrixGlyph('@');
    const question = getDotMatrixGlyph('?');
    expect(fallback).toEqual(question);
  });

  it('lowercase letter falls back to "?" glyph (font is uppercase-only)', () => {
    const fallback = getDotMatrixGlyph('a');
    const question = getDotMatrixGlyph('?');
    expect(fallback).toEqual(question);
  });
});

describe('SUPPORTED_DOT_MATRIX_CHARACTERS', () => {
  it('includes all uppercase letters A–Z', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      expect(SUPPORTED_DOT_MATRIX_CHARACTERS).toContain(ch);
    }
  });

  it('includes all digits 0–9', () => {
    for (const ch of '0123456789') {
      expect(SUPPORTED_DOT_MATRIX_CHARACTERS).toContain(ch);
    }
  });

  it('includes space and basic punctuation', () => {
    for (const ch of [' ', '.', ',', '!', '?', '-', '_']) {
      expect(SUPPORTED_DOT_MATRIX_CHARACTERS).toContain(ch);
    }
  });
});

// ─── createDotMatrixTextTemplate ──────────────────────────────────────────────

describe('createDotMatrixTextTemplate — basic creation', () => {
  it('creates a RhinestoneTemplate with unit "mm"', () => {
    const t = createDotMatrixTextTemplate({
      id: 'test',
      name: 'Test',
      text: 'A',
      stoneSize: 'SS10',
    });
    expect(t.unit).toBe('mm');
  });

  it('creates stones for text "A" (18 stones for the A glyph)', () => {
    const t = createDotMatrixTextTemplate({
      id: 'test',
      name: 'Test',
      text: 'A',
      stoneSize: 'SS10',
    });
    // A glyph: 01110 10001 10001 11111 10001 10001 10001
    // Counts:     3     2     2     5     2     2     2 = 18
    expect(t.stones.length).toBe(18);
  });

  it('creates deterministic IDs — same input gives same IDs', () => {
    const opts = { id: 't', name: 'T', text: 'HI', stoneSize: 'SS10' as const };
    const ids1 = createDotMatrixTextTemplate(opts).stones.map((s) => s.id);
    const ids2 = createDotMatrixTextTemplate(opts).stones.map((s) => s.id);
    expect(ids1).toEqual(ids2);
  });

  it('creates deterministic positions — same input gives same centers', () => {
    const opts = { id: 't', name: 'T', text: 'HI', stoneSize: 'SS10' as const };
    const pos1 = createDotMatrixTextTemplate(opts).stones.map((s) => s.center);
    const pos2 = createDotMatrixTextTemplate(opts).stones.map((s) => s.center);
    expect(pos1).toEqual(pos2);
  });

  it('supports lowercase input by uppercasing by default', () => {
    const lower = createDotMatrixTextTemplate({ id: 't', name: 'T', text: 'a', stoneSize: 'SS10' });
    const upper = createDotMatrixTextTemplate({ id: 't', name: 'T', text: 'A', stoneSize: 'SS10' });
    expect(lower.stones.length).toBe(upper.stones.length);
  });

  it('supports multiline text — "A\\nB" has more stones than "A"', () => {
    const single = createDotMatrixTextTemplate({ id: 't', name: 'T', text: 'A', stoneSize: 'SS10' });
    const multi = createDotMatrixTextTemplate({ id: 't', name: 'T', text: 'A\nB', stoneSize: 'SS10' });
    expect(multi.stones.length).toBeGreaterThan(single.stones.length);
  });

  it('"A\\nB" stone count equals count("A") + count("B")', () => {
    const a = createDotMatrixTextTemplate({ id: 't', name: 'T', text: 'A', stoneSize: 'SS10' });
    const b = createDotMatrixTextTemplate({ id: 't', name: 'T', text: 'B', stoneSize: 'SS10' });
    const ab = createDotMatrixTextTemplate({ id: 't', name: 'T', text: 'A\nB', stoneSize: 'SS10' });
    // B glyph: 11110 10001 10001 11110 10001 10001 11110 = 4+2+2+4+2+2+4 = 20
    expect(ab.stones.length).toBe(a.stones.length + b.stones.length);
  });

  it('uses SS10 recommended hole diameter for all stones', () => {
    const expected = getRecommendedHoleDiameter('SS10');
    const t = createDotMatrixTextTemplate({ id: 't', name: 'T', text: 'A', stoneSize: 'SS10' });
    for (const stone of t.stones) {
      expect(stone.holeDiameterMm).toBe(expected);
    }
  });

  it('uses recommended spacing by default (no collision)', () => {
    const t = createDotMatrixTextTemplate({ id: 't', name: 'T', text: 'A', stoneSize: 'SS10' });
    const result = validateRhinestoneTemplate(t);
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.code === 'STONE_COLLISION')).toHaveLength(0);
  });

  it('stone IDs are 1-based (contain -line1-, -char1-)', () => {
    const t = createDotMatrixTextTemplate({ id: 't', name: 'T', text: 'A', stoneSize: 'SS10' });
    expect(t.stones.some((s) => s.id.includes('-line1-'))).toBe(true);
    expect(t.stones.some((s) => s.id.includes('-char1-'))).toBe(true);
  });
});

// ─── Error cases ──────────────────────────────────────────────────────────────

describe('createDotMatrixTextTemplate — error cases', () => {
  it('throws on empty id', () => {
    expect(() =>
      createDotMatrixTextTemplate({ id: '', name: 'T', text: 'A', stoneSize: 'SS10' }),
    ).toThrow(/id/);
  });

  it('throws on empty name', () => {
    expect(() =>
      createDotMatrixTextTemplate({ id: 't', name: '', text: 'A', stoneSize: 'SS10' }),
    ).toThrow(/name/);
  });

  it('throws on empty text', () => {
    expect(() =>
      createDotMatrixTextTemplate({ id: 't', name: 'T', text: '', stoneSize: 'SS10' }),
    ).toThrow(/text/);
  });

  it('throws on whitespace-only text', () => {
    // Whitespace-only trimmed → empty
    expect(() =>
      createDotMatrixTextTemplate({ id: 't', name: 'T', text: '   ', stoneSize: 'SS10' }),
    ).toThrow(/text/);
  });

  it('throws when spacingMm is smaller than recommended', () => {
    const minSpacing = getRecommendedCenterDistance('SS10');
    expect(() =>
      createDotMatrixTextTemplate({
        id: 't',
        name: 'T',
        text: 'A',
        stoneSize: 'SS10',
        spacingMm: minSpacing - 0.1,
      }),
    ).toThrow(/spacing/i);
  });

  it('accepts spacingMm exactly equal to recommended', () => {
    const minSpacing = getRecommendedCenterDistance('SS10');
    expect(() =>
      createDotMatrixTextTemplate({
        id: 't',
        name: 'T',
        text: 'A',
        stoneSize: 'SS10',
        spacingMm: minSpacing,
      }),
    ).not.toThrow();
  });
});

// ─── Validation and export integration ───────────────────────────────────────

describe('createDotMatrixTextTemplate — integration', () => {
  it('generated template passes validateRhinestoneTemplate', () => {
    const t = createDotMatrixTextTemplate({ id: 't', name: 'T', text: 'HELLO', stoneSize: 'SS10' });
    const result = validateRhinestoneTemplate(t);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('generated template can be exported with createBasicSvgExport', () => {
    const t = createDotMatrixTextTemplate({ id: 't', name: 'T', text: 'HI', stoneSize: 'SS10' });
    expect(() => createBasicSvgExport(t)).not.toThrow();
  });

  it('exported SVG contains <circle', () => {
    const t = createDotMatrixTextTemplate({ id: 't', name: 'T', text: 'A', stoneSize: 'SS10' });
    const svg = createBasicSvgExport(t);
    expect(svg).toContain('<circle');
  });

  it('exported SVG contains data-stone-size="SS10"', () => {
    const t = createDotMatrixTextTemplate({ id: 't', name: 'T', text: 'A', stoneSize: 'SS10' });
    const svg = createBasicSvgExport(t);
    expect(svg).toContain('data-stone-size="SS10"');
  });

  it('exported SVG does not contain <image', () => {
    const t = createDotMatrixTextTemplate({ id: 't', name: 'T', text: 'A', stoneSize: 'SS10' });
    const svg = createBasicSvgExport(t);
    expect(svg).not.toContain('<image');
  });

  it('exported SVG has one circle per stone', () => {
    const t = createDotMatrixTextTemplate({ id: 't', name: 'T', text: 'A', stoneSize: 'SS10' });
    const svg = createBasicSvgExport(t);
    const circleCount = (svg.match(/<circle/g) ?? []).length;
    expect(circleCount).toBe(t.stones.length);
  });
});
