import { describe, it, expect } from 'vitest';
import {
  svgStringToPolylines,
  suggestSvgUploadMode,
  createPolylineRhinestoneTemplate,
  validateRhinestoneTemplate,
  createBasicSvgExport,
} from '../src/lib/rhinestone-engine/index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const lineSvg = '<svg xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="0" x2="30" y2="0" /></svg>';
const polylineSvg = '<svg xmlns="http://www.w3.org/2000/svg"><polyline points="0,0 10,10 20,0" /></svg>';
const polygonSvg = '<svg xmlns="http://www.w3.org/2000/svg"><polygon points="0,0 10,10 20,0" /></svg>';
const rectSvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect x="5" y="10" width="20" height="15" /></svg>';
const circleSvg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="10" /></svg>';
const ellipseSvg = '<svg xmlns="http://www.w3.org/2000/svg"><ellipse cx="20" cy="20" rx="15" ry="10" /></svg>';
const pathMLZSvg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M 0 0 L 30 0 L 30 20 Z" /></svg>';
const pathHVSvg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M 10 10 H 30 V 30 Z" /></svg>';
const pathCurveSvg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M 0 0 C 10 20 30 40 50 60" /></svg>';
const transformSvg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="10" transform="translate(10,5)" /></svg>';
const unsafeSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle cx="10" cy="10" r="5"/></svg>';
const noShapesSvg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Hello</text></svg>';
const styledClosedPathSvg = '<svg xmlns="http://www.w3.org/2000/svg"><defs><style>.cls-1{fill:#ff7bb2;}</style></defs><path class="cls-1" d="M 0 0 L 20 0 L 20 20 Z" /></svg>';

// ─── svgStringToPolylines — basic conversions ─────────────────────────────────

describe('svgStringToPolylines — conversions', () => {
  it('converts line to an open polyline with 2 points', () => {
    const polys = svgStringToPolylines(lineSvg);
    expect(polys).toHaveLength(1);
    expect(polys[0]!.closed).toBeFalsy();
    expect(polys[0]!.points).toHaveLength(2);
    expect(polys[0]!.points[0]).toEqual({ x: 0, y: 0 });
    expect(polys[0]!.points[1]).toEqual({ x: 30, y: 0 });
  });

  it('converts polyline points correctly', () => {
    const polys = svgStringToPolylines(polylineSvg);
    expect(polys[0]!.points).toHaveLength(3);
    expect(polys[0]!.points[1]).toEqual({ x: 10, y: 10 });
  });

  it('converts polygon to a closed polyline', () => {
    const polys = svgStringToPolylines(polygonSvg);
    expect(polys[0]!.closed).toBe(true);
    expect(polys[0]!.points).toHaveLength(3);
  });

  it('converts rect to a 4-point closed polyline', () => {
    const polys = svgStringToPolylines(rectSvg);
    expect(polys[0]!.closed).toBe(true);
    expect(polys[0]!.points).toHaveLength(4);
    expect(polys[0]!.points[0]).toEqual({ x: 5, y: 10 });
    expect(polys[0]!.points[2]).toEqual({ x: 25, y: 25 }); // x+w, y+h
  });

  it('converts circle to a closed polyline with configured segments', () => {
    const polys = svgStringToPolylines(circleSvg, { circleSegments: 8 });
    expect(polys[0]!.closed).toBe(true);
    expect(polys[0]!.points).toHaveLength(8);
  });

  it('uses default 64 segments for circle when no options given', () => {
    const polys = svgStringToPolylines(circleSvg);
    expect(polys[0]!.points).toHaveLength(64);
  });

  it('converts ellipse to a closed polyline with configured segments', () => {
    const polys = svgStringToPolylines(ellipseSvg, { ellipseSegments: 16 });
    expect(polys[0]!.closed).toBe(true);
    expect(polys[0]!.points).toHaveLength(16);
  });

  it('converts simple path M/L/Z to a closed polyline', () => {
    const polys = svgStringToPolylines(pathMLZSvg);
    expect(polys).toHaveLength(1);
    expect(polys[0]!.closed).toBe(true);
    expect(polys[0]!.points).toHaveLength(3);
    expect(polys[0]!.points[0]).toEqual({ x: 0, y: 0 });
    expect(polys[0]!.points[2]).toEqual({ x: 30, y: 20 });
  });

  it('converts simple path with H/V commands', () => {
    const polys = svgStringToPolylines(pathHVSvg);
    expect(polys[0]!.closed).toBe(true);
    const pts = polys[0]!.points;
    expect(pts[0]).toEqual({ x: 10, y: 10 }); // M
    expect(pts[1]).toEqual({ x: 30, y: 10 }); // H 30
    expect(pts[2]).toEqual({ x: 30, y: 30 }); // V 30
  });
});

