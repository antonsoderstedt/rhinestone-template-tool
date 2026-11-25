import { describe, expect, it } from 'vitest';
import {
  assessBuild,
  createPapercraft,
  exportPdf,
  partRgb,
  projectModel,
  renderCover,
  renderPages,
  shapes,
  textWidthMm,
  toWinAnsi,
  wrapText,
  type CoverContent,
  type PageDrawing,
  type RawMesh,
} from '../src/lib/papercraft-engine';

const content: CoverContent = {
  title: 'Test cube',
  subtitle: 'A paper model to print, cut and fold',
  facts: [
    { label: 'Size', value: '40.0 × 40.0 × 40.0 mm (1.6 × 1.6 × 1.6 in)' },
    { label: 'Parts', value: '1' },
    { label: 'Glue edges', value: '7' },
    { label: 'Paper', value: 'A4 sheet, 160-250 g/m² cardstock' },
    { label: 'Difficulty', value: 'Easy' },
    { label: 'Time', value: 'about 25 minutes' },
  ],
  legendTitle: 'How to read the pattern',
  legend: [
    { kind: 'cut', label: 'Cut along this line' },
    { kind: 'mountain', label: 'Mountain fold: the crease points up toward you' },
    { kind: 'valley', label: 'Valley fold: the crease points down, away from you' },
    { kind: 'tab', label: 'Fold the glue tab' },
    { kind: 'number', label: 'Glue the tab with a number to the edge with the same number' },
  ],
  pageMapTitle: 'What is on each page',
  pageMapMore: (n) => `+${n} more pages`,
  stepsTitle: 'How to build it',
  steps: [
    'Print the pages at 100 % scale (not "fit to page").',
    'Cut out every part along the solid lines. Do not cut the dashed lines.',
    'Crease along the dashed lines with a ruler and a blunt tool, then fold every crease the way it is marked.',
    'Start with part 1. Put glue on a tab and press it to the edge with the same number.',
    'Continue in number order, and close the last edges last. Let it dry before you handle it.',
  ],
  footer: 'Made with Rhinestone OS · Papercraft Studio',
};

function runOf(mesh: RawMesh, page = { pageWidthMm: 210, pageHeightMm: 297, marginMm: 10, gapMm: 3 }, many = false) {
  return createPapercraft({ mesh, page, pattern: many ? { forceCutEdges: Array.from({ length: 200 }, (_, i) => i) } : {} });
}

function allPoints(d: PageDrawing): [number, number][] {
  return [
    ...d.cut.flatMap((c) => c.points),
    ...d.folds.flatMap((f) => [f.a, f.b]),
    ...d.text.flat(),
    ...d.fills.flatMap((f) => f.points),
  ].map((p) => [p[0], p[1]]);
}

describe('Helvetica text', () => {
  it('measures with the standard widths', () => {
    expect(textWidthMm('Hello', 10)).toBeCloseTo(22.78, 6);
    expect(textWidthMm('Hello', 10, true)).toBeGreaterThan(textWidthMm('Hello', 10));
    expect(textWidthMm('å', 10)).toBeCloseTo(textWidthMm('a', 10), 6);
    expect(textWidthMm('', 10)).toBe(0);
  });

  it('wraps at word boundaries and never makes a line wider than asked (unless one word is)', () => {
    const lines = wrapText('The quick brown fox jumps over the lazy dog and keeps running', 40, 3.6);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(textWidthMm(l, 3.6)).toBeLessThanOrEqual(40);
    expect(lines.join(' ')).toBe('The quick brown fox jumps over the lazy dog and keeps running');
    expect(wrapText('Supercalifragilisticexpialidocious', 10, 3.6)).toEqual(['Supercalifragilisticexpialidocious']);
    expect(wrapText('   ', 40, 3.6)).toEqual([]);
  });

  it('encodes Swedish letters as WinAnsi and replaces what it cannot show', () => {
    expect(toWinAnsi('åäö ÅÄÖ')).toEqual([229, 228, 246, 32, 197, 196, 214]);
    expect(toWinAnsi('a–b')).toEqual([97, 0x2d, 98]);
    expect(toWinAnsi('x≈y')).toEqual([120, 0x3f, 121]);
    expect(toWinAnsi('²×°')).toEqual([178, 215, 176]);
  });
});

describe('colours', () => {
  it('gives each part its own colour between 0 and 1', () => {
    const colours = [1, 2, 3, 4, 5].map((id) => partRgb(id).map((v) => v.toFixed(3)).join());
    expect(new Set(colours).size).toBe(5);
    for (const id of [1, 7, 30]) for (const c of partRgb(id, 80)) expect(c >= 0 && c <= 1).toBe(true);
  });
});

