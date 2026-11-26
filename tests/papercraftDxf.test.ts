import { describe, expect, it } from 'vitest';
import { createPapercraft, exportPageDxf, renderPages, shapes } from '../src/lib/papercraft-engine';
import type { PageDrawing } from '../src/lib/papercraft-engine';
import { buildSilhouetteDownload, buildSilhouetteDxfs } from '../app/papercraft/papercraftExport';

/** Reads the group code and value pairs of a DXF. */
function pairs(dxf: string): [number, string][] {
  const lines = dxf.split('\r\n');
  if (lines[lines.length - 1] === '') lines.pop();
  expect(lines.length % 2).toBe(0);
  const out: [number, string][] = [];
  for (let i = 0; i < lines.length; i += 2) out.push([Number(lines[i]), lines[i + 1]]);
  return out;
}

interface Entity {
  type: string;
  layer: string;
  closed?: boolean;
  points: [number, number][];
}

/** The entities of the ENTITIES section: lines and polylines with their vertices. */
function entities(dxf: string): Entity[] {
  const ps = pairs(dxf);
  const start = ps.findIndex((p, i) => p[0] === 2 && p[1] === 'ENTITIES' && ps[i - 1][1] === 'SECTION');
  const out: Entity[] = [];
  let current: Entity | null = null;
  let vertex: Partial<{ x: number; y: number }> | null = null;
  for (let i = start + 1; i < ps.length; i++) {
    const [code, value] = ps[i];
    if (code === 0) {
      if (vertex && current) current.points.push([vertex.x!, vertex.y!]);
      vertex = null;
      if (value === 'ENDSEC') break;
      if (value === 'LINE' || value === 'POLYLINE') {
        current = { type: value, layer: '', points: [] };
        out.push(current);
      } else if (value === 'VERTEX') vertex = {};
      continue;
    }
    if (!current) continue;
    if (vertex) {
      if (code === 10) vertex.x = Number(value);
      if (code === 20) vertex.y = Number(value);
    } else if (code === 8 && current.layer === '') current.layer = value;
    else if (code === 70 && current.type === 'POLYLINE') current.closed = (Number(value) & 1) === 1;
    else if (current.type === 'LINE') {
      if (code === 10) current.points[0] = [Number(value), 0];
      if (code === 20) current.points[0][1] = Number(value);
      if (code === 11) current.points[1] = [Number(value), 0];
      if (code === 21) current.points[1][1] = Number(value);
    }
  }
  return out;
}

const drawing: PageDrawing = {
  widthMm: 210,
  heightMm: 297,
  cut: [
    { closed: true, points: [[10, 10], [60.12345, 10], [60, 50.5]] },
    { closed: false, points: [[100, 100], [120, 100]] },
  ],
  folds: [
    { a: [20, 20], b: [40, 20], kind: 'mountain' },
    { a: [20, 30], b: [40, 30], kind: 'valley' },
    { a: [20, 40], b: [40, 40], kind: 'tab' },
    { a: [20, 50], b: [40, 50], kind: 'flat' },
  ],
  text: [[[5, 5], [6, 5], [6, 7]]],
  fills: [],
  texts: [],
};

