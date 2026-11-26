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
}

export interface DrawDoc {
  name: string;
  sheet: { widthMm: number; heightMm: number };
  items: DrawItem[];
  nextId: number;
}

export const DRAW_LIMITS = {
  sheet: { min: 20, max: 2000 },
  items: 2000,
  pointsPerItem: 2000,
  coordinate: 5000,
  textLength: 12,
  textHeightMm: { min: 1, max: 50 },
} as const;

export const TEXT_CHARACTERS = '0123456789-/.x';

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const clampCoord = (n: number) => clamp(n, -DRAW_LIMITS.coordinate, DRAW_LIMITS.coordinate);
/** To a thousandth of a millimetre: enough for any cutter, and it keeps rounding noise out of the saved file. */
const round = (n: number) => Math.round(n * 1000) / 1000;

export function newDoc(widthMm = 210, heightMm = 297, name = 'Drawing'): DrawDoc {
  return { name, sheet: { widthMm: clamp(widthMm, DRAW_LIMITS.sheet.min, DRAW_LIMITS.sheet.max), heightMm: clamp(heightMm, DRAW_LIMITS.sheet.min, DRAW_LIMITS.sheet.max) }, items: [], nextId: 1 };
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
export function cleanItem(item: DrawItem): DrawItem | null {
  const kind: DrawKind = (['cut', 'mountain', 'valley', 'text'] as const).includes(item.kind) ? item.kind : 'cut';
  const points = (Array.isArray(item.points) ? item.points : [])
    .filter((p) => Array.isArray(p) && finite(p[0]) && finite(p[1]))
    .slice(0, DRAW_LIMITS.pointsPerItem)
    .map((p): Vec2 => [round(clampCoord(p[0])), round(clampCoord(p[1]))]);
  const id = Number.isInteger(item.id) && item.id > 0 ? item.id : 1;
  if (kind === 'text') {
    const text = [...String(item.text ?? '')].filter((c) => TEXT_CHARACTERS.includes(c)).join('').slice(0, DRAW_LIMITS.textLength);
    if (points.length < 1 || !text) return null;
    return {
      id,
      kind,
      points: [points[0]!],
      closed: false,
      text,
      heightMm: clamp(finite(item.heightMm) ? item.heightMm : 4, DRAW_LIMITS.textHeightMm.min, DRAW_LIMITS.textHeightMm.max),
      angleDeg: finite(item.angleDeg) ? clamp(item.angleDeg, -360, 360) : 0,
    };
  }
  const closed = kind === 'cut' && item.closed === true && points.length >= 3;
  if (points.length < 2) return null;
  return { id, kind, points, closed };
}

// ─── Operations ───────────────────────────────────────────────────────────────

function replaceItems(doc: DrawDoc, items: DrawItem[]): DrawDoc {
  return { ...doc, items };
}

/** Adds an item (the id is made here). Returns the new document and the id, or the same document and null when the item is not valid or the sheet is full. */
export function addItem(doc: DrawDoc, spec: Omit<DrawItem, 'id'>): { doc: DrawDoc; id: number | null } {
  if (doc.items.length >= DRAW_LIMITS.items) return { doc, id: null };
  const item = cleanItem({ ...spec, id: doc.nextId });
  if (!item) return { doc, id: null };
  return { doc: { ...doc, items: [...doc.items, item], nextId: doc.nextId + 1 }, id: item.id };
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
  return mapItems(doc, ids, (i) => ({
    ...i,
    points: i.points.map((p): Vec2 => [c[0] + (p[0] - c[0]) * cos - (p[1] - c[1]) * sin, c[1] + (p[0] - c[0]) * sin + (p[1] - c[1]) * cos]),
    ...(i.kind === 'text' ? { angleDeg: (i.angleDeg ?? 0) + degrees } : {}),
  }));
}

/** A mirror image of the items about the middle of their bounding box: `horizontal` swaps left and right, `vertical` top and bottom. */
export function mirrorItems(doc: DrawDoc, ids: readonly number[], axis: 'horizontal' | 'vertical'): DrawDoc {
  const c = centreOf(doc, ids);
  if (!c) return doc;
  return mapItems(doc, ids, (i) => ({ ...i, points: i.points.map((p): Vec2 => (axis === 'horizontal' ? [2 * c[0] - p[0], p[1]] : [p[0], 2 * c[1] - p[1]])) }));
}

/** Scales the items together about the middle of their bounding box. */
export function scaleItems(doc: DrawDoc, ids: readonly number[], factor: number): DrawDoc {
  const c = centreOf(doc, ids);
  if (!c || !finite(factor) || factor <= 0) return doc;
  return mapItems(doc, ids, (i) => ({ ...i, points: i.points.map((p): Vec2 => [c[0] + (p[0] - c[0]) * factor, c[1] + (p[1] - c[1]) * factor]) }));
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
  if (!item || item.kind !== 'cut' || !item.closed || edge < 0 || edge >= item.points.length) return { doc, added: false };
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
  if (!already) next = addItem(next, { kind: 'valley', points: [a, b], closed: false }).doc;
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
    const n = item.points.length;
    const edges = item.closed ? n : n - 1;
    for (let i = 0; i < edges; i++) if (distanceToSegment(p, item.points[i]!, item.points[(i + 1) % n]!) <= tolMm) return { id: item.id, vertex: null, edge: i };
  }
  let best: DrawItem | null = null;
  let bestArea = Infinity;
  for (const item of items) {
    if (item.kind !== 'cut' || !item.closed || !pointInPolygon(p, item.points)) continue;
    const area = Math.abs(signedArea(item.points));
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

export type DrawProblemCode = 'outside-sheet' | 'self-intersecting' | 'open-outline' | 'tiny' | 'nothing-to-cut';

export interface DrawProblem {
  code: DrawProblemCode;
  itemId?: number;
}

/** What may be wrong with the drawing before it is cut: parts off the sheet, outlines that cross themselves, open outlines, specks. */
export function drawProblems(doc: DrawDoc): DrawProblem[] {
  const problems: DrawProblem[] = [];
  if (!doc.items.some((i) => i.kind === 'cut')) problems.push({ code: 'nothing-to-cut' });
  const eps = 0.01;
  for (const item of doc.items) {
    const b = boundsOf([item])!;
    if (b.minX < -eps || b.minY < -eps || b.maxX > doc.sheet.widthMm + eps || b.maxY > doc.sheet.heightMm + eps) problems.push({ code: 'outside-sheet', itemId: item.id });
    if (item.kind === 'text') continue;
    if (Math.max(b.maxX - b.minX, b.maxY - b.minY) < 0.5) problems.push({ code: 'tiny', itemId: item.id });
    if (item.kind === 'cut') {
      if (item.closed && selfIntersects(item.points, true)) problems.push({ code: 'self-intersecting', itemId: item.id });
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
}

/** The drawing as the studio's exporters take it: cut outlines, folds (mountain or valley) and numbers as strokes. */
export function drawingOf(doc: DrawDoc, options: DrawingOptions = {}): PageDrawing {
  const cut: PageDrawing['cut'] = [];
  const folds: PageDrawing['folds'] = [];
  const text: Vec2[][] = [];
  for (const item of doc.items) {
    if (item.kind === 'cut') cut.push({ points: item.points.map((p): Vec2 => [p[0], p[1]]), closed: item.closed });
    else if (item.kind === 'text') {
      const p = item.points[0]!;
      text.push(...strokeText(item.text ?? '', p[0], p[1], item.heightMm ?? 4, ((item.angleDeg ?? 0) * Math.PI) / 180));
    } else for (let i = 1; i < item.points.length; i++) folds.push({ a: item.points[i - 1]!, b: item.points[i]!, kind: item.kind });
  }
  let width = doc.sheet.widthMm;
  let height = doc.sheet.heightMm;
  if (options.crop) {
    const all: DrawItem[] = [
      ...doc.items.filter((i) => i.kind !== 'text'),
      ...text.map((points, k): DrawItem => ({ id: -k - 1, kind: 'cut', points, closed: false })),
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

// ─── Saving ───────────────────────────────────────────────────────────────────

export interface SerializedDrawing {
  version: 1;
  kind: 'papercraft-drawing';
  doc: DrawDoc;
}

export function serializeDoc(doc: DrawDoc): SerializedDrawing {
  return { version: 1, kind: 'papercraft-drawing', doc: { ...doc, items: doc.items.map((i) => ({ ...i, points: i.points.map((p): Vec2 => [p[0], p[1]]) })) } };
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
  doc = { ...doc, items, nextId: maxId + 1 };
  return doc;
}
