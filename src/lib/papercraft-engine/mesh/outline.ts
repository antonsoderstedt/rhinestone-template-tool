import type { RawMesh, Vec2 } from '../types';
import { extrude, lathe } from './shapes';

/**
 * Models from flat artwork: the outline of a 2D shape pulled up into a box (`extrudeShape`), or its silhouette spun round an axis (`latheShape`).
 * The artwork is a list of filled regions, each some closed contours and a fill rule, in any units (the studio scales the model). y points up.
 * Overlapping regions and holes are no problem: the shape is drawn on a grid and the outer edge of the biggest piece is followed, so the union of
 * the regions is what counts. Pure and deterministic.
 */

export interface ShapeRegion {
  contours: readonly (readonly Vec2[])[];
  fillRule: 'nonzero' | 'evenodd';
}

interface Mask {
  w: number;
  h: number;
  /** 1 where the shape is. Row-major; rows count up with y. */
  cells: Uint8Array;
  minX: number;
  minY: number;
  /** Grid cells per unit. */
  scale: number;
}

const GRID = 256;
/** Empty cells all round the shape: room for the outer edge, and for closing gaps. */
const PAD = 24;
/** The widest gap between two pieces that is closed (in cells, on each side). */
const MAX_CLOSE = 20;

/** Contours with a point that is not a number are left out. */
function cleaned(regions: readonly ShapeRegion[]): ShapeRegion[] {
  return regions
    .map((r) => ({ fillRule: r.fillRule, contours: r.contours.filter((c) => c.length >= 3 && c.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))) }))
    .filter((r) => r.contours.length > 0);
}

function boundsOf(regions: readonly ShapeRegion[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of regions) for (const c of r.contours) for (const [x, y] of c) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return minX <= maxX && minY <= maxY ? { minX, minY, maxX, maxY } : null;
}

/** The shape on a grid: a cell is in when its centre is inside any region (by that region's fill rule). */
export function rasterizeShape(regionsIn: readonly ShapeRegion[], grid = GRID): Mask | null {
  const regions = cleaned(regionsIn);
  const b = boundsOf(regions);
  if (!b) return null;
  const width = b.maxX - b.minX;
  const height = b.maxY - b.minY;
  const longest = Math.max(width, height);
  if (!(longest > 0)) return null;
  const scale = grid / longest;
  const w = Math.max(1, Math.ceil(width * scale)) + 2 * PAD;
  const h = Math.max(1, Math.ceil(height * scale)) + 2 * PAD;
  const cells = new Uint8Array(w * h);
  for (const region of regions) {
    const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const c of region.contours) {
      for (let i = 0; i < c.length; i++) {
        const p = c[i];
        const q = c[(i + 1) % c.length];
        if (p[1] !== q[1]) edges.push({ x1: p[0], y1: p[1], x2: q[0], y2: q[1] });
      }
    }
    for (let row = PAD; row < h - PAD; row++) {
      const y = b.minY + (row - PAD + 0.5) / scale;
      const hits: { x: number; dir: number }[] = [];
      for (const e of edges) {
        const lo = Math.min(e.y1, e.y2);
        const hi = Math.max(e.y1, e.y2);
        if (y < lo || y >= hi) continue;
        hits.push({ x: e.x1 + ((y - e.y1) / (e.y2 - e.y1)) * (e.x2 - e.x1), dir: e.y2 > e.y1 ? 1 : -1 });
      }
      hits.sort((p, q) => p.x - q.x);
      let winding = 0;
      for (let i = 0; i + 1 < hits.length; i++) {
        winding = region.fillRule === 'evenodd' ? (winding === 0 ? 1 : 0) : winding + hits[i].dir;
        if (winding === 0) continue;
        const from = Math.max(PAD, Math.floor((hits[i].x - b.minX) * scale) + PAD);
        const to = Math.min(w - PAD - 1, Math.ceil((hits[i + 1].x - b.minX) * scale) + PAD);
        for (let col = from; col <= to; col++) {
          const cx = b.minX + (col - PAD + 0.5) / scale;
          if (cx >= hits[i].x && cx < hits[i + 1].x) cells[row * w + col] = 1;
        }
      }
    }
  }
  return { w, h, cells, minX: b.minX - PAD / scale, minY: b.minY - PAD / scale, scale };
}

