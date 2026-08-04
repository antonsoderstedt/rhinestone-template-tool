import { describe, it, expect } from 'vitest';
import {
  getDensitySpacing,
  getDensityPresetOptions,
  getRecommendedCenterDistance,
  getRecommendedHoleDiameter,
  getMinimumCenterDistance,
  createDotMatrixTextTemplate,
  createPolylineRhinestoneTemplate,
  createStoneGridTemplate,
} from '../src/lib/rhinestone-engine/index.js';
import type { Polyline } from '../src/lib/rhinestone-engine/index.js';

// ─── getDensitySpacing ────────────────────────────────────────────────────────

describe('getDensitySpacing — presets', () => {
  it('standard equals recommended center distance', () => {
    const recommended = getRecommendedCenterDistance('SS10');
    const result = getDensitySpacing({ stoneSize: 'SS10', preset: 'standard' });
    expect(result.spacingMm).toBe(recommended);
  });

  it('safe is larger than standard by 0.25 mm', () => {
    const standard = getDensitySpacing({ stoneSize: 'SS10', preset: 'standard' });
    const safe     = getDensitySpacing({ stoneSize: 'SS10', preset: 'safe' });
    expect(safe.spacingMm - standard.spacingMm).toBeCloseTo(0.25, 5);
    expect(safe.spacingMm).toBeGreaterThan(standard.spacingMm);
  });

  it('dense is smaller than standard', () => {
    const standard = getDensitySpacing({ stoneSize: 'SS10', preset: 'standard' });
    const dense    = getDensitySpacing({ stoneSize: 'SS10', preset: 'dense' });
    expect(dense.spacingMm).toBeLessThanOrEqual(standard.spacingMm);
  });

  it('dense is never below minAllowedSpacingMm', () => {
    for (const stoneSize of ['SS6', 'SS8', 'SS10', 'SS12'] as const) {
      const dense = getDensitySpacing({ stoneSize, preset: 'dense' });
      expect(dense.spacingMm).toBeGreaterThanOrEqual(dense.minAllowedSpacingMm);
    }
  });

  it('loose is larger than standard by 0.5 mm', () => {
    const standard = getDensitySpacing({ stoneSize: 'SS10', preset: 'standard' });
    const loose    = getDensitySpacing({ stoneSize: 'SS10', preset: 'loose' });
    expect(loose.spacingMm - standard.spacingMm).toBeCloseTo(0.5, 5);
    expect(loose.spacingMm).toBeGreaterThan(standard.spacingMm);
  });

  it('ordering: safe > standard > dense, loose > standard', () => {
    const safe     = getDensitySpacing({ stoneSize: 'SS10', preset: 'safe' }).spacingMm;
    const standard = getDensitySpacing({ stoneSize: 'SS10', preset: 'standard' }).spacingMm;
    const dense    = getDensitySpacing({ stoneSize: 'SS10', preset: 'dense' }).spacingMm;
    const loose    = getDensitySpacing({ stoneSize: 'SS10', preset: 'loose' }).spacingMm;
    expect(safe).toBeGreaterThan(standard);
    expect(dense).toBeLessThanOrEqual(standard);
    expect(loose).toBeGreaterThan(standard);
  });

  it('minAllowedSpacingMm equals holeDiameterMm + minimumEdgeSpacingMm for the material', () => {
    const result = getDensitySpacing({ stoneSize: 'SS10', preset: 'standard' });
    // Magic Flock SS10 hole preset (3.43) + minimumEdgeSpacingMm (0.508) = 3.938
    expect(result.minAllowedSpacingMm).toBeCloseTo(3.938, 6);
  });

  it('dense warning is undefined when not clamped (SS10)', () => {
    // SS10: recommended 4.188, dense target 4.038, minAllowed 3.938 → no clamp
    const dense = getDensitySpacing({ stoneSize: 'SS10', preset: 'dense' });
    expect(dense.warning).toBeUndefined();
  });

  it('result includes stoneSize and recommendedCenterDistanceMm', () => {
    const result = getDensitySpacing({ stoneSize: 'SS10', preset: 'standard' });
    expect(result.stoneSize).toBe('SS10');
    expect(result.recommendedCenterDistanceMm).toBe(getRecommendedCenterDistance('SS10'));
  });
});

describe('getDensitySpacing — custom preset', () => {
  it('custom spacing works when valid', () => {
    const minAllowed = getMinimumCenterDistance(getRecommendedHoleDiameter('SS10') / 2, getRecommendedHoleDiameter('SS10') / 2);
    const custom = minAllowed + 1.0;
    const result = getDensitySpacing({ stoneSize: 'SS10', preset: 'custom', customSpacingMm: custom });
    expect(result.spacingMm).toBe(custom);
  });

  it('custom spacing below minAllowedSpacingMm throws', () => {
    const minAllowed = getMinimumCenterDistance(getRecommendedHoleDiameter('SS10') / 2, getRecommendedHoleDiameter('SS10') / 2);
    expect(() =>
      getDensitySpacing({ stoneSize: 'SS10', preset: 'custom', customSpacingMm: minAllowed - 0.1 }),
    ).toThrow(/minimum/i);
  });

  it('custom with missing customSpacingMm throws', () => {
    expect(() =>
      getDensitySpacing({ stoneSize: 'SS10', preset: 'custom' }),
    ).toThrow(/custom/i);
  });

  it('custom with zero throws', () => {
    expect(() =>
      getDensitySpacing({ stoneSize: 'SS10', preset: 'custom', customSpacingMm: 0 }),
    ).toThrow();
  });

  it('custom with negative throws', () => {
    expect(() =>
      getDensitySpacing({ stoneSize: 'SS10', preset: 'custom', customSpacingMm: -1 }),
    ).toThrow();
  });
});

