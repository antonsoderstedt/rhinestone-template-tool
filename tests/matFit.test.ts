import { describe, expect, it } from 'vitest';
import {
  CRICUT_MAT_12X12_USABLE_MM,
  HIGH_STONE_COUNT_THRESHOLD,
  getFitToMatScale,
  getMatFit,
} from '../src/lib/rhinestone-engine/index';

describe('getFitToMatScale', () => {
  it('returns 1 for a design that already fits the mat', () => {
    expect(getFitToMatScale(200, 100, '12x12')).toEqual({ scale: 1, rotated: false, alreadyFits: true });
  });

  it('shrinks an oversized design so it fits the 12 x 12 mat', () => {
    const { scale, alreadyFits } = getFitToMatScale(400, 200, '12x12');
    expect(alreadyFits).toBe(false);
    expect(scale).toBeCloseTo(CRICUT_MAT_12X12_USABLE_MM.shortSide / 400, 6);
    expect(getMatFit(400 * scale, 200 * scale).status).toBe('fits-12x12');
  });

  it('prefers the orientation that needs less shrinking on a 12 x 24 mat', () => {
    const wide = getFitToMatScale(900, 200, '12x24');
    expect(wide.rotated).toBe(true); // 900 mm runs along the 597 mm side
    expect(getMatFit(900 * wide.scale, 200 * wide.scale).status).not.toBe('too-large');
  });

  it('leaves a margin when asked, so rounding to whole stones still fits', () => {
    const tight = getFitToMatScale(400, 400, '12x12');
    const roomy = getFitToMatScale(400, 400, '12x12', 0.03);
    expect(roomy.scale).toBeLessThan(tight.scale);
    expect(roomy.scale).toBeCloseTo(tight.scale * 0.97, 6);
  });

  it('never scales up and ignores unusable sizes', () => {
    expect(getFitToMatScale(10, 10, '12x12').scale).toBe(1);
    expect(getFitToMatScale(0, 10, '12x12').scale).toBe(1);
    expect(getFitToMatScale(Number.NaN, 10, '12x12').alreadyFits).toBe(true);
  });
});

describe('thresholds', () => {
  it('warns above 1500 stones', () => {
    expect(HIGH_STONE_COUNT_THRESHOLD).toBe(1500);
  });
});
