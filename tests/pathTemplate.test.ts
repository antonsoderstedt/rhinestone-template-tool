import { describe, it, expect } from 'vitest';
import {
  getPolylineLength,
  samplePolylineBySpacing,
  normalizePolylineInput,
  createPolylineRhinestoneTemplate,
  validateRhinestoneTemplate,
  createBasicSvgExport,
  getRecommendedHoleDiameter,
  getRecommendedCenterDistance,
  checkExportReadiness,
  distanceBetweenPoints,
} from '../src/lib/rhinestone-engine/index.js';
import type { Polyline } from '../src/lib/rhinestone-engine/index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** 30mm horizontal line */
const LINE_30: Polyline = { points: [{ x: 0, y: 0 }, { x: 30, y: 0 }] };

/** Square 10×10mm */
const SQUARE_10: Polyline = {
  points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
};

// ─── getPolylineLength ────────────────────────────────────────────────────────

describe('getPolylineLength', () => {
  it('calculates a 3-4-5 right triangle segment as 5', () => {
    const poly: Polyline = { points: [{ x: 0, y: 0 }, { x: 3, y: 4 }] };
    expect(getPolylineLength(poly)).toBe(5);
  });

  it('sums multiple segments correctly', () => {
    const poly: Polyline = {
      points: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }],
    };
    // 3 + 4 = 7
    expect(getPolylineLength(poly)).toBe(7);
  });

  it('includes the closing segment for closed polylines', () => {
    // 3-4-5 triangle: open length = 3+4 = 7; closing segment = 5
    const poly: Polyline = {
      points: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }],
      closed: true,
    };
    expect(getPolylineLength(poly)).toBe(12);
  });

  it('returns 0 for a polyline with a single pair of identical points', () => {
    const poly: Polyline = { points: [{ x: 5, y: 5 }, { x: 5, y: 5 }] };
    expect(getPolylineLength(poly)).toBe(0);
  });
});

// ─── normalizePolylineInput ───────────────────────────────────────────────────

describe('normalizePolylineInput', () => {
  it('returns a deep clone — mutations to the original do not affect the clone', () => {
    const original = [{ x: 1, y: 2 }, { x: 3, y: 4 }];
    const cloned = normalizePolylineInput(original);
    original[0]!.x = 999;
    expect(cloned[0]!.x).toBe(1);
  });

  it('throws on fewer than 2 points', () => {
    expect(() => normalizePolylineInput([{ x: 0, y: 0 }])).toThrow(/2 points/);
  });

  it('throws on an empty array', () => {
    expect(() => normalizePolylineInput([])).toThrow();
  });

  it('throws when a point has a non-finite x value', () => {
    expect(() =>
      normalizePolylineInput([{ x: NaN, y: 0 }, { x: 5, y: 0 }]),
    ).toThrow(/non-finite/);
  });

  it('throws when a point has a non-finite y value', () => {
    expect(() =>
      normalizePolylineInput([{ x: 0, y: Infinity }, { x: 5, y: 0 }]),
    ).toThrow(/non-finite/);
  });

  it('preserves point values', () => {
    const pts = normalizePolylineInput([{ x: 1.5, y: 2.5 }, { x: 3.5, y: 4.5 }]);
    expect(pts[0]).toEqual({ x: 1.5, y: 2.5 });
    expect(pts[1]).toEqual({ x: 3.5, y: 4.5 });
  });
});

// ─── samplePolylineBySpacing ──────────────────────────────────────────────────

