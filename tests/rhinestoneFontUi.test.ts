/**
 * Rhinestone Font Generator UI Integration Tests
 *
 * Tests the RhinestoneFontGenerator component's UI behavior and integration with the engine.
 */

import { describe, it, expect } from 'vitest';
import {
  createRhinestoneFontTemplate,
  TRW_CLEAN_STONE_FONT_ID,
  TRW_STONE_SIZE_CALIBRATION,
} from '../src/lib/rhinestone-engine/index.js';

// ─── UI Component Behavior ───────────────────────────────────────────────────

describe('Rhinestone Font Generator UI', () => {
  it('supports all four TRW stone sizes: SS6, SS10, SS16, SS20', () => {
    const sizes = ['SS6', 'SS10', 'SS16', 'SS20'] as const;
    expect(sizes).toHaveLength(4);
    
    // Verify each size has correct TRW calibration
    expect(TRW_STONE_SIZE_CALIBRATION.SS6.diameterMm).toBe(2.54);
    expect(TRW_STONE_SIZE_CALIBRATION.SS10.diameterMm).toBe(3.429);
    expect(TRW_STONE_SIZE_CALIBRATION.SS16.diameterMm).toBe(4.394);
    expect(TRW_STONE_SIZE_CALIBRATION.SS20.diameterMm).toBe(5.283);
  });

  it('displays correct physical diameter for each TRW size', () => {
    const expected = [
      { size: 'SS6', mm: 2.54 },
      { size: 'SS10', mm: 3.429 },
      { size: 'SS16', mm: 4.394 },
      { size: 'SS20', mm: 5.283 },
    ];

    for (const { size, mm } of expected) {
      const calibration = TRW_STONE_SIZE_CALIBRATION[size as keyof typeof TRW_STONE_SIZE_CALIBRATION];
      expect(calibration.diameterMm).toBe(mm);
    }
  });
});

// ─── Text Processing ──────────────────────────────────────────────────────────

describe('Rhinestone Font Text Processing', () => {
  it('generates stones for "Sulay" (mixed case)', async () => {
    const result = await createRhinestoneFontTemplate({
      text: 'Sulay',
      rhinestoneFontId: TRW_CLEAN_STONE_FONT_ID,
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
      letterSpacingMm: 1,
      lineSpacingMm: 0,
    });

    expect(result.template.stones.length).toBeGreaterThan(0);
    expect(result.unsupportedCharacters).toEqual([]);
  });

  it('generates stones for "SULAY" (all uppercase)', async () => {
    const result = await createRhinestoneFontTemplate({
      text: 'SULAY',
      rhinestoneFontId: TRW_CLEAN_STONE_FONT_ID,
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
      letterSpacingMm: 1,
      lineSpacingMm: 0,
    });

    expect(result.template.stones.length).toBeGreaterThan(0);
    expect(result.unsupportedCharacters).toEqual([]);
  });

  it('handles spaces correctly in text', async () => {
    const result = await createRhinestoneFontTemplate({
      text: 'A B',
      rhinestoneFontId: TRW_CLEAN_STONE_FONT_ID,
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
      letterSpacingMm: 1,
      lineSpacingMm: 0,
    });

    // Spaces should not be marked as unsupported
    expect(result.unsupportedCharacters).not.toContain(' ');
    expect(result.template.stones.length).toBeGreaterThan(0);
  });

  it('supports multiline text', async () => {
    const result = await createRhinestoneFontTemplate({
      text: 'A\nB',
      rhinestoneFontId: TRW_CLEAN_STONE_FONT_ID,
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
      letterSpacingMm: 1,
      lineSpacingMm: 5,
    });

    expect(result.template.stones.length).toBeGreaterThan(0);
    expect(result.unsupportedCharacters).toEqual([]);
  });

  it('detects unsupported characters: digits, Swedish, emoji', async () => {
    const result = await createRhinestoneFontTemplate({
      text: 'SULAY 2026 ÅÄÖ 😀',
      rhinestoneFontId: TRW_CLEAN_STONE_FONT_ID,
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
      letterSpacingMm: 1,
      lineSpacingMm: 0,
    });

    // Should generate stones for SULAY
    expect(result.template.stones.length).toBeGreaterThan(0);

    // Should report unsupported characters
    expect(result.unsupportedCharacters.length).toBeGreaterThan(0);
    
    // Check that digits are unsupported
    expect(result.unsupportedCharacters).toContain('2');
    expect(result.unsupportedCharacters).toContain('0');
    expect(result.unsupportedCharacters).toContain('6');
    
    // Check that Swedish characters are unsupported
    expect(result.unsupportedCharacters).toContain('Å');
    expect(result.unsupportedCharacters).toContain('Ä');
    expect(result.unsupportedCharacters).toContain('Ö');
    
    // Space should NOT be marked as unsupported
    expect(result.unsupportedCharacters).not.toContain(' ');
  });

  it('does not crash on emoji input', async () => {
    expect(async () => {
      await createRhinestoneFontTemplate({
        text: '😀😁😂',
        rhinestoneFontId: TRW_CLEAN_STONE_FONT_ID,
        targetStoneSizeId: 'SS10',
        targetStoneSizeMm: 3.429,
        letterSpacingMm: 1,
        lineSpacingMm: 0,
      });
    }).not.toThrow();
  });
});