describe('Silhouette DXF', () => {
  const dxf = exportPageDxf(drawing);

  it('is a release 12 ASCII DXF in millimetres: header, tables, entities, end of file', () => {
    const ps = pairs(dxf);
    expect(ps[0]).toEqual([0, 'SECTION']);
    expect(ps[ps.length - 1]).toEqual([0, 'EOF']);
    const sections = ps.filter((p, i) => p[0] === 2 && ps[i - 1]?.[1] === 'SECTION').map((p) => p[1]);
    expect(sections).toEqual(['HEADER', 'TABLES', 'ENTITIES']);
    expect(ps).toContainEqual([1, 'AC1009']);
    const units = ps.findIndex((p) => p[1] === '$INSUNITS');
    expect(ps[units + 1]).toEqual([70, '4']);
    expect(dxf).toContain('\r\n');
  });

  it('has three layers with their own colours: CUT black, SCORE red, NUMBERS blue', () => {
    const ps = pairs(dxf);
    const layers: Record<string, number> = {};
    ps.forEach((p, i) => {
      if (p[0] === 0 && p[1] === 'LAYER') layers[ps[i + 1][1]] = Number(ps.slice(i, i + 6).find((q) => q[0] === 62)![1]);
    });
    expect(layers).toEqual({ CUT: 7, SCORE: 1, NUMBERS: 5 });
  });

  it('puts closed outlines in as closed polylines and open ones as open polylines, with the coordinates as drawn (y up, rounded to 0.0001)', () => {
    const cut = entities(dxf).filter((e) => e.layer === 'CUT');
    expect(cut).toHaveLength(2);
    expect(cut[0]).toMatchObject({ type: 'POLYLINE', closed: true, points: [[10, 10], [60.1235, 10], [60, 50.5]] });
    expect(cut[1]).toMatchObject({ type: 'POLYLINE', closed: false, points: [[100, 100], [120, 100]] });
  });

  it('draws mountain, valley and tab lines as lines on SCORE, and leaves flat folds out', () => {
    const score = entities(dxf).filter((e) => e.layer === 'SCORE');
    expect(score).toHaveLength(3);
    expect(score.every((e) => e.type === 'LINE')).toBe(true);
    expect(score.map((e) => e.points)).toEqual([[[20, 20], [40, 20]], [[20, 30], [40, 30]], [[20, 40], [40, 40]]]);
  });

  it('draws the numbers as open polylines on NUMBERS', () => {
    const numbers = entities(dxf).filter((e) => e.layer === 'NUMBERS');
    expect(numbers).toEqual([{ type: 'POLYLINE', layer: 'NUMBERS', closed: false, points: [[5, 5], [6, 5], [6, 7]] }]);
  });

  it('is deterministic, never writes NaN or Infinity, and skips a polyline with fewer than two points', () => {
    expect(exportPageDxf(drawing)).toBe(dxf);
    expect(dxf).not.toMatch(/NaN|Infinity/);
    const odd = exportPageDxf({ ...drawing, cut: [{ closed: true, points: [[1, 1]] }], folds: [], text: [] });
    expect(entities(odd)).toEqual([]);
  });
});

describe('Silhouette DXF from a model', () => {
  const run = createPapercraft({ mesh: shapes.cube(60) });

  it('has one closed outline per part and a score line for every fold and tab, in millimetres inside the page', () => {
    const page = renderPages(run.layout.pages, run.pattern.parts)[0];
    const es = entities(exportPageDxf(page));
    expect(es.filter((e) => e.layer === 'CUT').length).toBeGreaterThan(0);
    expect(es.filter((e) => e.layer === 'SCORE')).toHaveLength(page.folds.filter((f) => f.kind !== 'flat').length);
    for (const e of es) for (const [x, y] of e.points) {
      expect(x).toBeGreaterThanOrEqual(-0.001);
      expect(x).toBeLessThanOrEqual(page.widthMm + 0.001);
      expect(y).toBeGreaterThanOrEqual(-0.001);
      expect(y).toBeLessThanOrEqual(page.heightMm + 0.001);
    }
  });

  it('gives one file for one page and a zip for several, named after the project', () => {
    const one = buildSilhouetteDownload(run, 'Test cube');
    expect(one.fileName).toBe('Test-cube-silhouette.dxf');
    expect(one.mime).toBe('application/dxf');
    expect(typeof one.data).toBe('string');
    const big = createPapercraft({ mesh: shapes.icosahedron(260), page: { pageWidthMm: 100, pageHeightMm: 100 } });
    expect(big.layout.pages.length).toBeGreaterThan(1);
    const many = buildSilhouetteDownload(big, 'Ball');
    expect(many.fileName).toBe('Ball-silhouette.zip');
    expect(String.fromCharCode((many.data as Uint8Array)[0], (many.data as Uint8Array)[1])).toBe('PK');
    expect(buildSilhouetteDxfs(big, 'Ball').map((f) => f.name)).toEqual(big.layout.pages.map((_, i) => `Ball-silhouette-page-${i + 1}.dxf`));
  });
});
