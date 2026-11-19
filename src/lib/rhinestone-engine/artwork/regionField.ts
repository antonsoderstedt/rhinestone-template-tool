/**
 * Raster regions and their distance fields.
 *
 * Artwork is turned into a binary mask on a grid of square cells (millimetres), and the mask into a signed distance field:
 * how far each cell is from the edge of the shape, positive inside. Everything the stone layouts need (rows that follow the
 * outline, the thin parts of a stroke, which parts are too narrow for a stone) comes from that one field, so overlapping
 * shapes, holes and touching letters need no polygon clipping.
 *
 * Pure and deterministic. All lengths are millimetres.
 */

import type { Polyline, PolylinePoint } from '../path/polyline';

export interface Grid {
  originX: number;
  originY: number;
  /** Cell size (mm). Cell (col, row) is centred on (originX + (col + 0.5) * cell, originY + (row + 0.5) * cell). */
  cell: number;
  cols: number;
  rows: number;
}

export interface Mask extends Grid {
  /** 1 inside the shape, 0 outside. */
  data: Uint8Array;
}

export interface RegionField extends Grid {
  mask: Uint8Array;
  /** Signed distance to the shape's edge in mm: positive inside, negative outside. */
  sdf: Float32Array;
}

export type FillRule = 'nonzero' | 'evenodd';

export interface GridOptions {
  /** Cell size (mm). Default: the longer side / 1200, never below 0.15 mm or above 0.4 mm. */
  cellMm?: number;
  /** Empty margin around the shapes (mm). Default 3 cells + 1 mm. */
  marginMm?: number;
}

export function boundsOfPolylines(polylines: readonly Polyline[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const polyline of polylines) {
    for (const point of polyline.points) {
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
  }
  return { minX, minY, maxX, maxY };
}

/** A grid that covers the given bounds with an empty margin. Every layer of one artwork must share it. */
export function createGrid(bounds: { minX: number; minY: number; maxX: number; maxY: number }, options: GridOptions = {}): Grid {
  const longest = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1);
  const cell = options.cellMm ?? Math.min(0.4, Math.max(0.15, longest / 1200));
  const margin = options.marginMm ?? 3 * cell + 1;
  const originX = bounds.minX - margin;
  const originY = bounds.minY - margin;
  return {
    originX,
    originY,
    cell,
    cols: Math.max(1, Math.ceil((bounds.maxX - bounds.minX + 2 * margin) / cell)),
    rows: Math.max(1, Math.ceil((bounds.maxY - bounds.minY + 2 * margin) / cell)),
  };
}

export function emptyMask(grid: Grid): Mask {
  return { ...grid, data: new Uint8Array(grid.cols * grid.rows) };
}

/** Fills the closed loops into `mask` (scanline, at cell centres). Open polylines are ignored. */
export function fillLoops(mask: Mask, loops: readonly Polyline[], rule: FillRule): void {
  const closed = loops.filter((l) => l.closed && l.points.length >= 3);
  if (closed.length === 0) return;
  const { originX, originY, cell, cols, rows, data } = mask;
  // Bucket the edges by the rows they cross, so each row only looks at the edges that matter.
  const edgesByRow: number[][] = Array.from({ length: rows }, () => []);
  const edges: Array<[number, number, number, number, number]> = []; // x1, y1, x2, y2, direction
  for (const loop of closed) {
    const n = loop.points.length;
    for (let i = 0; i < n; i++) {
      const a = loop.points[i]!;
      const b = loop.points[(i + 1) % n]!;
      if (a.y === b.y) continue;
      const index = edges.length;
      edges.push([a.x, a.y, b.x, b.y, b.y > a.y ? 1 : -1]);
      const lo = Math.max(0, Math.ceil((Math.min(a.y, b.y) - originY) / cell - 0.5));
      const hi = Math.min(rows - 1, Math.floor((Math.max(a.y, b.y) - originY) / cell - 0.5));
      for (let row = lo; row <= hi; row++) edgesByRow[row]!.push(index);
    }
  }
  const crossings: Array<[number, number]> = [];
  for (let row = 0; row < rows; row++) {
    const list = edgesByRow[row]!;
    if (list.length === 0) continue;
    const y = originY + (row + 0.5) * cell;
    crossings.length = 0;
    for (const index of list) {
      const [x1, y1, x2, y2, dir] = edges[index]!;
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) crossings.push([x1 + ((y - y1) / (y2 - y1)) * (x2 - x1), dir]);
    }
    crossings.sort((p, q) => p[0] - q[0]);
    let winding = 0;
    for (let k = 0; k + 1 < crossings.length; k++) {
      winding += crossings[k]![1];
      const inside = rule === 'evenodd' ? (k + 1) % 2 === 1 : winding !== 0;
      if (!inside) continue;
      const from = Math.max(0, Math.ceil((crossings[k]![0] - originX) / cell - 0.5));
      const to = Math.min(cols - 1, Math.floor((crossings[k + 1]![0] - originX) / cell - 0.5));
      for (let col = from; col <= to; col++) data[row * cols + col] = 1;
    }
  }
}