describe('build assessment', () => {
  it('a cube is easy and quick', () => {
    const r = runOf(shapes.cube(50));
    const a = assessBuild(r.pattern, r.solid);
    expect(a.difficulty).toBe('easy');
    // 10 + 1 part + 0.4 * 5 folds + 1.5 * 7 glued edges = 23.5, to the nearest 5
    expect(a.minutes).toBe(25);
  });

  it('more glued edges means harder and longer', () => {
    const small = runOf(shapes.icosahedron(60));
    const ball = runOf(shapes.lathe([[0, -20], [10, -17], [17, -9], [20, 0], [17, 9], [10, 17], [0, 20]], 12).faces ? shapes.lathe([[0, -40], [20, -34], [34, -18], [40, 0], [34, 18], [20, 34], [0, 40]], 16) : shapes.cube(1));
    const a = assessBuild(small.pattern, small.solid);
    const b = assessBuild(ball.pattern, ball.solid);
    expect(ball.pattern.edgePairCount).toBeGreaterThan(small.pattern.edgePairCount);
    expect(['easy', 'medium', 'hard', 'expert'].indexOf(b.difficulty)).toBeGreaterThan(['easy', 'medium', 'hard', 'expert'].indexOf(a.difficulty));
    expect(b.minutes).toBeGreaterThan(a.minutes);
  });

  it('very small edges make it one step harder', () => {
    const big = runOf(shapes.cube(60));
    const tiny = runOf(shapes.cube(12));
    expect(assessBuild(big.pattern, big.solid).difficulty).toBe('easy');
    expect(assessBuild(tiny.pattern, tiny.solid).difficulty).toBe('medium');
  });

  it('is never under 5 minutes and always a multiple of 5', () => {
    for (const mesh of [shapes.cube(30), shapes.dodecahedron(40), shapes.gem(30)]) {
      const r = runOf(mesh);
      const a = assessBuild(r.pattern, r.solid);
      expect(a.minutes).toBeGreaterThanOrEqual(5);
      expect(a.minutes % 5).toBe(0);
    }
  });
});

describe('picture of the model', () => {
  it('shows only the faces that face the viewer, back to front', () => {
    const cube = runOf(shapes.cube(50));
    expect(projectModel(cube.solid, cube.pattern)).toHaveLength(3);
    const octa = runOf(shapes.octahedron(50));
    expect(projectModel(octa.solid, octa.pattern)).toHaveLength(4);
  });

  it('is deterministic and uses colours between 0 and 1', () => {
    const r = runOf(shapes.icosahedron(40));
    const a = projectModel(r.solid, r.pattern);
    expect(JSON.stringify(projectModel(r.solid, r.pattern))).toBe(JSON.stringify(a));
    for (const poly of a) for (const c of poly.rgb) expect(c >= 0 && c <= 1).toBe(true);
  });
});

describe('cover page', () => {
  const sizes = { a4: { widthMm: 210, heightMm: 297 }, letter: { widthMm: 215.9, heightMm: 279.4 } };
  const MODELS: [string, RawMesh, boolean][] = [
    ['cube', shapes.cube(50), false],
    ['icosahedron', shapes.icosahedron(40), false],
    ['icosahedron in 20 parts', shapes.icosahedron(40), true],
    ['gem', shapes.gem(30), false],
  ];

  it.each(MODELS.flatMap(([name, mesh, many]) => (['a4', 'letter'] as const).map((s) => [name, mesh, many, s] as const)))(
    '%s on %s: everything is inside the page and the text inside the margins',
    (_name, mesh, many, sizeName) => {
      const r = runOf(mesh, undefined, many);
      const size = sizes[sizeName];
      const d = renderCover(content, r.solid, r.pattern, r.layout, size);
      expect(d.widthMm).toBe(size.widthMm);
      for (const [x, y] of allPoints(d)) {
        expect(x).toBeGreaterThanOrEqual(-1e-6);
        expect(y).toBeGreaterThanOrEqual(-1e-6);
        expect(x).toBeLessThanOrEqual(size.widthMm + 1e-6);
        expect(y).toBeLessThanOrEqual(size.heightMm + 1e-6);
      }
      for (const t of d.texts) {
        const w = textWidthMm(t.text, t.sizeMm, t.bold);
        const left = t.align === 'middle' ? t.x - w / 2 : t.x;
        expect(left).toBeGreaterThanOrEqual(14.9);
        expect(left + w).toBeLessThanOrEqual(size.widthMm - 14.9);
        expect(t.y).toBeGreaterThan(10);
        expect(t.y).toBeLessThan(size.heightMm - 10);
      }
    },
  );

  it('says every fact, the legend and the steps', () => {
    const r = runOf(shapes.cube(50));
    const d = renderCover(content, r.solid, r.pattern, r.layout, sizes.a4);
    const said = d.texts.map((t) => t.text).join(' ');
    expect(said).toContain('Test cube');
    for (const f of content.facts) expect(said).toContain(f.label);
    expect(said).toContain('1.');
    expect(said).toContain('5.');
    expect(said).toContain(content.stepsTitle);
    expect(said).toContain('Made with');
    // The legend draws the real line styles.
    expect(d.folds.map((f) => f.kind).sort()).toEqual(['mountain', 'tab', 'valley']);
    expect(d.cut).toHaveLength(1);
  });

  it('puts one thumbnail on the map for each page, with the part numbers, and says how many do not fit', () => {
    const few = runOf(shapes.cube(50));
    const d1 = renderCover(content, few.solid, few.pattern, few.layout, sizes.a4);
    const thumbs = (d: PageDrawing) => d.fills.filter((f) => f.rgb[0] === 1 && f.rgb[1] === 1 && f.rgb[2] === 1);
    expect(thumbs(d1)).toHaveLength(few.layout.pages.length);
    const lots = runOf(shapes.lathe([[0, -200], [100, -170], [170, -90], [200, 0], [170, 90], [100, 170], [0, 200]], 16), { pageWidthMm: 210, pageHeightMm: 297, marginMm: 10, gapMm: 3 }, true);
    expect(lots.layout.pages.length).toBeGreaterThan(8);
    const d2 = renderCover(content, lots.solid, lots.pattern, lots.layout, sizes.a4);
    const shown = thumbs(d2).length;
    expect(shown).toBeLessThanOrEqual(lots.layout.pages.length);
    if (shown < lots.layout.pages.length) expect(d2.texts.some((t) => t.text === `+${lots.layout.pages.length - shown} more pages`)).toBe(true);
  });

  it('shrinks a long title and a long list of steps to fit', () => {
    const r = runOf(shapes.cube(50));
    const long: CoverContent = {
      ...content,
      title: 'A very long project name that goes on and on and on and on and on and on and on and on',
      steps: Array.from({ length: 12 }, (_, i) => `Step number ${i + 1} is a long sentence that needs to be wrapped over several lines so that the page is nearly full of text.`),
    };
    const d = renderCover(long, r.solid, r.pattern, r.layout, sizes.a4);
    for (const t of d.texts) expect(textWidthMm(t.text, t.sizeMm, t.bold)).toBeLessThanOrEqual(180.1);
    expect(Math.min(...d.texts.map((t) => t.y))).toBeGreaterThan(5);
  });

  it('is deterministic', () => {
    const r = runOf(shapes.dodecahedron(40));
    const a = JSON.stringify(renderCover(content, r.solid, r.pattern, r.layout, sizes.a4));
    const b = JSON.stringify(renderCover(content, r.solid, r.pattern, r.layout, sizes.a4));
    expect(a).toBe(b);
  });
});

