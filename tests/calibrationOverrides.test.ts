import { describe, it, expect } from 'vitest';
import {
  createCalibrationOverrideSet,
  getCalibratedHoleDiameter,
  applyCalibrationOverridesToTemplate,
  createStoneGridTemplate,
  createBasicSvgExport,
  getRecommendedHoleDiameter,
} from '../src/lib/rhinestone-engine/index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PROFILE_ID = 'magic-flock-cricut-maker';

function makeOverrideSet() {
  return createCalibrationOverrideSet({
    id: 'test-overrides',
    name: 'My calibrated settings',
    materialProfileId: PROFILE_ID,
    overrides: [
      { stoneSize: 'SS10', holeDiameterMm: 2.8 }, // smaller than default 3.0
      { stoneSize: 'SS8',  holeDiameterMm: 2.4 },
    ],
  });
}

// ─── createCalibrationOverrideSet ────────────────────────────────────────────

describe('createCalibrationOverrideSet', () => {
  it('creates a valid override set', () => {
    const set = makeOverrideSet();
    expect(set.id).toBe('test-overrides');
    expect(set.overrides).toHaveLength(2);
  });

  it('rejects holeDiameterMm <= 0', () => {
    expect(() =>
      createCalibrationOverrideSet({
        id: 'bad', name: 'Bad', materialProfileId: PROFILE_ID,
        overrides: [{ stoneSize: 'SS10', holeDiameterMm: 0 }],
      }),
    ).toThrow(/holeDiameterMm/);
  });

  it('rejects negative holeDiameterMm', () => {
    expect(() =>
      createCalibrationOverrideSet({
        id: 'bad', name: 'Bad', materialProfileId: PROFILE_ID,
        overrides: [{ stoneSize: 'SS10', holeDiameterMm: -1 }],
      }),
    ).toThrow();
  });

  it('assigns materialProfileId to every override', () => {
    const set = makeOverrideSet();
    for (const o of set.overrides) {
      expect(o.materialProfileId).toBe(PROFILE_ID);
    }
  });
});

// ─── getCalibratedHoleDiameter ────────────────────────────────────────────────

describe('getCalibratedHoleDiameter', () => {
  it('returns the override value when an override exists', () => {
    const set = makeOverrideSet();
    expect(getCalibratedHoleDiameter('SS10', PROFILE_ID, set)).toBe(2.8);
  });

  it('falls back to recommended when no override exists for that size', () => {
    const set = makeOverrideSet();
    const recommended = getRecommendedHoleDiameter('SS6', PROFILE_ID);
    expect(getCalibratedHoleDiameter('SS6', PROFILE_ID, set)).toBe(recommended);
  });

  it('falls back to recommended when no overrideSet is given', () => {
    const recommended = getRecommendedHoleDiameter('SS10', PROFILE_ID);
    expect(getCalibratedHoleDiameter('SS10', PROFILE_ID)).toBe(recommended);
  });
});

// ─── applyCalibrationOverridesToTemplate ─────────────────────────────────────

describe('applyCalibrationOverridesToTemplate', () => {
  const GRID = createStoneGridTemplate({
    id: 'g', name: 'G', stoneSize: 'SS10', columns: 3, rows: 1,
  });

  it('updates holeDiameterMm for matching stone sizes', () => {
    const set = makeOverrideSet();
    const updated = applyCalibrationOverridesToTemplate(GRID, set);
    for (const stone of updated.stones) {
      expect(stone.holeDiameterMm).toBe(2.8); // override value
    }
  });

  it('does not mutate the original template', () => {
    const originalDiam = GRID.stones[0]!.holeDiameterMm;
    const set = makeOverrideSet();
    applyCalibrationOverridesToTemplate(GRID, set);
    expect(GRID.stones[0]!.holeDiameterMm).toBe(originalDiam);
  });

  it('updated stones have calibration metadata', () => {
    const set = makeOverrideSet();
    const updated = applyCalibrationOverridesToTemplate(GRID, set);
    for (const stone of updated.stones) {
      expect(stone.metadata?.calibrated).toBe(true);
      expect(stone.metadata?.calibratedHoleDiameterMm).toBe(2.8);
      expect(stone.metadata?.originalHoleDiameterMm).toBe(
        getRecommendedHoleDiameter('SS10', PROFILE_ID),
      );
    }
  });

  it('leaves non-overridden stone sizes unchanged', () => {
    // Create a mixed template: SS10 stones get override, SS6 do not
    const mixedGrid = createStoneGridTemplate({
      id: 'mixed', name: 'Mixed', stoneSize: 'SS6', columns: 2, rows: 1,
    });
    const ss6Recommended = getRecommendedHoleDiameter('SS6', PROFILE_ID);
    const set = makeOverrideSet(); // only SS10 and SS8 overridden

    const updated = applyCalibrationOverridesToTemplate(mixedGrid, set);
    for (const stone of updated.stones) {
      expect(stone.holeDiameterMm).toBe(ss6Recommended); // SS6 has no override
      expect(stone.metadata?.calibrated).toBeUndefined();
    }
  });

  it('returns a new template (not the same object reference)', () => {
    const set = makeOverrideSet();
    const updated = applyCalibrationOverridesToTemplate(GRID, set);
    expect(updated).not.toBe(GRID);
    expect(updated.stones).not.toBe(GRID.stones);
  });

  it('output is deterministic — same input gives same result', () => {
    const set = makeOverrideSet();
    const r1 = applyCalibrationOverridesToTemplate(GRID, set);
    const r2 = applyCalibrationOverridesToTemplate(GRID, set);
    expect(r1.stones.map((s) => s.holeDiameterMm)).toEqual(
      r2.stones.map((s) => s.holeDiameterMm),
    );
  });

  it('calibrated template exports with createBasicSvgExport', () => {
    const set = makeOverrideSet();
    const updated = applyCalibrationOverridesToTemplate(GRID, set);
    expect(() => createBasicSvgExport(updated)).not.toThrow();
  });

  it('exported SVG uses calibrated hole diameter (radius = calibrated / 2)', () => {
    const set = makeOverrideSet(); // SS10 → 2.8mm
    const updated = applyCalibrationOverridesToTemplate(GRID, set);
    const svg = createBasicSvgExport(updated);
    // Calibrated radius = 2.8 / 2 = 1.4
    expect(svg).toContain('r="1.4"');
    // Default radius = 3.0 / 2 = 1.5 should NOT appear
    expect(svg).not.toContain('r="1.5"');
  });
});
