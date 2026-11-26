import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { defaultRoles, lineStyles, patternDrawing, readPdf, traceLineArt } from '../src/lib/papercraft-engine';
import type { PixelImage } from '../src/lib/papercraft-engine';

/** A white picture to draw on. */
class Canvas {
  readonly rgb: Uint8Array;
  constructor(readonly width: number, readonly height: number) {
    this.rgb = new Uint8Array(width * height * 3).fill(255);
  }
  dot(x: number, y: number, c: [number, number, number]) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const o = (Math.round(y) * this.width + Math.round(x)) * 3;
    [this.rgb[o], this.rgb[o + 1], this.rgb[o + 2]] = c;
  }
  line(x0: number, y0: number, x1: number, y1: number, thick = 2, c: [number, number, number] = [0, 0, 0]) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      for (let a = 0; a < thick; a++) for (let b = 0; b < thick; b++) this.dot(x + a, y + b, c);
    }
  }
  dashed(x0: number, y0: number, x1: number, y1: number, dash: number, gap: number, thick = 1, c: [number, number, number] = [0, 0, 0], dots = false) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const ux = (x1 - x0) / len;
    const uy = (y1 - y0) / len;
    for (let s = 0; s < len; s += dash + gap) {
      const e = Math.min(len, s + dash);
      this.line(x0 + ux * s, y0 + uy * s, x0 + ux * e, y0 + uy * e, thick, c);
      if (dots && s + dash + gap / 2 < len) this.line(x0 + ux * (s + dash + gap / 2), y0 + uy * (s + dash + gap / 2), x0 + ux * (s + dash + gap / 2), y0 + uy * (s + dash + gap / 2), 2, c);
    }
  }
  /** A ring of ink, like a "0" or an "o": a letter, not a line. */
  ring(cx: number, cy: number, r: number) {
    for (let a = 0; a < 6.3; a += 0.05) this.dot(cx + r * Math.cos(a), cy + 1.3 * r * Math.sin(a), [0, 0, 0]);
  }
  photo(x: number, y: number, w: number, h: number) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.dot(x + i, y + j, [200 + ((i * 7 + j * 3) % 40), 120 + ((i + j) % 60), 60]);
  }
  get image(): PixelImage {
    return { width: this.width, height: this.height, rgb: this.rgb };
  }
}

const near = (p: readonly number[], q: readonly number[], tol: number) => expect(Math.hypot(p[0] - q[0], p[1] - q[1])).toBeLessThanOrEqual(tol);

