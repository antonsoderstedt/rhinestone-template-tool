import { describe, expect, it } from 'vitest';
import {
  ALL_OVER_MAX_STONES,
  ALL_OVER_PATTERNS,
  checkExportReadiness,
  createAllOverTemplate,
  getMinimumCenterDistance,
  getRecommendedHoleDiameter,
  type AllOverPattern,
} from '../src/lib/rhinestone-engine/index';

const NOT_CUTTABLE = new Set(['STONE_OVERLAP', 'STONE_COLLISION', 'STONE_TIGHT_GAP', 'NO_STONES']);
const make = (pattern: AllOverPattern, extra = {}) =>
  createAllOverTemplate({ id: 't', name: 't', widthMm: 130, heightMm: 140, stoneSize: 'SS10', pattern, ...extra });

function closestPair(stones: ReadonlyArray<{ center: { x: number; y: number } }>) {
  let best = Infinity;
  for (let i = 0; i < stones.length; i++) {
    for (let j = i + 1; j < stones.length; j++) {
      const d = Math.hypot(stones[i]!.center.x - stones[j]!.center.x, stones[i]!.center.y - stones[j]!.center.y);
      if (d < best) best = d;
    }
  }
  return best;
}

describe('all-over templates (plan: jeans and whole garments)', () => {
  for (const { id } of ALL_OVER_PATTERNS) {
    it(`${id}: covers the area, stays inside it, and every stone can be cut`, () => {
      const template = make(id);
      expect(template.stones.length).toBeGreaterThan(100);
      const xs = template.stones.map((s) => s.center.x);
      const ys = template.stones.map((s) => s.center.y);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(10);
      expect(Math.max(...xs)).toBeLessThanOrEqual(10 + 130);
      expect(Math.max(...ys)).toBeLessThanOrEqual(10 + 140);
      const hole = getRecommendedHoleDiameter('SS10');
      expect(closestPair(template.stones)).toBeGreaterThanOrEqual(getMinimumCenterDistance(hole / 2, hole / 2) - 1e-6);
      expect(checkExportReadiness(template).issues.filter((i) => NOT_CUTTABLE.has(i.code))).toEqual([]);
    });
  }

  it('the grid is straight and the offset rows are shifted by half a stone', () => {
    const grid = make('grid', { densityPreset: 'standard' });
    const columns = new Set(grid.stones.map((s) => s.center.x));
    const rows = new Set(grid.stones.map((s) => s.center.y));
    expect(columns.size * rows.size).toBe(grid.stones.length);

    const hex = make('hex', { densityPreset: 'standard' });
    const rowYs = [...new Set(hex.stones.map((s) => s.center.y))].sort((a, b) => a - b);
    const firstX = Math.min(...hex.stones.filter((s) => s.center.y === rowYs[0]).map((s) => s.center.x));
    const secondX = Math.min(...hex.stones.filter((s) => s.center.y === rowYs[1]).map((s) => s.center.x));
    expect(secondX - firstX).toBeCloseTo(4.188 / 2, 2);
  });

  it('scatter is the same for the same seed, different for another, and evenly spread', () => {
    const a = make('scatter', { seed: 7 });
    const b = make('scatter', { seed: 7 });
    const c = make('scatter', { seed: 8 });
    expect(a.stones.map((s) => s.center)).toEqual(b.stones.map((s) => s.center));
    expect(a.stones.map((s) => s.center)).not.toEqual(c.stones.map((s) => s.center));
    // Each quarter of the area holds a fair share (an even spread, not clumps).
    const quarters = [0, 0, 0, 0];
    for (const s of a.stones) quarters[(s.center.x > 75 ? 1 : 0) + (s.center.y > 80 ? 2 : 0)]!++;
    const mean = a.stones.length / 4;
    for (const count of quarters) expect(Math.abs(count - mean)).toBeLessThan(mean * 0.35);
  });

  it('fade is denser at the top than at the bottom', () => {
    const fade = createAllOverTemplate({ id: 'f', name: 'f', widthMm: 200, heightMm: 300, stoneSize: 'SS10', pattern: 'fade', fadeRatio: 2.5 });
    const top = fade.stones.filter((s) => s.center.y < 10 + 100).length;
    const bottom = fade.stones.filter((s) => s.center.y > 10 + 200).length;
    expect(top).toBeGreaterThan(bottom * 1.5);
  });

  it('a stone size is chosen by the preset, and Airy is wider than Standard', () => {
    expect(make('hex', { densityPreset: 'airy' }).stones.length).toBeLessThan(make('hex', { densityPreset: 'standard' }).stones.length);
    expect(make('grid', { densityPreset: 'custom', customSpacingMm: 6 }).metadata?.['resolvedSpacingMm']).toBe(6);
  });

  it('refuses an area that would need too many stones, and bad sizes', () => {
    expect(() => createAllOverTemplate({ id: 'x', name: 'x', widthMm: 3000, heightMm: 3000, stoneSize: 'SS6', pattern: 'hex', densityPreset: 'dense' })).toThrow(new RegExp(String(ALL_OVER_MAX_STONES)));
    expect(() => createAllOverTemplate({ id: 'x', name: 'x', widthMm: 0, heightMm: 10, stoneSize: 'SS10', pattern: 'grid' })).toThrow(/positive/);
  });

  it('is deterministic for every pattern', () => {
    for (const { id } of ALL_OVER_PATTERNS) expect(make(id).stones).toEqual(make(id).stones);
  });
});
