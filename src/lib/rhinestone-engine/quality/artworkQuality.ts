/**
 * Measuring whether a stone layout looks like the artwork it came from.
 *
 * "Cuttable" (no overlaps, enough gap) is checked elsewhere. This module checks the other half: do the stones cover the
 * shape, stay inside it, avoid strays and keep the outline? Pure and deterministic: millimetres, no randomness, no clock.
 *
 * The source silhouette is the even-odd fill of the closed polylines, which is also how the generators treat nested
 * shapes (an inner loop is a hole).
 */

import type { Polyline, PolylinePoint } from '../path/polyline';

export interface QualityStone {
  center: PolylinePoint;
  holeDiameterMm: number;
}

export interface ArtworkQualityOptions {
  polylines: readonly Polyline[];
  stones: readonly QualityStone[];
  /** Centre-to-centre distance the layout aims for (mm). */
  pitchMm: number;
  /** Raster cell for the silhouette (mm). Default: the larger of 0.4 mm and 1/500 of the longer side. */
  cellMm?: number;
}

export interface ArtworkQuality {
  stoneCount: number;
  /** Share of the silhouette area (0-1) within 0.75 pitch of a stone centre. NaN when the art has no area. */
  areaCoverage: number;
  /** Share of the outline length (0-1) within one pitch of a stone centre. */
  outlineCoverage: number;
  /** Stones whose centre is outside the silhouette by more than half a stone. */
  outsideStones: number;
  /** Stones with no neighbour within twice the pitch. */
  strayStones: number;
  /** Smallest distance between two stone edges (mm); Infinity with fewer than two stones. */
  minGapMm: number;
  silhouetteAreaMm2: number;
}

interface Grid {
  originX: number;
  originY: number;
  cell: number;
  cols: number;
  rows: number;
  inside: Uint8Array;
}

function closedLoops(polylines: readonly Polyline[]): PolylinePoint[][] {
  return polylines.filter((p) => p.closed && p.points.length >= 3).map((p) => p.points as PolylinePoint[]);
}

function boundsOf(polylines: readonly Polyline[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of polylines) {
    for (const pt of p.points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
  }
  return { minX, minY, maxX, maxY };
}

/** Even-odd scanline fill of the closed polylines onto a grid of cell centres. */
export function rasterizeSilhouette(polylines: readonly Polyline[], cellMm?: number): Grid {
  const b = boundsOf(polylines);
  const longest = Math.max(b.maxX - b.minX, b.maxY - b.minY, 1);
  const cell = cellMm ?? Math.max(0.4, longest / 500);
  const cols = Math.max(1, Math.ceil((b.maxX - b.minX) / cell));
  const rows = Math.max(1, Math.ceil((b.maxY - b.minY) / cell));
  const inside = new Uint8Array(cols * rows);
  const loops = closedLoops(polylines);

  for (let row = 0; row < rows; row++) {
    const y = b.minY + (row + 0.5) * cell;
    const crossings: number[] = [];
    for (const loop of loops) {
      for (let i = 0; i < loop.length; i++) {
        const a = loop[i]!;
        const c = loop[(i + 1) % loop.length]!;
        if ((a.y <= y && c.y > y) || (c.y <= y && a.y > y)) {
          crossings.push(a.x + ((y - a.y) / (c.y - a.y)) * (c.x - a.x));
        }
      }
    }
    crossings.sort((p, q) => p - q);
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const from = Math.max(0, Math.ceil((crossings[k]! - b.minX) / cell - 0.5));
      const to = Math.min(cols - 1, Math.floor((crossings[k + 1]! - b.minX) / cell - 0.5));
      for (let col = from; col <= to; col++) inside[row * cols + col] = 1;
    }
  }
  return { originX: b.minX, originY: b.minY, cell, cols, rows, inside };
}