describe('samplePolylineBySpacing', () => {
  it('always includes the first point as the first element', () => {
    const pts = samplePolylineBySpacing(LINE_30, 5);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
  });

  it('returns deterministic results for the same input', () => {
    const r1 = samplePolylineBySpacing(LINE_30, 5);
    const r2 = samplePolylineBySpacing(LINE_30, 5);
    expect(r1).toEqual(r2);
  });

  it('returns multiple points for a 30mm line with 5mm spacing', () => {
    const pts = samplePolylineBySpacing(LINE_30, 5);
    // Start at 0, then 5, 10, 15, 20, 25 → 6 points; next would be at 30mm
    expect(pts.length).toBeGreaterThanOrEqual(5);
  });

  it('throws if spacingMm is zero', () => {
    expect(() => samplePolylineBySpacing(LINE_30, 0)).toThrow(/spacingMm/);
  });

  it('throws if spacingMm is negative', () => {
    expect(() => samplePolylineBySpacing(LINE_30, -1)).toThrow(/spacingMm/);
  });

  it('returns more points for a closed polyline than an open one', () => {
    const open = samplePolylineBySpacing(SQUARE_10, 4.5);
    const closed = samplePolylineBySpacing({ ...SQUARE_10, closed: true }, 4.5);
    expect(closed.length).toBeGreaterThan(open.length);
  });

  it('does not place a duplicate stone at start for exactly-divisible closed polylines', () => {
    // Square 10×10, perimeter=40, spacing=5 → exactly 8 intervals
    const pts = samplePolylineBySpacing({ ...SQUARE_10, closed: true }, 5);
    // First and last should not be the same position
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    const dist = Math.hypot(last.x - first.x, last.y - first.y);
    expect(dist).toBeGreaterThan(0.001);
  });

  it('sampled points are roughly spacingMm apart along a straight line', () => {
    const pts = samplePolylineBySpacing(LINE_30, 5);
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
      expect(d).toBeCloseTo(5, 2);
    }
  });
});

// ─── createPolylineRhinestoneTemplate ─────────────────────────────────────────

