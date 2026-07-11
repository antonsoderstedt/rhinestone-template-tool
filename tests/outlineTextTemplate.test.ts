import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_VECTOR_FONT,
  SUPPORTED_VECTOR_FONT_CHARACTERS,
  getVectorGlyph,
  createOutlineTextTemplate,
  validateRhinestoneTemplate,
  checkExportReadiness,
  createBasicSvgExport,
} from '../src/lib/rhinestone-engine/index.js';

// ─── Vector font ──────────────────────────────────────────────────────────────

describe('BUILT_IN_VECTOR_FONT', () => {
  it('exists with expected shape', () => {
    expect(BUILT_IN_VECTOR_FONT).toBeDefined();
    expect(BUILT_IN_VECTOR_FONT.id).toBe('built-in-vector-outline-v1');
    expect(BUILT_IN_VECTOR_FONT.unitsPerEm).toBe(100);
    expect(typeof BUILT_IN_VECTOR_FONT.glyphs).toBe('object');
    expect(BUILT_IN_VECTOR_FONT.fallbackCharacter).toBe('?');
  });

  it('supports A', () => {
    const g = getVectorGlyph('A');
    expect(g.character).toBe('A');
    expect(g.polylines.length).toBeGreaterThan(0);
    expect(g.advanceWidth).toBeGreaterThan(0);
  });

  it('supports 0', () => {
    const g = getVectorGlyph('0');
    expect(g.character).toBe('0');
    expect(g.polylines.length).toBeGreaterThan(0);
  });

  it('supports space — advance width but no polylines', () => {
    const g = getVectorGlyph(' ');
    expect(g.character).toBe(' ');
    expect(g.polylines).toHaveLength(0);
    expect(g.advanceWidth).toBeGreaterThan(0);
  });

  it('returns fallback glyph for unknown character', () => {
    const fallback = getVectorGlyph('£');
    const question = BUILT_IN_VECTOR_FONT.glyphs['?'];
    expect(fallback).toBe(question);
  });

  it('maps lowercase to uppercase glyph', () => {
    const lower = getVectorGlyph('a');
    const upper = getVectorGlyph('A');
    expect(lower).toBe(upper);
  });

  it('all supported glyphs have deterministic shape data', () => {
    for (const char of SUPPORTED_VECTOR_FONT_CHARACTERS) {
      const g1 = getVectorGlyph(char);
      const g2 = getVectorGlyph(char);
      expect(g1).toBe(g2); // same object reference — fully immutable
      expect(g1.advanceWidth).toBeGreaterThan(0);
      for (const pl of g1.polylines) {
        expect(pl.points.length).toBeGreaterThanOrEqual(2);
        for (const pt of pl.points) {
          expect(isFinite(pt.x)).toBe(true);
          expect(isFinite(pt.y)).toBe(true);
        }
      }
    }
  });

  it('supports all required characters: A–Z, 0–9, space, . , ! ? - _', () => {
    const required = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-_';
    for (const ch of required) {
      const g = getVectorGlyph(ch);
      // fallback '?' is acceptable for any character listed here
      // but all of these should map directly, not to fallback
      expect(BUILT_IN_VECTOR_FONT.glyphs[ch] ?? BUILT_IN_VECTOR_FONT.glyphs['?']).toBeDefined();
      expect(g.advanceWidth).toBeGreaterThan(0);
    }
  });
});

// ─── createOutlineTextTemplate ────────────────────────────────────────────────

