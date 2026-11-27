import { describe, expect, it } from 'vitest';
import {
  addItem,
  addPage,
  addTab,
  boundsOf,
  cleanItem,
  distanceToSegment,
  drawingOf,
  drawProblems,
  DRAW_LIMITS,
  drawingsOf,
  duplicateItems,
  flattenItem,
  exportPageDxf,
  exportPageSvg,
  exportPdf,
  flipFolds,
  hitTest,
  mirrorItems,
  moveItems,
  moveToPage,
  newDoc,
  parseDoc,
  pageView,
  pointInPolygon,
  rectanglePoints,
  regularPolygonPoints,
  removeItems,
  removePage,
  rotateItems,
  scaleItems,
  selfIntersects,
  serializeDoc,
  setItemPoint,
  setSmooth,
  setText,
  signedArea,
  snapPoint,
  type DrawDoc,
  type Vec2,
} from '../src/lib/papercraft-engine';

const square = (doc: DrawDoc, x = 10, y = 10, s = 40) => addItem(doc, { kind: 'cut', points: rectanglePoints(x, y, x + s, y + s), closed: true });

describe('drawing shapes', () => {
  it('a rectangle runs counter-clockwise from its lower left corner, whichever way it is dragged', () => {
    expect(rectanglePoints(10, 20, 30, 50)).toEqual([[10, 20], [30, 20], [30, 50], [10, 50]]);
    expect(rectanglePoints(30, 50, 10, 20)).toEqual([[10, 20], [30, 20], [30, 50], [10, 50]]);
    expect(signedArea(rectanglePoints(0, 0, 4, 3))).toBe(12);
  });

  it('a regular polygon has its corners on the circle, counter-clockwise, and at least three', () => {
    const hex = regularPolygonPoints(5, 5, 10, 6);
    expect(hex).toHaveLength(6);
    for (const [x, y] of hex) expect(Math.hypot(x - 5, y - 5)).toBeCloseTo(10, 9);
    expect(signedArea(hex)).toBeGreaterThan(0);
    expect(regularPolygonPoints(0, 0, 1, 1)).toHaveLength(3);
    expect(regularPolygonPoints(0, 0, 1, 9999)).toHaveLength(200);
  });

  it('knows a point inside a shape, the distance to a segment, and a shape that crosses itself', () => {
    expect(pointInPolygon([1, 1], rectanglePoints(0, 0, 2, 2))).toBe(true);
    expect(pointInPolygon([3, 1], rectanglePoints(0, 0, 2, 2))).toBe(false);
    expect(distanceToSegment([5, 3], [0, 0], [10, 0])).toBe(3);
    expect(distanceToSegment([-4, 3], [0, 0], [10, 0])).toBe(5);
    expect(selfIntersects(rectanglePoints(0, 0, 4, 4))).toBe(false);
    expect(selfIntersects([[0, 0], [4, 4], [4, 0], [0, 4]])).toBe(true);
  });
});