class StoneIndex {
  private readonly buckets = new Map<string, number[]>();
  constructor(private readonly points: readonly PolylinePoint[], private readonly size: number) {
    points.forEach((p, i) => {
      const key = `${Math.floor(p.x / size)},${Math.floor(p.y / size)}`;
      const list = this.buckets.get(key);
      if (list) list.push(i);
      else this.buckets.set(key, [i]);
    });
  }

  /** Distance to the nearest point other than `skip`, searching rings of buckets up to `maxDist`. */
  nearest(x: number, y: number, maxDist: number, skip = -1): number {
    const cx = Math.floor(x / this.size);
    const cy = Math.floor(y / this.size);
    const reach = Math.ceil(maxDist / this.size);
    let best = Infinity;
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const list = this.buckets.get(`${cx + dx},${cy + dy}`);
        if (!list) continue;
        for (const i of list) {
          if (i === skip) continue;
          const p = this.points[i]!;
          const d = Math.hypot(p.x - x, p.y - y);
          if (d < best) best = d;
        }
      }
    }
    return best;
  }
}

function distanceToSegment(p: PolylinePoint, a: PolylinePoint, b: PolylinePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distanceToOutline(p: PolylinePoint, polylines: readonly Polyline[]): number {
  let best = Infinity;
  for (const poly of polylines) {
    const n = poly.points.length;
    const last = poly.closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const d = distanceToSegment(p, poly.points[i]!, poly.points[(i + 1) % n]!);
      if (d < best) best = d;
    }
  }
  return best;
}

export function measureArtworkQuality(options: ArtworkQualityOptions): ArtworkQuality {
  const { polylines, stones, pitchMm } = options;
  const centres = stones.map((s) => s.center);
  const index = new StoneIndex(centres, Math.max(pitchMm, 0.5));
  const grid = rasterizeSilhouette(polylines, options.cellMm);

  // Area coverage: silhouette cells near a stone.
  const reach = pitchMm * 0.75;
  let areaCells = 0;
  let coveredCells = 0;
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (!grid.inside[row * grid.cols + col]) continue;
      areaCells++;
      const x = grid.originX + (col + 0.5) * grid.cell;
      const y = grid.originY + (row + 0.5) * grid.cell;
      if (index.nearest(x, y, reach) <= reach) coveredCells++;
    }
  }

  // Outline coverage: points walked along the outline, every 0.5 mm.
  let outlineSamples = 0;
  let outlineCovered = 0;
  for (const poly of polylines) {
    const n = poly.points.length;
    const last = poly.closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = poly.points[i]!;
      const b = poly.points[(i + 1) % n]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(len / 0.5));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        outlineSamples++;
        if (index.nearest(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, pitchMm) <= pitchMm) outlineCovered++;
      }
    }
  }

  // Stones outside the silhouette (by more than half a stone), strays and the smallest gap.
  let outside = 0;
  let strays = 0;
  let minGap = Infinity;
  centres.forEach((c, i) => {
    const col = Math.floor((c.x - grid.originX) / grid.cell);
    const row = Math.floor((c.y - grid.originY) / grid.cell);
    const isInside = col >= 0 && col < grid.cols && row >= 0 && row < grid.rows && grid.inside[row * grid.cols + col] === 1;
    const half = stones[i]!.holeDiameterMm / 2;
    if (!isInside && distanceToOutline(c, polylines) > half + 0.01) outside++;

    const nn = index.nearest(c.x, c.y, pitchMm * 2, i);
    if (nn > pitchMm * 2) strays++;
    if (nn < Infinity) minGap = Math.min(minGap, nn - half * 2);
  });

  return {
    stoneCount: stones.length,
    areaCoverage: areaCells === 0 ? NaN : coveredCells / areaCells,
    outlineCoverage: outlineSamples === 0 ? NaN : outlineCovered / outlineSamples,
    outsideStones: outside,
    strayStones: strays,
    minGapMm: minGap,
    silhouetteAreaMm2: areaCells * grid.cell * grid.cell,
  };
}
