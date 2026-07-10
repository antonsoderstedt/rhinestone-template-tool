import { describe, it, expect } from 'vitest';
import {
  calculatePolylineBounds,
  scalePolylinesToWidth,
  scalePolylinesToHeight,
  scalePolylinesToFit,
  getTemplateStoneBounds,
  getTemplatePhysicalSize,
  estimateTemplatePhysicalSizeFromStones,
  createRhinestoneTemplate,
  createStoneGridTemplate,
} from '../src/lib/rhinestone-engine/index.js';
import type { Polyline } from '../src/lib/rhinestone-engine/index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** A simple L-shape polyline: width=10, height=5 in original coords */
const RECT_POLY: Polyline = {
  points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }, { x: 0, y: 5 }],
  closed: true,
};

/** A line starting at (5,3) going to (15,3) — width=10, height=0 */
const H_LINE: Polyline = {
  points: [{ x: 5, y: 3 }, { x: 15, y: 3 }],
};

// ─── calculatePolylineBounds ──────────────────────────────────────────────────

describe('calculatePolylineBounds', () => {
  it('returns correct bounds for a single polyline', () => {
    const b = calculatePolylineBounds([RECT_POLY]);
    expect(b.minX).toBe(0);
    expect(b.minY).toBe(0);
    expect(b.maxX).toBe(10);
    expect(b.maxY).toBe(5);
    expect(b.width).toBe(10);
    expect(b.height).toBe(5);
  });

  it('unions bounds across multiple polylines', () => {
    const poly2: Polyline = { points: [{ x: 20, y: 0 }, { x: 30, y: 10 }] };
    const b = calculatePolylineBounds([RECT_POLY, poly2]);
    expect(b.maxX).toBe(30);
    expect(b.maxY).toBe(10);
    expect(b.width).toBe(30);
    expect(b.height).toBe(10);
  });

  it('handles a polyline offset from origin', () => {
    const b = calculatePolylineBounds([H_LINE]);
    expect(b.minX).toBe(5);
    expect(b.minY).toBe(3);
    expect(b.width).toBe(10);
    expect(b.height).toBe(0);
  });

  it('throws on empty array', () => {
    expect(() => calculatePolylineBounds([])).toThrow();
  });
});

// ─── scalePolylinesToWidth ────────────────────────────────────────────────────

describe('scalePolylinesToWidth', () => {
  it('scales to exactly the target width', () => {
    const scaled = scalePolylinesToWidth([RECT_POLY], 50);
    const b = calculatePolylineBounds(scaled);
    expect(b.width).toBeCloseTo(50, 3);
  });

  it('preserves aspect ratio (height scales proportionally)', () => {
    const scaled = scalePolylinesToWidth([RECT_POLY], 50); // original 10x5 → 50x25
    const b = calculatePolylineBounds(scaled);
    expect(b.height).toBeCloseTo(25, 3);
  });

  it('moves minX/minY to default origin (10, 10)', () => {
    const scaled = scalePolylinesToWidth([RECT_POLY], 50);
    const b = calculatePolylineBounds(scaled);
    expect(b.minX).toBeCloseTo(10, 3);
    expect(b.minY).toBeCloseTo(10, 3);
  });

  it('throws on targetWidthMm <= 0', () => {
    expect(() => scalePolylinesToWidth([RECT_POLY], 0)).toThrow();
    expect(() => scalePolylinesToWidth([RECT_POLY], -5)).toThrow();
  });
});

// ─── scalePolylinesToHeight ───────────────────────────────────────────────────

describe('scalePolylinesToHeight', () => {
  it('scales to exactly the target height', () => {
    const scaled = scalePolylinesToHeight([RECT_POLY], 20);
    const b = calculatePolylineBounds(scaled);
    expect(b.height).toBeCloseTo(20, 3);
  });

  it('throws on targetHeightMm <= 0', () => {
    expect(() => scalePolylinesToHeight([RECT_POLY], 0)).toThrow();
  });
});

// ─── scalePolylinesToFit ──────────────────────────────────────────────────────