describe('items and operations', () => {
  it('adds items with new ids and brings numbers into range', () => {
    let doc = newDoc();
    const a = square(doc);
    doc = a.doc;
    const b = addItem(doc, { kind: 'valley', points: [[0, 0], [1e9, NaN as unknown as number]], closed: false });
    expect(a.id).toBe(1);
    expect(b.id).toBeNull();
    const c = addItem(doc, { kind: 'valley', points: [[0, 0], [1e9, 5]], closed: false });
    expect(c.id).toBe(2);
    expect(c.doc.items[1]!.points[1]).toEqual([5000, 5]);
  });

  it('refuses what cannot be drawn: one point, a text with nothing in it, a closed line that is not a cut', () => {
    const doc = newDoc();
    expect(addItem(doc, { kind: 'cut', points: [[0, 0]], closed: false }).id).toBeNull();
    expect(addItem(doc, { kind: 'text', points: [[5, 5]], closed: false, text: 'abc' }).id).toBeNull();
    const fold = addItem(doc, { kind: 'mountain', points: [[0, 0], [5, 5], [9, 0]], closed: true });
    expect(fold.doc.items[0]!.closed).toBe(false);
    expect(addItem(doc, { kind: 'cut', points: [[0, 0], [5, 5]], closed: true }).doc.items[0]!.closed).toBe(false);
  });

  it('a text keeps only the characters of the stroke font, within its length and size', () => {
    const t = cleanItem({ id: 1, kind: 'text', points: [[1, 2], [3, 4]], closed: false, text: 'a1b2-3/4.x', heightMm: 999, angleDeg: 20 })!;
    expect(t.text).toBe('12-3/4.x');
    expect(t.points).toEqual([[1, 2]]);
    expect(t.heightMm).toBe(50);
  });

  it('moves, removes and changes one corner without touching the others', () => {
    let doc = square(newDoc()).doc;
    doc = addItem(doc, { kind: 'mountain', points: [[0, 0], [5, 5]], closed: false }).doc;
    const moved = moveItems(doc, [1], 5, -5);
    expect(moved.items[0]!.points[0]).toEqual([15, 5]);
    expect(moved.items[1]).toBe(doc.items[1]);
    expect(setItemPoint(doc, 1, 2, [60, 60]).items[0]!.points[2]).toEqual([60, 60]);
    expect(setItemPoint(doc, 1, 9, [60, 60])).toEqual(doc);
    expect(removeItems(doc, [1]).items.map((i) => i.id)).toEqual([2]);
    expect(removeItems(doc, [])).toBe(doc);
  });

  it('turns, mirrors and scales items together about the middle of their box', () => {
    const doc = square(newDoc(), 0, 0, 20).doc;
    const turned = rotateItems(doc, [1], 90);
    const b = boundsOf(turned.items)!;
    expect([b.minX, b.minY, b.maxX, b.maxY].map((n) => Math.round(n) + 0)).toEqual([0, 0, 20, 20]);
    const wide = addItem(newDoc(), { kind: 'cut', points: [[0, 0], [40, 0], [40, 10], [0, 10]], closed: true }).doc;
    const b2 = boundsOf(rotateItems(wide, [1], 90).items)!;
    expect([b2.maxX - b2.minX, b2.maxY - b2.minY].map(Math.round)).toEqual([10, 40]);
    const tri = addItem(newDoc(), { kind: 'cut', points: [[0, 0], [10, 0], [0, 10]], closed: true }).doc;
    expect(mirrorItems(tri, [1], 'horizontal').items[0]!.points).toEqual([[10, 0], [0, 0], [10, 10]]);
    expect(boundsOf(scaleItems(doc, [1], 2).items)).toEqual({ minX: -10, minY: -10, maxX: 30, maxY: 30 });
    expect(scaleItems(doc, [1], -1)).toBe(doc);
  });

  it('copies items with new ids, moved; and turns mountain folds into valley folds', () => {
    let doc = square(newDoc()).doc;
    doc = addItem(doc, { kind: 'mountain', points: [[0, 0], [5, 5]], closed: false }).doc;
    const copy = duplicateItems(doc, [1, 2], 3, 4);
    expect(copy.ids).toEqual([3, 4]);
    expect(copy.doc.items[2]!.points[0]).toEqual([13, 14]);
    expect(copy.doc.nextId).toBe(5);
    expect(flipFolds(doc, [1, 2]).items.map((i) => i.kind)).toEqual(['cut', 'valley']);
  });

  it('changes the text of a text item only', () => {
    let doc = addItem(newDoc(), { kind: 'text', points: [[5, 5]], closed: false, text: '1' }).doc;
    doc = square(doc).doc;
    expect(setText(doc, 1, { text: '12' }).items[0]!.text).toBe('12');
    expect(setText(doc, 2, { text: '12' })).toEqual(doc);
  });
});

