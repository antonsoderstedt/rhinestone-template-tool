import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  PdfReadError,
  createPapercraft,
  defaultRoles,
  exportPageDxf,
  exportPageSvg,
  exportPdf,
  lineStyles,
  patternDrawing,
  readPdf,
  renderPages,
  shapes,
} from '../src/lib/papercraft-engine';
import type { PdfPage } from '../src/lib/papercraft-engine';

type Part = string | null | { dict: string; data: Buffer | string };

/** A small PDF from objects numbered 1, 2, 3 ...: the first is the catalog. A stream object is `{ dict, data }`. */
function makePdf(parts: Part[], header = '%PDF-1.5'): Uint8Array {
  const chunks: Buffer[] = [Buffer.from(header + '\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  parts.forEach((p, i) => {
    // A null leaves the number unused (the object is packed inside an object stream).
    if (p === null) return;
    if (typeof p === 'string') chunks.push(Buffer.from(`${i + 1} 0 obj\n${p}\nendobj\n`, 'latin1'));
    else {
      const data = typeof p.data === 'string' ? Buffer.from(p.data, 'latin1') : p.data;
      chunks.push(Buffer.from(`${i + 1} 0 obj\n<< ${p.dict} /Length ${data.length} >>\nstream\n`, 'latin1'), data, Buffer.from('\nendstream\nendobj\n', 'latin1'));
    }
  });
  chunks.push(Buffer.from(`trailer\n<< /Root 1 0 R /Size ${parts.length + 1} >>\n%%EOF\n`, 'latin1'));
  return new Uint8Array(Buffer.concat(chunks));
}

/** One page with this content stream (and extra objects from number 5 on). */
function onePage(content: string, opts: { page?: string; resources?: string; extra?: Part[]; compress?: boolean } = {}): Uint8Array {
  const stream: Part = opts.compress ? { dict: '/Filter /FlateDecode', data: deflateSync(Buffer.from(content, 'latin1')) } : { dict: '', data: content };
  return makePdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 /MediaBox [0 0 200 300] >>',
    `<< /Type /Page /Parent 2 0 R /Contents 4 0 R ${opts.resources ? `/Resources ${opts.resources}` : ''} ${opts.page ?? ''} >>`,
    stream,
    ...(opts.extra ?? []),
  ]);
}

const first = async (bytes: Uint8Array): Promise<PdfPage> => (await readPdf(bytes)).pages[0];
const near = (a: readonly number[], b: readonly number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));