describe('getDensityPresetOptions', () => {
  it('returns all 5 presets', () => {
    const opts = getDensityPresetOptions();
    const values = opts.map((o) => o.value);
    expect(values).toEqual(['safe', 'standard', 'dense', 'loose', 'custom']);
  });

  it('each option has value, label, and description', () => {
    for (const opt of getDensityPresetOptions()) {
      expect(typeof opt.value).toBe('string');
      expect(typeof opt.label).toBe('string');
      expect(typeof opt.description).toBe('string');
    }
  });
});

// ─── Template integration ─────────────────────────────────────────────────────

describe('createDotMatrixTextTemplate — densityPreset', () => {
  it('standard preset produces same stone count as no preset (both use recommended spacing)', () => {
    const withPreset    = createDotMatrixTextTemplate({ id:'t', name:'T', text:'A', stoneSize:'SS10', densityPreset:'standard' });
    const withoutPreset = createDotMatrixTextTemplate({ id:'t', name:'T', text:'A', stoneSize:'SS10' });
    expect(withPreset.stones.length).toBe(withoutPreset.stones.length);
  });

  it('loose preset produces physically larger layout than standard', () => {
    const standard = createDotMatrixTextTemplate({ id:'t', name:'T', text:'A', stoneSize:'SS10', densityPreset:'standard' });
    const loose    = createDotMatrixTextTemplate({ id:'t', name:'T', text:'A', stoneSize:'SS10', densityPreset:'loose' });
    const standardMaxX = Math.max(...standard.stones.map((s) => s.center.x));
    const looseMaxX    = Math.max(...loose.stones.map((s) => s.center.x));
    expect(looseMaxX).toBeGreaterThan(standardMaxX);
  });

  it('metadata contains densityPreset and resolvedSpacingMm', () => {
    const t = createDotMatrixTextTemplate({ id:'t', name:'T', text:'A', stoneSize:'SS10', densityPreset:'loose' });
    expect(t.metadata?.densityPreset).toBe('loose');
    expect(typeof t.metadata?.resolvedSpacingMm).toBe('number');
  });

  it('custom spacing metadata is preserved', () => {
    const custom = getMinimumCenterDistance(getRecommendedHoleDiameter('SS10') / 2, getRecommendedHoleDiameter('SS10') / 2) + 1.0;
    const t = createDotMatrixTextTemplate({ id:'t', name:'T', text:'A', stoneSize:'SS10', densityPreset:'custom', customSpacingMm: custom });
    expect(t.metadata?.densityPreset).toBe('custom');
    expect(t.metadata?.resolvedSpacingMm).toBe(custom);
  });
});

describe('createPolylineRhinestoneTemplate — densityPreset', () => {
  const LINE: Polyline = { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] };

  it('loose preset places fewer stones than standard (less dense = fewer stones per path)', () => {
    const standard = createPolylineRhinestoneTemplate({ id:'t', name:'T', polylines:[LINE], stoneSize:'SS10', densityPreset:'standard' });
    const loose    = createPolylineRhinestoneTemplate({ id:'t', name:'T', polylines:[LINE], stoneSize:'SS10', densityPreset:'loose' });
    expect(loose.stones.length).toBeLessThan(standard.stones.length);
  });

  it('dense preset places more stones than standard', () => {
    const standard = createPolylineRhinestoneTemplate({ id:'t', name:'T', polylines:[LINE], stoneSize:'SS10', densityPreset:'standard' });
    const dense    = createPolylineRhinestoneTemplate({ id:'t', name:'T', polylines:[LINE], stoneSize:'SS10', densityPreset:'dense' });
    expect(dense.stones.length).toBeGreaterThanOrEqual(standard.stones.length);
  });

  it('metadata contains densityPreset and resolvedSpacingMm', () => {
    const t = createPolylineRhinestoneTemplate({ id:'t', name:'T', polylines:[LINE], stoneSize:'SS10', densityPreset:'safe' });
    expect(t.metadata?.densityPreset).toBe('safe');
    expect(typeof t.metadata?.resolvedSpacingMm).toBe('number');
  });
});

describe('createStoneGridTemplate — densityPreset', () => {
  it('standard preset works and records metadata', () => {
    const t = createStoneGridTemplate({ id:'t', name:'T', stoneSize:'SS10', columns:3, rows:2, densityPreset:'standard' });
    expect(t.metadata?.densityPreset).toBe('standard');
    expect(typeof t.metadata?.resolvedSpacingMm).toBe('number');
  });

  it('loose preset produces a physically larger grid', () => {
    const standard = createStoneGridTemplate({ id:'t', name:'T', stoneSize:'SS10', columns:3, rows:2, densityPreset:'standard' });
    const loose    = createStoneGridTemplate({ id:'t', name:'T', stoneSize:'SS10', columns:3, rows:2, densityPreset:'loose' });
    const standardMaxX = Math.max(...standard.stones.map((s) => s.center.x));
    const looseMaxX    = Math.max(...loose.stones.map((s) => s.center.x));
    expect(looseMaxX).toBeGreaterThan(standardMaxX);
  });

  it('invalid custom spacing throws before creating template', () => {
    expect(() =>
      createStoneGridTemplate({ id:'t', name:'T', stoneSize:'SS10', columns:1, rows:1, densityPreset:'custom', customSpacingMm: 0.1 }),
    ).toThrow();
  });
});