function grow(cells: Uint8Array, w: number, h: number, on: 0 | 1): Uint8Array {
  // `on` 1 grows the shape by one cell (a cell next to it joins), 0 shrinks it by one (a cell next to an empty one leaves).
  const out = new Uint8Array(cells);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const any = cells[i - 1] || cells[i + 1] || cells[i - w] || cells[i + w];
      const all = cells[i - 1] && cells[i + 1] && cells[i - w] && cells[i + w];
      if (on === 1 && any) out[i] = 1;
      if (on === 0 && !all) out[i] = 0;
    }
  }
  return out;
}

/**
 * Pieces that are close to each other (the toes of a paw, the notes of a tune) are joined: the shape is grown until it is one piece and then shrunk the same
 * amount, which fills the gaps and leaves the rest as it was. A gap wider than about 16 % of the shape stays a gap.
 */
function joinPieces(mask: Mask): Mask {
  if (biggestPiece(mask).pieces <= 1) return mask;
  let grown = mask.cells;
  for (let r = 1; r <= MAX_CLOSE; r++) {
    grown = grow(grown, mask.w, mask.h, 1);
    if (biggestPiece({ ...mask, cells: grown }).pieces === 1) {
      let closed = grown;
      for (let k = 0; k < r; k++) closed = grow(closed, mask.w, mask.h, 0);
      return { ...mask, cells: closed };
    }
  }
  return mask;
}

/** The cells that belong to the biggest piece (cells that touch along an edge are one piece), and how many pieces there are. */
function biggestPiece(mask: Mask): { piece: Uint8Array; pieces: number } {
  const { w, h, cells } = mask;
  const label = new Int32Array(w * h);
  let best = 0;
  let bestSize = 0;
  let count = 0;
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!cells[start] || label[start]) continue;
    count++;
    let size = 0;
    stack.push(start);
    label[start] = count;
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      const x = i % w;
      const y = (i - x) / w;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (cells[j] && !label[j]) {
          label[j] = count;
          stack.push(j);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = count;
    }
  }
  const piece = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (label[i] === best) piece[i] = 1;
  return { piece, pieces: count };
}

/** The outer edge of a piece as corners of cells (the corners where it turns), going round (the direction does not matter: the caller makes it counter-clockwise). */
function traceEdge(piece: Uint8Array, w: number, h: number): Vec2[] {
  const at = (cx: number, cy: number) => (cx >= 0 && cy >= 0 && cx < w && cy < h && piece[cy * w + cx] === 1);
  const first = piece.indexOf(1);
  if (first < 0) return [];
  const sx = first % w;
  const sy = (first - sx) / w;
  // The top-left corner of the first cell (nothing above it), going east with the cell on the right.
  let x = sx;
  let y = sy;
  let dx = 1;
  let dy = 0;
  const startX = x;
  const startY = y;
  // The first cell has nothing above it or to its left, so its top-left corner is a corner of the edge.
  const out: Vec2[] = [[startX, startY]];
  for (let guard = 0; guard < 4 * w * h + 8; guard++) {
    // The cells ahead of the corner, to the left and to the right of the direction.
    const fx = x + dx * 0.5;
    const fy = y + dy * 0.5;
    const left = at(Math.floor(fx + dy * 0.5), Math.floor(fy - dx * 0.5));
    const right = at(Math.floor(fx - dy * 0.5), Math.floor(fy + dx * 0.5));
    let ndx = dx;
    let ndy = dy;
    if (left) {
      ndx = dy;
      ndy = -dx;
    } else if (!right) {
      ndx = -dy;
      ndy = dx;
    }
    // Back where it began, about to go the way it went first: the loop is closed.
    if (guard > 0 && x === startX && y === startY && ndx === 1 && ndy === 0) break;
    if (ndx !== dx || ndy !== dy) out.push([x, y]);
    dx = ndx;
    dy = ndy;
    x += dx;
    y += dy;
  }
  return out;
}

/** Takes away the corners that matter least (the smallest triangle with its neighbours) until `count` are left. */
export function simplifyOutline(points: readonly Vec2[], count: number): Vec2[] {
  const pts = points.slice();
  const target = Math.max(3, Math.floor(count));
  const area = (a: Vec2, b: Vec2, c: Vec2) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
  while (pts.length > target) {
    let best = 0;
    let bestArea = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = area(pts[(i + pts.length - 1) % pts.length], pts[i], pts[(i + 1) % pts.length]);
      if (a < bestArea - 1e-12) {
        bestArea = a;
        best = i;
      }
    }
    pts.splice(best, 1);
  }
  return pts;
}

export interface OutlineResult {
  /** Counter-clockwise, in the units of the artwork, y up. */
  points: Vec2[];
  /** Pieces left out because they are not the biggest. */
  omittedPieces: number;
}