// ─── svgStringToPolylines — error cases ──────────────────────────────────────

describe('svgStringToPolylines — error cases', () => {
  it('cubic Bezier C is now supported in v2 (does not throw)', () => {
    // In v1, C threw. In v2, C is supported via curve flattening.
    expect(() => svgStringToPolylines(pathCurveSvg)).not.toThrow();
  });

  it('transform attribute is now supported in v2 (does not throw for translate/scale/rotate/matrix)', () => {
    // In v1, any transform threw. In v2, translate/scale/rotate/matrix are applied.
    expect(() => svgStringToPolylines(transformSvg)).not.toThrow();
  });

  it('throws on unsafe SVG (script tag)', () => {
    expect(() => svgStringToPolylines(unsafeSvg)).toThrow(/unsafe/i);
  });

  it('ignores inert style blocks from design-tool exports', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><style>.cls-1{fill:#000}</style><circle cx="10" cy="10" r="5" /></svg>';
    expect(() => svgStringToPolylines(svg)).not.toThrow();
  });

  it('suggests fill mode for closed filled SVG artwork', () => {
    expect(suggestSvgUploadMode(styledClosedPathSvg)).toBe('outline-fill');
  });

  it('keeps outline mode for open stroke-style artwork', () => {
    expect(suggestSvgUploadMode(lineSvg)).toBe('outline');
  });

  it('throws when no supported shapes exist', () => {
    expect(() => svgStringToPolylines(noShapesSvg)).toThrow(/no supported/i);
  });

  it('arc A still throws in v2 with a clear message', () => {
    const arcSvg = '<svg><path d="M 0 0 A 10 10 0 0 1 20 0" /></svg>';
    expect(() => svgStringToPolylines(arcSvg)).toThrow(/arc/i);
  });
});

// ─── Integration with rhinestone engine ──────────────────────────────────────

describe('svgStringToPolylines — rhinestone engine integration', () => {
  it('generated polylines can be passed to createPolylineRhinestoneTemplate', () => {
    const polylines = svgStringToPolylines(lineSvg);
    expect(() =>
      createPolylineRhinestoneTemplate({ id: 't', name: 'T', polylines, stoneSize: 'SS10' }),
    ).not.toThrow();
  });

  it('generated template passes validateRhinestoneTemplate', () => {
    const polylines = svgStringToPolylines(lineSvg);
    const template = createPolylineRhinestoneTemplate({
      id: 't',
      name: 'T',
      polylines,
      stoneSize: 'SS10',
    });
    expect(validateRhinestoneTemplate(template).valid).toBe(true);
  });

  it('generated template can be exported with createBasicSvgExport', () => {
    const polylines = svgStringToPolylines(lineSvg);
    const template = createPolylineRhinestoneTemplate({
      id: 't',
      name: 'T',
      polylines,
      stoneSize: 'SS10',
    });
    expect(() => createBasicSvgExport(template)).not.toThrow();
  });

  it('exported SVG contains real <circle elements', () => {
    const polylines = svgStringToPolylines(lineSvg);
    const template = createPolylineRhinestoneTemplate({ id: 't', name: 'T', polylines, stoneSize: 'SS10' });
    const svg = createBasicSvgExport(template);
    expect(svg).toContain('<circle');
  });

  it('exported SVG does not contain the raw uploaded path data', () => {
    // The path d attribute value should not appear in the rhinestone output SVG
    const inputSvg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M 0 0 L 30 0 Z" /></svg>';
    const polylines = svgStringToPolylines(inputSvg);
    const template = createPolylineRhinestoneTemplate({ id: 't', name: 'T', polylines, stoneSize: 'SS10' });
    const exported = createBasicSvgExport(template);
    // The raw path d attribute should NOT appear in the rhinestone SVG
    expect(exported).not.toContain('M 0 0 L 30 0 Z');
    // But rhinestone circles should be present
    expect(exported).toContain('<circle');
  });

  it('exported SVG does not contain <image', () => {
    const polylines = svgStringToPolylines(lineSvg);
    const template = createPolylineRhinestoneTemplate({ id: 't', name: 'T', polylines, stoneSize: 'SS10' });
    const svg = createBasicSvgExport(template);
    expect(svg).not.toContain('<image');
  });

  it('exported SVG contains data-stone-size="SS10"', () => {
    const polylines = svgStringToPolylines(lineSvg);
    const template = createPolylineRhinestoneTemplate({ id: 't', name: 'T', polylines, stoneSize: 'SS10' });
    const svg = createBasicSvgExport(template);
    expect(svg).toContain('data-stone-size="SS10"');
  });
});