describe('tracing a pattern that is a picture', () => {
  it('finds an outline as one closed line with its corners', () => {
    const c = new Canvas(300, 200);
    c.line(40, 30, 240, 30);
    c.line(240, 30, 240, 150);
    c.line(240, 150, 40, 150);
    c.line(40, 150, 40, 30);
    const r = traceLineArt(c.image);
    expect(r.cut).toHaveLength(1);
    expect(r.cut[0].closed).toBe(true);
    const corners = [[40, 30], [240, 30], [240, 150], [40, 150]];
    for (const corner of corners) expect(Math.min(...r.cut[0].points.map((p) => Math.hypot(p[0] - corner[0], p[1] - corner[1])))).toBeLessThanOrEqual(3);
    expect(r.cut[0].points.length).toBeLessThanOrEqual(8);
    expect(r.folds).toEqual([]);
  });

  it('finds a dashed line as one fold line with its ends where the dashes begin and end', () => {
    const c = new Canvas(300, 200);
    c.dashed(40, 170, 260, 40, 12, 7);
    const r = traceLineArt(c.image);
    expect(r.cut).toEqual([]);
    expect(r.folds).toHaveLength(1);
    const ends = [r.folds[0].a, r.folds[0].b].sort((p, q) => p[0] - q[0]);
    near(ends[0], [40, 170], 4);
    near(ends[1], [260, 40], 4);
  });

  it('finds a dash and dot line, and takes the dots in', () => {
    const c = new Canvas(300, 120);
    c.dashed(20, 60, 280, 60, 16, 10, 1, [0, 0, 0], true);
    const r = traceLineArt(c.image);
    expect(r.folds).toHaveLength(1);
    expect(Math.abs(r.folds[0].a[0] - r.folds[0].b[0])).toBeGreaterThan(240);
  });

  it('runs a fold line to the outline it belongs to, when the last dash stopped short', () => {
    const c = new Canvas(300, 200);
    c.line(40, 30, 40, 170);
    c.line(260, 30, 260, 170);
    c.dashed(46, 100, 254, 100, 12, 7);
    const r = traceLineArt(c.image);
    expect(r.cut).toHaveLength(2);
    expect(r.folds).toHaveLength(1);
    const xs = [r.folds[0].a[0], r.folds[0].b[0]].sort((a, b) => a - b);
    expect(xs[0]).toBeLessThanOrEqual(42);
    expect(xs[1]).toBeGreaterThanOrEqual(258);
  });

  it('leaves out numbers and letters, a speck, and two dashes that are not a line', () => {
    const c = new Canvas(300, 200);
    for (let i = 0; i < 8; i++) c.ring(30 + i * 14, 30, 4);
    c.line(30, 60, 30, 72, 2);
    c.line(34, 60, 34, 72, 2);
    c.line(200, 150, 214, 150, 1);
    c.line(230, 150, 244, 150, 1);
    c.dot(100, 100, [0, 0, 0]);
    const r = traceLineArt(c.image);
    expect(r.cut).toEqual([]);
    expect(r.folds).toEqual([]);
  });

  it('leaves out a photo, and says how much', () => {
    const c = new Canvas(300, 200);
    c.photo(150, 40, 120, 120);
    c.line(20, 100, 120, 100);
    const r = traceLineArt(c.image);
    expect(r.skippedPhotoPixels).toBeGreaterThan(0);
    expect(r.cut).toHaveLength(1);
    expect(r.cut[0].points.every((p) => p[0] < 130)).toBe(true);
  });

  it('reads pale grey lines as well as black ones', () => {
    const c = new Canvas(300, 200);
    c.line(40, 40, 240, 40, 1, [205, 205, 205]);
    c.line(240, 40, 240, 160, 1, [205, 205, 205]);
    c.dashed(40, 100, 240, 100, 10, 6, 1, [205, 205, 205]);
    const r = traceLineArt(c.image);
    expect(r.cut.length).toBeGreaterThanOrEqual(1);
    expect(r.folds).toHaveLength(1);
  });

  it('joins a line that a number split in two, and keeps the colour of a line', () => {
    const c = new Canvas(300, 200);
    c.line(30, 100, 140, 100, 2, [200, 0, 0]);
    c.line(143, 100, 270, 100, 2, [200, 0, 0]);
    const r = traceLineArt(c.image);
    expect(r.cut).toHaveLength(1);
    expect(r.cut[0].closed).toBe(false);
    near(r.cut[0].points[0].map((v) => v) as number[], [30, 100], 3);
    near(r.cut[0].points[r.cut[0].points.length - 1], [270, 100], 3);
    expect(r.cut[0].rgb[0]).toBeGreaterThan(0.6);
    expect(r.cut[0].rgb[1]).toBeLessThan(0.2);
  });

  it('gives lines of one colour one colour, whatever the edge of the line looks like', () => {
    const c = new Canvas(300, 200);
    // Black dashes, drawn straight and drawn slanting, thin and thicker, with a light edge on the thick one.
    c.dashed(20, 50, 280, 50, 12, 7, 1);
    c.dashed(20, 120, 280, 160, 12, 7, 2);
    for (let x = 20; x < 280; x += 2) c.dot(x, 119, [200, 200, 200]);
    const r = traceLineArt(c.image);
    expect(r.folds).toHaveLength(2);
    expect(r.folds[0].rgb).toEqual(r.folds[1].rgb);
  });

  it('keeps a corner where two lines meet and a line that branches', () => {
    const c = new Canvas(300, 200);
    c.line(30, 150, 150, 40);
    c.line(150, 40, 270, 150);
    c.line(150, 40, 150, 100);
    const r = traceLineArt(c.image);
    const all = r.cut.flatMap((l) => l.points);
    expect(Math.min(...all.map((p) => Math.hypot(p[0] - 150, p[1] - 40)))).toBeLessThanOrEqual(3);
    expect(r.cut.length).toBeGreaterThanOrEqual(2);
  });

  it('is deterministic, and gives nothing for a blank or a tiny picture', () => {
    const c = new Canvas(300, 200);
    c.line(30, 150, 150, 40);
    c.dashed(20, 20, 280, 20, 10, 6);
    expect(JSON.stringify(traceLineArt(c.image))).toBe(JSON.stringify(traceLineArt(c.image)));
    expect(traceLineArt(new Canvas(100, 100).image)).toEqual({ cut: [], folds: [], skippedPhotoPixels: 0 });
    expect(traceLineArt(new Canvas(3, 3).image).cut).toEqual([]);
  });

  it('traces a picture of hundreds of thousands of pixels in well under a second or two', () => {
    const c = new Canvas(1200, 1600);
    for (let k = 0; k < 6; k++) {
      const x = 80 + (k % 3) * 360;
      const y = 80 + Math.floor(k / 3) * 700;
      c.line(x, y, x + 300, y);
      c.line(x + 300, y, x + 330, y + 500);
      c.line(x + 330, y + 500, x, y + 480);
      c.line(x, y + 480, x, y);
      c.dashed(x, y + 160, x + 310, y + 170, 12, 7);
      c.dashed(x, y + 320, x + 320, y + 330, 12, 7);
    }
    const t0 = performance.now();
    const r = traceLineArt(c.image);
    expect(performance.now() - t0).toBeLessThan(4000);
    expect(r.cut).toHaveLength(6);
    expect(r.folds).toHaveLength(12);
  });
});