describe('createPolylineRhinestoneTemplate — basic creation', () => {
  it('creates a RhinestoneTemplate with unit "mm"', () => {
    const t = createPolylineRhinestoneTemplate({
      id: 'test',
      name: 'Test',
      polylines: [LINE_30],
      stoneSize: 'SS10',
    });
    expect(t.unit).toBe('mm');
  });

  it('creates stones from one open polyline', () => {
    const t = createPolylineRhinestoneTemplate({
      id: 'test',
      name: 'Test',
      polylines: [LINE_30],
      stoneSize: 'SS10',
    });
    expect(t.stones.length).toBeGreaterThan(0);
  });

  it('creates more stones from a closed polyline than an open one', () => {
    // A larger square than SQUARE_10: at Magic Flock's SS10 recommended
    // spacing (~4.19mm) a 10mm square's closing segment gets absorbed by the
    // wraparound minimum-distance check, so use a square with enough
    // perimeter for the closing segment to add a genuinely separate stone.
    const square20: Polyline = {
      points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }],
    };
    const opts = { id: 'test', name: 'Test', stoneSize: 'SS10' as const };
    const open = createPolylineRhinestoneTemplate({ ...opts, polylines: [square20] });
    const closed = createPolylineRhinestoneTemplate({
      ...opts,
      polylines: [{ ...square20, closed: true }],
    });
    expect(closed.stones.length).toBeGreaterThan(open.stones.length);
  });

  it('is invariant to the starting vertex for equivalent closed polylines', () => {
    const a: Polyline = {
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
      closed: true,
    };
    const b: Polyline = {
      points: [{ x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }, { x: 10, y: 0 }],
      closed: true,
    };
    const templateA = createPolylineRhinestoneTemplate({
      id: 'closed-a',
      name: 'Closed A',
      polylines: [a],
      stoneSize: 'SS10',
    });
    const templateB = createPolylineRhinestoneTemplate({
      id: 'closed-b',
      name: 'Closed B',
      polylines: [b],
      stoneSize: 'SS10',
    });

    expect(templateA.stones.map((stone) => stone.center)).toEqual(
      templateB.stones.map((stone) => stone.center),
    );
  });

  it('is invariant to traversal direction for equivalent closed polylines', () => {
    const clockwise: Polyline = {
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
      closed: true,
    };
    const counterClockwise: Polyline = {
      points: [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 0 }],
      closed: true,
    };
    const clockwiseTemplate = createPolylineRhinestoneTemplate({
      id: 'clockwise',
      name: 'Clockwise',
      polylines: [clockwise],
      stoneSize: 'SS10',
    });
    const counterClockwiseTemplate = createPolylineRhinestoneTemplate({
      id: 'counter-clockwise',
      name: 'Counter Clockwise',
      polylines: [counterClockwise],
      stoneSize: 'SS10',
    });

    expect(clockwiseTemplate.stones.map((stone) => stone.center)).toEqual(
      counterClockwiseTemplate.stones.map((stone) => stone.center),
    );
  });

  it('is stable for reversed acute open polylines', () => {
    const acute: Polyline = {
      points: [{ x: 0, y: 0 }, { x: 4, y: 18 }, { x: 8, y: 0 }],
    };
    const reversed: Polyline = {
      points: [...acute.points].reverse(),
    };

    const forward = createPolylineRhinestoneTemplate({
      id: 'acute-forward',
      name: 'Acute Forward',
      polylines: [acute],
      stoneSize: 'SS6',
    });
    const backward = createPolylineRhinestoneTemplate({
      id: 'acute-backward',
      name: 'Acute Backward',
      polylines: [reversed],
      stoneSize: 'SS6',
    });

    expect(forward.stones.map((stone) => stone.center)).toEqual(
      backward.stones.map((stone) => stone.center),
    );
  });

  it('creates stones from multiple polylines', () => {
    // Two parallel lines 20mm apart — no collision
    const line1: Polyline = { points: [{ x: 0, y: 0 }, { x: 20, y: 0 }] };
    const line2: Polyline = { points: [{ x: 0, y: 20 }, { x: 20, y: 20 }] };
    const t = createPolylineRhinestoneTemplate({
      id: 'test',
      name: 'Test',
      polylines: [line1, line2],
      stoneSize: 'SS10',
    });
    const path1Stones = t.stones.filter((s) => s.id.includes('-path1-'));
    const path2Stones = t.stones.filter((s) => s.id.includes('-path2-'));
    expect(path1Stones.length).toBeGreaterThan(0);
    expect(path2Stones.length).toBeGreaterThan(0);
  });

  it('uses SS10 recommended hole diameter for all stones', () => {
    const expected = getRecommendedHoleDiameter('SS10');
    const t = createPolylineRhinestoneTemplate({
      id: 'test',
      name: 'Test',
      polylines: [LINE_30],
      stoneSize: 'SS10',
    });
    for (const stone of t.stones) {
      expect(stone.holeDiameterMm).toBe(expected);
    }
  });

  it('uses recommended spacing by default — no collisions in output', () => {
    const t = createPolylineRhinestoneTemplate({
      id: 'test',
      name: 'Test',
      polylines: [LINE_30],
      stoneSize: 'SS10',
    });
    expect(validateRhinestoneTemplate(t).valid).toBe(true);
  });

  it('creates deterministic IDs — same input gives same IDs', () => {
    const opts = { id: 'test', name: 'Test', polylines: [LINE_30], stoneSize: 'SS10' as const };
    const ids1 = createPolylineRhinestoneTemplate(opts).stones.map((s) => s.id);
    const ids2 = createPolylineRhinestoneTemplate(opts).stones.map((s) => s.id);
    expect(ids1).toEqual(ids2);
  });

  it('stone IDs use 1-based path and point indices', () => {
    const t = createPolylineRhinestoneTemplate({
      id: 'test',
      name: 'Test',
      polylines: [LINE_30],
      stoneSize: 'SS10',
    });
    expect(t.stones[0]!.id).toContain('-path1-p1');
  });

  it('includes metadata with generatedBy, stoneSize, pathCount, spacingMm', () => {
    const t = createPolylineRhinestoneTemplate({
      id: 'test',
      name: 'Test',
      polylines: [LINE_30],
      stoneSize: 'SS10',
    });
    expect(t.metadata?.generatedBy).toBe('createPolylineRhinestoneTemplate');
    expect(t.metadata?.stoneSize).toBe('SS10');
    expect(t.metadata?.pathCount).toBe(1);
    expect(typeof t.metadata?.spacingMm).toBe('number');
  });

  it('marks endpoint anchors with stronger collision priority on open polylines', () => {
    const template = createPolylineRhinestoneTemplate({
      id: 'anchors',
      name: 'Anchors',
      polylines: [LINE_30],
      stoneSize: 'SS10',
    });
    expect(template.stones[0]?.metadata?.isEndpointAnchor).toBe(true);
    expect(template.stones[0]?.metadata?.collisionPriority).toBe(4);
    expect(template.stones[0]?.metadata?.collisionSource).toBe('outline');
  });

  it('marks vertex anchors on closed polylines', () => {
    const template = createPolylineRhinestoneTemplate({
      id: 'closed-anchors',
      name: 'Closed Anchors',
      polylines: [{ ...SQUARE_10, closed: true }],
      stoneSize: 'SS10',
      spacingMm: 5,
    });
    expect(template.stones.some((stone) => stone.metadata?.isVertexAnchor === true)).toBe(true);
    expect(template.stones.every((stone) => stone.metadata?.collisionSource === 'outline')).toBe(true);
  });
});

// ─── Error cases ──────────────────────────────────────────────────────────────

