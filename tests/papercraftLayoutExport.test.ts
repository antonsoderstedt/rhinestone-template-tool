import { describe, expect, it } from 'vitest';
import {
  createPapercraft,
  exportPageSvg,
  exportPdf,
  layoutPages,
  PAGE_PRESETS,
  renderPages,
  shapes,
  strokeText,
  transformPoint,
} from '../src/lib/papercraft-engine';
import type { Part } from '../src/lib/papercraft-engine';
import { convexOverlap, signedArea, triangulate } from '../src/lib/papercraft-engine/geometry/polygon';

const A4 = { ...PAGE_PRESETS.a4, marginMm: 10, gapMm: 3 };

function placedHull(part: Part, pl: ReturnType<typeof layoutPages>['pages'][number]['placements'][number]) {
  return part.hull.map((p) => transformPoint(pl, p));
}

describe('page layout', () => {
  const run = createPapercraft({ mesh: shapes.icosahedron(60), page: A4 });

  it('puts every part on a page, inside the margins', () => {
    const placed = run.layout.pages.flatMap((p) => p.placements.map((pl) => pl.partId)).sort((a, b) => a - b);
    expect(placed).toEqual(run.pattern.parts.map((p) => p.id));
    for (const page of run.layout.pages) {
      for (const pl of page.placements) {
        const part = run.pattern.parts.find((p) => p.id === pl.partId)!;
        for (const [x, y] of placedHull(part, pl)) {
          expect(x).toBeGreaterThanOrEqual(A4.marginMm - 1e-6);
          expect(y).toBeGreaterThanOrEqual(A4.marginMm - 1e-6);
          expect(x).toBeLessThanOrEqual(A4.pageWidthMm - A4.marginMm + 1e-6);
          expect(y).toBeLessThanOrEqual(A4.pageHeightMm - A4.marginMm + 1e-6);
        }
      }
    }
  });

  it('never lets two parts on a page overlap', () => {
    for (const page of run.layout.pages) {
      const hulls = page.placements.map((pl) => placedHull(run.pattern.parts.find((p) => p.id === pl.partId)!, pl));
      for (let i = 0; i < hulls.length; i++) {
        for (let j = i + 1; j < hulls.length; j++) {
          for (const a of triangulate(hulls[i])) {
            for (const b of triangulate(hulls[j])) {
              expect(convexOverlap(a.map((k) => hulls[i][k]), b.map((k) => hulls[j][k]))).toBe(false);
            }
          }
        }
      }
    }
  });

  it('is deterministic', () => {
    const again = createPapercraft({ mesh: shapes.icosahedron(60), page: A4 });
    expect(JSON.stringify(again.layout)).toBe(JSON.stringify(run.layout));
  });

  it('packs loose parts tightly: at least half of the sheet is covered by parts (with their tabs), except on the last sheet', () => {
    const many = createPapercraft({ mesh: shapes.icosahedron(60), page: A4, pattern: { forceCutEdges: Array.from({ length: 30 }, (_, i) => i) } });
    expect(many.pattern.parts).toHaveLength(20);
    const usable = (A4.pageWidthMm - 2 * A4.marginMm) * (A4.pageHeightMm - 2 * A4.marginMm);
    const area = (pageIndex: number) =>
      many.layout.pages[pageIndex].placements.reduce((sum, pl) => sum + signedArea(many.pattern.parts.find((p) => p.id === pl.partId)!.hull), 0);
    for (let i = 0; i < many.layout.pages.length - 1; i++) expect(area(i) / usable).toBeGreaterThan(0.5);
    expect(many.layout.pages.length).toBeGreaterThan(1);
  });

  it('splits a model bigger than the page into parts that fit', () => {
    const big = createPapercraft({ mesh: shapes.cube(150), page: A4 });
    expect(big.pattern.parts.length).toBeGreaterThan(1);
    expect(big.layout.warnings).toEqual([]);
    expect(big.pattern.warnings.find((w) => w.code === 'part-too-large')).toBeUndefined();
  });

  it('warns when a single face is bigger than the page', () => {
    const huge = createPapercraft({ mesh: shapes.cube(400), page: A4 });
    expect(huge.layout.warnings.find((w) => w.code === 'part-too-large')?.count).toBeGreaterThan(0);
    expect(huge.pattern.warnings.find((w) => w.code === 'part-too-large')).toBeDefined();
    expect(huge.layout.pages.length).toBe(huge.pattern.parts.length);
  });

  it('works on a cutting mat size too', () => {
    const mat = createPapercraft({ mesh: shapes.dodecahedron(40), page: { ...PAGE_PRESETS.cricut12x12, marginMm: 5, gapMm: 3 } });
    expect(mat.layout.pages.length).toBeGreaterThanOrEqual(1);
    expect(mat.layout.warnings).toEqual([]);
  });
});

