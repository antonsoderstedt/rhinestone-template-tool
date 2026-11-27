import { describe, expect, it } from 'vitest';
import {
  addItem,
  addTab,
  autoHandles,
  cleanItem,
  drawProblems,
  drawingOf,
  flattenItem,
  hitHandle,
  hitTest,
  isCurved,
  mirrorItems,
  newDoc,
  parseDoc,
  rotateItems,
  scaleItems,
  serializeDoc,
  setBezier,
  setHandle,
  setSmooth,
  toggleCorner,
  type DrawDoc,
  type DrawItem,
  type Vec2,
} from '../src/lib/papercraft-engine';

const corner = { in: [0, 0] as Vec2, out: [0, 0] as Vec2 };

function docWith(spec: Partial<DrawItem> & { points: Vec2[] }): { doc: DrawDoc; id: number } {
  const added = addItem(newDoc(), { kind: 'cut', closed: false, ...spec });
  return { doc: added.doc, id: added.id! };
}
const itemOf = (doc: DrawDoc, id: number) => doc.items.find((i) => i.id === id)!;

describe('a Bézier line is cut along its curve', () => {
  it('with no handle at either end of a piece, that piece is straight', () => {
    const line = flattenItem({ points: [[0, 0], [10, 0], [10, 10]], closed: false, handles: [corner, corner, corner] });
    expect(line).toEqual([[0, 0], [10, 0], [10, 10]]);
  });

  it('follows a cubic Bézier between two points: it starts and ends on them and bulges toward the handles', () => {
    const line = flattenItem({ points: [[0, 0], [30, 0]], closed: false, handles: [{ in: [0, 0], out: [0, 20] }, { in: [0, 20], out: [0, 0] }] });
    expect(line[0]).toEqual([0, 0]);
    expect(line[line.length - 1]).toEqual([30, 0]);
    // the middle of that curve is 0.75 of the handle height: 3 * 20 / 4 = 15 (a cubic with both control points 20 above is 15 high at t = 0.5)
    const middle = line.reduce((best, p) => (Math.abs(p[0] - 15) < Math.abs(best[0] - 15) ? p : best), line[0]!);
    expect(middle[1]).toBeCloseTo(15, 1);
    expect(line.every((p) => p[1] >= 0 && p[1] <= 15.01)).toBe(true);
    expect(line.length).toBeGreaterThan(10);
  });

  it('is cut into pieces about a millimetre long, and a closed one includes the piece that closes it', () => {
    const handles = [{ in: [-10, 0] as Vec2, out: [10, 0] as Vec2 }, { in: [0, -10] as Vec2, out: [0, 10] as Vec2 }, { in: [10, 0] as Vec2, out: [-10, 0] as Vec2 }];
    const closed = flattenItem({ points: [[0, 0], [20, 0], [10, 20]], closed: true, handles });
    const open = flattenItem({ points: [[0, 0], [20, 0], [10, 20]], closed: false, handles });
    expect(closed.length).toBeGreaterThan(open.length);
    for (let i = 1; i < closed.length; i++) expect(Math.hypot(closed[i]![0] - closed[i - 1]![0], closed[i]![1] - closed[i - 1]![1])).toBeLessThan(4);
  });

  it('is the same every time', () => {
    const item = { points: [[0, 0], [30, 5], [50, 40]] as Vec2[], closed: false, handles: autoHandles([[0, 0], [30, 5], [50, 40]], false) };
    expect(flattenItem(item)).toEqual(flattenItem(item));
  });
});

describe('automatic handles', () => {
  it('make a smooth curve through the points and are the same on both sides', () => {
    const h = autoHandles([[0, 0], [10, 0], [10, 10], [0, 10]], false);
    expect(h).toHaveLength(4);
    for (const x of h) {
      expect(x.in[0]).toBeCloseTo(-x.out[0], 9);
      expect(x.in[1]).toBeCloseTo(-x.out[1], 9);
    }
    // an end point's handle points to its neighbour, a third of the way
    expect(h[0]!.out).toEqual([3.333, 0]);
  });

  it('close up round a closed shape', () => {
    const h = autoHandles([[0, 0], [10, 0], [10, 10], [0, 10]], true);
    expect(h[0]!.out[0]).toBeCloseTo((10 - 0) / 6, 2); // (next.x - previous.x) / 6 where the previous is (0,10)
    expect(h[0]!.out[1]).toBeCloseTo((0 - 10) / 6, 2);
  });
});