describe('createPolylineRhinestoneTemplate — error cases', () => {
  it('throws on empty id', () => {
    expect(() =>
      createPolylineRhinestoneTemplate({ id: '', name: 'T', polylines: [LINE_30], stoneSize: 'SS10' }),
    ).toThrow(/id/);
  });

  it('throws on empty name', () => {
    expect(() =>
      createPolylineRhinestoneTemplate({ id: 't', name: '', polylines: [LINE_30], stoneSize: 'SS10' }),
    ).toThrow(/name/);
  });

  it('throws on empty polylines array', () => {
    expect(() =>
      createPolylineRhinestoneTemplate({ id: 't', name: 'T', polylines: [], stoneSize: 'SS10' }),
    ).toThrow(/polylines/);
  });

  it('throws when spacingMm is smaller than recommended', () => {
    const minSpacing = getRecommendedCenterDistance('SS10');
    expect(() =>
      createPolylineRhinestoneTemplate({
        id: 't',
        name: 'T',
        polylines: [LINE_30],
        stoneSize: 'SS10',
        spacingMm: minSpacing - 0.1,
      }),
    ).toThrow(/spacing/i);
  });

  it('accepts spacingMm exactly equal to recommended (boundary)', () => {
    const minSpacing = getRecommendedCenterDistance('SS10');
    expect(() =>
      createPolylineRhinestoneTemplate({
        id: 't',
        name: 'T',
        polylines: [LINE_30],
        stoneSize: 'SS10',
        spacingMm: minSpacing,
      }),
    ).not.toThrow();
  });
});

// ─── Validation and export integration ───────────────────────────────────────