describe('scalePolylinesToFit', () => {
  it('preserves aspect ratio by default when both dimensions are given', () => {
    // RECT_POLY is 10x5. Fit into 100x100 box → scale by min(10,20)=10 → 100x50
    const scaled = scalePolylinesToFit([RECT_POLY], {
      targetWidthMm: 100,
      targetHeightMm: 100,
    });
    const b = calculatePolylineBounds(scaled);
    expect(b.width).toBeCloseTo(100, 3);
    expect(b.height).toBeCloseTo(50, 3);
  });

  it('stretches independently when preserveAspectRatio is false', () => {
    const scaled = scalePolylinesToFit([RECT_POLY], {
      targetWidthMm: 100,
      targetHeightMm: 100,
      preserveAspectRatio: false,
    });
    const b = calculatePolylineBounds(scaled);
    expect(b.width).toBeCloseTo(100, 3);
    expect(b.height).toBeCloseTo(100, 3);
  });

  it('moves minX/minY to custom origin', () => {
    const scaled = scalePolylinesToFit([RECT_POLY], {
      targetWidthMm: 50,
      originXmm: 5,
      originYmm: 5,
    });
    const b = calculatePolylineBounds(scaled);
    expect(b.minX).toBeCloseTo(5, 3);
    expect(b.minY).toBeCloseTo(5, 3);
  });

  it('moves minX/minY to (0, 0) when origin set to 0', () => {
    // offset polyline at (5,3)
    const scaled = scalePolylinesToFit([H_LINE], {
      targetWidthMm: 10,
      originXmm: 0,
      originYmm: 0,
    });
    const b = calculatePolylineBounds(scaled);
    expect(b.minX).toBeCloseTo(0, 3);
    expect(b.minY).toBeCloseTo(0, 3);
  });

  it('does not mutate the input polylines', () => {
    const original = RECT_POLY.points.map((p) => ({ ...p }));
    scalePolylinesToFit([RECT_POLY], { targetWidthMm: 50 });
    expect(RECT_POLY.points[0]).toEqual(original[0]);
  });

  it('throws on empty polylines array', () => {
    expect(() => scalePolylinesToFit([], { targetWidthMm: 50 })).toThrow();
  });

  it('throws on invalid targetWidthMm', () => {
    expect(() => scalePolylinesToFit([RECT_POLY], { targetWidthMm: 0 })).toThrow();
  });

  it('throws on invalid targetHeightMm', () => {
    expect(() => scalePolylinesToFit([RECT_POLY], { targetHeightMm: -1 })).toThrow();
  });
});

// ─── Template sizing ──────────────────────────────────────────────────────────

describe('getTemplateStoneBounds', () => {
  it('includes hole radius — bounds wider than just centers', () => {
    const template = createRhinestoneTemplate({
      id: 't',
      name: 'T',
      stones: [{ id: 's1', center: { x: 10, y: 10 }, stoneSize: 'SS10', holeDiameterMm: 3.0 }],
    });
    const b = getTemplateStoneBounds(template);
    // Radius = 1.5 — bounds should be center ± radius
    expect(b.minX).toBeCloseTo(8.5, 3);
    expect(b.maxX).toBeCloseTo(11.5, 3);
    expect(b.width).toBeCloseTo(3.0, 3);
  });

  it('returns zero bounds for empty stones', () => {
    const template = createRhinestoneTemplate({ id: 't', name: 'T', stones: [], widthMm: 100, heightMm: 50 });
    const b = getTemplateStoneBounds(template);
    expect(b.width).toBe(0);
    expect(b.height).toBe(0);
  });
});

describe('getTemplatePhysicalSize', () => {
  it('returns widthMm and heightMm from stone bounds', () => {
    const template = createStoneGridTemplate({
      id: 't', name: 'T', stoneSize: 'SS10', columns: 3, rows: 2,
    });
    const size = getTemplatePhysicalSize(template);
    expect(size.widthMm).toBeGreaterThan(0);
    expect(size.heightMm).toBeGreaterThan(0);
  });
});

describe('estimateTemplatePhysicalSizeFromStones', () => {
  it('returns the same result as getTemplatePhysicalSize', () => {
    const template = createStoneGridTemplate({
      id: 't', name: 'T', stoneSize: 'SS10', columns: 2, rows: 2,
    });
    const a = getTemplatePhysicalSize(template);
    const b = estimateTemplatePhysicalSizeFromStones(template);
    expect(b).toEqual(a);
  });
});