describe('making an item a Bézier curve', () => {
  it('keeps the shape of a smooth item (the handles give back nearly the same curve) and takes the smooth flag away', () => {
    const { doc, id } = docWith({ points: [[0, 0], [20, 15], [40, 0], [60, 15]], smooth: true });
    const smooth = flattenItem(itemOf(doc, id));
    const bez = setBezier(doc, [id], true);
    const item = itemOf(bez, id);
    expect(item.smooth).toBeUndefined();
    expect(item.handles).toHaveLength(4);
    expect(isCurved(item)).toBe(true);
    const after = flattenItem(item);
    // every point of the Bézier is close to the spline (a few tenths of a millimetre at most)
    const near = (p: Vec2) => Math.min(...smooth.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1])));
    expect(Math.max(...after.map(near))).toBeLessThan(1.2);
  });

  it('gives a straight item handles of length zero, so it keeps its corners', () => {
    const { doc, id } = docWith({ points: [[0, 0], [10, 0], [10, 10]], closed: false });
    const item = itemOf(setBezier(doc, [id], true), id);
    expect(item.handles).toEqual([corner, corner, corner]);
    expect(flattenItem(item)).toEqual([[0, 0], [10, 0], [10, 10]]);
  });

  it('can be undone: without handles the line is straight between the points again, and smooth removes the handles', () => {
    const { doc, id } = docWith({ points: [[0, 0], [10, 0], [10, 10]], smooth: true });
    const bez = setBezier(doc, [id], true);
    expect(itemOf(setBezier(bez, [id], false), id)).toMatchObject({ points: [[0, 0], [10, 0], [10, 10]] });
    expect(itemOf(setBezier(bez, [id], false), id).handles).toBeUndefined();
    const smooth = itemOf(setSmooth(bez, [id], true), id);
    expect(smooth.smooth).toBe(true);
    expect(smooth.handles).toBeUndefined();
  });

  it('works for a line of two points and leaves a text alone', () => {
    const { doc, id } = docWith({ kind: 'mountain', points: [[0, 0], [30, 0]] });
    expect(itemOf(setBezier(doc, [id], true), id).handles).toHaveLength(2);
    const text = addItem(newDoc(), { kind: 'text', points: [[5, 5]], closed: false, text: '12' });
    expect(setBezier(text.doc, [text.id!], true).items).toEqual(text.doc.items);
  });
});

describe('moving a handle', () => {
  const base = () => {
    const { doc, id } = docWith({ points: [[0, 0], [30, 0], [60, 0]] });
    return { doc: setBezier(doc, [id], true), id };
  };

  it('mirrors it to the other side of the point by default (a smooth point)', () => {
    const { doc, id } = base();
    const next = itemOf(setHandle(doc, id, 1, 'out', [10, 5]), id);
    expect(next.handles![1]).toEqual({ in: [-10, -5], out: [10, 5] });
    expect(next.handles![0]).toEqual(corner);
  });

  it('moves only that handle when it is not mirrored (a corner)', () => {
    const { doc, id } = base();
    const next = itemOf(setHandle(setHandle(doc, id, 1, 'out', [10, 5]), id, 1, 'in', [-4, 8], false), id);
    expect(next.handles![1]).toEqual({ in: [-4, 8], out: [10, 5] });
  });

  it('keeps the numbers in range and ignores what cannot be a handle', () => {
    const { doc, id } = base();
    expect(itemOf(setHandle(doc, id, 1, 'out', [1e9, -1e9]), id).handles![1]!.out).toEqual([5000, -5000]);
    expect(setHandle(doc, id, 1, 'out', [NaN, 0])).toBe(doc);
    expect(setHandle(doc, id, 9, 'out', [1, 1]).items).toEqual(doc.items);
    const plain = docWith({ points: [[0, 0], [5, 5]] });
    expect(itemOf(setHandle(plain.doc, plain.id, 0, 'out', [1, 1]), plain.id).handles).toBeUndefined();
  });
});

