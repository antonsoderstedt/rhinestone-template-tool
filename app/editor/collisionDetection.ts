/**
 * Collision detection utilities for rhinestone template editing
 */

import type { EditableStone } from './EditorState';
import type { Circle } from '@/src/lib/rhinestone-engine/types/index';
import { circlesOverlap } from '@/src/lib/rhinestone-engine/geometry/collision';

/**
 * Check if a new stone would collide with existing stones
 */
export function wouldCollide(
  newStoneX: number,
  newStoneY: number,
  newStoneRadius: number,
  existingStones: EditableStone[] | readonly EditableStone[],
  excludeIds: string[] = []
): { collides: boolean; collidingStones: EditableStone[] } {
  const excludeSet = new Set(excludeIds);
  const collidingStones: EditableStone[] = [];

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

    if (circlesOverlap(newCircle, existingCircle, 0)) {
      collidingStones.push(stone);
    }
  }

  return {
    collides: collidingStones.length > 0,
    collidingStones,
  };
}

/**
 * Check if moving stones would cause collisions
 */
export function wouldMoveCauseCollision(
  moves: Array<{ id: string; toX: number; toY: number }>,
  allStones: EditableStone[]
): { collides: boolean; collidingPairs: Array<[string, string]> } {
  const moveMap = new Map(moves.map(m => [m.id, { x: m.toX, y: m.toY }]));
  const movingIds = new Set(moves.map(m => m.id));
  const collidingPairs: Array<[string, string]> = [];

  // Create temporary positions for all stones
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

  // Check all pairs
  for (let i = 0; i < tempPositions.length; i++) {
    for (let j = i + 1; j < tempPositions.length; j++) {
      const a = tempPositions[i]!;
      const b = tempPositions[j]!;

      // Skip if neither stone is moving
      if (!movingIds.has(a.id) && !movingIds.has(b.id)) continue;

      if (circlesOverlap(a.circle, b.circle, 0)) {
        collidingPairs.push([a.id, b.id]);
      }
    }
  }

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
  },
): { x: number; y: number } | null {
  const excludeIds = options?.excludeIds ?? [];
  const snapToGrid = options?.snapToGrid ?? false;
  const gridSizeMm = options?.gridSizeMm ?? 1;
  const searchStepMm = options?.searchStepMm ?? Math.max(radiusMm, 1);
  const maxRadiusMm = options?.maxRadiusMm ?? Math.max(searchStepMm * 8, radiusMm * 6);

  const normalizePoint = (x: number, y: number) => ({
    x: snapToGrid ? Math.round(x / gridSizeMm) * gridSizeMm : x,
    y: snapToGrid ? Math.round(y / gridSizeMm) * gridSizeMm : y,
  });

  const desired = normalizePoint(desiredX, desiredY);
  if (!wouldCollide(desired.x, desired.y, radiusMm, existingStones, excludeIds).collides) {
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
      if (!wouldCollide(candidate.x, candidate.y, radiusMm, existingStones, excludeIds).collides) {
        return candidate;
      }
    }
  }

  return null;
}
