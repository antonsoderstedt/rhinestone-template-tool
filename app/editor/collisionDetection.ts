/**
 * Collision detection utilities for rhinestone template editing.
 *
 * The required gap between hole edges (not just raw geometric overlap) comes
 * from the active material profile's minimumEdgeSpacingMm — see
 * getMinimumEdgeSpacingMm in the engine's material profiles. Defaults to the
 * app's default material profile (Magic Flock) when no profile id is given.
 */

import type { EditableStone } from './EditorState';
import type { Circle } from '@/src/lib/rhinestone-engine/types/index';
import { circlesOverlap } from '@/src/lib/rhinestone-engine/geometry/collision';
import { getMinimumEdgeSpacingMm } from '@/src/lib/rhinestone-engine/profiles/materialProfiles';

/**
 * Check if a new stone would collide with existing stones (i.e. leave less
 * than the material's minimum edge-to-edge spacing between any two holes).
 */
export function wouldCollide(
  newStoneX: number,
  newStoneY: number,
  newStoneRadius: number,
  existingStones: EditableStone[] | readonly EditableStone[],
  excludeIds: string[] = [],
  materialProfileId?: string,
): { collides: boolean; collidingStones: EditableStone[] } {
  const excludeSet = new Set(excludeIds);
  const collidingStones: EditableStone[] = [];
  const minGapMm = getMinimumEdgeSpacingMm(materialProfileId);

  const newCircle: Circle = {
    center: { x: newStoneX, y: newStoneY },
    radiusMm: newStoneRadius,
  };

  for (const stone of existingStones) {
    if (excludeSet.has(stone.id)) continue;

    const existingCircle: Circle = {
      center: stone.center,
      radiusMm: stone.holeDiameterMm / 2,
    };

    if (circlesOverlap(newCircle, existingCircle, minGapMm)) {
      collidingStones.push(stone);
    }
  }

  return {
    collides: collidingStones.length > 0,
    collidingStones,
  };
}

/**
 * Check if moving stones would cause collisions (i.e. leave less than the
 * material's minimum edge-to-edge spacing between any two holes).
 */
export function wouldMoveCauseCollision(
  moves: Array<{ id: string; toX: number; toY: number }>,
  allStones: EditableStone[],
  materialProfileId?: string,
): { collides: boolean; collidingPairs: Array<[string, string]> } {
  const moveMap = new Map(moves.map(m => [m.id, { x: m.toX, y: m.toY }]));
  const movingIds = new Set(moves.map(m => m.id));
  const collidingPairs: Array<[string, string]> = [];
  const minGapMm = getMinimumEdgeSpacingMm(materialProfileId);

  // Temporary positions for all stones, bucketed on a grid so that each moving stone is only compared with the stones near it.
  // (Comparing every pair made nudging a few thousand stones take seconds.)
  const tempPositions = allStones.map(stone => {
    const newPos = moveMap.get(stone.id);
    return {
      id: stone.id,
      circle: {
        center: {
          x: newPos?.x ?? stone.center.x,
          y: newPos?.y ?? stone.center.y,
        },
        radiusMm: stone.holeDiameterMm / 2,
      } as Circle,
    };
  });

  let largestRadius = 0;
  for (const entry of tempPositions) largestRadius = Math.max(largestRadius, entry.circle.radiusMm);
  // Two circles can only be too close when their centres are within both radii plus the gap.
  const reach = largestRadius * 2 + minGapMm;
  const cell = Math.max(reach, 1e-6);
  const keyOf = (x: number, y: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  const buckets = new Map<string, number[]>();
  tempPositions.forEach((entry, index) => {
    const key = keyOf(entry.circle.center.x, entry.circle.center.y);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(index);
    else buckets.set(key, [index]);
  });

  const found: Array<[number, number]> = [];
  tempPositions.forEach((a, i) => {
    if (!movingIds.has(a.id)) return;
    const cx = Math.floor(a.circle.center.x / cell);
    const cy = Math.floor(a.circle.center.y / cell);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const j of buckets.get(`${cx + dx},${cy + dy}`) ?? []) {
          if (j === i) continue;
          // A pair of two moving stones is seen from both sides; keep it once, from the earlier one.
          if (movingIds.has(tempPositions[j]!.id) && j < i) continue;
          if (circlesOverlap(a.circle, tempPositions[j]!.circle, minGapMm)) found.push([Math.min(i, j), Math.max(i, j)]);
        }
      }
    }
  });
  // Same order as comparing all pairs: by the earlier stone, then the later one.
  found.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  for (const [i, j] of found) collidingPairs.push([tempPositions[i]!.id, tempPositions[j]!.id]);

  return {
    collides: collidingPairs.length > 0,
    collidingPairs,
  };
}

export function findNearestValidStonePosition(
  desiredX: number,
  desiredY: number,
  radiusMm: number,
  existingStones: EditableStone[] | readonly EditableStone[],
  options?: {
    excludeIds?: string[];
    snapToGrid?: boolean;
    gridSizeMm?: number;
    searchStepMm?: number;
    maxRadiusMm?: number;
    materialProfileId?: string;
  },
): { x: number; y: number } | null {
  const excludeIds = options?.excludeIds ?? [];
  const snapToGrid = options?.snapToGrid ?? false;
  const gridSizeMm = options?.gridSizeMm ?? 1;
  const searchStepMm = options?.searchStepMm ?? Math.max(radiusMm, 1);
  const maxRadiusMm = options?.maxRadiusMm ?? Math.max(searchStepMm * 8, radiusMm * 6);
  const materialProfileId = options?.materialProfileId;

  const normalizePoint = (x: number, y: number) => ({
    x: snapToGrid ? Math.round(x / gridSizeMm) * gridSizeMm : x,
    y: snapToGrid ? Math.round(y / gridSizeMm) * gridSizeMm : y,
  });

  const desired = normalizePoint(desiredX, desiredY);
  if (!wouldCollide(desired.x, desired.y, radiusMm, existingStones, excludeIds, materialProfileId).collides) {
    return desired;
  }

  for (let ringRadius = searchStepMm; ringRadius <= maxRadiusMm; ringRadius += searchStepMm) {
    const steps = Math.max(8, Math.ceil((Math.PI * 2 * ringRadius) / searchStepMm));
    for (let step = 0; step < steps; step += 1) {
      const angle = (step / steps) * Math.PI * 2;
      const candidate = normalizePoint(
        desiredX + Math.cos(angle) * ringRadius,
        desiredY + Math.sin(angle) * ringRadius,
      );
      if (!wouldCollide(candidate.x, candidate.y, radiusMm, existingStones, excludeIds, materialProfileId).collides) {
        return candidate;
      }
    }
  }

  return null;
}