describe('corners and smooth points', () => {
  it('a corner gets handles that make the curve smooth through it, and a smooth point becomes a corner', () => {
    const { doc, id } = docWith({ points: [[0, 0], [30, 10], [60, 0]] });
    const bez = setBezier(doc, [id], true);
    const smooth = toggleCorner(bez, id, 1);
    expect(itemOf(smooth, id).handles![1]!.out[0]).toBeGreaterThan(0);
    expect(itemOf(smooth, id).handles![0]).toEqual(corner);
    const corner2 = toggleCorner(smooth, id, 1);
    expect(itemOf(corner2, id).handles![1]).toEqual(corner);
  });
});

describe('finding a handle', () => {
  const item = (): DrawItem => {
    const { doc, id } = docWith({ points: [[0, 0], [30, 0]] });
    return itemOf(setHandle(setBezier(doc, [id], true), id, 0, 'out', [0, 10], false), id);
  };

  it('finds the one within reach, and none for a handle of length zero', () => {
    expect(hitHandle(item(), [0.5, 9.5], 2)).toEqual({ index: 0, which: 'out' });
    expect(hitHandle(item(), [30, 0], 2)).toBeNull(); // the point of the second handle, which has no length
    expect(hitHandle(item(), [15, 15], 2)).toBeNull();
    expect(hitHandle({ ...item(), handles: undefined }, [0, 10], 2)).toBeNull();
  });

  it('takes the nearer of two handles', () => {
    const { doc, id } = docWith({ points: [[0, 0], [30, 0]] });
    const i = itemOf(setHandle(setHandle(setBezier(doc, [id], true), id, 0, 'out', [10, 10], false), id, 1, 'in', [-10, 10], false), id);
    expect(hitHandle(i, [20, 10], 3)).toEqual({ index: 1, which: 'in' });
  });
});

describe('a Bézier item with the rest of the tools', () => {
  const sample = () => {
    const { doc, id } = docWith({ points: [[10, 10], [40, 10], [40, 40], [10, 40]], closed: true, smooth: true });
    return { doc: setBezier(doc, [id], true), id };
  };

  it('turns, mirrors and scales its handles with its points', () => {
    const { doc, id } = sample();
    const before = itemOf(doc, id);
    const turned = itemOf(rotateItems(doc, [id], 90), id);
    // a quarter turn counter-clockwise: an offset (x, y) becomes (-y, x)
    expect(turned.handles![0]!.out[0]).toBeCloseTo(-before.handles![0]!.out[1], 2);
    expect(turned.handles![0]!.out[1]).toBeCloseTo(before.handles![0]!.out[0], 2);
    const mirrored = itemOf(mirrorItems(doc, [id], 'horizontal'), id);
    expect(mirrored.handles![0]!.out).toEqual([-before.handles![0]!.out[0], before.handles![0]!.out[1]]);
    const bigger = itemOf(scaleItems(doc, [id], 2), id);
    expect(bigger.handles![0]!.out[0]).toBeCloseTo(before.handles![0]!.out[0] * 2, 2);
    // the curve is turned too: its bounding box follows
    const a = flattenItem(before);
    const b = flattenItem(bigger);
    const width = (pts: Vec2[]) => Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
    expect(width(b)).toBeCloseTo(width(a) * 2, 1);
  });

  it('is hit along its curve, has no straight edge for a glue tab, and checks itself on the curve', () => {
    const { doc, id } = sample();
    const onCurve = flattenItem(itemOf(doc, id))[3]!;
    expect(hitTest(doc, onCurve, 1)).toMatchObject({ id, edge: null });
    expect(addTab(doc, id, 0).added).toBe(false);
    expect(drawProblems(doc).some((p) => p.code === 'self-intersecting')).toBe(false);
  });

  it('is cut as the same points the drawing is drawn along (Cricut, Silhouette and PDF take them from drawingOf)', () => {
    const { doc, id } = sample();
    const drawing = drawingOf(doc);
    expect(drawing.cut[0]!.points).toEqual(flattenItem(itemOf(doc, id)));
    expect(drawing.cut[0]!.closed).toBe(true);
  });

  it('is copied with its handles', () => {
    const { doc, id } = sample();
    const copy = serializeDoc(doc).doc.items[0]!;
    expect(copy.handles).toEqual(itemOf(doc, id).handles);
    expect(copy.handles).not.toBe(itemOf(doc, id).handles);
  });
});

