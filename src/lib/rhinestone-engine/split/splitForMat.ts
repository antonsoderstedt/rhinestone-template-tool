/**
 * Splitting a design that does not fit one cutting mat into parts that each do.
 *
 * Cricut mats are 12 x 12 in (usable about 292 x 292 mm) or 12 x 24 in (about 292 x 597 mm). A larger design is cut
 * in parts and the parts are laid side by side on the garment. Rules this follows:
 *
 * - **A stone is never cut.** Every stone goes whole to exactly one part (the side its centre is on).
 * - **Seams run between stones.** Each seam is placed where the fewest circles cross the line, preferring a line no
 *   circle touches, and as far along as the mat allows so there are as few parts as possible.
 * - **Every part fits the mat**, counting the radius of its outermost stones, in either orientation of the mat.
 * - Both orientations of the mat are tried and the one with fewer parts (then fewer crossed stones) is used.
 *
 * Pure and deterministic: all lengths in millimetres, no randomness, no clock.
 */

import type { RhinestoneTemplate, Stone } from '../types/index';

export interface SplitMat {
  /** Usable width of the mat, the short side. */
  shortSideMm: number;
  /** Usable length of the mat, the long side (equal to the short side for a 12 x 12 mat). */
  longSideMm: number;
}

export interface SplitOptions {
  /** Step used when searching for the best seam position. Default 0.25 mm. */
  searchStepMm?: number;
}

export interface DesignPart {
  /** 1-based, left to right and top to bottom within each column. */
  index: number;
  column: number;
  row: number;
  stones: Stone[];
  /** Bounds including the stones' radii. */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  widthMm: number;
  heightMm: number;
  /** True when the part only fits the mat turned 90 degrees (a wide part on a portrait 12 x 24 mat). */
  needsTurn: boolean;
}

export interface SplitPlan {
  parts: DesignPart[];
  /** Whole design size, including stone radii. */
  widthMm: number;
  heightMm: number;
  /** True when the whole design fits the mat and no split is needed. */
  fitsWhole: boolean;
  columnCount: number;
  /** Number of parts in each column. */
  rowCounts: number[];
  /** X positions of the vertical seams. */
  verticalSeamsMm: number[];
  /** Y positions of the horizontal seams, for each column. */
  horizontalSeamsMm: number[][];
  /** Stones whose circle crosses a seam (kept whole, on one side). 0 means every seam runs between stones. */
  seamCrossings: number;
  /** False when the stones are too large to split for this mat at all. */
  splittable: boolean;
}

const DEFAULT_STEP_MM = 0.25;

function radius(stone: Stone): number {
  return stone.holeDiameterMm / 2;
}

function boundsOf(stones: readonly Stone[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stone of stones) {
    const r = radius(stone);
    minX = Math.min(minX, stone.center.x - r);
    minY = Math.min(minY, stone.center.y - r);
    maxX = Math.max(maxX, stone.center.x + r);
    maxY = Math.max(maxY, stone.center.y + r);
  }
  return { minX, minY, maxX, maxY, widthMm: maxX - minX, heightMm: maxY - minY };
}

function coordinate(stone: Stone, axis: 'x' | 'y'): number {
  return axis === 'x' ? stone.center.x : stone.center.y;
}

/** Index of the first value >= target in an ascending array. */
function lowerBound(values: readonly number[], target: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (values[mid]! < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

interface AxisCut {
  groups: Stone[][];
  seams: number[];
  /** Stones crossed by the seams, by the circle of the widest stone. */
  crossings: number;
  splittable: boolean;
}

/** Splits stones into groups along one axis so that each group's extent (radii included) is at most `maxLenMm`. */
function cutAxis(stones: readonly Stone[], axis: 'x' | 'y', maxLenMm: number, stepMm: number): AxisCut {
  const sorted = [...stones].sort((a, b) => coordinate(a, axis) - coordinate(b, axis) || a.id.localeCompare(b.id, undefined, { numeric: true }));
  const extent = (list: readonly Stone[]) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of list) {
      lo = Math.min(lo, coordinate(s, axis) - radius(s));
      hi = Math.max(hi, coordinate(s, axis) + radius(s));
    }
    return { lo, hi };
  };

  const whole = extent(sorted);
  if (sorted.length === 0 || whole.hi - whole.lo <= maxLenMm + 1e-9) {
    return { groups: [sorted], seams: [], crossings: 0, splittable: true };
  }

  const rMax = sorted.reduce((max, s) => Math.max(max, radius(s)), 0);
  // The part has to be able to hold at least one row of stones, and the seam search window must be non-empty.
  if (maxLenMm - rMax <= maxLenMm * 0.5 || maxLenMm <= 2 * rMax) {
    return { groups: [sorted], seams: [], crossings: 0, splittable: false };
  }

  const groups: Stone[][] = [];
  const seams: number[] = [];
  let crossings = 0;
  let remaining = sorted;

  while (remaining.length > 0) {
    const { lo, hi } = extent(remaining);
    if (hi - lo <= maxLenMm + 1e-9) {
      groups.push(remaining);
      break;
    }

    const coords = remaining.map((s) => coordinate(s, axis));
    // A group made of the stones whose centre is left of the seam reaches at most one radius past it.
    const farthest = lo + maxLenMm - rMax;
    const nearest = lo + (maxLenMm - rMax) * 0.5;
    let bestSeam = farthest;
    let bestCount = Infinity;
    for (let x = farthest; x >= nearest - 1e-9; x -= stepMm) {
      const count = lowerBound(coords, x + rMax) - lowerBound(coords, x - rMax);
      if (count < bestCount) {
        bestCount = count;
        bestSeam = x;
        if (count === 0) break; // the farthest seam that no circle touches: as few parts as possible
      }
    }

    const left = remaining.filter((s) => coordinate(s, axis) < bestSeam);
    const right = remaining.filter((s) => coordinate(s, axis) >= bestSeam);
    if (left.length === 0 || right.length === 0) {
      groups.push(remaining);
      return { groups, seams, crossings, splittable: false };
    }
    crossings += remaining.filter((s) => Math.abs(coordinate(s, axis) - bestSeam) < radius(s)).length;
    groups.push(left);
    seams.push(bestSeam);
    remaining = right;
  }

  return { groups, seams, crossings, splittable: true };
}