describe('glue tabs', () => {
  const tabbed = (points: Vec2[]) => {
    const doc = addItem(newDoc(), { kind: 'cut', points, closed: true }).doc;
    return addTab(doc, 1, 0, { widthMm: 8, angleDeg: 45 });
  };

  it('puts the tab outside the shape and a fold line along the edge, for a counter-clockwise shape', () => {
    const r = tabbed(rectanglePoints(0, 20, 40, 60));
    expect(r.added).toBe(true);
    const cut = r.doc.items[0]!;
    expect(cut.points).toHaveLength(6);
    // The tab is on the edge from (0,20) to (40,20): below it.
    expect(cut.points[1]).toEqual([8, 12]);
    expect(cut.points[2]).toEqual([32, 12]);
    expect(r.doc.items[1]).toMatchObject({ kind: 'valley', points: [[0, 20], [40, 20]] });
  });

  it('puts the tab outside for a clockwise shape as well', () => {
    const r = tabbed([...rectanglePoints(0, 20, 40, 60)].reverse());
    const cut = r.doc.items[0]!;
    // The first edge of the reversed shape is its top edge: the tab goes up, out of the shape.
    expect(boundsOf([cut])!.maxY).toBe(68);
    // The tab corners are outside the original rectangle.
    const original = rectanglePoints(0, 20, 40, 60);
    const extra = cut.points.filter((p) => !original.some((q) => q[0] === p[0] && q[1] === p[1]));
    expect(extra).toHaveLength(2);
    for (const p of extra) expect(pointInPolygon(p, original)).toBe(false);
  });

  it('works on the closing edge, does not double an existing fold line, and keeps the outline from crossing itself', () => {
    let doc = addItem(newDoc(), { kind: 'cut', points: rectanglePoints(0, 0, 40, 40), closed: true }).doc;
    const last = addTab(doc, 1, 3, { widthMm: 6 });
    expect(last.added).toBe(true);
    expect(last.doc.items[0]!.points).toHaveLength(6);
    expect(selfIntersects(last.doc.items[0]!.points)).toBe(false);
    const again = addTab(last.doc, 1, 3, { widthMm: 6 });
    // The second tab is put on the edge (the edge now runs to the first tab corner), the fold line of the first stays the only one on that edge.
    expect(last.doc.items.filter((i) => i.kind === 'valley')).toHaveLength(1);
    expect(again.added).toBe(true);
    doc = last.doc;
    expect(drawProblems(doc).some((p) => p.code === 'self-intersecting')).toBe(false);
  });

  it('does nothing for an open line, a missing edge, an edge that is too short or something that is not a cut', () => {
    const open = addItem(newDoc(), { kind: 'cut', points: [[0, 0], [10, 0], [10, 10]], closed: false }).doc;
    expect(addTab(open, 1, 0).added).toBe(false);
    const doc = square(newDoc()).doc;
    expect(addTab(doc, 1, 9).added).toBe(false);
    expect(addTab(doc, 7, 0).added).toBe(false);
    const tiny = addItem(newDoc(), { kind: 'cut', points: [[0, 0], [1, 0], [1, 10], [0, 10]], closed: true }).doc;
    expect(addTab(tiny, 1, 0).added).toBe(false);
  });

  it('keeps the tab inside the edge on a short edge (the corners never cross)', () => {
    const doc = addItem(newDoc(), { kind: 'cut', points: [[0, 0], [10, 0], [10, 30], [0, 30]], closed: true }).doc;
    const r = addTab(doc, 1, 0, { widthMm: 20, angleDeg: 30 });
    expect(selfIntersects(r.doc.items[0]!.points)).toBe(false);
  });
});

