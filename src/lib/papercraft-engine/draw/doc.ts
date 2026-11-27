import { strokeText } from '../export/strokeFont';
import type { PageDrawing } from '../export/render';
import type { Vec2 } from '../types';

/**
 * A pattern drawn by hand, flat: cut outlines (closed shapes or open lines), mountain and valley fold lines, and numbers. A document is
 * a sheet (millimetres, y up, the origin at the lower left corner) and a list of items; every operation returns a new document, so the
 * editor can keep a history. `drawingOf` turns a document into the same `PageDrawing` the studio's own patterns are drawn as, so the Cricut SVG,
 * the Silhouette DXF and the PDF come from the same code. Pure and deterministic; nothing here knows about the screen.
 */

export type DrawKind = 'cut' | 'mountain' | 'valley' | 'text';

export interface DrawItem {
  id: number;
  kind: DrawKind;
  /** A cut: its corners (a closed shape when `closed`, else an open line). A fold: the points of a line. A text: one point, its middle. */
  points: Vec2[];
  /** Only a cut can be closed. */
  closed: boolean;
  /** Only a text: digits and `- / . x` (what the stroke font has), its height in millimetres and its turn in degrees. */
  text?: string;
  heightMm?: number;
  angleDeg?: number;
  /** The page of the drawing the item is on (0 is the first). */
  page: number;
  /** The points are control points of a smooth curve that runs through them (a cut or a fold line with at least three points), not corners. */
  smooth?: boolean;
  /**
   * A Bézier curve: one pair of handles for each point (so as many as `points`), which makes each piece of the line between two points a cubic Bézier
   * curve. A point whose handles are both zero is a corner. An item with handles is not `smooth`.
   */
  handles?: BezierHandle[];
}

/** The two control points of a point on a Bézier curve, as distances from the point in millimetres: `in` is on the side the line comes from, `out` on the side it goes to. */
export interface BezierHandle {
  in: Vec2;
  out: Vec2;
}

/** What is given to make an item: the id is made here, and the page is the first unless it is said. */
export type NewDrawItem = Omit<DrawItem, 'id' | 'page'> & { page?: number };

export interface DrawDoc {
  name: string;
  sheet: { widthMm: number; heightMm: number };
  items: DrawItem[];
  nextId: number;
  /** How many pages (sheets of the same size) the drawing has. */
  pageCount: number;
}

export const DRAW_LIMITS = {
  sheet: { min: 20, max: 2000 },
  items: 2000,
  pointsPerItem: 2000,
  coordinate: 5000,
  textLength: 12,
  textHeightMm: { min: 1, max: 50 },
  pages: 20,
} as const;

export const TEXT_CHARACTERS = '0123456789-/.x';

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const clampCoord = (n: number) => clamp(n, -DRAW_LIMITS.coordinate, DRAW_LIMITS.coordinate);
/** To a thousandth of a millimetre: enough for any cutter, and it keeps rounding noise out of the saved file. */
const round = (n: number) => Math.round(n * 1000) / 1000;

export function newDoc(widthMm = 210, heightMm = 297, name = 'Drawing'): DrawDoc {
  return { name, sheet: { widthMm: clamp(widthMm, DRAW_LIMITS.sheet.min, DRAW_LIMITS.sheet.max), heightMm: clamp(heightMm, DRAW_LIMITS.sheet.min, DRAW_LIMITS.sheet.max) }, items: [], nextId: 1, pageCount: 1 };
}

// ─── Geometry ─────────────────────────────────────────────────────────────────

export function signedArea(points: readonly Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

export function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2, 0, 1);
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function pointInPolygon(p: Vec2, points: readonly Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!;
    const b = points[j]!;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function segmentsCross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const o = (p: Vec2, q: Vec2, r: Vec2) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a);
  const d2 = o(c, d, b);
  const d3 = o(a, b, c);
  const d4 = o(a, b, d);
  return d1 * d2 < -1e-9 && d3 * d4 < -1e-9;
}

/** True when two edges of the shape cross each other (edges that only share a corner do not count). */
export function selfIntersects(points: readonly Vec2[], closed = true): boolean {
  const n = points.length;
  const edges = closed ? n : n - 1;
  for (let i = 0; i < edges; i++) {
    for (let j = i + 1; j < edges; j++) {
      if (j === i + 1 || (closed && i === 0 && j === n - 1)) continue;
      if (segmentsCross(points[i]!, points[(i + 1) % n]!, points[j]!, points[(j + 1) % n]!)) return true;
    }
  }
  return false;
}

