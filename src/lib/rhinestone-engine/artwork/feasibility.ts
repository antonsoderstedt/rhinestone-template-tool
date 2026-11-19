/**
 * Can this artwork be made with this stone, at this size?
 *
 * A stone needs a part of the shape at least one hole wide (a row down the middle), so detail thinner than that is lost.
 * This measures how much of the artwork is thinner than each stone size (morphological opening of the shape by half a hole),
 * and from that how wide the artwork would have to be for the detail to survive.
 *
 * Pure and deterministic. Lengths in millimetres.
 */

import type { StoneSizeId } from '../types/index';
import { getRecommendedHoleDiameter } from '../profiles/materialProfiles';
import type { ArtworkLayer } from './layers';
import { distanceToSet, type Mask } from './regionField';

export type FeasibilityVerdict = 'good' | 'some-detail-lost' | 'too-small';

export interface StoneSizeFeasibility {
  stoneSize: StoneSizeId;
  holeDiameterMm: number;
  /** Share (0-1) of the artwork's area that is thinner than one hole. */
  thinAreaShare: number;
  /** Separate shapes (letters, dots, flourishes) whose thickest part is thinner than one hole: they get no stones. */
  lostShapes: number;
  /** Separate shapes in the artwork, not counting specks. */
  totalShapes: number;
  verdict: FeasibilityVerdict;
  /** Width the artwork would need for about 3 % of it to be too thin (with a margin of 5 %); null when it cannot be told. */
  suggestedWidthMm: number | null;
}

export interface FeasibilityReport {
  widthMm: number;
  heightMm: number;
  areaMm2: number;
  /** Width below which 3 % of the artwork's area is thinner (mm), at the current size. */
  thinnestPartMm: number | null;
  perSize: StoneSizeFeasibility[];
}

export interface FeasibilityOptions {
  stoneSizes?: readonly StoneSizeId[];
  materialProfileId?: string;
  /** Share of area allowed to be too thin. Default 0.03. */
  tolerance?: number;
}

const DEFAULT_SIZES: StoneSizeId[] = ['SS6', 'SS10', 'SS16'];

/** The union of the layers that get stones, shrunk to a coarse grid (a cell is on when most of its source cells are). */
function coarseUnion(layers: readonly ArtworkLayer[], targetCellMm: number): Mask | null {
  const included = layers.filter((layer) => layer.role === 'stones');
  if (included.length === 0) return null;
  const base = included[0]!.mask;
  const factor = Math.max(1, Math.round(targetCellMm / base.cell));
  const cols = Math.ceil(base.cols / factor);
  const rows = Math.ceil(base.rows / factor);
  const data = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let on = 0;
      let total = 0;
      for (let dy = 0; dy < factor; dy++) {
        const y = row * factor + dy;
        if (y >= base.rows) break;
        for (let dx = 0; dx < factor; dx++) {
          const x = col * factor + dx;
          if (x >= base.cols) break;
          total++;
          const i = y * base.cols + x;
          for (const layer of included) {
            if (layer.mask.data[i]) {
              on++;
              break;
            }
          }
        }
      }
      if (on * 2 >= total && total > 0) data[row * cols + col] = 1;
    }
  }
  return { originX: base.originX, originY: base.originY, cell: base.cell * factor, cols, rows, data };
}

/** Share of the mask's area removed by an opening of radius `radiusMm` (what is thinner than twice the radius). */
function thinShare(mask: Mask, radiusMm: number, area: number): number {
  const { cols, rows, cell, data } = mask;
  const r = radiusMm / cell;
  const outside = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) outside[i] = data[i] ? 0 : 1;
  const depth = distanceToSet(outside, cols, rows); // cells to the nearest outside cell
  const core = new Uint8Array(data.length);
  let coreCount = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] && depth[i]! - 0.5 >= r) {
      core[i] = 1;
      coreCount++;
    }
  }
  if (coreCount === 0) return area > 0 ? 1 : 0;
  const reach = distanceToSet(core, cols, rows);
  let kept = 0;
  for (let i = 0; i < data.length; i++) if (data[i] && reach[i]! <= r + 0.5) kept++;
  return Math.max(0, Math.min(1, 1 - kept / Math.max(1, area / (cell * cell))));
}