describe('finding and snapping', () => {
  const doc = (() => {
    let d = square(newDoc(), 10, 10, 40).doc;
    d = addItem(d, { kind: 'mountain', points: [[10, 30], [50, 30]], closed: false }).doc;
    d = addItem(d, { kind: 'text', points: [[100, 100]], closed: false, text: '7' }).doc;
    return d;
  })();

  it('finds a corner before an edge, an edge before the inside, and the item on top', () => {
    expect(hitTest(doc, [10.5, 10.5], 1)).toEqual({ id: 1, vertex: 0, edge: null });
    expect(hitTest(doc, [30, 10.4], 1)).toEqual({ id: 1, vertex: null, edge: 0 });
    // The fold line lies over the shape: on the line it is the line, elsewhere inside it is the shape.
    expect(hitTest(doc, [30, 30.2], 1)).toMatchObject({ id: 2 });
    expect(hitTest(doc, [30, 22], 1)).toEqual({ id: 1, vertex: null, edge: null });
    expect(hitTest(doc, [100.5, 100], 1)).toMatchObject({ id: 3 });
    expect(hitTest(doc, [150, 150], 1)).toBeNull();
    expect(hitTest(doc, [30, 22], 1, [2, 3])).toBeNull();
  });

  it('the smallest of shapes inside each other is the one that is hit', () => {
    let d = square(newDoc(), 0, 0, 100).doc;
    d = square(d, 40, 40, 20).doc;
    expect(hitTest(d, [50, 50], 1)?.id).toBe(2);
    expect(hitTest(d, [20, 20], 1)?.id).toBe(1);
  });

  it('snaps to a corner of another item, else to the grid, else leaves the point alone', () => {
    expect(snapPoint(doc, [10.8, 49.5], { gridMm: 5, tolMm: 2 })).toEqual([10, 50]);
    expect(snapPoint(doc, [72.2, 33.4], { gridMm: 5, tolMm: 2 })).toEqual([70, 35]);
    expect(snapPoint(doc, [72.2, 33.4], { gridMm: 0, tolMm: 2 })).toEqual([72.2, 33.4]);
    expect(snapPoint(doc, [10.8, 49.5], { gridMm: 5, tolMm: 2, exclude: [1, 2] })).toEqual([10, 50]);
    expect(snapPoint(doc, [10.8, 49.5], { gridMm: 0, tolMm: 2, exclude: [1, 2] })).toEqual([10.8, 49.5]);
  });
});

describe('checks', () => {
  it('says when there is nothing to cut, a part is off the sheet, an outline crosses itself or is open, or something is a speck', () => {
    expect(drawProblems(newDoc()).map((p) => p.code)).toEqual(['nothing-to-cut']);
    let doc = newDoc(100, 100);
    doc = addItem(doc, { kind: 'cut', points: rectanglePoints(90, 90, 120, 120), closed: true }).doc;
    doc = addItem(doc, { kind: 'cut', points: [[0, 0], [20, 20], [20, 0], [0, 20]], closed: true }).doc;
    doc = addItem(doc, { kind: 'cut', points: [[30, 30], [40, 30], [40, 40]], closed: false }).doc;
    doc = addItem(doc, { kind: 'cut', points: rectanglePoints(60, 60, 60.2, 60.2), closed: true }).doc;
    const codes = drawProblems(doc).map((p) => `${p.code}:${p.itemId}`);
    expect(codes).toContain('outside-sheet:1');
    expect(codes).toContain('self-intersecting:2');
    expect(codes).toContain('open-outline:3');
    expect(codes).toContain('tiny:4');
  });

  it('a clean drawing has no problems', () => {
    expect(drawProblems(square(newDoc()).doc)).toEqual([]);
  });
});

describe('output', () => {
  const doc = (() => {
    let d = newDoc(210, 297);
    d = square(d, 20, 20, 50).doc;
    d = addTab(d, 1, 1, { widthMm: 8 }).doc;
    d = addItem(d, { kind: 'mountain', points: [[20, 45], [70, 45]], closed: false }).doc;
    d = addItem(d, { kind: 'text', points: [[45, 45]], closed: false, text: '12', heightMm: 5 }).doc;
    return d;
  })();

  it('makes the drawing the exporters take: cut outlines, folds with their kind, numbers as strokes', () => {
    const drawing = drawingOf(doc);
    expect(drawing.widthMm).toBe(210);
    expect(drawing.heightMm).toBe(297);
    expect(drawing.cut).toHaveLength(1);
    expect(drawing.cut[0]!.closed).toBe(true);
    expect(drawing.folds.map((f) => f.kind).sort()).toEqual(['mountain', 'valley']);
    expect(drawing.text.length).toBeGreaterThan(0);
  });

  it('crops the sheet to the drawing plus a margin', () => {
    const drawing = drawingOf(doc, { crop: true, marginMm: 5 });
    const xs = drawing.cut[0]!.points.map((p) => p[0]);
    const ys = drawing.cut[0]!.points.map((p) => p[1]);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(5 - 1e-9);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(5 - 1e-9);
    expect(drawing.widthMm).toBeLessThan(100);
    expect(drawing.heightMm).toBeLessThan(100);
    expect(Math.max(...xs)).toBeLessThanOrEqual(drawing.widthMm - 5 + 1e-9);
  });

  it('goes through the Cricut SVG, the Silhouette DXF and the PDF', () => {
    const drawing = drawingOf(doc);
    const svg = exportPageSvg(drawing, 'cricut');
    expect(svg).toMatch(/width="210mm"/);
    expect(svg).not.toMatch(/<use|<image|<canvas|opacity/);
    expect(exportPageDxf(drawing)).toMatch(/CUT/);
    const pdf = exportPdf([drawing]);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
  });

  it('gives the same output every time', () => {
    expect(JSON.stringify(drawingOf(doc))).toBe(JSON.stringify(drawingOf(doc)));
  });
});