function distanceToSegment(p: PolylinePoint, a: PolylinePoint, b: PolylinePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Fills a line of the given width (round caps and joins) along each polyline into `mask`. */
export function fillStrokes(mask: Mask, polylines: readonly Polyline[], widthMm: number): void {
  const half = widthMm / 2;
  if (half <= 0) return;
  const { originX, originY, cell, cols, rows, data } = mask;
  for (const polyline of polylines) {
    const n = polyline.points.length;
    const last = polyline.closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = polyline.points[i]!;
      const b = polyline.points[(i + 1) % n]!;
      const colLo = Math.max(0, Math.floor((Math.min(a.x, b.x) - half - originX) / cell));
      const colHi = Math.min(cols - 1, Math.ceil((Math.max(a.x, b.x) + half - originX) / cell));
      const rowLo = Math.max(0, Math.floor((Math.min(a.y, b.y) - half - originY) / cell));
      const rowHi = Math.min(rows - 1, Math.ceil((Math.max(a.y, b.y) + half - originY) / cell));
      for (let row = rowLo; row <= rowHi; row++) {
        for (let col = colLo; col <= colHi; col++) {
          if (data[row * cols + col]) continue;
          const p = { x: originX + (col + 0.5) * cell, y: originY + (row + 0.5) * cell };
          if (distanceToSegment(p, a, b) <= half) data[row * cols + col] = 1;
        }
      }
    }
  }
}

// ─── Distance transform ───────────────────────────────────────────────────────

const INF = 1e20;

/** One-dimensional squared distance transform (Felzenszwalb and Huttenlocher), in place on `f`. */
function transform1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    while (s <= z[k]!) {
      k--;
      s = (f[q]! + q * q - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++;
    d[q] = (q - v[k]!) * (q - v[k]!) + f[v[k]!]!;
  }
}

/** Distance (in cells) from every cell to the nearest cell whose value in `source` is 1. Cells in the source get 0. */
export function distanceToSet(source: Uint8Array, cols: number, rows: number): Float32Array {
  const size = Math.max(cols, rows);
  const f = new Float64Array(size);
  const d = new Float64Array(size);
  const v = new Int32Array(size);
  const z = new Float64Array(size + 1);
  const grid = new Float64Array(cols * rows);
  for (let i = 0; i < grid.length; i++) grid[i] = source[i] ? 0 : INF;
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) f[row] = grid[row * cols + col]!;
    transform1d(f, rows, d, v, z);
    for (let row = 0; row < rows; row++) grid[row * cols + col] = d[row]!;
  }
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) f[col] = grid[row * cols + col]!;
    transform1d(f, cols, d, v, z);
    for (let col = 0; col < cols; col++) grid[row * cols + col] = d[col]!;
  }
  const out = new Float32Array(cols * rows);
  for (let i = 0; i < out.length; i++) out[i] = Math.sqrt(grid[i]!);
  return out;
}

/** The signed distance field of a mask: millimetres to the edge, positive inside. Edge sits half a cell from cell centres. */
export function buildRegionField(mask: Mask): RegionField {
  const { cols, rows, cell, data } = mask;
  const outside = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) outside[i] = data[i] ? 0 : 1;
  const toOutside = distanceToSet(outside, cols, rows);
  const toInside = distanceToSet(data, cols, rows);
  const sdf = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    sdf[i] = data[i] ? (toOutside[i]! - 0.5) * cell : -(toInside[i]! - 0.5) * cell;
  }
  return { originX: mask.originX, originY: mask.originY, cell, cols, rows, mask: data, sdf };
}

/** Value of the field at a point (nearest cell); negative outside the grid. */
export function sampleField(field: RegionField, x: number, y: number): number {
  const col = Math.floor((x - field.originX) / field.cell);
  const row = Math.floor((y - field.originY) / field.cell);
  if (col < 0 || row < 0 || col >= field.cols || row >= field.rows) return -Infinity;
  return field.sdf[row * field.cols + col]!;
}

/** Number of cells inside the shape, times the cell area (mm²). */
export function maskAreaMm2(mask: Mask): number {
  let count = 0;
  for (let i = 0; i < mask.data.length; i++) count += mask.data[i]!;
  return count * mask.cell * mask.cell;
}
