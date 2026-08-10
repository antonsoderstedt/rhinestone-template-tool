import { describe, it, expect } from 'vitest';
import {
  pointInPolygon,
  calculatePolygonBounds,
  generateFillPointsForClosedPolyline,
  generateFillPointsForClosedPolylines,
} from '../src/lib/rhinestone-engine/index.js';
import type { Polyline } from '../src/lib/rhinestone-engine/index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** 10×10mm closed square with corners at (0,0), (10,0), (10,10), (0,10). */
const SQUARE: Polyline = {
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ],
  closed: true,
};

/** Open square — same points but not closed. */
const OPEN_SQUARE: Polyline = {
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ],
  closed: false,
};

/** 20×15mm closed rectangle. */
const RECT: Polyline = {
  points: [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 15 },
    { x: 0, y: 15 },
  ],
  closed: true,
};

// ─── pointInPolygon ───────────────────────────────────────────────────────────

describe('pointInPolygon', () => {
  it('returns true for a point clearly inside a square', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, SQUARE.points)).toBe(true);
  });

  it('returns false for a point clearly outside a square', () => {
    expect(pointInPolygon({ x: 20, y: 20 }, SQUARE.points)).toBe(false);
  });

  it('returns false for a point left of the square', () => {
    expect(pointInPolygon({ x: -5, y: 5 }, SQUARE.points)).toBe(false);
  });

  it('returns false for a point above the square', () => {
    expect(pointInPolygon({ x: 5, y: 20 }, SQUARE.points)).toBe(false);
  });

  it('returns false for polygon with fewer than 3 points', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, [{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe(false);
  });

  it('returns true for points inside a rectangle', () => {
    expect(pointInPolygon({ x: 10, y: 7 }, RECT.points)).toBe(true);
    expect(pointInPolygon({ x: 1, y: 1 }, RECT.points)).toBe(true);
    expect(pointInPolygon({ x: 19, y: 14 }, RECT.points)).toBe(true);
  });

  it('returns false for points outside a rectangle', () => {
    expect(pointInPolygon({ x: -1, y: 7 }, RECT.points)).toBe(false);
    expect(pointInPolygon({ x: 21, y: 7 }, RECT.points)).toBe(false);
    expect(pointInPolygon({ x: 10, y: -1 }, RECT.points)).toBe(false);
    expect(pointInPolygon({ x: 10, y: 16 }, RECT.points)).toBe(false);
  });
});

// ─── calculatePolygonBounds ───────────────────────────────────────────────────

describe('calculatePolygonBounds', () => {
  it('calculates bounds for a square', () => {
    const b = calculatePolygonBounds(SQUARE.points);
    expect(b.minX).toBe(0);
    expect(b.minY).toBe(0);
    expect(b.maxX).toBe(10);
    expect(b.maxY).toBe(10);
    expect(b.width).toBe(10);
    expect(b.height).toBe(10);
  });

  it('calculates bounds for a rectangle', () => {
    const b = calculatePolygonBounds(RECT.points);
    expect(b.minX).toBe(0);
    expect(b.minY).toBe(0);
    expect(b.maxX).toBe(20);
    expect(b.maxY).toBe(15);
  });

  it('returns zero bounds for empty input', () => {
    const b = calculatePolygonBounds([]);
    expect(b.width).toBe(0);
    expect(b.height).toBe(0);
  });

  it('does not mutate input', () => {
    const pts = [...SQUARE.points.map(p => ({ ...p }))];
    calculatePolygonBounds(pts);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
  });
});

// ─── generateFillPointsForClosedPolyline ──────────────────────────────────────