describe('saving', () => {
  it('a document comes back as it was', () => {
    let doc = newDoc(150, 200, 'Mine');
    doc = square(doc).doc;
    doc = addItem(doc, { kind: 'text', points: [[5, 5]], closed: false, text: '3', heightMm: 6, angleDeg: 90 }).doc;
    expect(parseDoc(JSON.parse(JSON.stringify(serializeDoc(doc))))).toEqual(doc);
  });

  it('refuses data that is not a drawing and cleans up what is wrong inside one', () => {
    expect(parseDoc(null)).toBeNull();
    expect(parseDoc({ version: 2 })).toBeNull();
    expect(parseDoc({ version: 1, kind: 'other', doc: {} })).toBeNull();
    expect(parseDoc({ version: 1, kind: 'papercraft-drawing', doc: { sheet: { widthMm: 'a', heightMm: 2 }, items: [] } })).toBeNull();
    const messy = parseDoc({
      version: 1,
      kind: 'papercraft-drawing',
      doc: {
        name: 5,
        sheet: { widthMm: 1e9, heightMm: 5 },
        items: [
          { id: 3, kind: 'cut', points: [[0, 0], [10, 0], [10, 10]], closed: true },
          { id: 3, kind: 'cut', points: [[0, 0], [10, 0], [10, 10]], closed: true },
          { id: 4, kind: 'cut', points: [[0, 0]], closed: true },
          'junk',
          { id: 5, kind: 'wat', points: [[0, 0], [1, 1]], closed: false },
        ],
      },
    })!;
    expect(messy.sheet).toEqual({ widthMm: 2000, heightMm: 20 });
    expect(messy.items.map((i) => i.id)).toEqual([3, 5]);
    expect(messy.items[1]!.kind).toBe('cut');
    expect(messy.nextId).toBe(6);
    expect(messy.name).toBe('Drawing');
  });
});