export function boundsOf(items: readonly DrawItem[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of items) for (const [x, y] of item.points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return minX <= maxX ? { minX, minY, maxX, maxY } : null;
}


// ─── Curves ───────────────────────────────────────────────────────────────────

/** True for an item whose line is not straight between its points: a smooth curve through them, or a Bézier curve with handles. */
export const isCurved = (item: Pick<DrawItem, 'smooth' | 'handles'>): boolean => item.smooth === true || item.handles !== undefined;

const hasHandle = (h: BezierHandle): boolean => h.in[0] !== 0 || h.in[1] !== 0 || h.out[0] !== 0 || h.out[1] !== 0;

/** The handles that make a Bézier curve pass through the points the way a smooth curve does (a Catmull-Rom spline), so a smooth item can be edited with handles and keep its shape. */
export function autoHandles(points: readonly Vec2[], closed: boolean): BezierHandle[] {
  const n = points.length;
  if (n < 2) return points.map(() => ({ in: [0, 0], out: [0, 0] }));
  const at = (i: number): Vec2 => {
    if (closed) return points[((i % n) + n) % n]!;
    if (i < 0) return [2 * points[0]![0] - points[1]![0], 2 * points[0]![1] - points[1]![1]];
    if (i >= n) return [2 * points[n - 1]![0] - points[n - 2]![0], 2 * points[n - 1]![1] - points[n - 2]![1]];
    return points[i]!;
  };
  return points.map((_, i): BezierHandle => {
    const a = at(i - 1);
    const b = at(i + 1);
    const out: Vec2 = [round((b[0] - a[0]) / 6), round((b[1] - a[1]) / 6)];
    // `0 - n` keeps a zero as 0 (not -0), so a saved and opened drawing is equal to the one that was saved.
    return { in: [0 - out[0], 0 - out[1]], out };
  });
}

/** The pieces of a Bézier line, cut into straight pieces about a millimetre long. A piece with no handle at either end is a straight line. */
function flattenBezier(points: readonly Vec2[], handles: readonly BezierHandle[], closed: boolean): Vec2[] {
  const n = points.length;
  const segments = closed ? n : n - 1;
  const out: Vec2[] = [];
  for (let i = 0; i < segments; i++) {
    const a = points[i]!;
    const j = (i + 1) % n;
    const b = points[j]!;
    const ho = handles[i]!.out;
    const hi = handles[j]!.in;
    out.push([a[0], a[1]]);
    if (ho[0] === 0 && ho[1] === 0 && hi[0] === 0 && hi[1] === 0) continue;
    const c1: Vec2 = [a[0] + ho[0], a[1] + ho[1]];
    const c2: Vec2 = [b[0] + hi[0], b[1] + hi[1]];
    const length = Math.hypot(c1[0] - a[0], c1[1] - a[1]) + Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) + Math.hypot(b[0] - c2[0], b[1] - c2[1]);
    const steps = Math.min(80, Math.max(6, Math.ceil(length)));
    for (let k = 1; k < steps; k++) {
      const t = k / steps;
      const m = 1 - t;
      const w0 = m * m * m;
      const w1 = 3 * m * m * t;
      const w2 = 3 * m * t * t;
      const w3 = t * t * t;
      out.push([round(w0 * a[0] + w1 * c1[0] + w2 * c2[0] + w3 * b[0]), round(w0 * a[1] + w1 * c1[1] + w2 * c2[1] + w3 * b[1])]);
    }
  }
  if (!closed) out.push([points[n - 1]![0], points[n - 1]![1]]);
  return out;
}

/**
 * The points a curved item is drawn and cut along. A Bézier item (with handles) is its cubic Bézier pieces. A smooth item is a centripetal Catmull-Rom curve through its control points (closed for a closed shape),
 * cut into short straight pieces about a millimetre long (a cutter or an SVG path takes straight pieces). A straight item is its own points.
 */