describe('PDF with a cover page', () => {
  const r = runOf(shapes.icosahedron(60));
  const cover = renderCover({ ...content, title: 'Räv & Å (test)' }, r.solid, r.pattern, r.layout, { widthMm: 210, heightMm: 297 });
  const pages = renderPages(r.layout.pages, r.pattern.parts, { pageNumbers: true });
  const bytes = exportPdf([cover, ...pages]);
  const text = new TextDecoder('latin1').decode(bytes);

  it('has the cover first, then the pages, and two built-in fonts', () => {
    expect(text).toContain(`/Count ${pages.length + 1}`);
    expect((text.match(/\/Type \/Page /g) ?? []).length).toBe(pages.length + 1);
    expect(text).toContain('/BaseFont /Helvetica /Encoding /WinAnsiEncoding');
    expect(text).toContain('/BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding');
    expect(text).not.toMatch(/FontFile|\/Image|\/XObject|CreationDate/);
    // Only the cover refers to fonts.
    expect((text.match(/\/Resources << \/Font/g) ?? []).length).toBe(1);
  });

  it('writes Swedish letters as octal escapes and escapes brackets', () => {
    expect(text).toContain('(R\\344v & \\305 \\(test\\)) Tj');
  });

  it('has a correct cross-reference table and stream lengths', () => {
    const startxref = Number(text.match(/startxref\n(\d+)\n%%EOF/)![1]);
    const count = Number(text.match(/xref\n0 (\d+)\n/)![1]);
    const entries = text.slice(startxref).split('\n').filter((l) => /^\d{10} \d{5} n $/.test(l));
    expect(entries).toHaveLength(count - 1);
    entries.forEach((line, i) => {
      const off = Number(line.slice(0, 10));
      expect(text.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
    for (const m of text.matchAll(/\/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g)) expect(m[2].length).toBe(Number(m[1]));
  });

  it('draws filled shapes with fill and stroke operators', () => {
    expect(text).toMatch(/ rg\n[\d. -]+ RG\n[\d. -]+ w \[\] 0 d\n[\d. -]+ m\n/);
    expect(text).toContain('\nh B\n');
  });

  it('gives the same bytes every time, and a PDF without a cover is as before (no fonts)', () => {
    const again = renderCover({ ...content, title: 'Räv & Å (test)' }, r.solid, r.pattern, r.layout, { widthMm: 210, heightMm: 297 });
    expect(Array.from(exportPdf([again, ...pages]))).toEqual(Array.from(bytes));
    expect(new TextDecoder('latin1').decode(exportPdf(pages))).not.toContain('/Font');
  });
});