/** The outline of the biggest piece of the artwork with `count` corners. Null when there is nothing to draw. */
export function shapeOutline(regionsIn: readonly ShapeRegion[], count: number): OutlineResult | null {
  const regions = cleaned(regionsIn);
  const single = regions.length === 1 && regions[0].contours.length === 1 ? regions[0].contours[0] : null;
  let raw: Vec2[];
  let omitted = 0;
  if (single && single.length >= 3) {
    raw = single.map((p): Vec2 => [p[0], p[1]]);
    // The closing point is often a repeat of the first.
    if (raw.length > 3 && raw[0][0] === raw[raw.length - 1][0] && raw[0][1] === raw[raw.length - 1][1]) raw.pop();
  } else {
    const raster = rasterizeShape(regions);
    if (!raster) return null;
    const mask = joinPieces(raster);
    const { piece, pieces } = biggestPiece(mask);
    omitted = Math.max(0, pieces - 1);
    const corners = traceEdge(piece, mask.w, mask.h);
    if (corners.length < 3) return null;
    raw = corners.map(([gx, gy]): Vec2 => [mask.minX + gx / mask.scale, mask.minY + gy / mask.scale]);
  }
  const points = simplifyOutline(raw, count);
  let twice = 0;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    twice += p[0] * q[1] - q[0] * p[1];
  });
  if (Math.abs(twice) < 1e-12) return null;
  return { points: twice < 0 ? points.reverse() : points, omittedPieces: omitted };
}

export interface ExtrudeShapeOptions {
  /** Corners of the outline (the more, the closer to the shape and the more faces). */
  corners: number;
  /** How deep the box is, as a share of the longer side of the shape. */
  depthRatio: number;
}

/** A box in the shape of the artwork: the outline pulled up in z. */
export function extrudeShape(regions: readonly ShapeRegion[], options: ExtrudeShapeOptions): { mesh: RawMesh; omittedPieces: number } | null {
  const outline = shapeOutline(regions, options.corners);
  if (!outline) return null;
  const xs = outline.points.map((p) => p[0]);
  const ys = outline.points.map((p) => p[1]);
  const longer = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return { mesh: extrude(outline.points.map((p): [number, number] => [p[0], p[1]]), longer * Math.max(0.02, options.depthRatio)), omittedPieces: outline.omittedPieces };
}

export interface LatheShapeOptions {
  /** Rings along the height. */
  rings: number;
  /** Sides round the axis. */
  segments: number;
}

/** The silhouette of the artwork spun round its vertical middle: at each height the radius is half the width of the shape there. */
export function latheShape(regions: readonly ShapeRegion[], options: LatheShapeOptions): { mesh: RawMesh; omittedPieces: number } | null {
  const raster = rasterizeShape(regions);
  if (!raster) return null;
  const mask = joinPieces(raster);
  const { piece, pieces } = biggestPiece(mask);
  const { w, h } = mask;
  // The width of the piece in every row of the grid. Rows count up with y, so the first is the bottom.
  const rows: { r: number; y: number }[] = [];
  for (let row = 0; row < h; row++) {
    let lo = -1;
    let hi = -1;
    for (let col = 0; col < w; col++) if (piece[row * w + col]) {
      if (lo < 0) lo = col;
      hi = col;
    }
    if (lo >= 0) rows.push({ r: (hi - lo + 1) / 2 / mask.scale, y: (row + 0.5) / mask.scale });
  }
  if (rows.length < 2) return null;
  const rings = Math.max(3, Math.floor(options.rings));
  const y0 = rows[0].y;
  const y1 = rows[rows.length - 1].y;
  const profile: [number, number][] = [];
  for (let k = 0; k < rings; k++) {
    const y = y0 + ((y1 - y0) * k) / (rings - 1);
    // The row that is nearest this height.
    let nearest = rows[0];
    for (const row of rows) if (Math.abs(row.y - y) < Math.abs(nearest.y - y)) nearest = row;
    profile.push([nearest.r, y - y0]);
  }
  const widest = Math.max(...profile.map((p) => p[0]));
  // A tip (the point of a heart, a drop) is a pole, not a tiny flat cap.
  if (profile[0][0] < 0.12 * widest) profile[0][0] = 0;
  if (profile[profile.length - 1][0] < 0.12 * widest) profile[profile.length - 1][0] = 0;
  const mesh = lathe(profile, Math.max(3, Math.floor(options.segments)));
  return { mesh, omittedPieces: Math.max(0, pieces - 1) };
}