export function flattenItem(item: Pick<DrawItem, 'points' | 'closed' | 'smooth' | 'handles'>): Vec2[] {
  const raw = item.points;
  if (item.handles && item.handles.length === raw.length && raw.length >= 2) return flattenBezier(raw, item.handles, item.closed);
  if (!item.smooth || raw.length < 3) return raw.map((p): Vec2 => [p[0], p[1]]);
  // Points on top of each other would make the curve undefined.
  const pts: Vec2[] = [];
  for (const p of raw) if (pts.length === 0 || Math.hypot(p[0] - pts[pts.length - 1]![0], p[1] - pts[pts.length - 1]![1]) > 1e-6) pts.push(p);
  if (item.closed && pts.length > 1 && Math.hypot(pts[0]![0] - pts[pts.length - 1]![0], pts[0]![1] - pts[pts.length - 1]![1]) <= 1e-6) pts.pop();
  const n = pts.length;
  if (n < 3) return pts.map((p): Vec2 => [p[0], p[1]]);
  const at = (i: number): Vec2 => {
    if (item.closed) return pts[((i % n) + n) % n]!;
    if (i < 0) return [2 * pts[0]![0] - pts[1]![0], 2 * pts[0]![1] - pts[1]![1]];
    if (i >= n) return [2 * pts[n - 1]![0] - pts[n - 2]![0], 2 * pts[n - 1]![1] - pts[n - 2]![1]];
    return pts[i]!;
  };
  const segments = item.closed ? n : n - 1;
  const out: Vec2[] = [];
  for (let i = 0; i < segments; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const knot = (a: Vec2, b: Vec2) => Math.max(Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5), 1e-6);
    const t0 = 0;
    const t1 = t0 + knot(p0, p1);
    const t2 = t1 + knot(p1, p2);
    const t3 = t2 + knot(p2, p3);
    const steps = Math.min(60, Math.max(4, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]))));
    out.push([p1[0], p1[1]]);
    for (let k = 1; k < steps; k++) {
      const t = t1 + ((t2 - t1) * k) / steps;
      const mix = (a: Vec2, b: Vec2, ta: number, tb: number): Vec2 => {
        const w = (t - ta) / (tb - ta);
        return [a[0] * (1 - w) + b[0] * w, a[1] * (1 - w) + b[1] * w];
      };
      const a1 = mix(p0, p1, t0, t1);
      const a2 = mix(p1, p2, t1, t2);
      const a3 = mix(p2, p3, t2, t3);
      const b1 = mix(a1, a2, t0, t2);
      const b2 = mix(a2, a3, t1, t3);
      const c = mix(b1, b2, t1, t2);
      out.push([round(c[0]), round(c[1])]);
    }
  }
  if (!item.closed) out.push([pts[n - 1]![0], pts[n - 1]![1]]);
  return out;
}

// ─── Shapes ───────────────────────────────────────────────────────────────────

/** A rectangle, counter-clockwise from its lower left corner. */
export function rectanglePoints(x0: number, y0: number, x1: number, y1: number): Vec2[] {
  const [lx, hx] = x0 <= x1 ? [x0, x1] : [x1, x0];
  const [ly, hy] = y0 <= y1 ? [y0, y1] : [y1, y0];
  return [[lx, ly], [hx, ly], [hx, hy], [lx, hy]];
}

/** A regular polygon round (cx, cy), counter-clockwise, its first corner `startDeg` from the x axis. With many sides it is a circle. */
export function regularPolygonPoints(cx: number, cy: number, radius: number, sides: number, startDeg = 0): Vec2[] {
  const n = Math.round(clamp(sides, 3, 200));
  return Array.from({ length: n }, (_, i): Vec2 => {
    const a = ((startDeg + (360 * i) / n) * Math.PI) / 180;
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
  });
}

// ─── Cleaning ─────────────────────────────────────────────────────────────────

/** An item with every number in range and the rules of its kind kept; null when nothing is left of it. */
export function cleanItem(item: Omit<DrawItem, 'page'> & { page?: number }): DrawItem | null {
  const kind: DrawKind = (['cut', 'mountain', 'valley', 'text'] as const).includes(item.kind) ? item.kind : 'cut';
  const points = (Array.isArray(item.points) ? item.points : [])
    .filter((p) => Array.isArray(p) && finite(p[0]) && finite(p[1]))
    .slice(0, DRAW_LIMITS.pointsPerItem)
    .map((p): Vec2 => [round(clampCoord(p[0])), round(clampCoord(p[1]))]);
  const id = Number.isInteger(item.id) && item.id > 0 ? item.id : 1;
  const page = finite(item.page) && Number.isInteger(item.page) ? clamp(item.page, 0, DRAW_LIMITS.pages - 1) : 0;
  if (kind === 'text') {
    const text = [...String(item.text ?? '')].filter((c) => TEXT_CHARACTERS.includes(c)).join('').slice(0, DRAW_LIMITS.textLength);
    if (points.length < 1 || !text) return null;
    return {
      id,
      kind,
      page,
      points: [points[0]!],
      closed: false,
      text,
      heightMm: clamp(finite(item.heightMm) ? item.heightMm : 4, DRAW_LIMITS.textHeightMm.min, DRAW_LIMITS.textHeightMm.max),
      angleDeg: finite(item.angleDeg) ? clamp(item.angleDeg, -360, 360) : 0,
    };
  }
  const closed = kind === 'cut' && item.closed === true && points.length >= 3;
  if (points.length < 2) return null;
  const handles = cleanHandles(item.handles, points.length);
  // Handles make a Bézier curve; the smooth flag is only for the other kind of curve.
  return { id, kind, page, points, closed, ...(handles ? { handles } : item.smooth === true && points.length >= 3 ? { smooth: true } : {}) };
}

/** The handles of an item, with every number in range; undefined when there are none or they do not fit the points (one pair for each). */
function cleanHandles(raw: unknown, count: number): BezierHandle[] | undefined {
  if (!Array.isArray(raw) || raw.length !== count) return undefined;
  const offset = (v: unknown): Vec2 | null => (Array.isArray(v) && finite(v[0]) && finite(v[1]) ? [round(clampCoord(v[0])), round(clampCoord(v[1]))] : null);
  const out: BezierHandle[] = [];
  for (const h of raw) {
    const a = h && typeof h === 'object' ? offset((h as BezierHandle).in) : null;
    const b = h && typeof h === 'object' ? offset((h as BezierHandle).out) : null;
    if (!a || !b) return undefined;
    out.push({ in: a, out: b });
  }
  return out;
}