/** For each connected shape: how thick its thickest part is (mm, full width). Specks under 0.5 mm² are ignored. */
function shapeThicknesses(mask: Mask): number[] {
  const { cols, rows, cell, data } = mask;
  const outside = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) outside[i] = data[i] ? 0 : 1;
  const depth = distanceToSet(outside, cols, rows);
  const seen = new Uint8Array(data.length);
  const thicknesses: number[] = [];
  const stack: number[] = [];
  for (let start = 0; start < data.length; start++) {
    if (!data[start] || seen[start]) continue;
    let count = 0;
    let deepest = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length > 0) {
      const i = stack.pop()!;
      count++;
      if (depth[i]! > deepest) deepest = depth[i]!;
      const col = i % cols;
      const row = (i - col) / cols;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const c = col + dc;
        const r = row + dr;
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
        const j = r * cols + c;
        if (data[j] && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    if (count * cell * cell >= 0.5) thicknesses.push((2 * (deepest - 0.5)) * cell);
  }
  return thicknesses;
}

export function analyseFeasibility(layers: readonly ArtworkLayer[], options: FeasibilityOptions = {}): FeasibilityReport | null {
  const { stoneSizes = DEFAULT_SIZES, materialProfileId, tolerance = 0.03 } = options;
  const first = layers.find((layer) => layer.role === 'stones');
  if (!first) return null;
  const base = first.mask;
  const longest = Math.max(base.cols, base.rows) * base.cell;
  const mask = coarseUnion(layers, Math.max(0.2, longest / 600));
  if (!mask) return null;

  let cells = 0;
  let minCol = Infinity;
  let maxCol = -Infinity;
  let minRow = Infinity;
  let maxRow = -Infinity;
  for (let row = 0; row < mask.rows; row++) {
    for (let col = 0; col < mask.cols; col++) {
      if (!mask.data[row * mask.cols + col]) continue;
      cells++;
      if (col < minCol) minCol = col;
      if (col > maxCol) maxCol = col;
      if (row < minRow) minRow = row;
      if (row > maxRow) maxRow = row;
    }
  }
  if (cells === 0) return null;
  const area = cells * mask.cell * mask.cell;
  const widthMm = (maxCol - minCol + 1) * mask.cell;
  const heightMm = (maxRow - minRow + 1) * mask.cell;

  // The opening radius at which the thin share crosses the tolerance: a coarse ladder to bracket it, then bisection.
  const crossing = (() => {
    let lo = 0.4;
    if (thinShare(mask, lo, area) > tolerance) return lo;
    for (let hi = 0.65; hi <= 16; hi *= 1.6) {
      if (thinShare(mask, hi, area) > tolerance) {
        let a = lo;
        let b = hi;
        for (let i = 0; i < 5; i++) {
          const mid = (a + b) / 2;
          if (thinShare(mask, mid, area) > tolerance) b = mid;
          else a = mid;
        }
        return b;
      }
      lo = hi;
    }
    return null; // even the widest radius leaves less than the tolerance thin
  })();

  const thicknesses = shapeThicknesses(mask);
  const perSize = stoneSizes.map((stoneSize): StoneSizeFeasibility => {
    const hole = getRecommendedHoleDiameter(stoneSize, materialProfileId);
    const share = thinShare(mask, hole / 2, area);
    // A little above the target still counts as good, so following the advice always ends in a good verdict.
    const verdict: FeasibilityVerdict = share <= tolerance * 1.4 ? 'good' : share <= 0.15 ? 'some-detail-lost' : 'too-small';
    let suggestedWidthMm: number | null = null;
    if (verdict !== 'good' && crossing !== null && crossing > 0) suggestedWidthMm = Math.max(widthMm, ((widthMm * (hole / 2)) / crossing) * 1.05);
    const lostShapes = thicknesses.filter((t) => t < hole).length;
    return { stoneSize, holeDiameterMm: hole, thinAreaShare: share, lostShapes, totalShapes: thicknesses.length, verdict, suggestedWidthMm };
  });

  return { widthMm, heightMm, areaMm2: area, thinnestPartMm: crossing === null ? null : crossing * 2, perSize };
}
