/**
 * Makes a stone layout whose stones physically overlap cuttable.
 *
 * Some vendor rhinestone fonts are drawings made of dots that overlap on purpose (so the letters look solid).
 * As a template those holes would merge, so they cannot be cut. The right fix is to enlarge the whole layout until
 * the stones have room (`enlargeToCuttableSpacing`): every stone and every letter shape survives, the design just
 * gets bigger, which is physically what that many stones of that size need. Throwing stones away instead
 * (`thinStonesToSpacing`) destroys the letters, so it is only used on the few stones the enlargement leaves too close.
 * Pure and deterministic.
 */

import type { RhinestoneTemplate, Stone } from '../types/index';

export interface ThinStonesOptions {
  /** Minimum edge-to-edge gap between kept stones, in millimetres. */
  minGapMm: number;
}

export interface ThinStonesResult {
  template: RhinestoneTemplate;
  keptCount: number;
  removedCount: number;
}

function edgeGap(a: Stone, b: Stone): number {
  return Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y) - (a.holeDiameterMm + b.holeDiameterMm) / 2;
}

/** True when at least two stones overlap (negative edge gap), the case thinning exists for. */
export function hasOverlappingStones(stones: readonly Stone[]): boolean {
  if (stones.length < 2) return false;
  const cell = Math.max(...stones.map((s) => s.holeDiameterMm)) + 0.001;
  const grid = new Map<string, Stone[]>();
  for (const stone of stones) {
    const key = `${Math.floor(stone.center.x / cell)}:${Math.floor(stone.center.y / cell)}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(stone);
    else grid.set(key, [stone]);
  }
  for (const stone of stones) {
    const cx = Math.floor(stone.center.x / cell);
    const cy = Math.floor(stone.center.y / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const other of grid.get(`${cx + dx}:${cy + dy}`) ?? []) {
          if (other !== stone && edgeGap(stone, other) < 0) return true;
        }
      }
    }
  }
  return false;
}

export function thinStonesToSpacing(template: RhinestoneTemplate, options: ThinStonesOptions): ThinStonesResult {
  const { minGapMm } = options;
  const maxDiameter = template.stones.reduce((max, s) => Math.max(max, s.holeDiameterMm), 0);
  const cell = Math.max(maxDiameter + minGapMm, 0.001);
  const grid = new Map<string, Stone[]>();
  const kept: Stone[] = [];

  for (const stone of template.stones) {
    const cx = Math.floor(stone.center.x / cell);
    const cy = Math.floor(stone.center.y / cell);
    let blocked = false;
    for (let dx = -1; dx <= 1 && !blocked; dx++) {
      for (let dy = -1; dy <= 1 && !blocked; dy++) {
        for (const other of grid.get(`${cx + dx}:${cy + dy}`) ?? []) {
          if (edgeGap(stone, other) < minGapMm) {
            blocked = true;
            break;
          }
        }
      }
    }
    if (blocked) continue;
    kept.push(stone);
    const key = `${cx}:${cy}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(stone);
    else grid.set(key, [stone]);
  }

  const removedCount = template.stones.length - kept.length;
  return {
    template: {
      ...template,
      stones: kept.map((stone) => ({ ...stone, center: { ...stone.center } })),
      metadata: {
        ...(template.metadata ?? {}),
        thinnedFromStoneCount: template.stones.length,
        removedStoneCount: removedCount,
        resolvedSpacingMm: minGapMm,
      },
    },
    keptCount: kept.length,
    removedCount,
  };
}


export interface EnlargeToCuttableResult {
  template: RhinestoneTemplate;
  /** Factor the layout was enlarged by (1 = unchanged). */
  scale: number;
  /** Stones removed afterwards because a few were still too close. */
  removedCount: number;
}

/** Spacing of the closest neighbour of each stone, smallest first. O(n^2), fine for the few thousand stones of a font. */
function sortedNearestNeighbourDistances(stones: readonly Stone[]): number[] {
  const distances: number[] = [];
  for (let i = 0; i < stones.length; i++) {
    let nearest = Infinity;
    const a = stones[i]!;
    for (let j = 0; j < stones.length; j++) {
      if (i === j) continue;
      const b = stones[j]!;
      const d = Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y);
      if (d < nearest) nearest = d;
    }
    distances.push(nearest);
  }
  return distances.sort((x, y) => x - y);
}

/**
 * If any stones overlap, enlarges the layout (about its top-left corner) so that the typical closest pair is
 * `minGapMm` apart edge to edge, then drops the few stones that are still too close. Stone sizes are unchanged. A
 * layout without overlaps is returned as it is.
 */
export function enlargeToCuttableSpacing(template: RhinestoneTemplate, options: ThinStonesOptions): EnlargeToCuttableResult {
  const { minGapMm } = options;
  if (!hasOverlappingStones(template.stones)) return { template, scale: 1, removedCount: 0 };

  const distances = sortedNearestNeighbourDistances(template.stones);
  // The 5th percentile rather than the smallest, so one or two odd pairs do not blow the whole design up.
  const reference = distances[Math.min(distances.length - 1, Math.floor(distances.length * 0.05))]!;
  const maxDiameter = template.stones.reduce((max, s) => Math.max(max, s.holeDiameterMm), 0);
  // A hair of margin (0.2 %) so stones that land exactly on the limit are not lost to rounding.
  const scale = reference > 0 ? Math.max(1, ((maxDiameter + minGapMm) / reference) * 1.002) : 1;

  const originX = Math.min(...template.stones.map((s) => s.center.x));
  const originY = Math.min(...template.stones.map((s) => s.center.y));
  const enlarged: RhinestoneTemplate = {
    ...template,
    stones: template.stones.map((stone) => ({
      ...stone,
      center: { x: originX + (stone.center.x - originX) * scale, y: originY + (stone.center.y - originY) * scale },
    })),
    widthMm: template.widthMm === undefined ? undefined : template.widthMm * scale,
    heightMm: template.heightMm === undefined ? undefined : template.heightMm * scale,
  };

  const thinned = thinStonesToSpacing(enlarged, { minGapMm });
  return {
    template: {
      ...thinned.template,
      metadata: { ...(thinned.template.metadata ?? {}), enlargedByFactor: Number(scale.toFixed(3)) },
    },
    scale,
    removedCount: thinned.removedCount,
  };
}