describe('saving and opening a drawing with handles', () => {
  it('round-trips the handles', () => {
    const { doc, id } = docWith({ points: [[10, 10], [50, 10], [50, 40]], smooth: true });
    const bez = setBezier(doc, [id], true);
    const back = parseDoc(JSON.parse(JSON.stringify(serializeDoc(bez))))!;
    expect(itemOf(back, id).handles).toEqual(itemOf(bez, id).handles);
    expect(flattenItem(itemOf(back, id))).toEqual(flattenItem(itemOf(bez, id)));
  });

  it('brings numbers into range and drops handles that do not fit the points (a drawing from before handles has none)', () => {
    const raw = { id: 1, kind: 'cut' as const, points: [[0, 0], [10, 0], [10, 10]] as Vec2[], closed: false, page: 0 };
    expect(cleanItem({ ...raw, handles: [corner, corner] })!.handles).toBeUndefined(); // two pairs for three points
    expect(cleanItem({ ...raw, handles: [corner, corner, { in: [1, 'x'] as never, out: [0, 0] }] })!.handles).toBeUndefined();
    expect(cleanItem({ ...raw, handles: 'no' as never })!.handles).toBeUndefined();
    const big = cleanItem({ ...raw, handles: [{ in: [1e9, 0.00049], out: [0, 0] }, corner, corner] })!;
    expect(big.handles![0]!.in).toEqual([5000, 0]);
    expect(cleanItem(raw)!.handles).toBeUndefined();
  });

  it('keeps handles instead of the smooth flag when both are given', () => {
    const raw = { id: 1, kind: 'cut' as const, points: [[0, 0], [10, 0], [10, 10]] as Vec2[], closed: false, page: 0, smooth: true };
    const item = cleanItem({ ...raw, handles: [corner, corner, corner] })!;
    expect(item.smooth).toBeUndefined();
    expect(item.handles).toHaveLength(3);
  });
});

// ─── Adding and removing points ──────────────────────────────────────────────

import { distanceToSegment, insertPoint, nearestOnItem, removePoint } from '../src/lib/papercraft-engine';

/** How far a point is from a line made of straight pieces (not just from its corners). */
const toLine = (p: Vec2, line: Vec2[]) => Math.min(...line.slice(1).map((q, i) => distanceToSegment(p, line[i]!, q)));