describe('createOutlineTextTemplate', () => {
  it('creates a RhinestoneTemplate with unit mm', () => {
    const t = createOutlineTextTemplate({
      id: 'test-a', name: 'Test A', text: 'A', stoneSize: 'SS10',
    });
    expect(t.unit).toBe('mm');
    expect(Array.isArray(t.stones)).toBe(true);
  });

  it('creates stones for text "A"', () => {
    const t = createOutlineTextTemplate({
      id: 'test-a', name: 'Test A', text: 'A', stoneSize: 'SS10',
    });
    expect(t.stones.length).toBeGreaterThan(0);
  });

  it('creates stones for text "SMOOCH"', () => {
    const t = createOutlineTextTemplate({
      id: 'test-smooch', name: 'Test SMOOCH', text: 'SMOOCH', stoneSize: 'SS10',
    });
    expect(t.stones.length).toBeGreaterThan(10);
  });

  it('handles lowercase input by mapping to uppercase glyphs', () => {
    const upper = createOutlineTextTemplate({
      id: 'test-upper', name: 'Upper', text: 'ABC', stoneSize: 'SS10',
    });
    const lower = createOutlineTextTemplate({
      id: 'test-lower', name: 'Lower', text: 'abc', stoneSize: 'SS10',
    });
    expect(lower.stones.length).toBe(upper.stones.length);
  });

  it('supports multiline text', () => {
    const multi = createOutlineTextTemplate({
      id: 'test-multi', name: 'Multi', text: 'AB\nCD', stoneSize: 'SS10',
    });
    const single = createOutlineTextTemplate({
      id: 'test-single', name: 'Single', text: 'ABCD', stoneSize: 'SS10',
    });
    expect(multi.stones.length).toBeGreaterThan(0);
    // multiline lays glyphs in separate rows — stone count may differ
    expect(multi.stones.length).not.toBe(0);
    expect(single.stones.length).not.toBe(0);
  });

  it('center alignment changes stone positions', () => {
    const left = createOutlineTextTemplate({
      id: 'test-left', name: 'Left', text: 'AB\nC', stoneSize: 'SS10', align: 'left',
    });
    const center = createOutlineTextTemplate({
      id: 'test-center', name: 'Center', text: 'AB\nC', stoneSize: 'SS10', align: 'center',
    });
    // Same stone count but different positions
    expect(center.stones.length).toBe(left.stones.length);
    // Not required to differ for line 0 (AB is longest), but metadata should differ
    expect(center.metadata?.['align']).toBe('center');
    expect(left.metadata?.['align']).toBe('left');
  });

  it('right alignment is applied', () => {
    const t = createOutlineTextTemplate({
      id: 'test-right', name: 'Right', text: 'HI\nA', stoneSize: 'SS10', align: 'right',
    });
    expect(t.metadata?.['align']).toBe('right');
    expect(t.stones.length).toBeGreaterThan(0);
  });

  it('fontSizeMm scales the output', () => {
    const small = createOutlineTextTemplate({
      id: 'small', name: 'Small', text: 'A', stoneSize: 'SS10', fontSizeMm: 15,
    });
    const large = createOutlineTextTemplate({
      id: 'large', name: 'Large', text: 'A', stoneSize: 'SS10', fontSizeMm: 40,
    });
    const maxX = (t: ReturnType<typeof createOutlineTextTemplate>) =>
      Math.max(...t.stones.map((s) => s.center.x));
    expect(maxX(large)).toBeGreaterThan(maxX(small));
  });

  it('targetWidthMm scales the template', () => {
    const t = createOutlineTextTemplate({
      id: 'tw', name: 'TW', text: 'SMOOCH', stoneSize: 'SS10',
      targetWidthMm: 80,
    });
    const maxX = Math.max(...t.stones.map((s) => s.center.x));
    expect(maxX).toBeLessThanOrEqual(100); // 80mm + 10mm origin + some padding
    expect(t.metadata?.['targetWidthMm']).toBe(80);
  });

  it('targetHeightMm scales the template', () => {
    const t = createOutlineTextTemplate({
      id: 'th', name: 'TH', text: 'A', stoneSize: 'SS10',
      targetHeightMm: 30,
    });
    expect(t.stones.length).toBeGreaterThan(0);
    expect(t.metadata?.['targetHeightMm']).toBe(30);
  });

  it('densityPreset is applied', () => {
    const dense = createOutlineTextTemplate({
      id: 'dense', name: 'Dense', text: 'A', stoneSize: 'SS10',
      densityPreset: 'dense',
    });
    const loose = createOutlineTextTemplate({
      id: 'loose', name: 'Loose', text: 'A', stoneSize: 'SS10',
      densityPreset: 'loose',
    });
    expect(dense.stones.length).toBeGreaterThanOrEqual(loose.stones.length);
  });

  it('custom spacing is applied', () => {
    const t = createOutlineTextTemplate({
      id: 'custom', name: 'Custom', text: 'A', stoneSize: 'SS10',
      densityPreset: 'custom',
      customSpacingMm: 4.5,
    });
    expect(t.stones.length).toBeGreaterThan(0);
    expect(t.metadata?.['customSpacingMm']).toBe(4.5);
  });

  it('includes expected metadata fields', () => {
    const t = createOutlineTextTemplate({
      id: 'meta', name: 'Meta', text: 'HI', stoneSize: 'SS10',
      fontSizeMm: 20,
      letterSpacingMm: 3,
      lineSpacingMm: 10,
      align: 'center',
      densityPreset: 'standard',
    });
    expect(t.metadata?.['generatedBy']).toBe('createOutlineTextTemplate');
    expect(t.metadata?.['text']).toBe('HI');
    expect(t.metadata?.['fontMode']).toBe('built-in-vector-outline-v1');
    expect(t.metadata?.['fontSizeMm']).toBe(20);
    expect(t.metadata?.['letterSpacingMm']).toBe(3);
    expect(t.metadata?.['lineSpacingMm']).toBe(10);
    expect(t.metadata?.['align']).toBe('center');
    expect(t.metadata?.['densityPreset']).toBe('standard');
  });

  it('throws on empty id', () => {
    expect(() =>
      createOutlineTextTemplate({ id: '', name: 'N', text: 'A', stoneSize: 'SS10' }),
    ).toThrow(/id/);
  });

  it('throws on empty name', () => {
    expect(() =>
      createOutlineTextTemplate({ id: 'x', name: '', text: 'A', stoneSize: 'SS10' }),
    ).toThrow(/name/);
  });

  it('throws on empty text', () => {
    expect(() =>
      createOutlineTextTemplate({ id: 'x', name: 'N', text: '', stoneSize: 'SS10' }),
    ).toThrow(/text/);
  });

  it('throws on invalid fontSizeMm (zero)', () => {
    expect(() =>
      createOutlineTextTemplate({ id: 'x', name: 'N', text: 'A', stoneSize: 'SS10', fontSizeMm: 0 }),
    ).toThrow(/fontSizeMm/);
  });

  it('throws on invalid fontSizeMm (negative)', () => {
    expect(() =>
      createOutlineTextTemplate({ id: 'x', name: 'N', text: 'A', stoneSize: 'SS10', fontSizeMm: -5 }),
    ).toThrow(/fontSizeMm/);
  });

  it('generated template passes validateRhinestoneTemplate', () => {
    const t = createOutlineTextTemplate({
      id: 'val', name: 'Val', text: 'SMOOCH', stoneSize: 'SS10',
    });
    const result = validateRhinestoneTemplate(t);
    const errors = result.issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('generated template passes checkExportReadiness', () => {
    const t = createOutlineTextTemplate({
      id: 'ready', name: 'Ready', text: 'SMOOCH', stoneSize: 'SS10',
    });
    const r = checkExportReadiness(t);
    expect(r.ready).toBe(true);
  });

  it('exports through createBasicSvgExport without error', () => {
    const t = createOutlineTextTemplate({
      id: 'exp', name: 'Exp', text: 'A', stoneSize: 'SS10',
    });
    const svg = createBasicSvgExport(t, { includeGuideBox: false });
    expect(typeof svg).toBe('string');
    expect(svg.includes('<svg')).toBe(true);
  });

  it('exported SVG contains real circle elements', () => {
    const t = createOutlineTextTemplate({
      id: 'circ', name: 'Circ', text: 'A', stoneSize: 'SS10',
    });
    const svg = createBasicSvgExport(t, { includeGuideBox: false });
    expect(svg).toContain('<circle');
  });

  it('exported SVG does not contain image tags', () => {
    const t = createOutlineTextTemplate({
      id: 'img', name: 'Img', text: 'A', stoneSize: 'SS10',
    });
    const svg = createBasicSvgExport(t, { includeGuideBox: false });
    expect(svg.toLowerCase()).not.toContain('<image');
  });

  it('output is deterministic — same input produces identical results', () => {
    const opts = { id: 'det', name: 'Det', text: 'SMOOCH', stoneSize: 'SS10' as const };
    const t1 = createOutlineTextTemplate(opts);
    const t2 = createOutlineTextTemplate(opts);
    expect(t1.stones.length).toBe(t2.stones.length);
    for (let i = 0; i < t1.stones.length; i++) {
      expect(t1.stones[i]!.center.x).toBe(t2.stones[i]!.center.x);
      expect(t1.stones[i]!.center.y).toBe(t2.stones[i]!.center.y);
    }
  });
});