// ─── Operations ───────────────────────────────────────────────────────────────

function replaceItems(doc: DrawDoc, items: DrawItem[]): DrawDoc {
  return { ...doc, items };
}

/** Adds an item (the id is made here). Returns the new document and the id, or the same document and null when the item is not valid or the sheet is full. */
export function addItem(doc: DrawDoc, spec: NewDrawItem): { doc: DrawDoc; id: number | null } {
  if (doc.items.length >= DRAW_LIMITS.items) return { doc, id: null };
  const made = cleanItem({ ...spec, id: doc.nextId });
  if (!made) return { doc, id: null };
  // An item is on a page the drawing has.
  const item = made.page >= doc.pageCount ? { ...made, page: doc.pageCount - 1 } : made;
  return { doc: { ...doc, items: [...doc.items, item], nextId: doc.nextId + 1 }, id: item.id };
}

// ─── Pages ────────────────────────────────────────────────────────────────────

/** The items on one page. */
export function itemsOnPage(doc: DrawDoc, page: number): DrawItem[] {
  return doc.items.filter((i) => i.page === page);
}

/** The drawing as seen from one page: only that page's items. Used to find things on the page being worked on. */
export function pageView(doc: DrawDoc, page: number): DrawDoc {
  return { ...doc, items: itemsOnPage(doc, page) };
}

/** A new empty page at the end (at most `DRAW_LIMITS.pages`). */
export function addPage(doc: DrawDoc): DrawDoc {
  return doc.pageCount >= DRAW_LIMITS.pages ? doc : { ...doc, pageCount: doc.pageCount + 1 };
}

/** Takes a page away with what is on it; the pages after it move up by one. The last page cannot be removed. */
export function removePage(doc: DrawDoc, page: number): DrawDoc {
  if (doc.pageCount <= 1 || page < 0 || page >= doc.pageCount) return doc;
  return {
    ...doc,
    pageCount: doc.pageCount - 1,
    items: doc.items.filter((i) => i.page !== page).map((i) => (i.page > page ? { ...i, page: i.page - 1 } : i)),
  };
}

/** Moves items to another page. */
export function moveToPage(doc: DrawDoc, ids: readonly number[], page: number): DrawDoc {
  if (!Number.isInteger(page) || page < 0 || page >= doc.pageCount) return doc;
  return mapItems(doc, ids, (i) => ({ ...i, page }));
}

export function removeItems(doc: DrawDoc, ids: readonly number[]): DrawDoc {
  const set = new Set(ids);
  return set.size === 0 ? doc : replaceItems(doc, doc.items.filter((i) => !set.has(i.id)));
}

function mapItems(doc: DrawDoc, ids: readonly number[], f: (item: DrawItem) => DrawItem): DrawDoc {
  const set = new Set(ids);
  if (set.size === 0) return doc;
  const items: DrawItem[] = [];
  for (const item of doc.items) {
    if (!set.has(item.id)) {
      items.push(item);
      continue;
    }
    const next = cleanItem(f(item));
    if (next) items.push(next);
  }
  return replaceItems(doc, items);
}

export function moveItems(doc: DrawDoc, ids: readonly number[], dx: number, dy: number): DrawDoc {
  if (!finite(dx) || !finite(dy)) return doc;
  return mapItems(doc, ids, (i) => ({ ...i, points: i.points.map((p): Vec2 => [p[0] + dx, p[1] + dy]) }));
}

/** Moves one corner of an item. */
export function setItemPoint(doc: DrawDoc, id: number, index: number, to: Vec2): DrawDoc {
  return mapItems(doc, [id], (i) => (index < 0 || index >= i.points.length ? i : { ...i, points: i.points.map((p, k): Vec2 => (k === index ? to : p)) }));
}