describe('createPolylineRhinestoneTemplate — integration', () => {
  it('generated template passes validateRhinestoneTemplate', () => {
    const t = createPolylineRhinestoneTemplate({
      id: 'test',
      name: 'Test',
      polylines: [LINE_30],
      stoneSize: 'SS10',
    });
    const result = validateRhinestoneTemplate(t);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('can be exported with createBasicSvgExport without error', () => {
    const t = createPolylineRhinestoneTemplate({
      id: 'test',
      name: 'Test',
      polylines: [LINE_30],
      stoneSize: 'SS10',
    });
    expect(() => createBasicSvgExport(t)).not.toThrow();
  });

  it('exported SVG contains <circle', () => {
    const t = createPolylineRhinestoneTemplate({
      id: 'test',
      name: 'Test',
      polylines: [LINE_30],
      stoneSize: 'SS10',
    });
    expect(createBasicSvgExport(t)).toContain('<circle');
  });

  it('exported SVG contains data-stone-size="SS10"', () => {
    const t = createPolylineRhinestoneTemplate({
      id: 'test',
      name: 'Test',
      polylines: [LINE_30],
      stoneSize: 'SS10',
    });
    expect(createBasicSvgExport(t)).toContain('data-stone-size="SS10"');
  });

  it('exported SVG does not contain <image', () => {
    const t = createPolylineRhinestoneTemplate({
      id: 'test',
      name: 'Test',
      polylines: [LINE_30],
      stoneSize: 'SS10',
    });
    expect(createBasicSvgExport(t)).not.toContain('<image');
  });
});

// ─── Physical sizing integration ──────────────────────────────────────────────

describe('createPolylineRhinestoneTemplate — physical sizing', () => {
  const LINE_100: import('../src/lib/rhinestone-engine/index.js').Polyline = {
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
  };

  it('supports targetWidthMm — metadata includes the value', () => {
    const t = createPolylineRhinestoneTemplate({
      id: 'test', name: 'Test', polylines: [LINE_100], stoneSize: 'SS10',
      targetWidthMm: 50,
    });
    expect(t.metadata?.targetWidthMm).toBe(50);
  });

  it('supports targetHeightMm — metadata includes the value', () => {
    const RECT: import('../src/lib/rhinestone-engine/index.js').Polyline = {
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
    };
    const t = createPolylineRhinestoneTemplate({
      id: 'test', name: 'Test', polylines: [RECT], stoneSize: 'SS10',
      targetHeightMm: 50,
    });
    expect(t.metadata?.targetHeightMm).toBe(50);
  });

  it('scaling changes stone positions compared to unscaled', () => {
    const unscaled = createPolylineRhinestoneTemplate({
      id: 'test', name: 'Test', polylines: [LINE_100], stoneSize: 'SS10',
    });
    const scaled = createPolylineRhinestoneTemplate({
      id: 'test', name: 'Test', polylines: [LINE_100], stoneSize: 'SS10',
      targetWidthMm: 30,
    });
    const unscaledMaxX = Math.max(...unscaled.stones.map((s) => s.center.x));
    const scaledMaxX   = Math.max(...scaled.stones.map((s) => s.center.x));
    expect(scaledMaxX).toBeLessThan(unscaledMaxX);
  });

  it('scaled template passes validateRhinestoneTemplate', () => {
    const t = createPolylineRhinestoneTemplate({
      id: 'test', name: 'Test', polylines: [LINE_100], stoneSize: 'SS10',
      targetWidthMm: 50,
    });
    expect(validateRhinestoneTemplate(t).valid).toBe(true);
  });

  it('scaled template exports via createBasicSvgExport', () => {
    const t = createPolylineRhinestoneTemplate({
      id: 'test', name: 'Test', polylines: [LINE_100], stoneSize: 'SS10',
      targetWidthMm: 50,
    });
    expect(() => createBasicSvgExport(t)).not.toThrow();
  });

  it('exported SVG width/height use mm units (not px)', () => {
    const t = createPolylineRhinestoneTemplate({
      id: 'test', name: 'Test', polylines: [LINE_100], stoneSize: 'SS10',
      targetWidthMm: 50,
    });
    const svg = createBasicSvgExport(t);
    expect(svg).toMatch(/width="[\d.]+mm"/);
    expect(svg).toMatch(/height="[\d.]+mm"/);
    expect(svg).not.toMatch(/width="[\d.]+px"/);
  });

  it('exported SVG does not contain <image', () => {
    const t = createPolylineRhinestoneTemplate({
      id: 'test', name: 'Test', polylines: [LINE_100], stoneSize: 'SS10',
      targetWidthMm: 50,
    });
    expect(createBasicSvgExport(t)).not.toContain('<image');
  });
});

// ─── Closed polyline collision fix ────────────────────────────────────────────

describe('samplePolylineBySpacing — closed polyline closure safety', () => {
  const DIAMOND: Polyline = {
    points: [{ x: 20, y: 0 }, { x: 40, y: 15 }, { x: 20, y: 30 }, { x: 0, y: 15 }],
    closed: true,
  };

  it('no two stone centers are closer than holeDiameterMm for SS10 diamond template', () => {
    // After Euclidean post-processing in createPolylineRhinestoneTemplate,
    // no two stone centers should violate the physical minimum distance.
    const holeDiameter = getRecommendedHoleDiameter('SS10');
    const t = createPolylineRhinestoneTemplate({
      id: 'diamond', name: 'Diamond', polylines: [DIAMOND], stoneSize: 'SS10',
    });
    for (let i = 0; i < t.stones.length; i++) {
      for (let j = i + 1; j < t.stones.length; j++) {
        const dist = distanceBetweenPoints(t.stones[i]!.center, t.stones[j]!.center);
        expect(dist).toBeGreaterThanOrEqual(holeDiameter - 0.001);
      }
    }
  });

  it('default diamond polyline with SS10 passes validateRhinestoneTemplate', () => {
    const t = createPolylineRhinestoneTemplate({
      id: 'diamond', name: 'Diamond', polylines: [DIAMOND], stoneSize: 'SS10',
    });
    const result = validateRhinestoneTemplate(t);
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.code === 'STONE_COLLISION')).toHaveLength(0);
  });

  it('default diamond polyline with SS10 passes checkExportReadiness', () => {
    const t = createPolylineRhinestoneTemplate({
      id: 'diamond', name: 'Diamond', polylines: [DIAMOND], stoneSize: 'SS10',
    });
    const r = checkExportReadiness(t, { requireCalibration: false });
    expect(r.ready).toBe(true);
    expect(r.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('last sampled stone on closed polyline is at least spacingMm from first stone along path', () => {
    // This checks that the fix removes any stone that would be < spacingMm from the start
    const spacing = getRecommendedCenterDistance('SS10');
    const sampled = samplePolylineBySpacing(DIAMOND, spacing);
    const first = sampled[0]!;
    const last  = sampled[sampled.length - 1]!;
    // The Euclidean distance from last to first should be at least spacingMm
    const dist = distanceBetweenPoints(first, last);
    expect(dist).toBeGreaterThanOrEqual(spacing - 0.001);
  });
});
