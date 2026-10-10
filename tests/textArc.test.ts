import { describe, expect, it } from 'vitest';
import { warpPolylinesOnArc } from '../src/lib/rhinestone-engine/geometry/textArc';
import type { Polyline } from '../src/lib/rhinestone-engine/path/polyline';

function widthOf(polylines: Polyline[]): number {
  const xs = polylines.flatMap((pl) => pl.points.map((pt) => pt.x));
  return Math.max(...xs) - Math.min(...xs);
}

const STRAIGHT_LINE: Polyline[] = [
  { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], closed: false },
];

const SYMMETRIC_TEXT: Polyline[] = [
  { points: [{ x: 0, y: 0 }, { x: 20, y: -5 }, { x: 40, y: 0 }], closed: false },
  { points: [{ x: 60, y: 0 }, { x: 80, y: -5 }, { x: 100, y: 0 }], closed: true },
];

describe('warpPolylinesOnArc', () => {
  it('throws on a non-finite curveAmount', () => {
    expect(() => warpPolylinesOnArc(STRAIGHT_LINE, { curveAmount: NaN })).toThrow();
    expect(() => warpPolylinesOnArc(STRAIGHT_LINE, { curveAmount: Infinity })).toThrow();
  });

  it('returns an identity clone (not the same reference) when curveAmount is 0', () => {
    const result = warpPolylinesOnArc(STRAIGHT_LINE, { curveAmount: 0 });
    expect(result).toEqual(STRAIGHT_LINE);
    expect(result).not.toBe(STRAIGHT_LINE);
    expect(result[0]).not.toBe(STRAIGHT_LINE[0]);
  });

  it('returns an empty array for empty input', () => {
    expect(warpPolylinesOnArc([], { curveAmount: 0.5 })).toEqual([]);
  });

  it('preserves closed/open flags per polyline', () => {
    const result = warpPolylinesOnArc(SYMMETRIC_TEXT, { curveAmount: 0.4 });
    expect(result[0]!.closed).toBe(false);
    expect(result[1]!.closed).toBe(true);
  });

  it('leaves a degenerate (zero-width) input unchanged', () => {
    const zeroWidth: Polyline[] = [{ points: [{ x: 5, y: 0 }, { x: 5, y: 10 }], closed: false }];
    const result = warpPolylinesOnArc(zeroWidth, { curveAmount: 0.5 });
    expect(result).toEqual(zeroWidth);
  });

  it('maps the centre baseline point (x = centerX, y = 0) to itself for any curveAmount', () => {
    for (const curveAmount of [0.1, 0.5, 1, -0.3, -1]) {
      const centered: Polyline[] = [{ points: [{ x: 50, y: 0 }], closed: false }];
      const result = warpPolylinesOnArc(centered, { curveAmount });
      expect(result[0]!.points[0]!.x).toBeCloseTo(50, 6);
      expect(result[0]!.points[0]!.y).toBeCloseTo(0, 6);
    }
  });

  it('always foreshortens horizontal extent for a non-zero curveAmount', () => {
    for (const curveAmount of [0.1, 0.5, 0.9, -0.1, -0.5, -0.9]) {
      const result = warpPolylinesOnArc(STRAIGHT_LINE, { curveAmount });
      expect(widthOf(result)).toBeLessThan(widthOf(STRAIGHT_LINE));
    }
  });

  it('preserves left-right mirror symmetry of symmetric input', () => {
    const result = warpPolylinesOnArc(SYMMETRIC_TEXT, { curveAmount: 0.6 });
    const points = result.flatMap((pl) => pl.points);
    const centerX = 50;
    for (const point of points) {
      const mirrorX = 2 * centerX - point.x;
      const match = points.find((candidate) => Math.abs(candidate.x - mirrorX) < 1e-6);
      expect(match).toBeDefined();
      expect(match!.y).toBeCloseTo(point.y, 6);
    }
  });

  it('produces a vertical mirror image for opposite curveAmount signs, for points on the baseline', () => {
    // The mirror only holds exactly at y = 0: points off the baseline get a
    // curveAmount-dependent radial offset (by design, so stroke thickness
    // survives the warp), so a positive/negative pair isn't a pure y-flip
    // once y != 0.
    const baseline: Polyline[] = [{ points: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 100, y: 0 }], closed: false }];
    const positive = warpPolylinesOnArc(baseline, { curveAmount: 0.5 });
    const negative = warpPolylinesOnArc(baseline, { curveAmount: -0.5 });
    for (let i = 0; i < positive.length; i++) {
      for (let j = 0; j < positive[i]!.points.length; j++) {
        expect(negative[i]!.points[j]!.x).toBeCloseTo(positive[i]!.points[j]!.x, 6);
        expect(negative[i]!.points[j]!.y).toBeCloseTo(-positive[i]!.points[j]!.y, 6);
      }
    }
  });

  it('is deterministic', () => {
    const first = warpPolylinesOnArc(SYMMETRIC_TEXT, { curveAmount: 0.35 });
    const second = warpPolylinesOnArc(SYMMETRIC_TEXT, { curveAmount: 0.35 });
    expect(first).toEqual(second);
  });

  it('does not mutate the input polylines', () => {
    const before = JSON.parse(JSON.stringify(SYMMETRIC_TEXT));
    warpPolylinesOnArc(SYMMETRIC_TEXT, { curveAmount: 0.7 });
    expect(SYMMETRIC_TEXT).toEqual(before);
  });

  it('curls tighter as |curveAmount| grows toward 1', () => {
    const moderate = warpPolylinesOnArc(STRAIGHT_LINE, { curveAmount: 0.3 });
    const strong = warpPolylinesOnArc(STRAIGHT_LINE, { curveAmount: 0.9 });
    expect(widthOf(strong)).toBeLessThan(widthOf(moderate));
  });
});