/** Where the items are as a whole: the middle of their bounding box. */
function centreOf(doc: DrawDoc, ids: readonly number[]): Vec2 | null {
  const b = boundsOf(doc.items.filter((i) => ids.includes(i.id)));
  return b ? [(b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2] : null;
}

/** Turns items together about the middle of their bounding box, counter-clockwise by `degrees`. */
export function rotateItems(doc: DrawDoc, ids: readonly number[], degrees: number): DrawDoc {
  const c = centreOf(doc, ids);
  if (!c || !finite(degrees)) return doc;
  const a = (degrees * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const turnOffset = (o: Vec2): Vec2 => [o[0] * cos - o[1] * sin, o[0] * sin + o[1] * cos];
  return mapItems(doc, ids, (i) => ({
    ...i,
    points: i.points.map((p): Vec2 => [c[0] + (p[0] - c[0]) * cos - (p[1] - c[1]) * sin, c[1] + (p[0] - c[0]) * sin + (p[1] - c[1]) * cos]),
    ...(i.handles ? { handles: i.handles.map((h): BezierHandle => ({ in: turnOffset(h.in), out: turnOffset(h.out) })) } : {}),
    ...(i.kind === 'text' ? { angleDeg: (i.angleDeg ?? 0) + degrees } : {}),
  }));
}

/** A mirror image of the items about the middle of their bounding box: `horizontal` swaps left and right, `vertical` top and bottom. */
export function mirrorItems(doc: DrawDoc, ids: readonly number[], axis: 'horizontal' | 'vertical'): DrawDoc {
  const c = centreOf(doc, ids);
  if (!c) return doc;
  const flip = (o: Vec2): Vec2 => (axis === 'horizontal' ? [-o[0], o[1]] : [o[0], -o[1]]);
  return mapItems(doc, ids, (i) => ({
    ...i,
    points: i.points.map((p): Vec2 => (axis === 'horizontal' ? [2 * c[0] - p[0], p[1]] : [p[0], 2 * c[1] - p[1]])),
    ...(i.handles ? { handles: i.handles.map((h): BezierHandle => ({ in: flip(h.in), out: flip(h.out) })) } : {}),
  }));
}

/** Scales the items together about the middle of their bounding box. */
export function scaleItems(doc: DrawDoc, ids: readonly number[], factor: number): DrawDoc {
  const c = centreOf(doc, ids);
  if (!c || !finite(factor) || factor <= 0) return doc;
  const grow = (o: Vec2): Vec2 => [o[0] * factor, o[1] * factor];
  return mapItems(doc, ids, (i) => ({
    ...i,
    points: i.points.map((p): Vec2 => [c[0] + (p[0] - c[0]) * factor, c[1] + (p[1] - c[1]) * factor]),
    ...(i.handles ? { handles: i.handles.map((h): BezierHandle => ({ in: grow(h.in), out: grow(h.out) })) } : {}),
  }));
}

/** Copies of the items, moved by (dx, dy). Returns the new document and the ids of the copies. */
export function duplicateItems(doc: DrawDoc, ids: readonly number[], dx: number, dy: number): { doc: DrawDoc; ids: number[] } {
  let next = doc;
  const made: number[] = [];
  for (const item of doc.items.filter((i) => ids.includes(i.id))) {
    const { id: _id, ...spec } = item;
    void _id;
    const added = addItem(next, { ...spec, points: item.points.map((p): Vec2 => [p[0] + dx, p[1] + dy]) });
    next = added.doc;
    if (added.id !== null) made.push(added.id);
  }
  return { doc: next, ids: made };
}

/** Mountain folds become valley folds and the other way round. Other items are left as they are. */
export function flipFolds(doc: DrawDoc, ids: readonly number[]): DrawDoc {
  return mapItems(doc, ids, (i) => (i.kind === 'mountain' ? { ...i, kind: 'valley' } : i.kind === 'valley' ? { ...i, kind: 'mountain' } : i));
}

/** Makes items smooth curves through their points, or straight pieces between them again. A text, and an item with fewer than three points, stays as it is. */
export function setSmooth(doc: DrawDoc, ids: readonly number[], smooth: boolean): DrawDoc {
  return mapItems(doc, ids, (i) => {
    if (i.kind === 'text' || i.points.length < 3) return i;
    // Straight is no flag at all, so an item is either smooth or has no `smooth` (never `false`). An item with handles stops being a Bézier curve.
    const { smooth: _was, handles: _handles, ...rest } = i;
    void _was;
    void _handles;
    return smooth ? { ...rest, smooth: true } : rest;
  });
}

/**
 * Makes items Bézier curves, with a pair of handles at each point, or takes the handles away (the line is then straight between the points again).
 * A smooth item keeps its shape (its handles are the ones that give the same curve); a straight item gets handles of length zero, so it keeps its
 * corners until a handle is pulled out of one (`toggleCorner` gives a point its handles). A text stays as it is.
 */
export function setBezier(doc: DrawDoc, ids: readonly number[], on: boolean): DrawDoc {
  return mapItems(doc, ids, (i) => {
    if (i.kind === 'text' || i.points.length < 2) return i;
    const { smooth: _was, handles: _handles, ...rest } = i;
    void _was;
    void _handles;
    if (!on) return rest;
    if (i.handles) return i;
    return { ...rest, handles: i.smooth ? autoHandles(i.points, i.closed) : i.points.map((): BezierHandle => ({ in: [0, 0], out: [0, 0] })) };
  });
}

/**
 * Moves one handle of a point of a Bézier item to `offset` (a distance from the point). With `mirror` the other handle of the point is the same
 * distance the other way, which keeps the curve smooth through the point; without it the other handle stays, which makes a corner.
 */
export function setHandle(doc: DrawDoc, id: number, index: number, which: 'in' | 'out', offset: Vec2, mirror = true): DrawDoc {
  if (!finite(offset[0]) || !finite(offset[1])) return doc;
  return mapItems(doc, [id], (i) => {
    if (!i.handles || index < 0 || index >= i.handles.length) return i;
    const other = which === 'in' ? 'out' : 'in';
    const handles = i.handles.map((h, k): BezierHandle => (k !== index ? h : { ...h, [which]: offset, ...(mirror ? { [other]: [0 - offset[0], 0 - offset[1]] } : {}) }));
    return { ...i, handles };
  });
}

/** A point of a Bézier item that has handles becomes a corner (its handles go to zero); a corner gets handles that make the curve smooth through it. */
export function toggleCorner(doc: DrawDoc, id: number, index: number): DrawDoc {
  return mapItems(doc, [id], (i) => {
    if (!i.handles || index < 0 || index >= i.handles.length) return i;
    const now = i.handles[index]!;
    const next: BezierHandle = hasHandle(now) ? { in: [0, 0], out: [0, 0] } : autoHandles(i.points, i.closed)[index]!;
    return { ...i, handles: i.handles.map((h, k) => (k === index ? next : h)) };
  });
}

export interface HandleHit {
  index: number;
  which: 'in' | 'out';
}

/** The handle of a Bézier item that is at a place, within `tolMm`. A handle of length zero is not there to be hit. The one nearer is taken. */
export function hitHandle(item: DrawItem, p: Vec2, tolMm: number): HandleHit | null {
  if (!item.handles) return null;
  let best: HandleHit | null = null;
  let bestDistance = tolMm;
  item.handles.forEach((h, index) => {
    const at = item.points[index];
    if (!at) return;
    for (const which of ['in', 'out'] as const) {
      const o = h[which];
      if (o[0] === 0 && o[1] === 0) continue;
      const d = Math.hypot(at[0] + o[0] - p[0], at[1] + o[1] - p[1]);
      if (d <= bestDistance) {
        best = { index, which };
        bestDistance = d;
      }
    }
  });
  return best;
}

export function setText(doc: DrawDoc, id: number, patch: { text?: string; heightMm?: number }): DrawDoc {
  return mapItems(doc, [id], (i) => (i.kind === 'text' ? { ...i, ...patch } : i));
}

export interface TabOptions {
  /** How far the tab reaches out from the edge. */
  widthMm: number;
  /** The angle of its sides to the edge, in degrees (45 is usual). */
  angleDeg: number;
}

export const DEFAULT_TAB: TabOptions = { widthMm: 8, angleDeg: 45 };

/**
 * A glue tab on one edge of a closed cut shape: the shape gets the two extra corners of the tab (so the tab is part of the outline, as in a real
 * pattern), and a valley fold line is drawn along the edge. Edge `edge` runs from corner `edge` to the next. Returns the document unchanged
 * for an open shape, a missing edge or an edge that is too short. A tab on the edge of a fold line that is already there is not doubled.
 */
export function addTab(doc: DrawDoc, id: number, edge: number, options: Partial<TabOptions> = {}): { doc: DrawDoc; added: boolean } {
  const item = doc.items.find((i) => i.id === id);
  if (!item || item.kind !== 'cut' || !item.closed || isCurved(item) || edge < 0 || edge >= item.points.length) return { doc, added: false };
  const o = { ...DEFAULT_TAB, ...options };
  const width = clamp(finite(o.widthMm) ? o.widthMm : DEFAULT_TAB.widthMm, 1, 100);
  const angle = clamp(finite(o.angleDeg) ? o.angleDeg : DEFAULT_TAB.angleDeg, 20, 90);
  const n = item.points.length;
  const a = item.points[edge]!;
  const b = item.points[(edge + 1) % n]!;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length < 2) return { doc, added: false };
  const dir: Vec2 = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  // Out of the shape: to the right of the edge when the shape runs counter-clockwise, to the left when it runs clockwise.
  const sign = signedArea(item.points) >= 0 ? 1 : -1;
  const out: Vec2 = [sign * dir[1], -sign * dir[0]];
  const inset = Math.min(width / Math.tan((angle * Math.PI) / 180), length * 0.4);
  const a2: Vec2 = [a[0] + out[0] * width + dir[0] * inset, a[1] + out[1] * width + dir[1] * inset];
  const b2: Vec2 = [b[0] + out[0] * width - dir[0] * inset, b[1] + out[1] * width - dir[1] * inset];
  const points = [...item.points.slice(0, edge + 1), a2, b2, ...item.points.slice(edge + 1)];
  let next = mapItems(doc, [id], (i) => ({ ...i, points }));
  const near = (p: Vec2, q: Vec2) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.01;
  const already = doc.items.some((i) => (i.kind === 'valley' || i.kind === 'mountain') && i.points.length === 2 && ((near(i.points[0]!, a) && near(i.points[1]!, b)) || (near(i.points[0]!, b) && near(i.points[1]!, a))));
  if (!already) next = addItem(next, { kind: 'valley', points: [a, b], closed: false, page: item.page }).doc;
  return { doc: next, added: true };
}

// ─── Finding things on the sheet ──────────────────────────────────────────────

export interface Hit {
  id: number;
  /** The corner that was hit, if the point is at one. */
  vertex: number | null;
  /** The edge that was hit (from corner `edge` to the next), if the point is on one. */
  edge: number | null;
}

/**
 * The item at a point, within `tolMm`: corners first, then edges and lines, then the inside of a closed shape (the smallest one when shapes lie
 * inside each other). Later items are on top.
 */
export function hitTest(doc: DrawDoc, p: Vec2, tolMm: number, only?: readonly number[]): Hit | null {
  const items = only ? doc.items.filter((i) => only.includes(i.id)) : doc.items;
  for (let k = items.length - 1; k >= 0; k--) {
    const item = items[k]!;
    const v = item.points.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) <= tolMm);
    if (v >= 0) return { id: item.id, vertex: v, edge: null };
  }
  for (let k = items.length - 1; k >= 0; k--) {
    const item = items[k]!;
    if (item.kind === 'text') {
      const q = item.points[0]!;
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) <= Math.max(tolMm, (item.heightMm ?? 4) * 1.5)) return { id: item.id, vertex: null, edge: null };
      continue;
    }
    // A curved item is hit along its curve; only a straight edge can be told apart (for a glue tab).
    const line = flattenItem(item);
    const n = line.length;
    const edges = item.closed ? n : n - 1;
    for (let i = 0; i < edges; i++) if (distanceToSegment(p, line[i]!, line[(i + 1) % n]!) <= tolMm) return { id: item.id, vertex: null, edge: isCurved(item) ? null : i };
  }
  let best: DrawItem | null = null;
  let bestArea = Infinity;
  for (const item of items) {
    const outline = flattenItem(item);
    if (item.kind !== 'cut' || !item.closed || !pointInPolygon(p, outline)) continue;
    const area = Math.abs(signedArea(outline));
    if (area <= bestArea) {
      best = item;
      bestArea = area;
    }
  }
  return best ? { id: best.id, vertex: null, edge: null } : null;
}

