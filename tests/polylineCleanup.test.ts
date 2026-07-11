import { describe, it, expect } from 'vitest';
import {
  cleanupPolylines,
  removeDuplicatePolylinePoints,
  removeShortPolylineSegments,
  simplifyPolyline,
  removeTinyPolylines,
  svgStringToPolylines,
  createPolylineRhinestoneTemplate,
  validateRhinestoneTemplate,
  checkExportReadiness,
  createBasicSvgExport,
  getPolylineLength,
} from '../src/lib/rhinestone-engine/index.js';
import type { Polyline } from '../src/lib/rhinestone-engine/index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CLEAN_LINE: Polyline = { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] };

/** Polyline with duplicate consecutive points */
const DUPED_LINE: Polyline = {
  points: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }],
};

/** Closed triangle with repeated closure point */
const CLOSED_WITH_DUPE: Polyline = {
  points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 8 }, { x: 0, y: 0 }],
  closed: true,
};

/** Polyline with many collinear points (simplifiable) */
function makeCollinear(n = 20): Polyline {
  return {
    points: Array.from({ length: n + 1 }, (_, i) => ({ x: i, y: 0 })),
  };
}

// ─── removeDuplicatePolylinePoints ────────────────────────────────────────────

describe('removeDuplicatePolylinePoints', () => {
  it('removes exact duplicate consecutive points', () => {
    const result = removeDuplicatePolylinePoints(DUPED_LINE, 0.001);
    expect(result.points.length).toBe(3); // [0,0], [5,0], [10,0]
  });

  it('removes near-duplicate points within tolerance', () => {
    const poly: Polyline = {
      points: [{ x: 0, y: 0 }, { x: 0.03, y: 0 }, { x: 10, y: 0 }],
    };
    const result = removeDuplicatePolylinePoints(poly, 0.05);
    expect(result.points.length).toBe(2); // 0.03 < 0.05 → removed
  });

  it('does NOT remove points beyond tolerance', () => {
    const poly: Polyline = {
      points: [{ x: 0, y: 0 }, { x: 0.1, y: 0 }, { x: 10, y: 0 }],
    };
    const result = removeDuplicatePolylinePoints(poly, 0.05);
    expect(result.points.length).toBe(3); // 0.1 > 0.05 → kept
  });

  it('removes repeated closure point from closed polyline', () => {
    const result = removeDuplicatePolylinePoints(CLOSED_WITH_DUPE, 0.001);
    // Original has 4 points where last = first; should become 3
    expect(result.points.length).toBe(3);
    expect(result.closed).toBe(true);
  });

  it('preserves open/closed status', () => {
    const open   = removeDuplicatePolylinePoints(CLEAN_LINE, 0.001);
    const closed = removeDuplicatePolylinePoints({ ...CLEAN_LINE, closed: true }, 0.001);
    expect(open.closed).toBeFalsy();
    expect(closed.closed).toBe(true);
  });

  it('does not mutate input', () => {
    const before = DUPED_LINE.points.length;
    removeDuplicatePolylinePoints(DUPED_LINE, 0.001);
    expect(DUPED_LINE.points.length).toBe(before);
  });
});

// ─── removeShortPolylineSegments ─────────────────────────────────────────────

describe('removeShortPolylineSegments', () => {
  it('removes intermediate points creating short segments', () => {
    const poly: Polyline = {
      points: [{ x: 0, y: 0 }, { x: 0.1, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }],
    };
    const result = removeShortPolylineSegments(poly, 1.0); // 0.1 < 1.0 → remove
    // First (0,0), then skip 0.1mm, keep 5mm, keep 10mm
    expect(result.points.length).toBe(3);
    expect(result.points[0]).toEqual({ x: 0, y: 0 });
    expect(result.points[result.points.length - 1]).toEqual({ x: 10, y: 0 });
  });

  it('always preserves first and last points', () => {
    const poly: Polyline = {
      points: [{ x: 0, y: 0 }, { x: 0.05, y: 0 }, { x: 20, y: 0 }],
    };
    const result = removeShortPolylineSegments(poly, 1.0);
    expect(result.points[0]).toEqual({ x: 0, y: 0 });
    expect(result.points[result.points.length - 1]).toEqual({ x: 20, y: 0 });
  });
});

// ─── simplifyPolyline ─────────────────────────────────────────────────────────

describe('simplifyPolyline', () => {
  it('reduces collinear points to just 2 endpoints', () => {
    const poly = makeCollinear(20);
    const simplified = simplifyPolyline(poly, 0.01);
    // All points are at y=0 → all collinear → only endpoints remain
    expect(simplified.points.length).toBe(2);
  });

  it('preserves first and last points for open polyline', () => {
    const poly = makeCollinear(10);
    const simplified = simplifyPolyline(poly, 0.01);
    expect(simplified.points[0]).toEqual(poly.points[0]);
    expect(simplified.points[simplified.points.length - 1]).toEqual(
      poly.points[poly.points.length - 1],
    );
  });

  it('handles closed polyline without throwing', () => {
    const closed: Polyline = {
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 8 }],
      closed: true,
    };
    expect(() => simplifyPolyline(closed, 0.1)).not.toThrow();
    expect(simplifyPolyline(closed, 0.1).closed).toBe(true);
  });

  it('returns fewer points than input for a noisy curve', () => {
    const pts = Array.from({ length: 30 }, (_, i) => ({
      x: i,
      y: (i % 2 === 0 ? 0.01 : -0.01), // alternating tiny noise
    }));
    const poly: Polyline = { points: pts };
    const simplified = simplifyPolyline(poly, 0.05);
    expect(simplified.points.length).toBeLessThan(pts.length);
  });

  it('throws on toleranceMm <= 0', () => {
    expect(() => simplifyPolyline(CLEAN_LINE, 0)).toThrow(/toleranceMm/);
  });
});