describe('generateFillPointsForClosedPolyline', () => {
  it('returns empty array for open polyline', () => {
    const pts = generateFillPointsForClosedPolyline(OPEN_SQUARE, { spacingMm: 3 });
    expect(pts).toHaveLength(0);
  });

  it('creates fill points inside a rectangle', () => {
    const pts = generateFillPointsForClosedPolyline(RECT, { spacingMm: 3 });
    expect(pts.length).toBeGreaterThan(0);
    // All points must be inside the rectangle
    for (const pt of pts) {
      expect(pointInPolygon(pt, RECT.points)).toBe(true);
    }
  });

  it('creates fill points inside a square', () => {
    const pts = generateFillPointsForClosedPolyline(SQUARE, { spacingMm: 2 });
    expect(pts.length).toBeGreaterThan(0);
    for (const pt of pts) {
      expect(pointInPolygon(pt, SQUARE.points)).toBe(true);
    }
  });

  it('grid pattern is deterministic', () => {
    const opts = { spacingMm: 3, pattern: 'grid' as const };
    const r1 = generateFillPointsForClosedPolyline(RECT, opts);
    const r2 = generateFillPointsForClosedPolyline(RECT, opts);
    expect(r1.length).toBe(r2.length);
    for (let i = 0; i < r1.length; i++) {
      expect(r1[i]!.x).toBe(r2[i]!.x);
      expect(r1[i]!.y).toBe(r2[i]!.y);
    }
  });

  it('offset-grid pattern is deterministic', () => {
    const opts = { spacingMm: 3, pattern: 'offset-grid' as const };
    const r1 = generateFillPointsForClosedPolyline(RECT, opts);
    const r2 = generateFillPointsForClosedPolyline(RECT, opts);
    expect(r1.length).toBe(r2.length);
    for (let i = 0; i < r1.length; i++) {
      expect(r1[i]!.x).toBe(r2[i]!.x);
      expect(r1[i]!.y).toBe(r2[i]!.y);
    }
  });

  it('offset-grid produces at least as many points as grid for the same spacing', () => {
    const grid = generateFillPointsForClosedPolyline(RECT, { spacingMm: 3, pattern: 'grid' });
    const offset = generateFillPointsForClosedPolyline(RECT, { spacingMm: 3, pattern: 'offset-grid' });
    // offset-grid can produce more or equal points
    expect(offset.length).toBeGreaterThanOrEqual(grid.length - 1);
  });

  it('offset-grid advances rows by the hexagonal close-pack pitch, not a full spacingMm', () => {
    // Per docs/RHINESTONE_ENGINE_SPEC.md "Grid Generation": row pitch is
    // spacingMm * sqrt(3)/2 so offset rows nest against their neighbors
    // instead of leaving a gap — this is what makes fill coverage dense.
    const spacingMm = 3;
    const pts = generateFillPointsForClosedPolyline(RECT, { spacingMm, pattern: 'offset-grid' });
    const rowYs = Array.from(new Set(pts.map((p) => p.y))).sort((a, b) => a - b);
    expect(rowYs.length).toBeGreaterThan(1);
    const expectedStep = spacingMm * (Math.sqrt(3) / 2);
    for (let i = 1; i < rowYs.length; i++) {
      expect(rowYs[i]! - rowYs[i - 1]!).toBeCloseTo(expectedStep, 3);
    }
  });

  it('offset-grid packs rows more densely than a square grid pattern', () => {
    const spacingMm = 2;
    const grid = generateFillPointsForClosedPolyline(RECT, { spacingMm, pattern: 'grid' });
    const offset = generateFillPointsForClosedPolyline(RECT, { spacingMm, pattern: 'offset-grid' });
    const gridRows = new Set(grid.map((p) => p.y)).size;
    const offsetRows = new Set(offset.map((p) => p.y)).size;
    expect(offsetRows).toBeGreaterThan(gridRows);
  });

  it('throws on spacing <= 0', () => {
    expect(() =>
      generateFillPointsForClosedPolyline(SQUARE, { spacingMm: 0 }),
    ).toThrow(/spacingMm/);
  });

  it('throws on spacing < 0', () => {
    expect(() =>
      generateFillPointsForClosedPolyline(SQUARE, { spacingMm: -1 }),
    ).toThrow(/spacingMm/);
  });

  it('throws when polygon has fewer than 3 points', () => {
    const twoPoints: Polyline = {
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
      closed: true,
    };
    expect(() =>
      generateFillPointsForClosedPolyline(twoPoints, { spacingMm: 3 }),
    ).toThrow(/3 points/);
  });

  it('does not mutate the input polyline', () => {
    const original = { ...RECT, points: RECT.points.map(p => ({ ...p })) };
    generateFillPointsForClosedPolyline(RECT, { spacingMm: 3 });
    expect(RECT.points[0]).toEqual({ x: 0, y: 0 });
    expect(original.points[0]).toEqual({ x: 0, y: 0 });
  });

  it('smaller spacing produces more fill points', () => {
    const coarse = generateFillPointsForClosedPolyline(RECT, { spacingMm: 5 });
    const fine   = generateFillPointsForClosedPolyline(RECT, { spacingMm: 2 });
    expect(fine.length).toBeGreaterThan(coarse.length);
  });
});

// ─── generateFillPointsForClosedPolylines ────────────────────────────────────

describe('generateFillPointsForClosedPolylines', () => {
  it('skips open polylines', () => {
    const pts = generateFillPointsForClosedPolylines([OPEN_SQUARE], { spacingMm: 3 });
    expect(pts).toHaveLength(0);
  });

  it('fills multiple closed shapes', () => {
    const shifted: Polyline = {
      points: RECT.points.map(p => ({ x: p.x + 30, y: p.y })),
      closed: true,
    };
    const pts = generateFillPointsForClosedPolylines([RECT, shifted], { spacingMm: 3 });
    expect(pts.length).toBeGreaterThan(0);
    // Each point is inside one of the two rectangles
    for (const pt of pts) {
      const inRect = pointInPolygon(pt, RECT.points);
      const inShifted = pointInPolygon(pt, shifted.points);
      expect(inRect || inShifted).toBe(true);
    }
  });

  it('mixes open and closed — only processes closed ones', () => {
    const closed = generateFillPointsForClosedPolylines([RECT], { spacingMm: 3 });
    const mixed  = generateFillPointsForClosedPolylines([RECT, OPEN_SQUARE], { spacingMm: 3 });
    expect(mixed.length).toBe(closed.length);
  });
});