describe('stroke font', () => {
  it('draws digits as lines centred on the point', () => {
    const lines = strokeText('8', 100, 50, 5, 0);
    expect(lines).toHaveLength(7);
    const xs = lines.flat().map((p) => p[0]);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(100, 6);
    const ys = lines.flat().map((p) => p[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(5, 6);
  });

  it('rotates with the angle', () => {
    const lines = strokeText('1', 0, 0, 5, Math.PI / 2);
    const xs = lines.flat().map((p) => p[0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(5, 6);
  });
});

describe('SVG export', () => {
  const run = createPapercraft({ mesh: shapes.cube(40), page: A4 });
  const drawings = renderPages(run.layout.pages, run.pattern.parts);

  for (const purpose of ['cricut', 'print'] as const) {
    it(`${purpose}: is millimetres, plain, vector and safe for Cricut Design Space`, () => {
      const svg = exportPageSvg(drawings[0], purpose);
      expect(svg).toContain('width="210mm"');
      expect(svg).toContain('height="297mm"');
      expect(svg).toContain('viewBox="0 0 210 297"');
      expect(svg.match(/<svg/g)).toHaveLength(1);
      expect(svg).not.toMatch(/<use|<image|<canvas|opacity|data:image|<text/);
      expect(svg).toContain('id="cut"');
      expect(svg).toContain('id="numbers"');
    });
  }

  it('cricut: three solid colour layers (cut black, score red, draw blue)', () => {
    const svg = exportPageSvg(drawings[0], 'cricut');
    expect(svg).toContain('id="score"');
    expect(svg).toContain('stroke="#ff0000"');
    expect(svg).toContain('stroke="#0000ff"');
    expect(svg).not.toContain('stroke-dasharray');
  });

  it('print: dashed folds, mountain and valley drawn differently', () => {
    const svg = exportPageSvg(drawings[0], 'print');
    expect(svg).toContain('id="fold-mountain"');
    expect(svg).toContain('stroke-dasharray="3 1 0.6 1"');
    expect(svg).toContain('stroke-dasharray="1.6 1.2"');
  });

  it('flips y so the picture is not mirrored: the cut outline of a part has the same handedness as on the page', () => {
    const svg = exportPageSvg(drawings[0], 'cricut');
    // The drawing's lowest cut point (y up) is near the bottom margin, which is a large y in SVG.
    const ys = [...svg.matchAll(/ (\d+(?:\.\d+)?)(?= L| Z|")/g)].map((m) => Number(m[1]));
    expect(Math.max(...ys)).toBeLessThanOrEqual(297);
    expect(Math.max(...ys)).toBeGreaterThan(150);
  });

  it('gives the same text every time', () => {
    const again = createPapercraft({ mesh: shapes.cube(40), page: A4 });
    expect(exportPageSvg(renderPages(again.layout.pages, again.pattern.parts)[0], 'cricut')).toBe(exportPageSvg(drawings[0], 'cricut'));
  });

  it('page numbers are drawn only when asked', () => {
    const plain = renderPages(run.layout.pages, run.pattern.parts)[0].text.length;
    const numbered = renderPages(run.layout.pages, run.pattern.parts, { pageNumbers: true })[0].text.length;
    expect(numbered).toBeGreaterThan(plain);
  });
});

describe('PDF export', () => {
  const run = createPapercraft({ mesh: shapes.icosahedron(60), page: A4 });
  const drawings = renderPages(run.layout.pages, run.pattern.parts, { pageNumbers: true });
  const bytes = exportPdf(drawings);
  const text = new TextDecoder('latin1').decode(bytes);

  it('is a PDF with one page per sheet at the right size', () => {
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain(`/Count ${drawings.length}`);
    expect((text.match(/\/Type \/Page /g) ?? []).length).toBe(drawings.length);
    expect(text).toContain('/MediaBox [0 0 595.276 841.89]');
  });

  it('has a correct cross-reference table', () => {
    const startxref = Number(text.match(/startxref\n(\d+)\n%%EOF/)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const count = Number(text.match(/xref\n0 (\d+)\n/)![1]);
    const entries = text.slice(startxref).split('\n').filter((l) => /^\d{10} \d{5} n $/.test(l));
    expect(entries).toHaveLength(count - 1);
    entries.forEach((line, i) => {
      const off = Number(line.slice(0, 10));
      expect(text.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
  });

  it('declares the right stream length', () => {
    for (const m of text.matchAll(/\/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)) {
      expect(m[2].length).toBe(Number(m[1]));
    }
  });

  it('is vector only: no fonts, no images, no dates', () => {
    expect(text).not.toMatch(/\/Font|\/Image|\/XObject|CreationDate|\/Filter/);
    expect(text).toContain(' m\n');
    expect(text).toContain(' l\n');
  });

  it('gives the same bytes every time', () => {
    const again = createPapercraft({ mesh: shapes.icosahedron(60), page: A4 });
    expect(Array.from(exportPdf(renderPages(again.layout.pages, again.pattern.parts, { pageNumbers: true })))).toEqual(Array.from(bytes));
  });
});

describe('end to end', () => {
  it('scales a model and produces pages', () => {
    const run = createPapercraft({ mesh: shapes.icosahedron(1), scale: { by: 'height', mm: 90 }, page: A4 });
    const zs = run.solid.vertices.map((v) => v[2]);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(90, 6);
    expect(run.layout.pages.length).toBeGreaterThan(0);
    expect(run.pattern.stats.faceCount).toBe(20);
  });
});
