import { describe, it, expect } from 'vitest';
import {
  svgStringToPolylines,
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
  it('throws on unsupported path curve command C', () => {
    expect(() => svgStringToPolylines(pathCurveSvg)).toThrow(/C/);
  });

  it('throws on transform attribute', () => {
    expect(() => svgStringToPolylines(transformSvg)).toThrow(/transform/i);
  });

  it('throws on unsafe SVG (script tag)', () => {
    expect(() => svgStringToPolylines(unsafeSvg)).toThrow(/unsafe/i);
  });

  it('throws when no supported shapes exist', () => {
    expect(() => svgStringToPolylines(noShapesSvg)).toThrow(/no supported/i);
  });

  it('error message for curve command includes "flatten"', () => {
    expect(() => svgStringToPolylines(pathCurveSvg)).toThrow(/flatten/i);
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