describe('finding the place on a line nearest to a point', () => {
  it('on a straight piece: the piece, how far along it and the distance', () => {
    const { doc, id } = docWith({ points: [[0, 0], [10, 0], [10, 10]] });
    const hit = nearestOnItem(itemOf(doc, id), [4, 3])!;
    expect(hit.edge).toBe(0);
    expect(hit.t).toBeCloseTo(0.4, 9);
    expect(hit.at).toEqual([4, 0]);
    expect(hit.distance).toBeCloseTo(3, 9);
    expect(nearestOnItem(itemOf(doc, id), [12, 6])!.edge).toBe(1);
  });

  it('includes the piece that closes a closed shape', () => {
    const { doc, id } = docWith({ points: [[0, 0], [10, 0], [10, 10], [0, 10]], closed: true });
    expect(nearestOnItem(itemOf(doc, id), [-2, 5])).toMatchObject({ edge: 3 });
    const open = docWith({ points: [[0, 0], [10, 0], [10, 10], [0, 10]], closed: false });
    expect(nearestOnItem(itemOf(open.doc, open.id), [-2, 5])!.edge).not.toBe(3);
  });

  it('on a Bézier curve: the nearest place on the curve, not on the line between the points', () => {
    const { doc, id } = docWith({ points: [[0, 0], [30, 0]] });
    const bez = itemOf(setHandle(setHandle(setBezier(doc, [id], true), id, 0, 'out', [0, 20], false), id, 1, 'in', [0, 20], false), id);
    const hit = nearestOnItem(bez, [15, 15])!;
    expect(hit.edge).toBe(0);
    expect(hit.t).toBeCloseTo(0.5, 2);
    expect(hit.at[1]).toBeCloseTo(15, 1);
    expect(hit.distance).toBeLessThan(0.1);
  });

  it('has nothing for a text', () => {
    const text = addItem(newDoc(), { kind: 'text', points: [[5, 5]], closed: false, text: '1' });
    expect(nearestOnItem(itemOf(text.doc, text.id!), [5, 5])).toBeNull();
  });
});

describe('adding a point', () => {
  it('to a straight line puts it on the line and keeps the shape', () => {
    const { doc, id } = docWith({ points: [[0, 0], [10, 0], [10, 10]] });
    const next = itemOf(insertPoint(doc, id, 0, 0.5), id);
    expect(next.points).toEqual([[0, 0], [5, 0], [10, 0], [10, 10]]);
    expect(next.handles).toBeUndefined();
    expect(flattenItem(next)).toEqual([[0, 0], [5, 0], [10, 0], [10, 10]]);
  });

  it('to the piece that closes a closed shape puts the point last', () => {
    const { doc, id } = docWith({ points: [[0, 0], [10, 0], [10, 10], [0, 10]], closed: true });
    expect(itemOf(insertPoint(doc, id, 3, 0.5), id).points).toEqual([[0, 0], [10, 0], [10, 10], [0, 10], [0, 5]]);
  });

  it('to a Bézier curve does not change the curve (the piece is cut in two with de Casteljau)', () => {
    const { doc, id } = docWith({ points: [[0, 0], [40, 10], [70, -10]], closed: false });
    let item = itemOf(setBezier(doc, [id], true), id);
    let d = setHandle(setHandle(setBezier(doc, [id], true), id, 0, 'out', [5, 25], false), id, 1, 'in', [-12, 6], false);
    d = setHandle(d, id, 1, 'out', [10, -8], false);
    item = itemOf(d, id);
    const next = itemOf(insertPoint(d, id, 0, 0.37), id);
    expect(next.points).toHaveLength(4);
    expect(next.handles).toHaveLength(4);
    // every point of the old curve is on the new one and the other way round (within the cutting resolution)
    const before = flattenItem(item);
    const after = flattenItem(next);
    const near = toLine;
    expect(Math.max(...before.map((p) => near(p, after)))).toBeLessThan(0.35);
    expect(Math.max(...after.map((p) => near(p, before)))).toBeLessThan(0.35);
    // the point is where the curve is, and the rest of the line is untouched
    const hit = nearestOnItem(item, next.points[1]!)!;
    expect(hit.distance).toBeLessThan(0.01);
    expect(next.points[0]).toEqual([0, 0]);
    expect(next.points[3]).toEqual([70, -10]);
    expect(next.handles![3]).toEqual(item.handles![2]);
  });

  it('to a closed Bézier curve works on the closing piece too', () => {
    const { doc, id } = docWith({ points: [[10, 10], [50, 10], [30, 50]], closed: true, smooth: true });
    const bez = setBezier(doc, [id], true);
    const next = itemOf(insertPoint(bez, id, 2, 0.5), id);
    expect(next.points).toHaveLength(4);
    const near = toLine;
    const before = flattenItem(itemOf(bez, id));
    expect(Math.max(...flattenItem(next).map((p) => near(p, before)))).toBeLessThan(0.35);
  });

  it('to a smooth curve first makes it the Bézier curve it would be, then adds the point', () => {
    const { doc, id } = docWith({ points: [[0, 0], [20, 15], [40, 0]], smooth: true });
    const next = itemOf(insertPoint(doc, id, 0, 0.5), id);
    expect(next.smooth).toBeUndefined();
    expect(next.handles).toHaveLength(4);
    const before = flattenItem(itemOf(doc, id));
    const near = toLine;
    expect(Math.max(...flattenItem(next).map((p) => near(p, before)))).toBeLessThan(1.2);
  });

  it('is refused near an end of the piece, for a piece that is not there and for a text', () => {
    const { doc, id } = docWith({ points: [[0, 0], [10, 0], [10, 10]] });
    expect(insertPoint(doc, id, 0, 0.01)).toBe(doc);
    expect(insertPoint(doc, id, 0, 0.99)).toBe(doc);
    expect(insertPoint(doc, id, 0, NaN)).toBe(doc);
    expect(itemOf(insertPoint(doc, id, 5, 0.5), id).points).toHaveLength(3);
    expect(itemOf(insertPoint(doc, id, 2, 0.5), id).points).toHaveLength(3); // an open line has no piece that closes it
    const text = addItem(newDoc(), { kind: 'text', points: [[5, 5]], closed: false, text: '1' });
    expect(itemOf(insertPoint(text.doc, text.id!, 0, 0.5), text.id!).points).toEqual([[5, 5]]);
  });

  it('is undone by taking the point away again (a straight line)', () => {
    const { doc, id } = docWith({ points: [[0, 0], [10, 0], [10, 10]] });
    const back = removePoint(insertPoint(doc, id, 0, 0.5), id, 1);
    expect(itemOf(back, id).points).toEqual([[0, 0], [10, 0], [10, 10]]);
  });
});

