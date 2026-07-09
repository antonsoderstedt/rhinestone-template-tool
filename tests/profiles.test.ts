import { describe, it, expect } from 'vitest';
import {
  STONE_SIZE_PROFILES,
  getStoneSizeProfile,
  MAGIC_FLOCK_CRICUT_MAKER_PROFILE,
  MATERIAL_PROFILES,
  getMaterialProfile,
  getRecommendedHoleDiameter,
  getRecommendedCenterDistance,
} from '../src/lib/rhinestone-engine/index.js';

// ─── Stone size profiles ──────────────────────────────────────────────────────

describe('STONE_SIZE_PROFILES', () => {
  it('has entries for all four stone sizes', () => {
    expect(Object.keys(STONE_SIZE_PROFILES)).toEqual(['SS6', 'SS8', 'SS10', 'SS12']);
  });

  it('SS10 stoneDiameterMm is 2.8', () => {
    expect(STONE_SIZE_PROFILES.SS10.stoneDiameterMm).toBe(2.8);
  });

  it('SS10 recommendedHoleDiameterMm is 3.0', () => {
    expect(STONE_SIZE_PROFILES.SS10.recommendedHoleDiameterMm).toBe(3.0);
  });

  it('SS10 minCenterDistanceMm is 3.35', () => {
    expect(STONE_SIZE_PROFILES.SS10.minCenterDistanceMm).toBe(3.35);
  });

  it('every stone profile has requiresPhysicalValidation true', () => {
    for (const profile of Object.values(STONE_SIZE_PROFILES)) {
      expect(profile.requiresPhysicalValidation).toBe(true);
    }
  });
});

describe('getStoneSizeProfile', () => {
  it('returns the correct profile for each size', () => {
    expect(getStoneSizeProfile('SS6').id).toBe('SS6');
    expect(getStoneSizeProfile('SS8').id).toBe('SS8');
    expect(getStoneSizeProfile('SS10').id).toBe('SS10');
    expect(getStoneSizeProfile('SS12').id).toBe('SS12');
  });
});

// ─── Material profiles ────────────────────────────────────────────────────────

describe('MAGIC_FLOCK_CRICUT_MAKER_PROFILE', () => {
  it('exists', () => {
    expect(MAGIC_FLOCK_CRICUT_MAKER_PROFILE).toBeDefined();
  });

  it('defaultStoneSize is SS10', () => {
    expect(MAGIC_FLOCK_CRICUT_MAKER_PROFILE.defaultStoneSize).toBe('SS10');
  });

  it('requiresCalibration is true', () => {
    expect(MAGIC_FLOCK_CRICUT_MAKER_PROFILE.requiresCalibration).toBe(true);
  });

  it('supports SS6, SS8, SS10, SS12', () => {
    const sizes = MAGIC_FLOCK_CRICUT_MAKER_PROFILE.supportedStoneSizes;
    expect(sizes).toContain('SS6');
    expect(sizes).toContain('SS8');
    expect(sizes).toContain('SS10');
    expect(sizes).toContain('SS12');
  });
});

describe('MATERIAL_PROFILES registry', () => {
  it('contains the magic-flock-cricut-maker profile', () => {
    expect(MATERIAL_PROFILES['magic-flock-cricut-maker']).toBeDefined();
  });

  it('getMaterialProfile returns the correct profile', () => {
    const profile = getMaterialProfile('magic-flock-cricut-maker');
    expect(profile.id).toBe('magic-flock-cricut-maker');
  });

  it('getMaterialProfile throws for unknown id', () => {
    expect(() => getMaterialProfile('does-not-exist')).toThrow();
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

describe('getRecommendedHoleDiameter', () => {
  it('returns 3.0 for SS10 with default material profile (kerf = 0)', () => {
    expect(getRecommendedHoleDiameter('SS10')).toBe(3.0);
  });

  it('returns correct value for explicit magic-flock-cricut-maker profile', () => {
    expect(getRecommendedHoleDiameter('SS10', 'magic-flock-cricut-maker')).toBe(3.0);
  });
});

describe('getRecommendedCenterDistance', () => {
  it('returns at least 3.35 for SS10 (safety margin applied)', () => {
    const dist = getRecommendedCenterDistance('SS10');
    // minCenterDistanceMm (3.35) + spacingSafetyMarginMm (0.25) = 3.60
    expect(dist).toBeGreaterThanOrEqual(3.35);
  });

  it('equals minCenterDistanceMm + spacingSafetyMarginMm for SS10', () => {
    const dist = getRecommendedCenterDistance('SS10', 'magic-flock-cricut-maker');
    expect(dist).toBe(3.35 + MAGIC_FLOCK_CRICUT_MAKER_PROFILE.spacingSafetyMarginMm);
  });
});
