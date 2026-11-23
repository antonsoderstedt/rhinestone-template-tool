/**
 * Stone layout from a region field: rows that follow the outline, optionally filling the whole shape.
 *
 * One algorithm covers the "looks" a user picks from: one row is an outline, a few rows are a contour, all rows plus a hex
 * fill of what is left is a solid fill. Rows are the iso-contours of the distance field one pitch apart, so they follow every
 * curve and corner, narrow necks give way to a single row down the middle, and no two rows can be closer than the pitch.
 *
 * Pure and deterministic. Lengths in millimetres.
 */

import type { PolylinePoint } from '../path/polyline';
import { extractContours, sampleLoop } from './contours';
import { sampleField, type RegionField } from './regionField';

export interface RowsLayoutOptions {
  holeDiameterMm: number;
  /** Centre-to-centre distance the rows aim for (mm). */
  pitchMm: number;
  /** Hard floor: no two stones closer than this (hole diameter plus the material's minimum edge gap). */
  minCentreDistanceMm: number;
  /** How many rows from the edge inwards, or `all` to fill the shape. */
  rows: number | 'all';
  /** Depth of the first row's centres (mm). Default: half a hole, so stones lie just inside the edge. */
  edgeInsetMm?: number;
  /** Fill what the rows leave with a hex lattice. Default: true when `rows` is `all`. */
  fillRemainder?: boolean;
  /**
   * Also put one row down the middle of parts thinner than a stone, where a stone cannot lie wholly inside. The stones
   * then reach a little past the edge. Meant for letters, where a thin stroke should still get stones.
   */
  overhang?: boolean;
  /**
   * How far a lattice stone has to be from every other stone, as a fraction of the pitch (default: the hard minimum only). A
   * value near 1 keeps the lattice from squeezing between the edge row and itself, so the fill reads as clean rows.
   */
  latticeClearance?: number;
}

export type StoneKind = 'edge' | 'row' | 'fill';

export interface PlacedStone {
  x: number;
  y: number;
  /** 0 for the outermost row; fill stones count as one row deeper than the last. */
  row: number;
  kind: StoneKind;
}

const MAX_ROWS = 400;

class PointIndex {
  private readonly buckets = new Map<string, number[]>();
  constructor(private readonly points: PlacedStone[], private readonly size: number) {}

  private key(x: number, y: number) {
    return `${Math.floor(x / this.size)},${Math.floor(y / this.size)}`;
  }

  add(index: number): void {
    const p = this.points[index]!;
    const key = this.key(p.x, p.y);
    const list = this.buckets.get(key);
    if (list) list.push(index);
    else this.buckets.set(key, [index]);
  }

  remove(index: number): void {
    const p = this.points[index]!;
    const list = this.buckets.get(this.key(p.x, p.y));
    if (!list) return;
    const at = list.indexOf(index);
    if (at >= 0) list.splice(at, 1);
  }

  /** Indices of stones within `radius` of (x, y), nearest first; ties by index. */
  near(x: number, y: number, radius: number, ignore = -1): number[] {
    const cx = Math.floor(x / this.size);
    const cy = Math.floor(y / this.size);
    const reach = Math.ceil(radius / this.size);
    const found: Array<[number, number]> = [];
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const list = this.buckets.get(`${cx + dx},${cy + dy}`);
        if (!list) continue;
        for (const i of list) {
          if (i === ignore) continue;
          const p = this.points[i]!;
          const d = Math.hypot(p.x - x, p.y - y);
          if (d < radius) found.push([d, i]);
        }
      }
    }
    return found.sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((f) => f[1]);
  }
}

/**
 * Lays stones out in rows following the outline of the field. The result has no two stones closer than
 * `minCentreDistanceMm` and every stone lies inside the shape.
 */