describe('taking a point away', () => {
  it('takes its handles with it and leaves the others', () => {
    const { doc, id } = docWith({ points: [[0, 0], [20, 10], [40, 0], [60, 10]], smooth: true });
    const bez = setBezier(doc, [id], true);
    const before = itemOf(bez, id);
    const next = itemOf(removePoint(bez, id, 1), id);
    expect(next.points).toEqual([[0, 0], [40, 0], [60, 10]]);
    expect(next.handles).toEqual([before.handles![0], before.handles![2], before.handles![3]]);
  });

  it('keeps at least two points in a line and three in a closed shape', () => {
    const line = docWith({ points: [[0, 0], [10, 0]] });
    expect(itemOf(removePoint(line.doc, line.id, 0), line.id).points).toHaveLength(2);
    const tri = docWith({ points: [[0, 0], [10, 0], [5, 8]], closed: true });
    expect(itemOf(removePoint(tri.doc, tri.id, 0), tri.id).points).toHaveLength(3);
    const quad = docWith({ points: [[0, 0], [10, 0], [10, 10], [0, 10]], closed: true });
    expect(itemOf(removePoint(quad.doc, quad.id, 2), quad.id).points).toEqual([[0, 0], [10, 0], [0, 10]]);
  });

  it('ignores a point that is not there and a text', () => {
    const { doc, id } = docWith({ points: [[0, 0], [10, 0], [10, 10]] });
    expect(itemOf(removePoint(doc, id, 7), id).points).toHaveLength(3);
    expect(itemOf(removePoint(doc, id, -1), id).points).toHaveLength(3);
    const text = addItem(newDoc(), { kind: 'text', points: [[5, 5]], closed: false, text: '1' });
    expect(itemOf(removePoint(text.doc, text.id!, 0), text.id!).points).toHaveLength(1);
  });

  it('a smooth line that loses its third point becomes straight', () => {
    const { doc, id } = docWith({ points: [[0, 0], [10, 5], [20, 0]], smooth: true });
    const next = itemOf(removePoint(doc, id, 1), id);
    expect(next.points).toHaveLength(2);
    expect(next.smooth).toBeUndefined();
  });
});
