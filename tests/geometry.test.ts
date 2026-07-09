import { describe, it, expect } from 'vitest';
import {
  distanceBetweenPoints,
  circleCenterDistance,
  circleDiameter,
  circleToStoneCircle,
  calculateBounds,
  expandBounds,
  isCircleInsideBounds,
  circlesOverlap,
  findOverlappingCirclePairs,
  hasCircleCollisions,
  roundMm,
} from '../src/lib/rhinestone-engine/index.js';
import type { Circle, Stone } from '../src/lib/rhinestone-engine/index.js';

// ─── distanceBetweenPoints ────────────────────────────────────────────────────

describe('distanceBetweenPoints', () => {
  it('returns 5 for a 3-4-5 right triangle', () => {
    expect(distanceBetweenPoints({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('returns 0 for the same point', () => {
    expect(distanceBetweenPoints({ x: 7, y: 3 }, { x: 7, y: 3 })).toBe(0);
  });

  it('is symmetric', () => {
    const a = { x: 1, y: 2 };
    const b = { x: 4, y: 6 };
    expect(distanceBetweenPoints(a, b)).toBe(distanceBetweenPoints(b, a));
  });
});

// ─── circle utilities ─────────────────────────────────────────────────────────

describe('circleCenterDistance', () => {
  it('returns the distance between circle centers', () => {
    const a: Circle = { center: { x: 0, y: 0 }, radiusMm: 1 };
    const b: Circle = { center: { x: 3, y: 4 }, radiusMm: 2 };
    expect(circleCenterDistance(a, b)).toBe(5);
  });
});

describe('circleDiameter', () => {
  it('returns radiusMm * 2', () => {
    const c: Circle = { center: { x: 0, y: 0 }, radiusMm: 1.5 };
    expect(circleDiameter(c)).toBe(3);
  });
});

describe('circleToStoneCircle', () => {
  it('uses holeDiameterMm / 2 as the radius', () => {
    const stone: Stone = {
      id: 's1',
      center: { x: 10, y: 20 },
      stoneSize: 'SS10',
      holeDiameterMm: 3.0,
    };
    const circle = circleToStoneCircle(stone);
    expect(circle.center).toEqual({ x: 10, y: 20 });
    expect(circle.radiusMm).toBe(1.5);
  });

  it('preserves the center coordinates', () => {
    const stone: Stone = {
      id: 's2',
      center: { x: 5.5, y: 12.25 },
      stoneSize: 'SS6',
      holeDiameterMm: 2.1,
    };
    const circle = circleToStoneCircle(stone);
    expect(circle.center.x).toBe(5.5);
    expect(circle.center.y).toBe(12.25);
  });
});

// ─── bounds utilities ─────────────────────────────────────────────────────────

describe('calculateBounds', () => {
  it('returns zero bounds for empty array', () => {
    const b = calculateBounds([]);
    expect(b).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 });
  });

  it('includes the full circle radius, not only centers', () => {
    const circles: Circle[] = [
      { center: { x: 5, y: 5 }, radiusMm: 2 },
    ];
    const b = calculateBounds(circles);
    expect(b.minX).toBe(3);
    expect(b.minY).toBe(3);
    expect(b.maxX).toBe(7);
    expect(b.maxY).toBe(7);
    expect(b.width).toBe(4);
    expect(b.height).toBe(4);
  });

  it('covers multiple circles', () => {
    const circles: Circle[] = [
      { center: { x: 0, y: 0 }, radiusMm: 1 },
      { center: { x: 10, y: 8 }, radiusMm: 1 },
    ];
    const b = calculateBounds(circles);
    expect(b.minX).toBe(-1);
    expect(b.minY).toBe(-1);
    expect(b.maxX).toBe(11);
    expect(b.maxY).toBe(9);
    expect(b.width).toBe(12);
    expect(b.height).toBe(10);
  });
});

describe('expandBounds', () => {
  it('expands all sides by the padding value', () => {
    const base = { minX: 0, minY: 0, maxX: 10, maxY: 8, width: 10, height: 8 };
    const expanded = expandBounds(base, 2);
    expect(expanded.minX).toBe(-2);
    expect(expanded.minY).toBe(-2);
    expect(expanded.maxX).toBe(12);
    expect(expanded.maxY).toBe(10);
    expect(expanded.width).toBe(14);
    expect(expanded.height).toBe(12);
  });

  it('does not mutate the original bounds', () => {
    const base = { minX: 0, minY: 0, maxX: 10, maxY: 10, width: 10, height: 10 };
    expandBounds(base, 5);
    expect(base.minX).toBe(0);
  });
});

describe('isCircleInsideBounds', () => {
  const bounds = { minX: 0, minY: 0, maxX: 20, maxY: 20, width: 20, height: 20 };

  it('returns true when the full circle is inside', () => {
    const c: Circle = { center: { x: 10, y: 10 }, radiusMm: 3 };
    expect(isCircleInsideBounds(c, bounds)).toBe(true);
  });

  it('returns true when the circle exactly touches the boundary', () => {
    const c: Circle = { center: { x: 3, y: 10 }, radiusMm: 3 };
    expect(isCircleInsideBounds(c, bounds)).toBe(true);
  });

  it('returns false when the circle crosses the left boundary', () => {
    const c: Circle = { center: { x: 2, y: 10 }, radiusMm: 3 };
    expect(isCircleInsideBounds(c, bounds)).toBe(false);
  });

  it('returns false when the circle crosses the right boundary', () => {
    const c: Circle = { center: { x: 18, y: 10 }, radiusMm: 3 };
    expect(isCircleInsideBounds(c, bounds)).toBe(false);
  });

  it('returns false when the circle crosses the top boundary', () => {
    const c: Circle = { center: { x: 10, y: 18 }, radiusMm: 3 };
    expect(isCircleInsideBounds(c, bounds)).toBe(false);
  });
});

// ─── collision utilities ──────────────────────────────────────────────────────

describe('circlesOverlap', () => {
  it('returns true when circles overlap', () => {
    const a: Circle = { center: { x: 0, y: 0 }, radiusMm: 1.5 };
    const b: Circle = { center: { x: 2, y: 0 }, radiusMm: 1.5 };
    // centers are 2 apart, combined radii = 3 → overlap
    expect(circlesOverlap(a, b)).toBe(true);
  });

  it('returns false when circles have valid spacing', () => {
    const a: Circle = { center: { x: 0, y: 0 }, radiusMm: 1.5 };
    const b: Circle = { center: { x: 4, y: 0 }, radiusMm: 1.5 };
    // centers are 4 apart, combined radii = 3 → clear gap of 1
    expect(circlesOverlap(a, b)).toBe(false);
  });

  it('returns false when circles exactly touch (not overlapping)', () => {
    const a: Circle = { center: { x: 0, y: 0 }, radiusMm: 1.5 };
    const b: Circle = { center: { x: 3, y: 0 }, radiusMm: 1.5 };
    // center distance exactly equals combined radii → touching, not overlapping
    expect(circlesOverlap(a, b)).toBe(false);
  });

  it('respects minGapMm: returns true when gap is insufficient', () => {
    const a: Circle = { center: { x: 0, y: 0 }, radiusMm: 1 };
    const b: Circle = { center: { x: 2.1, y: 0 }, radiusMm: 1 };
    // combined radii = 2, gap = 0.1 mm, minGapMm = 0.25 → overlap
    expect(circlesOverlap(a, b, 0.25)).toBe(true);
  });

  it('respects minGapMm: returns false when gap meets requirement', () => {
    const a: Circle = { center: { x: 0, y: 0 }, radiusMm: 1 };
    const b: Circle = { center: { x: 2.25, y: 0 }, radiusMm: 1 };
    // combined radii = 2, minGapMm = 0.25, exact distance = 2.25 → not overlapping
    expect(circlesOverlap(a, b, 0.25)).toBe(false);
  });
});

describe('findOverlappingCirclePairs', () => {
  it('returns empty array when no circles overlap', () => {
    const circles: Circle[] = [
      { center: { x: 0, y: 0 }, radiusMm: 1 },
      { center: { x: 10, y: 0 }, radiusMm: 1 },
    ];
    expect(findOverlappingCirclePairs(circles)).toEqual([]);
  });

  it('returns the correct index pair when two circles overlap', () => {
    const circles: Circle[] = [
      { center: { x: 0, y: 0 }, radiusMm: 1 },   // 0
      { center: { x: 10, y: 0 }, radiusMm: 1 },   // 1 — far away
      { center: { x: 1, y: 0 }, radiusMm: 1 },    // 2 — overlaps with 0
    ];
    const pairs = findOverlappingCirclePairs(circles);
    expect(pairs).toContainEqual([0, 2]);
    expect(pairs).not.toContainEqual([0, 1]);
    expect(pairs).not.toContainEqual([1, 2]);
  });

  it('returns multiple pairs when many circles overlap', () => {
    const circles: Circle[] = [
      { center: { x: 0, y: 0 }, radiusMm: 2 },
      { center: { x: 1, y: 0 }, radiusMm: 2 },
      { center: { x: 2, y: 0 }, radiusMm: 2 },
    ];
    const pairs = findOverlappingCirclePairs(circles);
    expect(pairs.length).toBe(3);
  });
});

describe('hasCircleCollisions', () => {
  it('returns false for an empty array', () => {
    expect(hasCircleCollisions([])).toBe(false);
  });

  it('returns false when no circles overlap', () => {
    const circles: Circle[] = [
      { center: { x: 0, y: 0 }, radiusMm: 1 },
      { center: { x: 10, y: 0 }, radiusMm: 1 },
    ];
    expect(hasCircleCollisions(circles)).toBe(false);
  });

  it('returns true when any circle overlaps', () => {
    const circles: Circle[] = [
      { center: { x: 0, y: 0 }, radiusMm: 1 },
      { center: { x: 100, y: 0 }, radiusMm: 1 },
      { center: { x: 1, y: 0 }, radiusMm: 1 }, // overlaps with index 0
    ];
    expect(hasCircleCollisions(circles)).toBe(true);
  });
});

// ─── rounding ─────────────────────────────────────────────────────────────────

describe('roundMm', () => {
  it('rounds to 3 decimal places by default', () => {
    expect(roundMm(1.23456)).toBe(1.235);
  });

  it('supports custom decimal places', () => {
    expect(roundMm(1.23456, 2)).toBe(1.23);
    expect(roundMm(1.23456, 4)).toBe(1.2346);
  });

  it('returns exact value when no rounding needed', () => {
    expect(roundMm(1.5, 3)).toBe(1.5);
  });

  it('is deterministic — same input gives same output', () => {
    const result1 = roundMm(2.71828, 3);
    const result2 = roundMm(2.71828, 3);
    expect(result1).toBe(result2);
  });
});