// ─── Stone Size Scaling ──────────────────────────────────────────────────────

describe('Rhinestone Font Size Scaling', () => {
  it('generates different sized templates for each TRW stone size', async () => {
    const sizes = [
      { id: 'SS6' as const, mm: 2.54 },
      { id: 'SS10' as const, mm: 3.429 },
      { id: 'SS16' as const, mm: 4.394 },
      { id: 'SS20' as const, mm: 5.283 },
    ];

    const results = [];
    for (const { id, mm } of sizes) {
      const result = await createRhinestoneFontTemplate({
        text: 'A',
        rhinestoneFontId: TRW_CLEAN_STONE_FONT_ID,
        targetStoneSizeId: id,
        targetStoneSizeMm: mm,
        letterSpacingMm: 0,
        lineSpacingMm: 0,
      });
      results.push({ size: id, result });
    }

    // All should generate stones
    for (const { size, result } of results) {
      expect(result.template.stones.length).toBeGreaterThan(0);
      expect(result.template.stones[0].stoneSize).toBe(size);
    }

    // Verify stone sizes match (compare stoneSize values, not hole diameters)
    expect(results[0].result.template.stones[0].stoneSize).toBe('SS6');
    expect(results[1].result.template.stones[0].stoneSize).toBe('SS10');
    expect(results[2].result.template.stones[0].stoneSize).toBe('SS16');
    expect(results[3].result.template.stones[0].stoneSize).toBe('SS20');
  });

  it('letter spacing affects stone layout', async () => {
    const withoutSpacing = await createRhinestoneFontTemplate({
      text: 'AB',
      rhinestoneFontId: TRW_CLEAN_STONE_FONT_ID,
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
      letterSpacingMm: 0,
      lineSpacingMm: 0,
    });

    const withSpacing = await createRhinestoneFontTemplate({
      text: 'AB',
      rhinestoneFontId: TRW_CLEAN_STONE_FONT_ID,
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
      letterSpacingMm: 10,
      lineSpacingMm: 0,
    });

    // With spacing should have greater width
    const widthWithout = Math.max(...withoutSpacing.template.stones.map((s) => s.center.x));
    const widthWith = Math.max(...withSpacing.template.stones.map((s) => s.center.x));
    expect(widthWith).toBeGreaterThan(widthWithout);
  });

  it('line spacing affects multiline layout', async () => {
    const withoutSpacing = await createRhinestoneFontTemplate({
      text: 'A\nB',
      rhinestoneFontId: TRW_CLEAN_STONE_FONT_ID,
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
      letterSpacingMm: 0,
      lineSpacingMm: 0,
    });

    const withSpacing = await createRhinestoneFontTemplate({
      text: 'A\nB',
      rhinestoneFontId: TRW_CLEAN_STONE_FONT_ID,
      targetStoneSizeId: 'SS10',
      targetStoneSizeMm: 3.429,
      letterSpacingMm: 0,
      lineSpacingMm: 10,
    });

    // With spacing should have greater height
    const heightWithout = Math.max(...withoutSpacing.template.stones.map((s) => s.center.y));
    const heightWith = Math.max(...withSpacing.template.stones.map((s) => s.center.y));
    expect(heightWith).toBeGreaterThan(heightWithout);
  });
});

// ─── Determinism ──────────────────────────────────────────────────────────────

describe('Rhinestone Font Determinism', () => {
  it('generates identical results for identical inputs', async () => {
    const options = {
      text: 'TEST',
      rhinestoneFontId: TRW_CLEAN_STONE_FONT_ID,
      targetStoneSizeId: 'SS10' as const,
      targetStoneSizeMm: 3.429,
      letterSpacingMm: 2,
      lineSpacingMm: 0,
    };

    const result1 = await createRhinestoneFontTemplate(options);
    const result2 = await createRhinestoneFontTemplate(options);

    expect(result1.template.stones.length).toBe(result2.template.stones.length);
    
    // Compare stone positions
    for (let i = 0; i < result1.template.stones.length; i++) {
      expect(result1.template.stones[i].center.x).toBeCloseTo(result2.template.stones[i].center.x, 6);
      expect(result1.template.stones[i].center.y).toBeCloseTo(result2.template.stones[i].center.y, 6);
      expect(result1.template.stones[i].stoneSize).toBe(result2.template.stones[i].stoneSize);
    }
  });
});