// ─── Bezier curve support (v2) ────────────────────────────────────────────────

describe('svgStringToPolylines — Bezier curves', () => {
  it('converts cubic Bezier C to polyline (curveSegments points added)', () => {
    const svg = '<svg><path d="M 0 0 C 10 0 10 20 20 20" /></svg>';
    const polys = svgStringToPolylines(svg, { curveSegments: 4 });
    // 1 start + 4 curve points = 5
    expect(polys[0]!.points.length).toBe(5);
    expect(polys[0]!.points[0]).toEqual({ x: 0, y: 0 });
    expect(polys[0]!.points[4]!.x).toBeCloseTo(20, 2);
    expect(polys[0]!.points[4]!.y).toBeCloseTo(20, 2);
  });

  it('converts relative cubic c to polyline', () => {
    const svg = '<svg><path d="M 0 0 c 10 0 10 20 20 20" /></svg>';
    const polys = svgStringToPolylines(svg, { curveSegments: 4 });
    expect(polys[0]!.points.length).toBe(5);
    expect(polys[0]!.points[4]!.x).toBeCloseTo(20, 2);
    expect(polys[0]!.points[4]!.y).toBeCloseTo(20, 2);
  });

  it('converts smooth cubic S (uses reflected control point)', () => {
    const svg = '<svg><path d="M 0 0 C 5 -5 15 25 20 20 S 35 15 40 20" /></svg>';
    const polys = svgStringToPolylines(svg, { curveSegments: 4 });
    // 1 start + 4 (C) + 4 (S) = 9 points
    expect(polys[0]!.points.length).toBe(9);
    expect(polys[0]!.points[8]!.x).toBeCloseTo(40, 2);
  });

  it('converts quadratic Bezier Q to polyline', () => {
    const svg = '<svg><path d="M 0 0 Q 10 20 20 0" /></svg>';
    const polys = svgStringToPolylines(svg, { curveSegments: 4 });
    expect(polys[0]!.points.length).toBe(5);
    expect(polys[0]!.points[4]!.x).toBeCloseTo(20, 2);
    expect(polys[0]!.points[4]!.y).toBeCloseTo(0, 2);
  });

  it('converts smooth quadratic T (uses reflected control point)', () => {
    const svg = '<svg><path d="M 0 0 Q 10 20 20 0 T 40 0" /></svg>';
    const polys = svgStringToPolylines(svg, { curveSegments: 4 });
    expect(polys[0]!.points.length).toBe(9);
    expect(polys[0]!.points[8]!.x).toBeCloseTo(40, 2);
  });

  it('supports multiple subpaths in one path element', () => {
    const svg = '<svg><path d="M 0 0 L 10 0 M 20 0 L 30 0" /></svg>';
    const polys = svgStringToPolylines(svg);
    expect(polys.length).toBe(2);
    expect(polys[0]!.points[0]).toEqual({ x: 0, y: 0 });
    expect(polys[1]!.points[0]).toEqual({ x: 20, y: 0 });
  });

  it('curve produces more points than a straight line', () => {
    const straight = svgStringToPolylines('<svg><path d="M 0 0 L 20 20" /></svg>');
    const curve    = svgStringToPolylines('<svg><path d="M 0 0 C 10 0 10 20 20 20" /></svg>');
    expect(curve[0]!.points.length).toBeGreaterThan(straight[0]!.points.length);
  });

  it('throws on arc A command (not supported in v2)', () => {
    expect(() =>
      svgStringToPolylines('<svg><path d="M 0 0 A 10 10 0 0 1 20 0" /></svg>'),
    ).toThrow(/arc/i);
  });

  it('curve-based SVG → template → valid → exported SVG with real circles', () => {
    const polys = svgStringToPolylines(
      '<svg><path d="M 0 0 C 20 0 20 20 40 20" /></svg>',
    );
    const template = createPolylineRhinestoneTemplate({ id: 't', name: 'T', polylines: polys, stoneSize: 'SS10' });
    expect(validateRhinestoneTemplate(template).valid).toBe(true);
    const svg = createBasicSvgExport(template);
    expect(svg).toContain('<circle');
    expect(svg).not.toContain('<image');
  });
});

