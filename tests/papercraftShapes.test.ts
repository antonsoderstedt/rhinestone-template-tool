import { describe, expect, it } from 'vitest';
import { buildPattern, buildSolid, extrudeShape, latheShape, rasterizeShape, reportSolid, shapeOutline, simplifyOutline, scaleMesh } from '../src/lib/papercraft-engine';
import type { ShapeRegion, Solid } from '../src/lib/papercraft-engine';
import { GALLERY_SHAPES } from '../app/lib/shapeGallery';
import { DEFAULT_SHAPE_SETTINGS, ShapeFileError, regionsFromSvg, shapeModel } from '../app/papercraft/papercraftShapes';

const rect = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const region = (...contours: [number, number][][]): ShapeRegion => ({ contours, fillRule: 'nonzero' });
const area = (pts: readonly (readonly number[])[]) => Math.abs(pts.reduce((s, p, i) => s + p[0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * p[1], 0)) / 2;
const volume = (s: Solid) => {
  let v = 0;
  for (const f of s.faces) for (let k = 1; k + 1 < f.vertices.length; k++) {
    const [a, b, c] = [f.vertices[0], f.vertices[k], f.vertices[k + 1]].map((i) => s.vertices[i]);
    v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return v;
};

describe('simplifying an outline', () => {
  it('takes away the corners that matter least and keeps the ones that carry the shape', () => {
    // A square with a corner cut by a tiny step on every side: the four big corners stay.
    const pts: [number, number][] = [[0, 0], [5, 0.05], [10, 0], [10.05, 5], [10, 10], [5, 9.95], [0, 10], [-0.05, 5]];
    const four = simplifyOutline(pts, 4);
    expect(four).toHaveLength(4);
    expect(area(four)).toBeCloseTo(100, 0);
  });
  it('never goes under three, and leaves a shape alone that has fewer corners than asked', () => {
    expect(simplifyOutline(rect(0, 0, 4, 3), 1)).toHaveLength(3);
    expect(simplifyOutline(rect(0, 0, 4, 3), 10)).toHaveLength(4);
  });
});

describe('the outline of a shape', () => {
  it('a single contour is used as it is, counter-clockwise, without its repeated closing point', () => {
    const cw = [[0, 0], [0, 4], [6, 4], [6, 0], [0, 0]] as [number, number][];
    const o = shapeOutline([region(cw)], 8)!;
    expect(o.points).toHaveLength(4);
    expect(area(o.points)).toBeCloseTo(24, 9);
    const twice = o.points.reduce((s, p, i) => s + p[0] * o.points[(i + 1) % 4][1] - o.points[(i + 1) % 4][0] * p[1], 0);
    expect(twice).toBeGreaterThan(0);
  });

  it('is the union when regions overlap: two overlapping squares are one L-shaped, or here one wide, outline', () => {
    const o = shapeOutline([region(rect(0, 0, 10, 10)), region(rect(6, 0, 16, 10))], 12)!;
    expect(o.omittedPieces).toBe(0);
    expect(area(o.points)).toBeGreaterThan(155);
    expect(area(o.points)).toBeLessThan(165);
    expect(o.points.length).toBeLessThanOrEqual(12);
  });

  it('fills a hole (the outline is the outer edge) and says nothing is left out', () => {
    const o = shapeOutline([{ contours: [rect(0, 0, 20, 20), rect(6, 6, 14, 14)], fillRule: 'evenodd' }], 8)!;
    expect(o.omittedPieces).toBe(0);
    expect(area(o.points)).toBeGreaterThan(380);
  });

  it('joins pieces that are close, and leaves out the small ones that are far away', () => {
    const near = shapeOutline([region(rect(0, 0, 10, 10)), region(rect(12, 0, 22, 10))], 10)!;
    expect(near.omittedPieces).toBe(0);
    expect(area(near.points)).toBeGreaterThan(200);
    const far = shapeOutline([region(rect(0, 0, 100, 100)), region(rect(300, 0, 310, 10))], 10)!;
    expect(far.omittedPieces).toBe(1);
    expect(area(far.points)).toBeGreaterThan(9000);
    expect(area(far.points)).toBeLessThan(10500);
  });

  it('gives nothing for nothing: no contours, a line, points that are not numbers', () => {
    expect(shapeOutline([], 8)).toBeNull();
    expect(shapeOutline([region([[0, 0], [5, 0], [10, 0]])], 8)).toBeNull();
    expect(rasterizeShape([region([[Number.NaN, 0], [1, 1], [2, 0]])])).toBeNull();
  });

  it('is deterministic', () => {
    const r = [region(rect(0, 0, 10, 10)), region(rect(6, 4, 16, 14))];
    expect(JSON.stringify(shapeOutline(r, 14))).toBe(JSON.stringify(shapeOutline(r, 14)));
  });
});

describe('a box in the shape of a flat shape', () => {
  it('is a closed prism as deep as asked: a share of the longer side', () => {
    const made = extrudeShape([region(rect(0, 0, 40, 20))], { corners: 8, depthRatio: 0.5 })!;
    const solid = buildSolid(made.mesh);
    expect(solid.warnings).toEqual([]);
    expect(solid.closed).toBe(true);
    expect(reportSolid(solid).size.map((x) => Math.round(x * 100) / 100)).toEqual([40, 20, 20]);
    expect(volume(solid)).toBeCloseTo(40 * 20 * 20, 6);
  });

  it('a heart: a non-convex box with the corners asked for, and its faces are the corners plus the top and bottom', () => {
    const heart = GALLERY_SHAPES.find((g) => g.id === 'heart')!;
    const made = shapeModel(regionsFromSvg(heart.svg), { ...DEFAULT_SHAPE_SETTINGS, corners: 14 })!;
    expect(made.mesh.faces).toHaveLength(14 + 2);
    const solid = buildSolid(made.mesh);
    expect(solid.closed).toBe(true);
    expect(solid.warnings).toEqual([]);
  });
});

describe('a shape spun round', () => {
  it('a rectangle becomes a cylinder (rings with the same radius, flat ends) of the right size', () => {
    const made = latheShape([region(rect(0, 0, 20, 30))], { rings: 5, segments: 8 })!;
    const solid = buildSolid(made.mesh);
    expect(solid.closed).toBe(true);
    const size = reportSolid(solid).size;
    expect(size[0]).toBeGreaterThan(19.5);
    expect(size[0]).toBeLessThan(20.5);
    expect(size[2]).toBeGreaterThan(29);
    expect(size[2]).toBeLessThan(30.5);
  });

  it('a tip becomes a point: a triangle spun round is a cone', () => {
    const made = latheShape([region([[0, 0], [20, 0], [10, 30]])], { rings: 6, segments: 8 })!;
    const solid = buildSolid(made.mesh);
    expect(solid.closed).toBe(true);
    const top = Math.max(...solid.vertices.map((v) => v[2]));
    const atTop = solid.vertices.filter((v) => Math.abs(v[2] - top) < 1e-9);
    expect(atTop).toHaveLength(1);
  });

  it('keeps the way up: a shape that is wide at the top is wide at the top (y up, nothing upside down)', () => {
    const made = latheShape([region([[5, 0], [15, 0], [30, 30], [-10, 30]])], { rings: 6, segments: 8 })!;
    const solid = buildSolid(made.mesh);
    const widthAt = (z: number) => Math.max(...solid.vertices.filter((v) => Math.abs(v[2] - z) < 1e-6).map((v) => Math.hypot(v[0], v[1])));
    const zs = solid.vertices.map((v) => v[2]);
    expect(widthAt(Math.max(...zs))).toBeGreaterThan(widthAt(Math.min(...zs)) * 1.5);
  });

  it('refuses an empty shape', () => {
    expect(latheShape([], { rings: 6, segments: 8 })).toBeNull();
  });
});

describe('shapes from the gallery and from files', () => {
  it.each(GALLERY_SHAPES.map((g) => [g.id, g] as const))('%s makes a closed box and a closed spun model that unfold', (_id, g) => {
    const regions = regionsFromSvg(g.svg);
    for (const mode of ['box', 'spun'] as const) {
      const made = shapeModel(regions, { ...DEFAULT_SHAPE_SETTINGS, mode })!;
      expect(made, mode).not.toBeNull();
      const solid = buildSolid(scaleMesh(made.mesh, { by: 'largest', mm: 120 }));
      expect(solid.closed, mode).toBe(true);
      expect(solid.faces.length, mode).toBeLessThanOrEqual(120);
      const pattern = buildPattern(solid, { maxPartSize: { widthMm: 190, heightMm: 277 } });
      expect(pattern.parts.length, mode).toBeGreaterThan(0);
      expect(pattern.warnings.find((w) => w.code === 'part-too-large'), mode).toBeUndefined();
    }
  });

  it('reads the fill, not the stroke, and flips y so the shape is not upside down', () => {
    const regions = regionsFromSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 10L90 10L50 90Z" fill="#f00"/><rect x="0" y="0" width="5" height="5" fill="none" stroke="#000"/></svg>');
    expect(regions).toHaveLength(1);
    // A triangle with its point down in the SVG: the point is the lowest y in the model.
    const ys = regions[0].contours[0].map((p) => p[1]);
    const tip = regions[0].contours[0].find((p) => p[1] === Math.min(...ys))!;
    expect(tip[0]).toBeCloseTo(50, 6);
  });

  it('uses the closed lines of line art when nothing is filled', () => {
    const regions = regionsFromSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 10L90 10L50 90Z" fill="none" stroke="#000"/></svg>');
    expect(regions).toHaveLength(1);
  });

  it('refuses what it cannot or should not read: not an SVG, scripts, too big, nothing in it', () => {
    const code = (svg: string) => {
      try {
        regionsFromSvg(svg);
        return 'ok';
      } catch (e) {
        return e instanceof ShapeFileError ? e.code : 'other';
      }
    };
    expect(code('hello')).toBe('unreadable');
    expect(code('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><path d="M0 0L9 0L9 9Z"/></svg>')).toBe('unreadable');
    expect(code('<svg xmlns="http://www.w3.org/2000/svg">' + ' '.repeat(2 * 1024 * 1024 + 1) + '</svg>')).toBe('too-big');
    expect(code('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBe('empty');
  });

  it('keeps the settings in range: a request for 1000 corners gives the most the panel allows', () => {
    const heart = regionsFromSvg(GALLERY_SHAPES.find((g) => g.id === 'heart')!.svg);
    const made = shapeModel(heart, { ...DEFAULT_SHAPE_SETTINGS, corners: 1000 })!;
    expect(made.mesh.faces.length).toBeLessThanOrEqual(40 + 2);
  });
});