/** A point snapped to a corner of another item within `tolMm`, else to the grid (if there is one). */
export function snapPoint(doc: DrawDoc, p: Vec2, options: { gridMm: number; tolMm: number; exclude?: readonly number[] }): Vec2 {
  let best: Vec2 | null = null;
  let bestDist = options.tolMm;
  for (const item of doc.items) {
    if (options.exclude?.includes(item.id)) continue;
    for (const q of item.points) {
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d <= bestDist) {
        best = q;
        bestDist = d;
      }
    }
  }
  if (best) return best;
  return options.gridMm > 0 ? [Math.round(p[0] / options.gridMm) * options.gridMm, Math.round(p[1] / options.gridMm) * options.gridMm] : p;
}

// ─── Checks ───────────────────────────────────────────────────────────────────

export type DrawProblemCode = 'outside-sheet' | 'self-intersecting' | 'open-outline' | 'tiny' | 'nothing-to-cut' | 'empty-page';

export interface DrawProblem {
  code: DrawProblemCode;
  itemId?: number;
  /** The page, for a page with nothing on it. */
  page?: number;
}

/** What may be wrong with the drawing before it is cut: parts off the sheet, outlines that cross themselves, open outlines, specks. */
export function drawProblems(doc: DrawDoc): DrawProblem[] {
  const problems: DrawProblem[] = [];
  if (!doc.items.some((i) => i.kind === 'cut')) problems.push({ code: 'nothing-to-cut' });
  if (doc.pageCount > 1) for (let page = 0; page < doc.pageCount; page++) if (!doc.items.some((i) => i.page === page)) problems.push({ code: 'empty-page', page });
  const eps = 0.01;
  for (const item of doc.items) {
    const shown = isCurved(item) ? flattenItem(item) : item.points;
    const b = boundsOf([{ ...item, points: shown }])!;
    if (b.minX < -eps || b.minY < -eps || b.maxX > doc.sheet.widthMm + eps || b.maxY > doc.sheet.heightMm + eps) problems.push({ code: 'outside-sheet', itemId: item.id });
    if (item.kind === 'text') continue;
    if (Math.max(b.maxX - b.minX, b.maxY - b.minY) < 0.5) problems.push({ code: 'tiny', itemId: item.id });
    if (item.kind === 'cut') {
      if (item.closed && selfIntersects(shown, true)) problems.push({ code: 'self-intersecting', itemId: item.id });
      if (!item.closed && item.points.length >= 3) problems.push({ code: 'open-outline', itemId: item.id });
    }
  }
  return problems;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface DrawingOptions {
  /** Make the sheet only as big as the drawing (plus the margin), not as big as the paper. */
  crop?: boolean;
  marginMm?: number;
  /** The page to draw (0 is the first). */
  page?: number;
}

/** The drawing as the studio's exporters take it: cut outlines, folds (mountain or valley) and numbers as strokes. */
export function drawingOf(doc: DrawDoc, options: DrawingOptions = {}): PageDrawing {
  const cut: PageDrawing['cut'] = [];
  const folds: PageDrawing['folds'] = [];
  const text: Vec2[][] = [];
  const page = options.page ?? 0;
  const here = doc.items.filter((i) => i.page === page);
  for (const item of here) {
    if (item.kind === 'cut') cut.push({ points: flattenItem(item), closed: item.closed });
    else if (item.kind === 'text') {
      const p = item.points[0]!;
      text.push(...strokeText(item.text ?? '', p[0], p[1], item.heightMm ?? 4, ((item.angleDeg ?? 0) * Math.PI) / 180));
    } else {
      const line = flattenItem(item);
      for (let i = 1; i < line.length; i++) folds.push({ a: line[i - 1]!, b: line[i]!, kind: item.kind });
    }
  }
  let width = doc.sheet.widthMm;
  let height = doc.sheet.heightMm;
  if (options.crop) {
    const all: DrawItem[] = [
      ...here.filter((i) => i.kind !== 'text').map((i) => ({ ...i, points: flattenItem(i) })),
      ...text.map((points, k): DrawItem => ({ id: -k - 1, kind: 'cut', page, points, closed: false })),
    ];
    const b = boundsOf(all);
    if (b) {
      const m = options.marginMm ?? 5;
      const move = (p: Vec2): Vec2 => [p[0] - b.minX + m, p[1] - b.minY + m];
      for (const c of cut) c.points = c.points.map(move);
      for (const f of folds) {
        f.a = move(f.a);
        f.b = move(f.b);
      }
      for (let k = 0; k < text.length; k++) text[k] = text[k]!.map(move);
      width = b.maxX - b.minX + 2 * m;
      height = b.maxY - b.minY + 2 * m;
    }
  }
  return { widthMm: width, heightMm: height, cut, folds, text, fills: [], texts: [] };
}

/** Every page of the drawing, in order, as the exporters take them. */
export function drawingsOf(doc: DrawDoc, options: Omit<DrawingOptions, 'page'> = {}): PageDrawing[] {
  return Array.from({ length: doc.pageCount }, (_, page) => drawingOf(doc, { ...options, page }));
}

// ─── Saving ───────────────────────────────────────────────────────────────────

export interface SerializedDrawing {
  version: 1;
  kind: 'papercraft-drawing';
  doc: DrawDoc;
}

export function serializeDoc(doc: DrawDoc): SerializedDrawing {
  return { version: 1, kind: 'papercraft-drawing', doc: { ...doc, items: doc.items.map((i) => ({ ...i, points: i.points.map((p): Vec2 => [p[0], p[1]]), ...(i.handles ? { handles: i.handles.map((h): BezierHandle => ({ in: [h.in[0], h.in[1]], out: [h.out[0], h.out[1]] })) } : {}) })) } };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The document a saved drawing stands for, or null when the data is not one of ours. Numbers out of range are brought back; items that make no sense are dropped. */
export function parseDoc(data: unknown): DrawDoc | null {
  if (!isRecord(data) || data.version !== 1 || data.kind !== 'papercraft-drawing' || !isRecord(data.doc)) return null;
  const raw = data.doc;
  if (!isRecord(raw.sheet) || !finite(raw.sheet.widthMm) || !finite(raw.sheet.heightMm) || !Array.isArray(raw.items)) return null;
  let doc = newDoc(raw.sheet.widthMm, raw.sheet.heightMm, typeof raw.name === 'string' ? raw.name.slice(0, 120) : 'Drawing');
  const used = new Set<number>();
  let maxId = 0;
  const items: DrawItem[] = [];
  for (const candidate of raw.items.slice(0, DRAW_LIMITS.items)) {
    if (!isRecord(candidate)) continue;
    const item = cleanItem(candidate as unknown as DrawItem);
    if (!item || used.has(item.id)) continue;
    used.add(item.id);
    maxId = Math.max(maxId, item.id);
    items.push(item);
  }
  const highest = items.reduce((m, i) => Math.max(m, i.page), 0);
  const asked = finite(raw.pageCount) ? Math.round(raw.pageCount) : 1;
  doc = { ...doc, items, nextId: maxId + 1, pageCount: clamp(Math.max(asked, highest + 1), 1, DRAW_LIMITS.pages) };
  return doc;
}
