import { describe, it, expect } from 'vitest';
import {
  calculateDotMatrixTextLayoutBounds,
  alignDotMatrixLine,
  computeTextScaleFactors,
  scaleDotMatrixTextPoints,
  GLYPH_COLUMNS,
  GLYPH_ROWS,
} from '../src/lib/rhinestone-engine/index.js';

const SPACING = 3.6; // example spacingMm for SS10
const LETTER_SP = 1;
const LINE_SP   = 2;

// ─── calculateDotMatrixTextLayoutBounds ───────────────────────────────────────

describe('calculateDotMatrixTextLayoutBounds', () => {
  it('single character has width=5*spacing, height=7*spacing', () => {
    const b = calculateDotMatrixTextLayoutBounds(['A'], SPACING, LETTER_SP, LINE_SP);
    expect(b.width).toBeCloseTo(GLYPH_COLUMNS * SPACING, 5);
    expect(b.height).toBeCloseTo(GLYPH_ROWS * SPACING, 5);
  });

  it('two-char line has correct width including letter spacing', () => {
    // "AB" → cols = 2*5 + 1*1 = 11
    const b = calculateDotMatrixTextLayoutBounds(['AB'], SPACING, 1, LINE_SP);
    expect(b.width).toBeCloseTo(11 * SPACING, 5);
  });

  it('multiline bounds use max line width', () => {
    // Line "A" = 5 cols, Line "AB" = 11 cols → max = 11
    const b = calculateDotMatrixTextLayoutBounds(['A', 'AB'], SPACING, 1, LINE_SP);
    expect(b.width).toBeCloseTo(11 * SPACING, 5);
  });

  it('multiline height includes line spacing', () => {
    // 2 lines × 7 rows + 1 gap × 2 = 16 rows
    const b = calculateDotMatrixTextLayoutBounds(['A', 'B'], SPACING, 1, 2);
    expect(b.height).toBeCloseTo(16 * SPACING, 5);
  });

  it('empty lines array returns zero bounds', () => {
    const b = calculateDotMatrixTextLayoutBounds([], SPACING, 1, LINE_SP);
    expect(b.width).toBe(0);
    expect(b.height).toBe(0);
  });

  it('minX and minY are 0', () => {
    const b = calculateDotMatrixTextLayoutBounds(['A'], SPACING, 1, LINE_SP);
    expect(b.minX).toBe(0);
    expect(b.minY).toBe(0);
  });
});

// ─── alignDotMatrixLine ───────────────────────────────────────────────────────

describe('alignDotMatrixLine', () => {
  it('left alignment always returns 0', () => {
    expect(alignDotMatrixLine(3, 5, 'left', 1)).toBe(0);
    expect(alignDotMatrixLine(5, 5, 'left', 1)).toBe(0);
  });

  it('center alignment shifts shorter line by half the difference', () => {
    // "A" (1 char = 5 cols) vs max "AB" (2 chars = 11 cols) → offset = (11-5)/2 = 3
    const offset = alignDotMatrixLine(1, 2, 'center', 1);
    expect(offset).toBeCloseTo(3, 5);
  });

  it('right alignment shifts shorter line by full difference', () => {
    // "A" (5 cols) vs max "AB" (11 cols) → offset = 11-5 = 6
    const offset = alignDotMatrixLine(1, 2, 'right', 1);
    expect(offset).toBeCloseTo(6, 5);
  });

  it('returns 0 when line length equals max length', () => {
    expect(alignDotMatrixLine(3, 3, 'center', 1)).toBe(0);
    expect(alignDotMatrixLine(3, 3, 'right', 1)).toBe(0);
  });

  it('returns 0 for zero-length line with left align', () => {
    expect(alignDotMatrixLine(0, 3, 'left', 1)).toBe(0);
  });
});

// ─── computeTextScaleFactors ──────────────────────────────────────────────────

describe('computeTextScaleFactors', () => {
  it('no targets returns {1, 1}', () => {
    const s = computeTextScaleFactors(100, 50);
    expect(s.scaleX).toBe(1);
    expect(s.scaleY).toBe(1);
  });

  it('targetWidthMm scales X (and Y uniformly) with preserveAspectRatio=true', () => {
    const s = computeTextScaleFactors(100, 50, 200, undefined, true);
    expect(s.scaleX).toBeCloseTo(2, 5);
    expect(s.scaleY).toBeCloseTo(2, 5);
  });

  it('targetHeightMm scales Y (and X uniformly) with preserveAspectRatio=true', () => {
    const s = computeTextScaleFactors(100, 50, undefined, 25, true);
    expect(s.scaleX).toBeCloseTo(0.5, 5);
    expect(s.scaleY).toBeCloseTo(0.5, 5);
  });

  it('both targets with preserveAspectRatio: uses smaller scale (fit inside box)', () => {
    // width=100, height=50; targetW=150, targetH=150
    // scaleW=1.5, scaleH=3.0 → min=1.5
    const s = computeTextScaleFactors(100, 50, 150, 150, true);
    expect(s.scaleX).toBeCloseTo(1.5, 5);
    expect(s.scaleY).toBeCloseTo(1.5, 5);
  });

  it('preserveAspectRatio=false stretches X and Y independently', () => {
    const s = computeTextScaleFactors(100, 50, 200, 150, false);
    expect(s.scaleX).toBeCloseTo(2, 5);
    expect(s.scaleY).toBeCloseTo(3, 5);
  });

  it('returns {1,1} when natural dimensions are 0 (guard against division by zero)', () => {
    const s = computeTextScaleFactors(0, 0, 100, 100);
    expect(s.scaleX).toBe(1);
    expect(s.scaleY).toBe(1);
  });
});

// ─── scaleDotMatrixTextPoints ─────────────────────────────────────────────────

describe('scaleDotMatrixTextPoints', () => {
  it('scales points by given factors', () => {
    const pts = [{ x: 10, y: 20 }, { x: 30, y: 40 }];
    const result = scaleDotMatrixTextPoints(pts, 2, 0.5);
    expect(result[0]).toEqual({ x: 20, y: 10 });
    expect(result[1]).toEqual({ x: 60, y: 20 });
  });

  it('does not mutate input', () => {
    const pts = [{ x: 10, y: 20 }];
    scaleDotMatrixTextPoints(pts, 3, 3);
    expect(pts[0]).toEqual({ x: 10, y: 20 });
  });
});