describe('reading the lines of a PDF', () => {
  it('reads lines, rectangles and the page size, with the origin at the lower left and y up', async () => {
    const page = await first(onePage('1 0 0 RG 2 w 10 20 m 110 20 l 110 70 l S 30 40 50 60 re S'));
    expect(page).toMatchObject({ number: 1, widthPt: 200, heightPt: 300 });
    expect(page.strokes).toHaveLength(2);
    expect(page.strokes[0]).toMatchObject({ closed: false, rgb: [1, 0, 0], width: 2, dash: [] });
    expect(page.strokes[0].points).toEqual([[10, 20], [110, 20], [110, 70]]);
    expect(page.strokes[1].closed).toBe(true);
    expect(page.strokes[1].points).toEqual([[30, 40], [80, 40], [80, 100], [30, 100]]);
  });

  it('closes a path with h and with s, and treats b as a closed stroke; fills and n paint no lines', async () => {
    const page = await first(onePage('0 0 m 10 0 l 10 10 l h S 0 0 m 5 0 l 5 5 l s 20 0 m 30 0 l 30 10 l b 0 0 5 5 re f 0 0 5 5 re n 1 1 m 9 9 l f'));
    expect(page.strokes.map((s) => s.closed)).toEqual([true, true, true]);
  });

  it('follows cm, q and Q: a scaled and moved drawing, and a state that is put back', async () => {
    const page = await first(onePage('q 2 0 0 2 10 10 cm 0 0 m 5 0 l S Q 0 0 m 5 0 l S'));
    expect(page.strokes[0].points).toEqual([[10, 10], [20, 10]]);
    expect(page.strokes[0].width).toBeCloseTo(2, 9);
    expect(page.strokes[1].points).toEqual([[0, 0], [5, 0]]);
  });

  it('flattens curves (c, v, y) and ends them at the end point', async () => {
    const page = await first(onePage('0 0 m 0 10 10 10 10 0 c S 0 0 m 5 5 10 0 v S 0 0 m 5 5 10 0 y S'));
    expect(page.strokes).toHaveLength(3);
    for (const s of page.strokes) {
      expect(s.points.length).toBeGreaterThan(5);
      near(s.points[s.points.length - 1], [10, 0]);
    }
    // The first curve bulges up to 7.5 at its middle.
    expect(Math.max(...page.strokes[0].points.map((p) => p[1]))).toBeCloseTo(7.5, 0);
  });

  it('reads the dash pattern, from d and from an ExtGState, and a pattern of zeros is a solid line', async () => {
    const page = await first(
      onePage('[3 1] 0 d 0 0 m 9 0 l S [0 0] 0 d 0 0 m 9 1 l S /G1 gs 0 0 m 9 2 l S', { resources: '<< /ExtGState << /G1 << /LW 4 /D [[5 2] 0] >> >> >>' }),
    );
    expect(page.strokes.map((s) => s.dash)).toEqual([[3, 1], [], [5, 2]]);
    expect(page.strokes[2].width).toBe(4);
  });

  it('reads colours: RG, G, K and SCN with three, one and four numbers', async () => {
    const page = await first(onePage('0 1 0 RG 0 0 m 1 0 l S 0.5 G 0 0 m 1 0 l S 0 0 0 1 K 0 0 m 1 0 l S 0 0 1 SCN 0 0 m 1 0 l S 0 1 1 0 SCN 0 0 m 1 0 l S'));
    expect(page.strokes.map((s) => s.rgb)).toEqual([[0, 1, 0], [0.5, 0.5, 0.5], [0, 0, 0], [0, 0, 1], [1, 0, 0]]);
  });

  it('is not thrown by text, strings with brackets, comments, arrays and inline images between the lines', async () => {
    const content = [
      '% a comment (with a bracket',
      'BT /F1 12 Tf (a (nested) string \\) with a bracket) Tj [(x) -10 (y)] TJ ET',
      '0 0 m 10 0 l S',
      'q 4 0 0 4 0 0 cm BI /W 2 /H 2 /BPC 8 /CS /G ID \x00\x01\x02 EI Q',
      '<< /Type /Marked >> /OC BDC 0 5 m 10 5 l S EMC',
      '<414243> Tj 0 9 m 10 9 l S',
    ].join('\n');
    const page = await first(onePage(content));
    expect(page.strokes.map((s) => s.points[0][1])).toEqual([0, 5, 9]);
  });

  it('puts the content of several streams together, and reads Flate, ASCIIHex and ASCII85 streams', async () => {
    const hex = Buffer.from('0 0 m 7 0 l S', 'latin1').toString('hex') + '>';
    const bytes = makePdf([
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 /MediaBox [0 0 100 100] >>',
      '<< /Type /Page /Parent 2 0 R /Contents [4 0 R 5 0 R 6 0 R] >>',
      { dict: '/Filter /FlateDecode', data: deflateSync(Buffer.from('0 0 m 1 0 l S', 'latin1')) },
      { dict: '/Filter /ASCIIHexDecode', data: hex },
      // "0 0 m 3 0 l S" in ASCII85.
      { dict: '/Filter /ASCII85Decode', data: ascii85('0 0 m 3 0 l S') },
    ]);
    const page = await first(bytes);
    expect(page.strokes.map((s) => s.points[1][0])).toEqual([1, 7, 3]);
  });

  it('reads form XObjects with their own matrix and resources, and does not follow a form that calls itself for ever', async () => {
    const form: Part = { dict: '/Type /XObject /Subtype /Form /BBox [0 0 10 10] /Matrix [2 0 0 2 100 100] /Resources << >>', data: '1 0 0 RG 0 0 m 5 0 l S /Self Do' };
    const page = await first(onePage('/Fm1 Do', { resources: '<< /XObject << /Fm1 5 0 R >> >>', extra: [form] }));
    expect(page.strokes.length).toBeGreaterThanOrEqual(1);
    expect(page.strokes[0].points).toEqual([[100, 100], [110, 100]]);
    expect(page.strokes[0].rgb).toEqual([1, 0, 0]);
    // A form that draws itself: stops at a depth, and gives up with a normal result.
    const loop: Part = { dict: '/Type /XObject /Subtype /Form /BBox [0 0 1 1] /Resources << /XObject << /Fm1 5 0 R >> >>', data: '0 0 m 1 0 l S /Fm1 Do' };
    const looped = await first(onePage('/Fm1 Do', { resources: '<< /XObject << /Fm1 5 0 R >> >>', extra: [loop] }));
    expect(looped.strokes.length).toBe(8);
  });

  it('applies the rotation of a page and a MediaBox that does not start at 0', async () => {
    const rotated = await first(onePage('10 20 m 30 20 l S', { page: '/Rotate 90' }));
    // A page of 200 x 300 turned a quarter turn is 300 x 200.
    expect(rotated).toMatchObject({ widthPt: 300, heightPt: 200 });
    for (const [x, y] of rotated.strokes[0].points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(300);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(200);
    }
    const lowered = await first(onePage('100 100 m 150 100 l S', { page: '/MediaBox [50 50 250 350]' }));
    expect(lowered.strokes[0].points).toEqual([[50, 50], [100, 50]]);
    expect(lowered).toMatchObject({ widthPt: 200, heightPt: 300 });
  });

  it('reads a document with object streams (the page tree packed inside one) and several pages, in order', async () => {
    const packed = '<< /Type /Catalog /Pages 2 0 R >>\n<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 /MediaBox [0 0 50 60] >>\n<< /Type /Page /Parent 2 0 R /Contents 7 0 R >>\n<< /Type /Page /Parent 2 0 R /Contents 8 0 R >>';
    const offsets: number[] = [];
    let at = 0;
    for (const o of packed.split('\n')) {
      offsets.push(at);
      at += o.length + 1;
    }
    const head = offsets.map((o, i) => `${i + 1} ${o}`).join(' ') + ' ';
    const objstm = Buffer.from(head + packed, 'latin1');
    const bytes = makePdf([
      // 1 to 4 live inside object 5.
      null, null, null, null,
      { dict: `/Type /ObjStm /N 4 /First ${head.length} /Filter /FlateDecode`, data: deflateSync(objstm) },
      '<< >>',
      { dict: '', data: '0 0 m 1 1 l S' },
      { dict: '', data: '0 0 m 2 2 l S 0 0 m 3 3 l S' },
    ]);
    const doc = await readPdf(bytes);
    expect(doc.pages.map((p) => p.strokes.length)).toEqual([1, 2]);
    expect(doc.pages[0]).toMatchObject({ widthPt: 50, heightPt: 60 });
  });

  it('inherits the resources and finds pages in a nested page tree', async () => {
    const bytes = makePdf([
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 /MediaBox [0 0 80 80] /Resources << /ExtGState << /G1 << /LW 7 >> >> >> >>',
      '<< /Type /Pages /Parent 2 0 R /Kids [4 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 3 0 R /Contents 5 0 R >>',
      { dict: '', data: '/G1 gs 0 0 m 5 5 l S' },
    ]);
    const page = await first(bytes);
    expect(page.strokes[0].width).toBe(7);
    expect(page.widthPt).toBe(80);
  });

  it('refuses what it cannot read: not a PDF, encrypted, no pages, too big; skips streams with filters it does not know', async () => {
    const code = async (bytes: Uint8Array) => {
      try {
        await readPdf(bytes);
        return 'ok';
      } catch (e) {
        return e instanceof PdfReadError ? e.code : 'other';
      }
    };
    expect(await code(new TextEncoder().encode('hello'))).toBe('not-a-pdf');
    expect(await code(makePdf(['<< /Type /Catalog >>']))).toBe('no-pages');
    const encrypted = makePdf(['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [] /Count 0 >>']);
    expect(await code(new Uint8Array([...encrypted, ...new TextEncoder().encode('\n/Encrypt 9 0 R\n')]))).toBe('encrypted');
    const lzw = await readPdf(makePdf(['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 /MediaBox [0 0 9 9] >>', '<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>', { dict: '/Filter /LZWDecode', data: 'xx' }]));
    expect(lzw.pages[0].strokes).toEqual([]);
    expect(lzw.warnings.length).toBe(1);
  });

  it('reads the PDF the studio makes itself: the same cut lines, and the folds as dashed lines', async () => {
    const run = createPapercraft({ mesh: shapes.cube(60) });
    const drawing = renderPages(run.layout.pages, run.pattern.parts)[0];
    const doc = await readPdf(exportPdf([drawing]));
    expect(doc.pages).toHaveLength(1);
    const page = doc.pages[0];
    expect(page.widthPt * (25.4 / 72)).toBeCloseTo(drawing.widthMm, 1);
    expect(page.heightPt * (25.4 / 72)).toBeCloseTo(drawing.heightMm, 1);
    const styles = lineStyles(page);
    const dashed = styles.filter((s) => s.dashed).reduce((n, s) => n + s.count, 0);
    expect(dashed).toBe(drawing.folds.filter((f) => f.kind !== 'flat').length);
    // The cut outlines come back as closed lines of the same length.
    const roles = defaultRoles(styles);
    const back = patternDrawing(page, roles, {});
    const length = (cut: { points: readonly (readonly number[])[]; closed: boolean }[]) =>
      cut.reduce((sum, c) => sum + c.points.reduce((s, p, i) => s + (i === 0 && !c.closed ? 0 : Math.hypot(p[0] - c.points[(i + c.points.length - 1) % c.points.length][0], p[1] - c.points[(i + c.points.length - 1) % c.points.length][1])), 0), 0);
    const outlineLength = length(drawing.cut);
    expect(back.cut.filter((c) => c.closed).length).toBeGreaterThanOrEqual(drawing.cut.length);
    expect(length(back.cut.filter((c) => c.closed))).toBeGreaterThanOrEqual(outlineLength - 0.5);
    expect(back.folds.length).toBeGreaterThanOrEqual(drawing.folds.filter((f) => f.kind !== 'flat').length);
  });
});