// ─── The picture in a PDF ─────────────────────────────────────────────────────

type Part = string | null | { dict: string; data: Buffer | string };

function makePdf(parts: Part[]): Uint8Array {
  const chunks: Buffer[] = [Buffer.from('%PDF-1.5\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  parts.forEach((p, i) => {
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

/** A page of 600 x 800 pt with these pictures, each as an image object placed by `cm` (the unit square scaled and moved). */
function pdfWith(images: { dict: string; data: Buffer; cm: [number, number, number, number, number, number] }[], mediaBox = '[0 0 600 800]', pageExtra = ''): Uint8Array {
  const names = images.map((_, i) => `/Im${i}`);
  const content = images.map((im, i) => `q ${im.cm.join(' ')} cm ${names[i]} Do Q`).join('\n');
  return makePdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [3 0 R] /Count 1 /MediaBox ${mediaBox} >>`,
    `<< /Type /Page /Parent 2 0 R /Contents 4 0 R ${pageExtra} /Resources << /XObject << ${images.map((_, i) => `${names[i]} ${5 + i} 0 R`).join(' ')} >> >> >>`,
    { dict: '', data: content },
    ...images.map((im) => ({ dict: `/Type /XObject /Subtype /Image ${im.dict}`, data: im.data })),
  ]);
}

const rgbImage = (c: Canvas) => ({ dict: `/Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode`, data: deflateSync(Buffer.from(c.rgb)) });

describe('a PDF page that is a picture', () => {
  const pattern = () => {
    const c = new Canvas(400, 300);
    c.line(40, 40, 360, 40);
    c.line(360, 40, 360, 260);
    c.line(360, 260, 40, 260);
    c.line(40, 260, 40, 40);
    c.dashed(40, 150, 360, 150, 12, 7);
    return c;
  };

  it('says how much of the page the picture covers, and has no lines of its own', async () => {
    const c = pattern();
    const doc = await readPdf(pdfWith([{ ...rgbImage(c), cm: [600, 0, 0, 450, 0, 175] }]));
    expect(doc.pages[0].strokes).toEqual([]);
    expect(doc.pages[0].pictureShare).toBeCloseTo((600 * 450) / (600 * 800), 6);
  });

  it('traces it into cut and dashed lines in page points: the picture is the unit square under the matrix, with its top at the top', async () => {
    const c = pattern();
    const doc = await readPdf(pdfWith([{ ...rgbImage(c), cm: [600, 0, 0, 450, 0, 175] }]));
    const strokes = await doc.tracePage(0);
    const cut = strokes.filter((s) => s.dash.length === 0);
    const folds = strokes.filter((s) => s.dash.length > 0);
    expect(cut).toHaveLength(1);
    expect(folds).toHaveLength(1);
    // Picture pixel (40, 40) is the upper left corner of the outline: x = 40/400*600 = 60, y = 175 + (1 - 40/300) * 450 = 175 + 390 = 565.
    const upperLeft = cut[0].points.reduce((best, p) => (Math.hypot(p[0] - 60, p[1] - 565) < Math.hypot(best[0] - 60, best[1] - 565) ? p : best));
    near(upperLeft, [60, 565], 6);
    // The fold runs across the middle: y = 175 + (1 - 150/300) * 450 = 400.
    for (const p of folds[0].points) expect(Math.abs(p[1] - 400)).toBeLessThan(6);
    // And it feeds the cutting file: a closed outline and a score line, in millimetres.
    const page = { ...doc.pages[0], strokes };
    const drawing = patternDrawing(page, defaultRoles(lineStyles(page)), { crop: true });
    expect(drawing.cut).toHaveLength(1);
    expect(drawing.cut[0].closed).toBe(true);
    expect(drawing.folds.length).toBeGreaterThanOrEqual(1);
    expect(drawing.widthMm).toBeCloseTo(((360 - 40) / 400) * 600 * (25.4 / 72) + 10, 0);
  });

  it('puts the tiles of a page together before it traces: a line that crosses the edge of a tile is one line', async () => {
    const whole = pattern();
    // Cut the picture into four tiles of 200 x 150 and place each where it was.
    const tiles = [] as { dict: string; data: Buffer; cm: [number, number, number, number, number, number] }[];
    for (let ty = 0; ty < 2; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        const t = new Canvas(200, 150);
        for (let y = 0; y < 150; y++) for (let x = 0; x < 200; x++) {
          const from = ((ty * 150 + y) * 400 + tx * 200 + x) * 3;
          t.rgb.set(whole.rgb.subarray(from, from + 3), (y * 200 + x) * 3);
        }
        tiles.push({ ...rgbImage(t), cm: [300, 0, 0, 225, tx * 300, 175 + (1 - ty) * 225] });
      }
    }
    const doc = await readPdf(pdfWith(tiles));
    const strokes = await doc.tracePage(0);
    expect(strokes.filter((s) => s.dash.length === 0)).toHaveLength(1);
    expect(strokes.filter((s) => s.dash.length > 0)).toHaveLength(1);
    const xs = strokes.flatMap((s) => s.points.map((p) => p[0]));
    expect(Math.min(...xs)).toBeCloseTo(60, -1);
    expect(Math.max(...xs)).toBeCloseTo(540, -1);
  });

  it('reads a grey picture, a picture with a palette and a picture of one bit', async () => {
    const c = pattern();
    const grey = new Uint8Array(400 * 300);
    for (let i = 0; i < grey.length; i++) grey[i] = c.rgb[i * 3];
    const cm: [number, number, number, number, number, number] = [600, 0, 0, 450, 0, 175];
    const greyDoc = await readPdf(pdfWith([{ dict: '/Width 400 /Height 300 /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode', data: deflateSync(Buffer.from(grey)), cm }]));
    expect((await greyDoc.tracePage(0)).length).toBeGreaterThan(1);
    const indexed = new Uint8Array(400 * 300);
    for (let i = 0; i < indexed.length; i++) indexed[i] = grey[i] < 128 ? 1 : 0;
    const palDoc = await readPdf(pdfWith([{ dict: '/Width 400 /Height 300 /ColorSpace [/Indexed /DeviceRGB 1 <FFFFFF000000>] /BitsPerComponent 8 /Filter /FlateDecode', data: deflateSync(Buffer.from(indexed)), cm }]));
    expect((await palDoc.tracePage(0)).length).toBeGreaterThan(1);
    const rowBytes = 50;
    const bits = new Uint8Array(rowBytes * 300);
    for (let y = 0; y < 300; y++) for (let x = 0; x < 400; x++) if (grey[y * 400 + x] >= 128) bits[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
    const bitDoc = await readPdf(pdfWith([{ dict: '/Width 400 /Height 300 /ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /FlateDecode', data: deflateSync(Buffer.from(bits)), cm }]));
    expect((await bitDoc.tracePage(0)).length).toBeGreaterThan(1);
  });

  it('hands a JPEG to the decoder it is given, and gives no lines without one', async () => {
    const c = pattern();
    const jpeg = { dict: '/Width 400 /Height 300 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode', data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]), cm: [600, 0, 0, 450, 0, 175] as [number, number, number, number, number, number] };
    const bytes = pdfWith([jpeg]);
    expect(await (await readPdf(bytes)).tracePage(0)).toEqual([]);
    let received = 0;
    const doc = await readPdf(bytes, {
      decodeJpeg: async (b) => {
        received = b.length;
        return c.image;
      },
    });
    expect(received).toBe(0);
    const strokes = await doc.tracePage(0);
    expect(received).toBe(4);
    expect(strokes.length).toBeGreaterThan(1);
  });

  it('does not trace a small picture (a logo) or a page without a picture, and a page that is turned is traced the way it is shown', async () => {
    const c = pattern();
    const small = await readPdf(pdfWith([{ ...rgbImage(c), cm: [100, 0, 0, 75, 10, 10] }]));
    expect(await small.tracePage(0)).toEqual([]);
    const none = await readPdf(pdfWith([]));
    expect(await none.tracePage(0)).toEqual([]);
    expect(await none.tracePage(5)).toEqual([]);
    const turned = await readPdf(pdfWith([{ ...rgbImage(c), cm: [600, 0, 0, 450, 0, 175] }], '[0 0 600 800]', '/Rotate 90'));
    expect(turned.pages[0]).toMatchObject({ widthPt: 800, heightPt: 600 });
    const strokes = await turned.tracePage(0);
    const xs = strokes.flatMap((s) => s.points.map((p) => p[0]));
    const ys = strokes.flatMap((s) => s.points.map((p) => p[1]));
    expect(Math.max(...xs)).toBeLessThanOrEqual(800 + 1);
    expect(Math.max(...ys)).toBeLessThanOrEqual(600 + 1);
  });
});