describe('smooth curves', () => {
  const near = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!) < 1e-2;

  it('an item that is not smooth, or has fewer than three points, is its own points', () => {
    expect(flattenItem({ points: [[0, 0], [5, 5], [10, 0]], closed: false })).toEqual([[0, 0], [5, 5], [10, 0]]);
    expect(flattenItem({ points: [[0, 0], [10, 0]], closed: false, smooth: true })).toEqual([[0, 0], [10, 0]]);
  });

  it('an open curve runs through every control point, from the first to the last, in short pieces', () => {
    const control: Vec2[] = [[0, 0], [20, 15], [40, 0], [60, 15]];
    const line = flattenItem({ points: control, closed: false, smooth: true });
    expect(near(line[0]!, control[0]!)).toBe(true);
    expect(near(line[line.length - 1]!, control[3]!)).toBe(true);
    for (const c of control) expect(line.some((p) => near(p, c)), String(c)).toBe(true);
    expect(line.length).toBeGreaterThan(control.length * 4);
    for (let i = 1; i < line.length; i++) expect(Math.hypot(line[i]![0] - line[i - 1]![0], line[i]![1] - line[i - 1]![1])).toBeLessThan(6);
  });

  it('a closed curve through four points on a circle stays close to the circle, and does not repeat its first point', () => {
    const line = flattenItem({ points: [[10, 0], [0, 10], [-10, 0], [0, -10]], closed: true, smooth: true });
    expect(near(line[0]!, line[line.length - 1]!)).toBe(false);
    for (const [x, y] of line) expect(Math.abs(Math.hypot(x, y) - 10)).toBeLessThan(1.2);
    // Rounder than the diamond through the same points (area 200), and not fuller than the circle (about 314).
    expect(signedArea(line)).toBeGreaterThan(250);
    expect(signedArea(line)).toBeLessThan(320);
  });

  it('points on top of each other do not break the curve', () => {
    const line = flattenItem({ points: [[0, 0], [0, 0], [10, 10], [10, 10], [20, 0]], closed: false, smooth: true });
    expect(line.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
  });

  it('gives the same curve every time', () => {
    const item = { points: [[0, 0], [20, 15], [40, 0]] as Vec2[], closed: false, smooth: true };
    expect(JSON.stringify(flattenItem(item))).toBe(JSON.stringify(flattenItem(item)));
  });

  it('only a cut or fold line with three points can be smooth', () => {
    let doc = addItem(newDoc(), { kind: 'cut', points: rectanglePoints(10, 10, 50, 50), closed: true, smooth: true }).doc;
    doc = addItem(doc, { kind: 'valley', points: [[0, 0], [5, 5]], closed: false, smooth: true }).doc;
    doc = addItem(doc, { kind: 'text', points: [[5, 5]], closed: false, text: '1', smooth: true }).doc;
    expect(doc.items.map((i) => i.smooth === true)).toEqual([true, false, false]);
    expect(setSmooth(doc, [1, 2, 3], false).items[0]!.smooth).toBeUndefined();
    expect(setSmooth(doc, [1, 2, 3], true).items.map((i) => i.smooth === true)).toEqual([true, false, false]);
  });

  it('is hit along the curve, and a tab cannot be put on it', () => {
    const doc = addItem(newDoc(), { kind: 'cut', points: [[10, 10], [60, 10], [60, 60], [10, 60]], closed: true, smooth: true }).doc;
    const line = flattenItem(doc.items[0]!);
    const on = line[Math.floor(line.length / 8)]!;
    expect(hitTest(doc, on, 0.5)).toEqual({ id: 1, vertex: null, edge: null });
    expect(addTab(doc, 1, 0).added).toBe(false);
  });

  it('is cut along the curve, and a curve that bulges off the sheet is reported', () => {
    let doc = newDoc(100, 100);
    doc = addItem(doc, { kind: 'cut', points: [[10, 10], [50, 40], [90, 10]], closed: false, smooth: true }).doc;
    expect(drawingOf(doc).cut[0]!.points.length).toBeGreaterThan(20);
    // A curve through the four corners of the sheet bows out past the edges.
    const bulge = addItem(newDoc(100, 100), { kind: 'cut', points: [[0, 0], [100, 0], [100, 100], [0, 100]], closed: true, smooth: true }).doc;
    expect(drawProblems(bulge).some((p) => p.code === 'outside-sheet')).toBe(true);
    const crossing = addItem(newDoc(), { kind: 'cut', points: [[0, 0], [30, 30], [30, 0], [0, 30]], closed: true, smooth: true }).doc;
    expect(drawProblems(crossing).some((p) => p.code === 'self-intersecting')).toBe(true);
  });

  it('a curve goes through the exporters', () => {
    const doc = addItem(newDoc(), { kind: 'cut', points: [[10, 10], [50, 40], [90, 10]], closed: false, smooth: true }).doc;
    expect(exportPageSvg(drawingOf(doc), 'cricut')).toMatch(/<path/);
  });
});

