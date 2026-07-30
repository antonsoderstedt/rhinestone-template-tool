/**
 * Rhinestone Font System Tests
 *
 * Validates that rhinestone fonts can be loaded and that glyphs contain
 * extractable stone shapes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadRhinestoneFont,
  clearRhinestoneFontCacheForTests,
  extractStonesFromGlyph,
  layoutRhinestoneFontText,
  TRW_STONE_SIZE_CALIBRATION,
  createRhinestoneFontTemplate,
} from '../src/lib/rhinestone-engine/index';

describe('Rhinestone Font System', () => {
  beforeEach(() => {
    clearRhinestoneFontCacheForTests();
  });

  describe('Font Registry and Loading', () => {
    it('should load TRW Clean Stone font', async () => {
      const loaded = await loadRhinestoneFont('trw-clean-stone');

      expect(loaded.definition.fontId).toBe('trw-clean-stone');
      expect(loaded.definition.displayName).toBe('TRW Clean Stone');
      expect(loaded.definition.isPrivate).toBe(true);
      expect(loaded.font).toBeDefined();
      expect(loaded.font.unitsPerEm).toBeGreaterThan(0);
    });

    it('should indicate character coverage limitations', async () => {
      const loaded = await loadRhinestoneFont('trw-clean-stone');

      expect(loaded.definition.characterCoverage).toEqual({
        uppercase: true,
        lowercase: true,
        digits: false,
        swedish: false,
      });
    });
  });

  describe('Glyph Stone Extraction', () => {
    it('should extract stones from TRW uppercase A', async () => {
      const loaded = await loadRhinestoneFont('trw-clean-stone');
      const extracted = extractStonesFromGlyph(loaded.font, 'A');

      expect(extracted.character).toBe('A');
      expect(extracted.stones.length).toBeGreaterThan(20);
      expect(extracted.stones.length).toBeLessThan(50);
      expect(extracted.warnings.length).toBe(0);

      // Verify stone properties
      for (const stone of extracted.stones) {
        expect(stone.localX).toBeDefined();
        expect(stone.localY).toBeDefined();
        expect(stone.diameterFontUnits).toBeGreaterThan(0);
        expect(isFinite(stone.localX)).toBe(true);
        expect(isFinite(stone.localY)).toBe(true);
        expect(isFinite(stone.diameterFontUnits)).toBe(true);
      }
    });

    it('should extract stones from TRW uppercase B', async () => {
      const loaded = await loadRhinestoneFont('trw-clean-stone');
      const extracted = extractStonesFromGlyph(loaded.font, 'B');

      expect(extracted.character).toBe('B');
      expect(extracted.stones.length).toBeGreaterThan(30);
      expect(extracted.stones.length).toBeLessThan(60);
    });

    it('should extract stones from TRW lowercase s', async () => {
      const loaded = await loadRhinestoneFont('trw-clean-stone');
      const extracted = extractStonesFromGlyph(loaded.font, 's');

      expect(extracted.character).toBe('s');
      expect(extracted.stones.length).toBeGreaterThan(20);
      expect(extracted.warnings.length).toBe(0);
    });

    it('should report unsupported character for digit', async () => {
      const loaded = await loadRhinestoneFont('trw-clean-stone');
      const extracted = extractStonesFromGlyph(loaded.font, '5');

      expect(extracted.stones.length).toBe(0);
      expect(extracted.warnings.length).toBeGreaterThan(0);
      expect(extracted.warnings[0]).toContain('5');
    });

    it('should report unsupported character for Swedish Å', async () => {
      const loaded = await loadRhinestoneFont('trw-clean-stone');
      const extracted = extractStonesFromGlyph(loaded.font, 'Å');

      expect(extracted.stones.length).toBe(0);
      expect(extracted.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Text Layout', () => {
    it('should layout simple single-line text', async () => {
      const loaded = await loadRhinestoneFont('trw-clean-stone');
      const layout = layoutRhinestoneFontText({
        text: 'ABC',
        font: loaded.font,
        targetStoneSizeMm: TRW_STONE_SIZE_CALIBRATION.SS10.diameterMm,
        targetStoneSizeId: 'SS10',
        letterSpacingMm: 0,
        lineSpacingMm: 0,
      });

      expect(layout.stones.length).toBeGreaterThan(70); // A + B + C stones
      expect(layout.widthMm).toBeGreaterThan(0);
      expect(layout.heightMm).toBeGreaterThan(0);
      expect(layout.unsupportedCharacters.length).toBe(0);

      // Verify stones are normalized to origin
      const minX = Math.min(...layout.stones.map((s) => s.x));
      const minY = Math.min(...layout.stones.map((s) => s.y));
      expect(minX).toBeCloseTo(0, 1);
      expect(minY).toBeCloseTo(0, 1);
    });

    it('should handle spaces in text', async () => {
      const loaded = await loadRhinestoneFont('trw-clean-stone');
      const layout = layoutRhinestoneFontText({
        text: 'A B',
        font: loaded.font,
        targetStoneSizeMm: TRW_STONE_SIZE_CALIBRATION.SS10.diameterMm,
        targetStoneSizeId: 'SS10',
        letterSpacingMm: 0,
        lineSpacingMm: 0,
      });

      expect(layout.stones.length).toBeGreaterThan(60); // A + B stones (space adds no stones)
      expect(layout.unsupportedCharacters.length).toBe(0);

      // B should be positioned after space
      const aStones = layout.stones.filter((s) => s.character === 'A');
      const bStones = layout.stones.filter((s) => s.character === 'B');
      const maxAx = Math.max(...aStones.map((s) => s.x));
      const minBx = Math.min(...bStones.map((s) => s.x));
      expect(minBx).toBeGreaterThan(maxAx);
    });

    it('should apply letter spacing', async () => {
      const loaded = await loadRhinestoneFont('trw-clean-stone');
      const noSpacing = layoutRhinestoneFontText({
        text: 'AB',
        font: loaded.font,
        targetStoneSizeMm: TRW_STONE_SIZE_CALIBRATION.SS10.diameterMm,
        targetStoneSizeId: 'SS10',
        letterSpacingMm: 0,
        lineSpacingMm: 0,
      });

      const withSpacing = layoutRhinestoneFontText({
        text: 'AB',
        font: loaded.font,
        targetStoneSizeMm: TRW_STONE_SIZE_CALIBRATION.SS10.diameterMm,
        targetStoneSizeId: 'SS10',
        letterSpacingMm: 2,
        lineSpacingMm: 0,
      });

      expect(withSpacing.widthMm).toBeGreaterThan(noSpacing.widthMm);
      expect(withSpacing.stones.length).toBe(noSpacing.stones.length);
    });

    it('should report unsupported characters without failing', async () => {
      const loaded = await loadRhinestoneFont('trw-clean-stone');
      const layout = layoutRhinestoneFontText({
        text: 'A5B',
        font: loaded.font,
        targetStoneSizeMm: TRW_STONE_SIZE_CALIBRATION.SS10.diameterMm,
        targetStoneSizeId: 'SS10',
        letterSpacingMm: 0,
        lineSpacingMm: 0,
      });

      expect(layout.stones.length).toBeGreaterThan(60); // A + B stones (5 skipped)
      expect(layout.unsupportedCharacters).toContain('5');

      const aStones = layout.stones.filter((s) => s.character === 'A');
      const bStones = layout.stones.filter((s) => s.character === 'B');
      expect(aStones.length).toBeGreaterThan(0);
      expect(bStones.length).toBeGreaterThan(0);
    });

    it('should handle multiline text', async () => {
      const loaded = await loadRhinestoneFont('trw-clean-stone');
      const layout = layoutRhinestoneFontText({
        text: 'AB\nCD',
        font: loaded.font,
        targetStoneSizeMm: TRW_STONE_SIZE_CALIBRATION.SS10.diameterMm,
        targetStoneSizeId: 'SS10',
        letterSpacingMm: 0,
        lineSpacingMm: 1,
      });

      expect(layout.stones.length).toBeGreaterThan(100); // A + B + C + D stones
      expect(layout.heightMm).toBeGreaterThan(TRW_STONE_SIZE_CALIBRATION.SS10.diameterMm * 2);

      // Verify CD is below AB
      const abStones = layout.stones.filter((s) => s.character === 'A' || s.character === 'B');
      const cdStones = layout.stones.filter((s) => s.character === 'C' || s.character === 'D');
      const maxABy = Math.max(...abStones.map((s) => s.y));
      const minCDy = Math.min(...cdStones.map((s) => s.y));
      expect(minCDy).toBeGreaterThan(maxABy);
    });
  });

  describe('Template Generation', () => {
    it('should create template from rhinestone font text', async () => {
      const result = await createRhinestoneFontTemplate({
        text: 'SULAY',
        rhinestoneFontId: 'trw-clean-stone',
        targetStoneSizeId: 'SS10',
        targetStoneSizeMm: TRW_STONE_SIZE_CALIBRATION.SS10.diameterMm,
        letterSpacingMm: 1,
        lineSpacingMm: 0,
      });

      expect(result.template).toBeDefined();
      expect(result.template.stones.length).toBeGreaterThan(150); // S + U + L + A + Y
      expect(result.template.widthMm).toBeGreaterThan(0);
      expect(result.template.heightMm).toBeGreaterThan(0);
      expect(result.unsupportedCharacters.length).toBe(0);
      expect(result.warnings.length).toBe(0);

      // Verify stones have correct properties
      for (const stone of result.template.stones) {
        expect(stone.stoneSize).toBe('SS10');
        expect(stone.center.x).toBeGreaterThanOrEqual(0);
        expect(stone.center.y).toBeGreaterThanOrEqual(0);
        expect(stone.metadata?.character).toBeDefined();
        expect(isFinite(stone.center.x)).toBe(true);
        expect(isFinite(stone.center.y)).toBe(true);
      }

      // Verify deterministic IDs
      const ids = result.template.stones.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should create warning for unsupported characters', async () => {
      const result = await createRhinestoneFontTemplate({
        text: 'SULAY 2026',
        rhinestoneFontId: 'trw-clean-stone',
        targetStoneSizeId: 'SS10',
        targetStoneSizeMm: TRW_STONE_SIZE_CALIBRATION.SS10.diameterMm,
        letterSpacingMm: 1,
        lineSpacingMm: 0,
      });

      expect(result.unsupportedCharacters).toContain('2');
      expect(result.unsupportedCharacters).toContain('0');
      expect(result.unsupportedCharacters).toContain('6');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('2');
      expect(result.warnings[0]).toContain('0');
      expect(result.warnings[0]).toContain('6');

      // SULAY stones should still be generated
      expect(result.template.stones.length).toBeGreaterThan(150);
    });

    it('should produce same result for same input', async () => {
      const options = {
        text: 'ABC',
        rhinestoneFontId: 'trw-clean-stone' as const,
        targetStoneSizeId: 'SS10' as const,
        targetStoneSizeMm: TRW_STONE_SIZE_CALIBRATION.SS10.diameterMm,
        letterSpacingMm: 0.5,
        lineSpacingMm: 0,
      };

      const result1 = await createRhinestoneFontTemplate(options);
      const result2 = await createRhinestoneFontTemplate(options);

      expect(result1.template.stones.length).toBe(result2.template.stones.length);

      for (let i = 0; i < result1.template.stones.length; i++) {
        const s1 = result1.template.stones[i]!;
        const s2 = result2.template.stones[i]!;
        expect(s1.id).toBe(s2.id);
        expect(s1.center.x).toBeCloseTo(s2.center.x, 6);
        expect(s1.center.y).toBeCloseTo(s2.center.y, 6);
        expect(s1.stoneSize).toBe(s2.stoneSize);
      }
    });
  });

  describe('Stone Size Calibration', () => {
    it('should have correct TRW calibration values', () => {
      expect(TRW_STONE_SIZE_CALIBRATION.SS6.diameterMm).toBeCloseTo(2.54, 2);
      expect(TRW_STONE_SIZE_CALIBRATION.SS10.diameterMm).toBeCloseTo(3.429, 2);
      expect(TRW_STONE_SIZE_CALIBRATION.SS16.diameterMm).toBeCloseTo(4.394, 2);
      expect(TRW_STONE_SIZE_CALIBRATION.SS20.diameterMm).toBeCloseTo(5.283, 2);
    });

    it('should scale stones correctly for different sizes', async () => {
      const ss6Result = await createRhinestoneFontTemplate({
        text: 'A',
        rhinestoneFontId: 'trw-clean-stone',
        targetStoneSizeId: 'SS6',
        targetStoneSizeMm: TRW_STONE_SIZE_CALIBRATION.SS6.diameterMm,
        letterSpacingMm: 0,
        lineSpacingMm: 0,
      });

      const ss12Result = await createRhinestoneFontTemplate({
        text: 'A',
        rhinestoneFontId: 'trw-clean-stone',
        targetStoneSizeId: 'SS12',
        targetStoneSizeMm: TRW_STONE_SIZE_CALIBRATION.SS10.diameterMm * 1.5, // SS12 is larger
        letterSpacingMm: 0,
        lineSpacingMm: 0,
      });

      // SS12 should be larger than SS6
      expect(ss12Result.template.widthMm).toBeDefined();
      expect(ss6Result.template.widthMm).toBeDefined();
      expect(ss12Result.template.widthMm!).toBeGreaterThan(ss6Result.template.widthMm!);
      expect(ss12Result.template.heightMm!).toBeGreaterThan(ss6Result.template.heightMm!);

      // Stone count should be the same
      expect(ss12Result.template.stones.length).toBe(ss6Result.template.stones.length);
    });
  });
});