// ─── removeTinyPolylines ─────────────────────────────────────────────────────

describe('removeTinyPolylines', () => {
  it('removes polylines shorter than the minimum length', () => {
    const tiny: Polyline   = { points: [{ x: 0, y: 0 }, { x: 0.5, y: 0 }] }; // 0.5mm
    const big:  Polyline   = { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }]  }; // 10mm
    const result = removeTinyPolylines([tiny, big], 1);
    expect(result).toHaveLength(1);
    expect(getPolylineLength(result[0]!)).toBeGreaterThanOrEqual(1);
  });

  it('keeps polylines at or above minimum length', () => {
    const result = removeTinyPolylines([CLEAN_LINE], 10); // CLEAN_LINE = 10mm
    expect(result).toHaveLength(1);
  });
});

// ─── cleanupPolylines ─────────────────────────────────────────────────────────

describe('cleanupPolylines', () => {
  it('throws if all polylines are removed by cleanup', () => {
    const tiny: Polyline = { points: [{ x: 0, y: 0 }, { x: 0.05, y: 0 }] }; // 0.05mm
    expect(() =>
      cleanupPolylines([tiny], { removeTinyPolylines: true, minPolylineLengthMm: 1 }),
    ).toThrow(/removed/i);
  });

  it('does not mutate input array', () => {
    const original = [{ ...CLEAN_LINE, points: CLEAN_LINE.points.map((p) => ({ ...p })) }];
    const originalLen = original[0]!.points.length;
    cleanupPolylines(original);
    expect(original[0]!.points.length).toBe(originalLen);
  });

  it('returns clean polylines for valid input', () => {
    const result = cleanupPolylines([CLEAN_LINE]);
    expect(result.length).toBeGreaterThan(0);
    for (const p of result) expect(p.points.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── Integration with svgStringToPolylines ────────────────────────────────────

describe('svgStringToPolylines — cleanup integration', () => {
  const simpleSvg = '<svg xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="0" x2="30" y2="0" /></svg>';

  it('cleanup is enabled by default (no error on clean SVG)', () => {
    expect(() => svgStringToPolylines(simpleSvg)).not.toThrow();
  });

  it('cleanup can be disabled explicitly', () => {
    expect(() => svgStringToPolylines(simpleSvg, { cleanup: false })).not.toThrow();
  });

  it('cleaned polylines can become a RhinestoneTemplate', () => {
    const polys = svgStringToPolylines(simpleSvg);
    expect(() =>
      createPolylineRhinestoneTemplate({ id: 't', name: 'T', polylines: polys, stoneSize: 'SS10' }),
    ).not.toThrow();
  });

  it('cleaned template passes validateRhinestoneTemplate', () => {
    const polys    = svgStringToPolylines(simpleSvg);
    const template = createPolylineRhinestoneTemplate({ id: 't', name: 'T', polylines: polys, stoneSize: 'SS10' });
    expect(validateRhinestoneTemplate(template).valid).toBe(true);
  });

  it('cleaned template passes checkExportReadiness', () => {
    const polys    = svgStringToPolylines(simpleSvg);
    const template = createPolylineRhinestoneTemplate({ id: 't', name: 'T', polylines: polys, stoneSize: 'SS10' });
    expect(checkExportReadiness(template, { requireCalibration: false }).ready).toBe(true);
  });

  it('exported SVG contains real <circle elements', () => {
    const polys    = svgStringToPolylines(simpleSvg);
    const template = createPolylineRhinestoneTemplate({ id: 't', name: 'T', polylines: polys, stoneSize: 'SS10' });
    const svg      = createBasicSvgExport(template);
    expect(svg).toContain('<circle');
  });

  it('exported SVG does not contain uploaded raw SVG content', () => {
    const polys    = svgStringToPolylines(simpleSvg);
    const template = createPolylineRhinestoneTemplate({ id: 't', name: 'T', polylines: polys, stoneSize: 'SS10' });
    const svg      = createBasicSvgExport(template);
    // The original line element should not appear
    expect(svg).not.toContain('x1="0"');
    expect(svg).not.toContain('<line');
  });

  it('exported SVG does not contain <image tags', () => {
    const polys    = svgStringToPolylines(simpleSvg);
    const template = createPolylineRhinestoneTemplate({ id: 't', name: 'T', polylines: polys, stoneSize: 'SS10' });
    expect(createBasicSvgExport(template)).not.toContain('<image');
  });
});