describe('pages', () => {
  const two = () => {
    let doc = addPage(newDoc());
    doc = addItem(doc, { kind: 'cut', points: rectanglePoints(0, 0, 20, 20), closed: true, page: 0 }).doc;
    doc = addItem(doc, { kind: 'cut', points: rectanglePoints(5, 5, 30, 30), closed: true, page: 1 }).doc;
    return doc;
  };

  it('a drawing starts with one page, gets more up to the limit, and an item is put on a page the drawing has', () => {
    let doc = newDoc();
    expect(doc.pageCount).toBe(1);
    expect(addItem(doc, { kind: 'cut', points: rectanglePoints(0, 0, 5, 5), closed: true, page: 7 }).doc.items[0]!.page).toBe(0);
    for (let i = 0; i < 40; i++) doc = addPage(doc);
    expect(doc.pageCount).toBe(DRAW_LIMITS.pages);
  });

  it('the view of a page has only its items, and what is found or snapped to stays on the page', () => {
    const doc = two();
    expect(pageView(doc, 1).items.map((i) => i.id)).toEqual([2]);
    expect(hitTest(pageView(doc, 1), [10, 10], 1)?.id).toBe(2);
    expect(hitTest(pageView(doc, 0), [25, 25], 1)).toBeNull();
    expect(snapPoint(pageView(doc, 1), [0.5, 0.5], { gridMm: 0, tolMm: 2 })).toEqual([0.5, 0.5]);
  });

  it('each page is drawn on its own, and drawingsOf gives them all in order', () => {
    const doc = two();
    expect(drawingOf(doc, { page: 0 }).cut).toHaveLength(1);
    expect(drawingOf(doc, { page: 1 }).cut[0]!.points[0]).toEqual([5, 5]);
    expect(drawingOf(doc, { page: 2 }).cut).toHaveLength(0);
    expect(drawingsOf(doc)).toHaveLength(2);
    expect(drawingsOf(doc, { crop: true })[1]!.widthMm).toBeLessThan(40);
  });

  it('removing a page takes its items with it and moves the later pages up; the last page cannot go', () => {
    let doc = two();
    doc = addPage(doc);
    doc = addItem(doc, { kind: 'cut', points: rectanglePoints(1, 1, 9, 9), closed: true, page: 2 }).doc;
    const removed = removePage(doc, 1);
    expect(removed.pageCount).toBe(2);
    expect(removed.items.map((i) => [i.id, i.page])).toEqual([[1, 0], [3, 1]]);
    expect(removePage(newDoc(), 0).pageCount).toBe(1);
    expect(removePage(doc, 9)).toBe(doc);
  });

  it('moves items to another page, only to a page that exists', () => {
    const doc = two();
    expect(moveToPage(doc, [1], 1).items[0]!.page).toBe(1);
    expect(moveToPage(doc, [1], 5)).toBe(doc);
    expect(moveToPage(doc, [1], -1)).toBe(doc);
  });

  it('a copy stays on the page of the original', () => {
    const copy = duplicateItems(two(), [2], 3, 3);
    expect(copy.doc.items.find((i) => i.id === copy.ids[0])!.page).toBe(1);
  });

  it('a page with nothing on it is pointed out when there are several', () => {
    expect(drawProblems(addPage(square(newDoc()).doc)).filter((p) => p.code === 'empty-page')).toEqual([{ code: 'empty-page', page: 1 }]);
    expect(drawProblems(square(newDoc()).doc).some((p) => p.code === 'empty-page')).toBe(false);
  });

  it('pages and curves are saved and come back; a drawing from before pages opens on one page', () => {
    let doc = two();
    doc = addItem(doc, { kind: 'cut', points: [[10, 10], [50, 40], [90, 10]], closed: false, smooth: true, page: 1 }).doc;
    expect(parseDoc(JSON.parse(JSON.stringify(serializeDoc(doc))))).toEqual(doc);
    const old = JSON.parse(JSON.stringify(serializeDoc(square(newDoc()).doc)));
    delete old.doc.pageCount;
    delete old.doc.items[0].page;
    const back = parseDoc(old)!;
    expect(back.pageCount).toBe(1);
    expect(back.items[0]!.page).toBe(0);
  });

  it('a saved drawing with an item on a later page than it says has the page count raised', () => {
    const saved = JSON.parse(JSON.stringify(serializeDoc(two())));
    saved.doc.pageCount = 1;
    expect(parseDoc(saved)!.pageCount).toBe(2);
    saved.doc.pageCount = 9999;
    expect(parseDoc(saved)!.pageCount).toBe(DRAW_LIMITS.pages);
  });
});