export function layoutRows(field: RegionField, options: RowsLayoutOptions): PlacedStone[] {
  const { holeDiameterMm, pitchMm, minCentreDistanceMm, rows } = options;
  const inset = options.edgeInsetMm ?? holeDiameterMm / 2;
  const fillRemainder = options.fillRemainder ?? rows === 'all';
  const maxRows = rows === 'all' ? MAX_ROWS : Math.max(0, Math.floor(rows));
  const insideLimit = holeDiameterMm / 2 - field.cell; // a stone's centre must be at least this deep (a cell of slack)

  const placed: PlacedStone[] = [];
  const index = new PointIndex(placed, Math.max(minCentreDistanceMm, 1));
  const merged = new Set<number>();

  const accept = (x: number, y: number, row: number, kind: StoneKind) => {
    placed.push({ x, y, row, kind });
    index.add(placed.length - 1);
  };

  // A candidate that is too close to a stone already placed. On a narrow part the two sides of a row meet: the pair is
  // replaced by one stone halfway between, which puts a single row down the middle. Anything else is dropped.
  const place = (x: number, y: number, row: number, kind: StoneKind) => {
    const conflicts = index.near(x, y, minCentreDistanceMm);
    if (conflicts.length === 0) {
      if (sampleField(field, x, y) >= insideLimit) accept(x, y, row, kind);
      return;
    }
    if (kind === 'fill') return;
    const other = conflicts[0]!;
    const o = placed[other]!;
    if (merged.has(other) || o.row !== row) return;
    const mx = (x + o.x) / 2;
    const my = (y + o.y) / 2;
    if (sampleField(field, mx, my) < insideLimit) return;
    if (index.near(mx, my, minCentreDistanceMm, other).length > 0) return;
    index.remove(other);
    placed[other] = { x: mx, y: my, row, kind: o.kind };
    index.add(other);
    merged.add(other);
  };

  let lastRow = -1;
  for (let k = 0; k < maxRows; k++) {
    const level = inset + k * pitchMm;
    const loops = extractContours(field, level);
    if (loops.length === 0) break;
    lastRow = k;
    for (const loop of loops) {
      for (const point of sampleLoop(loop, { pitchMm })) place(point.x, point.y, k, k === 0 ? 'edge' : 'row');
    }
  }

  // Parts thinner than a stone: one row down the middle, found from a shallow contour (both sides of the part meet and are
  // merged into one stone halfway between). Only where the normal rows could not go, never next to a normal stone.
  if (options.overhang) {
    const floor = field.cell;
    const overhang = new Set<number>();
    for (const loop of extractContours(field, field.cell * 1.5)) {
      for (const point of sampleLoop(loop, { pitchMm })) {
        if (climbToRidge(field, point.x, point.y).depth >= inset) continue;
        const conflicts = index.near(point.x, point.y, minCentreDistanceMm);
        if (conflicts.length === 0) {
          if (sampleField(field, point.x, point.y) >= floor) {
            accept(point.x, point.y, 0, 'edge');
            overhang.add(placed.length - 1);
          }
          continue;
        }
        const other = conflicts[0]!;
        if (!overhang.has(other) || merged.has(other)) continue;
        const o = placed[other]!;
        const mx = (point.x + o.x) / 2;
        const my = (point.y + o.y) / 2;
        if (sampleField(field, mx, my) < floor || index.near(mx, my, minCentreDistanceMm, other).length > 0) continue;
        index.remove(other);
        placed[other] = { x: mx, y: my, row: 0, kind: 'edge' };
        index.add(other);
        merged.add(other);
      }
    }
  }

  // Stones in a part too narrow for a second row sit on one side of it, as close as the edge row can be. Move each to the
  // middle of the part (the ridge of the field) when that keeps the spacing.
  const holdsTwoRows = inset + pitchMm / 2;
  for (let i = 0; i < placed.length; i++) {
    const stone = placed[i]!;
    const ridge = climbToRidge(field, stone.x, stone.y);
    if (ridge.depth >= holdsTwoRows || ridge.depth <= sampleField(field, stone.x, stone.y) + 0.05) continue;
    if (index.near(ridge.x, ridge.y, minCentreDistanceMm, i).length > 0) continue;
    index.remove(i);
    placed[i] = { ...stone, x: ridge.x, y: ridge.y };
    index.add(i);
  }

  if (fillRemainder) {
    // A hex lattice over the field: only points deep enough and clear of every stone placed so far.
    const rowStep = (pitchMm * Math.sqrt(3)) / 2;
    const { originX, originY, cell, cols, rows: gridRows } = field;
    const width = cols * cell;
    const height = gridRows * cell;
    const clear = Math.max(minCentreDistanceMm, (options.latticeClearance ?? 0) * pitchMm);
    // The lattice is centred on the shape, so a symmetric shape gets a symmetric fill (anchored on the grid's corner it was
    // lopsided), and its rows run straight across.
    let minX = Infinity;
    let maxX = -Infinity;
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < cols; col++) {
        if (field.mask[row * cols + col]) {
          const x = originX + (col + 0.5) * cell;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }
    const centreX = Number.isFinite(minX) ? (minX + maxX) / 2 : originX + width / 2;
    const first = centreX - Math.ceil((centreX - originX) / pitchMm) * pitchMm;
    let r = 0;
    for (let y = originY + rowStep / 2; y < originY + height; y += rowStep, r++) {
      const shift = r % 2 === 0 ? 0 : pitchMm / 2;
      for (let x = first + shift; x < originX + width; x += pitchMm) {
        if (x < originX) continue;
        if (sampleField(field, x, y) < insideLimit) continue;
        if (index.near(x, y, clear).length > 0) continue;
        accept(x, y, lastRow + 1, 'fill');
      }
    }
  }

  return placed.sort((p, q) => p.y - q.y || p.x - q.x).map((p) => ({ ...p, x: Math.round(p.x * 1e4) / 1e4, y: Math.round(p.y * 1e4) / 1e4 }));
}

export function toPoints(stones: readonly PlacedStone[]): PolylinePoint[] {
  return stones.map((s) => ({ x: s.x, y: s.y }));
}

/** Follows the distance field uphill from a point to the middle of the part it is in (at most 4 mm). */
function climbToRidge(field: RegionField, x0: number, y0: number): { x: number; y: number; depth: number } {
  const step = Math.max(field.cell * 0.5, 0.08);
  let x = x0;
  let y = y0;
  let best = { x, y, depth: sampleField(field, x, y) };
  let worse = 0;
  for (let i = 0; i < 60 && worse < 8; i++) {
    const h = field.cell;
    const gx = sampleField(field, x + h, y) - sampleField(field, x - h, y);
    const gy = sampleField(field, x, y + h) - sampleField(field, x, y - h);
    const length = Math.hypot(gx, gy);
    if (!Number.isFinite(length) || length < 1e-6) break;
    x += (gx / length) * step;
    y += (gy / length) * step;
    const depth = sampleField(field, x, y);
    if (depth > best.depth + 1e-6) {
      best = { x, y, depth };
      worse = 0;
    } else worse++;
  }
  return best;
}