// ─── Transform support (v2) ───────────────────────────────────────────────────

describe('svgStringToPolylines — transforms', () => {
  it('translate moves line points', () => {
    const svg = '<svg><line x1="0" y1="0" x2="10" y2="0" transform="translate(5, 3)" /></svg>';
    const polys = svgStringToPolylines(svg);
    expect(polys[0]!.points[0]).toEqual({ x: 5, y: 3 });
    expect(polys[0]!.points[1]).toEqual({ x: 15, y: 3 });
  });

  it('scale(2) doubles all coordinates', () => {
    const svg = '<svg><rect x="0" y="0" width="10" height="5" transform="scale(2)" /></svg>';
    const polys = svgStringToPolylines(svg);
    expect(polys[0]!.points[0]).toEqual({ x: 0, y: 0 });
    expect(polys[0]!.points[1]).toEqual({ x: 20, y: 0 });
    expect(polys[0]!.points[2]).toEqual({ x: 20, y: 10 });
  });

  it('rotate(90°) rotates points', () => {
    const svg = '<svg><line x1="10" y1="0" x2="0" y2="0" transform="rotate(90)" /></svg>';
    const polys = svgStringToPolylines(svg);
    // (10,0) rotated 90°: x'=0, y'=10
    expect(polys[0]!.points[0]!.x).toBeCloseTo(0, 2);
    expect(polys[0]!.points[0]!.y).toBeCloseTo(10, 2);
    expect(polys[0]!.points[1]!.x).toBeCloseTo(0, 2);
    expect(polys[0]!.points[1]!.y).toBeCloseTo(0, 2);
  });

  it('rotate(90, cx, cy) rotates around a center point', () => {
    // (10,0) rotated 90° around (10,10) → (20,10)
    const svg = '<svg><line x1="10" y1="0" x2="10" y2="10" transform="rotate(90, 10, 10)" /></svg>';
    const polys = svgStringToPolylines(svg);
    expect(polys[0]!.points[0]!.x).toBeCloseTo(20, 2);
    expect(polys[0]!.points[0]!.y).toBeCloseTo(10, 2);
    // (10,10) rotated around itself stays (10,10)
    expect(polys[0]!.points[1]!.x).toBeCloseTo(10, 2);
    expect(polys[0]!.points[1]!.y).toBeCloseTo(10, 2);
  });

  it('matrix(2,0,0,2,5,3) acts as scale(2) + translate', () => {
    const svg = '<svg><line x1="0" y1="0" x2="5" y2="0" transform="matrix(2,0,0,2,5,3)" /></svg>';
    const polys = svgStringToPolylines(svg);
    // x'=2*0+5=5, y'=2*0+3=3 ; x'=2*5+5=15, y'=3
    expect(polys[0]!.points[0]).toEqual({ x: 5, y: 3 });
    expect(polys[0]!.points[1]).toEqual({ x: 15, y: 3 });
  });

  it('transform chain: two translates add up', () => {
    const svg = '<svg><line x1="0" y1="0" x2="0" y2="5" transform="translate(10,0) translate(5,0)" /></svg>';
    const polys = svgStringToPolylines(svg);
    expect(polys[0]!.points[0]!.x).toBeCloseTo(15, 3);
    expect(polys[0]!.points[1]!.x).toBeCloseTo(15, 3);
  });

  it('malformed transform throws a clear error', () => {
    const svg = '<svg><line x1="0" y1="0" x2="10" y2="0" transform="skewX(45)" /></svg>';
    expect(() => svgStringToPolylines(svg)).toThrow();
  });
});