function fitsMat(width: number, height: number, mat: SplitMat): boolean {
  const { shortSideMm: s, longSideMm: l } = mat;
  return (width <= s + 1e-9 && height <= l + 1e-9) || (height <= s + 1e-9 && width <= l + 1e-9);
}

function planForOrientation(stones: readonly Stone[], maxWidth: number, maxHeight: number, step: number) {
  const columns = cutAxis(stones, 'x', maxWidth, step);
  const horizontalSeams: number[][] = [];
  const groups: Array<{ column: number; row: number; stones: Stone[] }> = [];
  let crossings = columns.crossings;
  let splittable = columns.splittable;

  columns.groups.forEach((columnStones, column) => {
    const rows = cutAxis(columnStones, 'y', maxHeight, step);
    horizontalSeams.push(rows.seams);
    crossings += rows.crossings;
    splittable = splittable && rows.splittable;
    rows.groups.forEach((rowStones, row) => groups.push({ column, row, stones: rowStones }));
  });

  return { groups, columns, horizontalSeams, crossings, splittable };
}

export function planSplitForMat(template: RhinestoneTemplate, mat: SplitMat, options: SplitOptions = {}): SplitPlan {
  const step = options.searchStepMm && options.searchStepMm > 0 ? options.searchStepMm : DEFAULT_STEP_MM;
  const stones = template.stones;

  if (stones.length === 0) {
    return {
      parts: [], widthMm: 0, heightMm: 0, fitsWhole: true, columnCount: 0, rowCounts: [],
      verticalSeamsMm: [], horizontalSeamsMm: [], seamCrossings: 0, splittable: true,
    };
  }

  const whole = boundsOf(stones);
  const wholePart = (): DesignPart => ({
    index: 1, column: 0, row: 0, stones: stones.map((s) => ({ ...s, center: { ...s.center } })),
    minX: whole.minX, minY: whole.minY, maxX: whole.maxX, maxY: whole.maxY, widthMm: whole.widthMm, heightMm: whole.heightMm,
    needsTurn: !(whole.widthMm <= mat.shortSideMm + 1e-9 && whole.heightMm <= mat.longSideMm + 1e-9),
  });

  if (fitsMat(whole.widthMm, whole.heightMm, mat)) {
    return {
      parts: [wholePart()], widthMm: whole.widthMm, heightMm: whole.heightMm, fitsWhole: true, columnCount: 1, rowCounts: [1],
      verticalSeamsMm: [], horizontalSeamsMm: [[]], seamCrossings: 0, splittable: true,
    };
  }

  // The mat can be used either way round; keep the arrangement with fewer parts, then fewer crossed stones.
  const candidates = [planForOrientation(stones, mat.longSideMm, mat.shortSideMm, step)];
  if (mat.longSideMm !== mat.shortSideMm) candidates.push(planForOrientation(stones, mat.shortSideMm, mat.longSideMm, step));
  const best = candidates.reduce((a, b) => (b.groups.length < a.groups.length || (b.groups.length === a.groups.length && b.crossings < a.crossings) ? b : a));

  const parts: DesignPart[] = best.groups.map((group, i) => {
    const b = boundsOf(group.stones);
    return {
      index: i + 1,
      column: group.column,
      row: group.row,
      stones: group.stones.map((s) => ({ ...s, center: { ...s.center } })),
      minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY, widthMm: b.widthMm, heightMm: b.heightMm,
      needsTurn: !(b.widthMm <= mat.shortSideMm + 1e-9 && b.heightMm <= mat.longSideMm + 1e-9),
    };
  });

  return {
    parts,
    widthMm: whole.widthMm,
    heightMm: whole.heightMm,
    fitsWhole: false,
    columnCount: best.columns.groups.length,
    rowCounts: best.columns.groups.map((_, column) => best.groups.filter((g) => g.column === column).length),
    verticalSeamsMm: best.columns.seams,
    horizontalSeamsMm: best.horizontalSeams,
    seamCrossings: best.crossings,
    splittable: best.splittable,
  };
}

/** One part as a template of its own, keeping the original coordinates. Metadata says which part it is. */
export function buildPartTemplate(template: RhinestoneTemplate, plan: SplitPlan, part: DesignPart): RhinestoneTemplate {
  return {
    ...template,
    id: `${template.id}-part-${part.index}`,
    name: `${template.name} (part ${part.index} of ${plan.parts.length})`,
    stones: part.stones,
    // Cut shapes belong to the whole design and cannot be divided; the caller tells the user.
    cutShapes: undefined,
    widthMm: undefined,
    heightMm: undefined,
    metadata: {
      ...(template.metadata ?? {}),
      partIndex: part.index,
      partCount: plan.parts.length,
      partColumn: part.column + 1,
      partRow: part.row + 1,
    },
  };
}