describe('from lines to a cutting drawing', () => {
  const stroke = (points: [number, number][], rgb: [number, number, number], dash: number[] = [], closed = false) => ({ points, rgb, dash, closed, width: 1 });
  const page: PdfPage = {
    number: 1,
    widthPt: 600,
    heightPt: 800,
    strokes: [
      stroke([[100, 100], [300, 100], [300, 300], [100, 300]], [0, 0, 0], [], true),
      stroke([[100, 200], [300, 200]], [0, 0, 0], [4, 2]),
      stroke([[100, 150], [300, 150]], [1, 0, 0]),
      stroke([[0, 0], [600, 0], [600, 800], [0, 800]], [0, 0, 0], [], true),
      stroke([[150, 150], [150.5, 150]], [0, 0, 0]),
      stroke([[120, 120], [130, 120]], [1, 1, 1]),
    ],
  };

  it('groups lines by colour and by solid or dashed, the longest group first, and leaves the frame of the page out', () => {
    const styles = lineStyles(page);
    // The dashed and the red line are as long as each other: the tie goes by name.
    expect(styles.map((s) => s.id)).toEqual(['#000000/solid', '#000000/dash', '#ff0000/solid', '#ffffff/solid']);
    expect(styles[0].count).toBe(2);
    expect(styles[0].lengthMm).toBeCloseTo(((800 + 0.5) * 25.4) / 72, 3);
    expect(styles[1].dashed).toBe(true);
  });

  it('guesses roles: dashed is score, solid is cut, white is left out', () => {
    expect(defaultRoles(lineStyles(page))).toEqual({ '#000000/solid': 'cut', '#ff0000/solid': 'cut', '#000000/dash': 'score', '#ffffff/solid': 'ignore' });
  });

  it('makes cut outlines and score lines in millimetres, leaves out the frame, specks and lines with no role', () => {
    const drawing = patternDrawing(page, { '#000000/solid': 'cut', '#000000/dash': 'score', '#ff0000/solid': 'ignore', '#ffffff/solid': 'ignore' });
    expect(drawing.cut).toHaveLength(1);
    expect(drawing.cut[0].closed).toBe(true);
    near(drawing.cut[0].points[1], [(300 * 25.4) / 72, (100 * 25.4) / 72]);
    expect(drawing.folds).toHaveLength(1);
    expect(drawing.folds[0].kind).not.toBe('flat');
    expect(drawing.widthMm).toBeCloseTo((600 * 25.4) / 72, 6);
  });

  it('scales, and can make the sheet as big as the pattern with a margin', () => {
    const roles = defaultRoles(lineStyles(page));
    const big = patternDrawing(page, roles, { scalePct: 200 });
    expect(big.widthMm).toBeCloseTo((1200 * 25.4) / 72, 6);
    const cropped = patternDrawing(page, roles, { crop: true, marginMm: 5 });
    const w = ((300 - 100) * 25.4) / 72;
    expect(cropped.widthMm).toBeCloseTo(w + 10, 6);
    const xs = cropped.cut.flatMap((c) => c.points.map((p) => p[0]));
    expect(Math.min(...xs)).toBeCloseTo(5, 6);
  });

  it('a line that comes back to its start is closed, and a polyline drawn as a score gives one line per piece', () => {
    const p: PdfPage = { number: 1, widthPt: 100, heightPt: 100, strokes: [stroke([[10, 10], [50, 10], [50, 50], [10, 10]], [0, 0, 0]), stroke([[10, 60], [40, 60], [40, 90]], [0, 0, 1], [2, 2])] };
    const d = patternDrawing(p, { '#000000/solid': 'cut', '#0000ff/dash': 'score' });
    expect(d.cut[0].closed).toBe(true);
    expect(d.cut[0].points).toHaveLength(3);
    expect(d.folds).toHaveLength(2);
  });

  it('feeds the Cricut SVG and the Silhouette DXF, as any pattern', () => {
    const drawing = patternDrawing(page, defaultRoles(lineStyles(page)), { crop: true });
    expect(exportPageSvg(drawing, 'cricut')).toContain('id="score"');
    expect(exportPageDxf(drawing)).toContain('SCORE');
  });
});

/** ASCII85 of a short text, for the test above. */
function ascii85(text: string): string {
  const bytes = Buffer.from(text, 'latin1');
  let out = '';
  for (let i = 0; i < bytes.length; i += 4) {
    const chunk = bytes.subarray(i, i + 4);
    const n = chunk.length;
    let v = 0;
    for (let k = 0; k < 4; k++) v = v * 256 + (k < n ? chunk[k] : 0);
    const digits: string[] = [];
    for (let k = 0; k < 5; k++) {
      digits.unshift(String.fromCharCode((v % 85) + 33));
      v = Math.floor(v / 85);
    }
    out += digits.slice(0, n + 1).join('');
  }
  return out + '~>';
}
