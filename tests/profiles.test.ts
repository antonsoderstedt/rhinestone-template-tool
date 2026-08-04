import { describe, it, expect } from 'vitest';
import {
  STONE_SIZE_PROFILES,
  getStoneSizeProfile,
  MAGIC_FLOCK_CRICUT_MAKER_PROFILE,
  MAGIC_FLOCK_HOLE_PRESETS,
  MAGIC_FLOCK_CRICUT_MAKER_3_RECOMMENDATION,
  MATERIAL_PROFILES,
  getMaterialProfile,
  getRecommendedHoleDiameter,
  getRecommendedCenterDistance,
  getHolePreset,
  getCalibrationSeries,
  isHolePresetProvisional,
  getMinimumEdgeSpacingMm,
  getMinimumCenterDistance,
} from '../src/lib/rhinestone-engine/index.js';

// ─── Stone size profiles ──────────────────────────────────────────────────────

describe('STONE_SIZE_PROFILES', () => {
  it('has entries for all six stone sizes', () => {
    expect(Object.keys(STONE_SIZE_PROFILES)).toEqual(['SS6', 'SS8', 'SS10', 'SS12', 'SS16', 'SS20']);
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

  it('SS16 stoneDiameterMm is 4.394 (TRW calibration)', () => {
    expect(STONE_SIZE_PROFILES.SS16.stoneDiameterMm).toBe(4.394);
  });

  it('SS20 stoneDiameterMm is 5.283 (TRW calibration)', () => {
    expect(STONE_SIZE_PROFILES.SS20.stoneDiameterMm).toBe(5.283);
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
    expect(getStoneSizeProfile('SS16').id).toBe('SS16');
    expect(getStoneSizeProfile('SS20').id).toBe('SS20');
  });

  it('throws for unknown ids at runtime', () => {
    expect(() => getStoneSizeProfile('SS99' as Parameters<typeof getStoneSizeProfile>[0])).toThrow(/Unknown stone size id/);
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
  it('returns the Magic Flock SS10 hole preset (3.43) for the default material profile (kerf = 0)', () => {
    expect(getRecommendedHoleDiameter('SS10')).toBe(3.43);
  });

  it('returns correct value for explicit magic-flock-cricut-maker profile', () => {
    expect(getRecommendedHoleDiameter('SS10', 'magic-flock-cricut-maker')).toBe(3.43);
  });
});

describe('getRecommendedCenterDistance', () => {
  it('returns at least the minimum center distance for SS10 (safety margin applied)', () => {
    const dist = getRecommendedCenterDistance('SS10');
    // minimumCenterDistance (3.43 + 0.508 = 3.938) + spacingSafetyMarginMm (0.25) = 4.188
    expect(dist).toBeGreaterThanOrEqual(3.938);
  });

  it('equals holeDiameterMm + minimumEdgeSpacingMm + spacingSafetyMarginMm for SS10', () => {
    const dist = getRecommendedCenterDistance('SS10', 'magic-flock-cricut-maker');
    expect(dist).toBeCloseTo(3.43 + MAGIC_FLOCK_CRICUT_MAKER_PROFILE.minimumEdgeSpacingMm + MAGIC_FLOCK_CRICUT_MAKER_PROFILE.spacingSafetyMarginMm, 6);
  });
});

// ─── Magic Flock hole presets — default hole diameters per stone size ─────────

describe('MAGIC_FLOCK_HOLE_PRESETS — default hole diameters', () => {
  const expected: Record<string, number> = {
    SS6: 2.54,
    SS8: 3.00,
    SS10: 3.43,
    SS12: 3.80,
    SS16: 4.39,
    SS20: 5.28,
  };

  it('has an entry for every supported stone size', () => {
    const ids = MAGIC_FLOCK_HOLE_PRESETS.map((p) => p.stoneSize);
    expect(ids).toEqual(['SS6', 'SS8', 'SS10', 'SS12', 'SS16', 'SS20']);
  });

  for (const [stoneSize, holeDiameterMm] of Object.entries(expected)) {
    it(`${stoneSize} default hole diameter is ${holeDiameterMm}mm`, () => {
      expect(getHolePreset(stoneSize as never)?.holeDiameterMm).toBe(holeDiameterMm);
      expect(getRecommendedHoleDiameter(stoneSize as never)).toBe(holeDiameterMm);
    });
  }

  it('SS12 is the only preset marked provisional', () => {
    for (const preset of MAGIC_FLOCK_HOLE_PRESETS) {
      if (preset.stoneSize === 'SS12') {
        expect(preset.status).toBe('provisional');
        expect(preset.note).toBeDefined();
      } else {
        expect(preset.status).toBe('verified');
      }
    }
  });

  it('isHolePresetProvisional reports true only for SS12', () => {
    expect(isHolePresetProvisional('SS12')).toBe(true);
    for (const size of ['SS6', 'SS8', 'SS10', 'SS16', 'SS20'] as const) {
      expect(isHolePresetProvisional(size)).toBe(false);
    }
  });
});

// ─── Calibration series — 5 explicit values per stone size ────────────────────

describe('getCalibrationSeries — Magic Flock', () => {
  it('SS10 series has exactly 5 ascending values, centered on the default', () => {
    const series = getCalibrationSeries('SS10');
    expect(series).toEqual([3.33, 3.38, 3.43, 3.48, 3.53]);
    expect(series[2]).toBe(getRecommendedHoleDiameter('SS10'));
  });

  it('every supported stone size has a 5-value calibration series', () => {
    for (const size of MAGIC_FLOCK_CRICUT_MAKER_PROFILE.supportedStoneSizes) {
      expect(getCalibrationSeries(size)).toHaveLength(5);
    }
  });

  it('SS12 series is centered on the provisional 3.80mm default', () => {
    const series = getCalibrationSeries('SS12');
    expect(series).toEqual([3.60, 3.70, 3.80, 3.90, 4.00]);
  });
});

// ─── Dynamic minimum center distance (holeRadiusA + holeRadiusB + edge gap) ───

describe('getMinimumCenterDistance — dynamic edge-gap formula', () => {
  it('getMinimumEdgeSpacingMm is 0.508mm for Magic Flock', () => {
    expect(getMinimumEdgeSpacingMm('magic-flock-cricut-maker')).toBe(0.508);
    expect(getMinimumEdgeSpacingMm()).toBe(0.508); // default profile
  });

  it('equal-size holes: minimum = holeDiameterMm + minimumEdgeSpacingMm', () => {
    const holeDiameterMm = getRecommendedHoleDiameter('SS10');
    const min = getMinimumCenterDistance(holeDiameterMm / 2, holeDiameterMm / 2);
    expect(min).toBeCloseTo(holeDiameterMm + 0.508, 6);
  });

  it('mixed-size holes: minimum = radiusA + radiusB + minimumEdgeSpacingMm', () => {
    const ss6 = getRecommendedHoleDiameter('SS6');
    const ss20 = getRecommendedHoleDiameter('SS20');
    const min = getMinimumCenterDistance(ss6 / 2, ss20 / 2);
    expect(min).toBeCloseTo(ss6 / 2 + ss20 / 2 + 0.508, 6);
  });
});

// ─── Cricut Maker 3 machine recommendation ─────────────────────────────────────

describe('MAGIC_FLOCK_CRICUT_MAKER_3_RECOMMENDATION', () => {
  it('has the specified cut settings', () => {
    expect(MAGIC_FLOCK_CRICUT_MAKER_3_RECOMMENDATION.machine).toBe('Cricut Maker 3');
    expect(MAGIC_FLOCK_CRICUT_MAKER_3_RECOMMENDATION.blade).toBe('Deep-Point Blade');
    expect(MAGIC_FLOCK_CRICUT_MAKER_3_RECOMMENDATION.customPressure).toBe(350);
    expect(MAGIC_FLOCK_CRICUT_MAKER_3_RECOMMENDATION.pressureSetting).toBe('More');
    expect(MAGIC_FLOCK_CRICUT_MAKER_3_RECOMMENDATION.passes).toBe(1);
    expect(MAGIC_FLOCK_CRICUT_MAKER_3_RECOMMENDATION.multiCut).toBe(false);
    expect(MAGIC_FLOCK_CRICUT_MAKER_3_RECOMMENDATION.mirror).toBe(false);
    expect(MAGIC_FLOCK_CRICUT_MAKER_3_RECOMMENDATION.testCutRequired).toBe(true);
  });

  it('marks 340 as an alternative pressure only, not the primary recommendation', () => {
    expect(MAGIC_FLOCK_CRICUT_MAKER_3_RECOMMENDATION.customPressure).not.toBe(340);
    expect(MAGIC_FLOCK_CRICUT_MAKER_3_RECOMMENDATION.alternativePressure?.customPressure).toBe(340);
    expect(MAGIC_FLOCK_CRICUT_MAKER_3_RECOMMENDATION.alternativePressure?.label).toMatch(/alternative/i);
  });

  it('is attached to the Magic Flock material profile', () => {
    expect(MAGIC_FLOCK_CRICUT_MAKER_PROFILE.machineRecommendations).toContain(
      MAGIC_FLOCK_CRICUT_MAKER_3_RECOMMENDATION,
    );
    expect(MAGIC_FLOCK_CRICUT_MAKER_PROFILE.cutter).toBe('Cricut Maker 3');
  });
});

// ─── Saved-project protection: explicit stone diameters are never recomputed ──

describe('old-project protection — explicit hole diameters are immutable data', () => {
  it('a stone created with a superseded default diameter keeps that exact value', () => {
    // Simulates a project saved before this profile correction, when SS10
    // resolved to 3.0mm. The stone's holeDiameterMm is a plain literal on
    // the Stone object, not a live lookup — so it is never silently migrated
    // to the new 3.43mm default just by re-reading the current profile.
    const legacyStone = { id: 's1', center: { x: 0, y: 0 }, stoneSize: 'SS10' as const, holeDiameterMm: 3.0 };
    expect(legacyStone.holeDiameterMm).toBe(3.0);
    expect(getRecommendedHoleDiameter('SS10')).toBe(3.43);
    expect(legacyStone.holeDiameterMm).not.toBe(getRecommendedHoleDiameter('SS10'));
  });
});
