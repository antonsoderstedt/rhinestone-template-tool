import type { RhinestoneTemplate } from '../types/index';

export type ResolveStoneSpacingStrategy = 'nudge' | 'remove-lesser';

export interface ResolveStoneSpacingOptions {
  /** Minimum required edge gap between nearby stones, in millimeters. */
  minGapMm?: number;
  /** Strategy used when two stones violate the minimum gap. */
  strategy?: ResolveStoneSpacingStrategy;
}

function getStoneRadiusMm(stone: RhinestoneTemplate['stones'][number]): number {
  return stone.holeDiameterMm / 2;
}

function compareStoneIds(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function getStonePairGapMm(
  a: RhinestoneTemplate['stones'][number],
  b: RhinestoneTemplate['stones'][number],
): number {
  const dx = b.center.x - a.center.x;
  const dy = b.center.y - a.center.y;
  const centerDistanceMm = Math.hypot(dx, dy);
  return centerDistanceMm - (getStoneRadiusMm(a) + getStoneRadiusMm(b));
}

function sortStonesByStableOrder(stones: RhinestoneTemplate['stones']): RhinestoneTemplate['stones'] {
  return [...stones].sort((a, b) => {
    const idComparison = compareStoneIds(a.id, b.id);
    if (idComparison !== 0) return idComparison;
    if (Math.abs(a.center.y - b.center.y) > 1e-9) return a.center.y - b.center.y;
    return a.center.x - b.center.x;
  });
}

function cloneStones(stones: RhinestoneTemplate['stones']): RhinestoneTemplate['stones'] {
  return stones.map((stone) => ({
    ...stone,
    center: { ...stone.center },
    metadata: stone.metadata ? { ...stone.metadata } : undefined,
  }));
}

function getDeterministicDirection(aId: string, bId: string): { x: number; y: number } {
  const stable = `${aId}:${bId}`;
  let hash = 0;
  for (let i = 0; i < stable.length; i++) {
    hash = (hash * 131 + stable.charCodeAt(i)) >>> 0;
  }
  const angle = (hash % 9973) / 9973 * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function buildSpatialMap(stones: RhinestoneTemplate['stones'], minGapMm: number): {
  cellSize: number;
  map: Map<string, number[]>;
} {
  const maxRadius = stones.reduce((max, stone) => Math.max(max, getStoneRadiusMm(stone)), 0);
  const cellSize = Math.max(1, minGapMm + maxRadius * 2 + 0.25);
  const map = new Map<string, number[]>();

  for (let index = 0; index < stones.length; index++) {
    const stone = stones[index]!;
    const cellX = Math.floor(stone.center.x / cellSize);
    const cellY = Math.floor(stone.center.y / cellSize);
    const key = `${cellX}:${cellY}`;
    const bucket = map.get(key) ?? [];
    bucket.push(index);
    map.set(key, bucket);
  }

  return { cellSize, map };
}

function findViolatingPairs(stones: RhinestoneTemplate['stones'], minGapMm: number): Array<[number, number]> {
  if (stones.length < 2) return [];

  const { cellSize, map } = buildSpatialMap(stones, minGapMm);
  const seen = new Set<string>();
  const violations: Array<[number, number]> = [];

  for (let i = 0; i < stones.length; i++) {
    const stoneA = stones[i]!;
    const baseCellX = Math.floor(stoneA.center.x / cellSize);
    const baseCellY = Math.floor(stoneA.center.y / cellSize);

    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      for (let offsetY = -1; offsetY <= 1; offsetY++) {
        const key = `${baseCellX + offsetX}:${baseCellY + offsetY}`;
        const bucket = map.get(key);
        if (!bucket) continue;

        for (const index of bucket) {
          if (index <= i) continue;
          const pairKey = `${Math.min(i, index)}:${Math.max(i, index)}`;
          if (seen.has(pairKey)) continue;
          seen.add(pairKey);

          const stoneB = stones[index]!;
          if (getStonePairGapMm(stoneA, stoneB) < minGapMm) {
            violations.push([i, index]);
          }
        }
      }
    }
  }

  return violations;
}

function addDelta(map: Map<string, { x: number; y: number }>, id: string, dx: number, dy: number): void {
  const current = map.get(id) ?? { x: 0, y: 0 };
  current.x += dx;
  current.y += dy;
  map.set(id, current);
}

export function resolveStoneSpacing(
  template: RhinestoneTemplate,
  options: ResolveStoneSpacingOptions = {},
): RhinestoneTemplate {
  const minGapMm = options.minGapMm ?? 0.508;
  const strategy = options.strategy ?? 'nudge';
  const metadata = template.metadata ?? {};

  let stones = cloneStones(sortStonesByStableOrder(template.stones));
  const movedStoneIds = new Set<string>();
  let removedStoneCount = 0;
  let maxDisplacementMm = 0;
  let resolutionPasses = 0;
  const maxPasses = 500;

  const isAlreadyResolved = findViolatingPairs(stones, minGapMm).length === 0;
  if (isAlreadyResolved) {
    return {
      ...template,
      stones: cloneStones(stones),
      metadata: {
        ...metadata,
        resolvedSpacingMm: minGapMm,
        spacingStrategy: strategy,
        removedStoneCount: typeof metadata.removedStoneCount === 'number' ? metadata.removedStoneCount : 0,
        movedStoneCount: typeof metadata.movedStoneCount === 'number' ? metadata.movedStoneCount : 0,
        maxDisplacementMm: typeof metadata.maxDisplacementMm === 'number' ? metadata.maxDisplacementMm : 0,
        resolutionPasses: typeof metadata.resolutionPasses === 'number' ? metadata.resolutionPasses : 0,
        tooDenseForStoneSize: Boolean(metadata.tooDenseForStoneSize),
      },
    };
  }

  for (let pass = 0; pass < maxPasses; pass++) {
    const violations = findViolatingPairs(stones, minGapMm);
    if (violations.length === 0) {
      break;
    }

    if (strategy === 'remove-lesser') {
      const [i, j] = violations[0]!;
      const a = stones[i]!;
      const b = stones[j]!;
      const removeItem = getStoneRadiusMm(a) <= getStoneRadiusMm(b)
        ? a
        : b;
      stones = stones.filter((stone) => stone.id !== removeItem.id);
      removedStoneCount += 1;
      resolutionPasses += 1;
      continue;
    }

    const deltaByStoneId = new Map<string, { x: number; y: number }>();

    for (const [i, j] of violations) {
      const a = stones[i]!;
      const b = stones[j]!;
      const dx = b.center.x - a.center.x;
      const dy = b.center.y - a.center.y;
      const centerDistanceMm = Math.hypot(dx, dy);
      const radiusSumMm = getStoneRadiusMm(a) + getStoneRadiusMm(b);
      const requiredCenterOffsetMm = Math.max(0, radiusSumMm + minGapMm - centerDistanceMm) + 1e-9;
      if (requiredCenterOffsetMm <= 1e-12) continue;

      const direction = centerDistanceMm > 1e-12
        ? { x: dx / centerDistanceMm, y: dy / centerDistanceMm }
        : getDeterministicDirection(a.id, b.id);

      const moveDistanceMm = requiredCenterOffsetMm;
      addDelta(deltaByStoneId, a.id, -direction.x * moveDistanceMm, -direction.y * moveDistanceMm);
      addDelta(deltaByStoneId, b.id, direction.x * moveDistanceMm, direction.y * moveDistanceMm);
    }

    let movedThisPass = false;
    for (const stone of stones) {
      const delta = deltaByStoneId.get(stone.id);
      if (!delta) continue;

      const displacementMm = Math.hypot(delta.x, delta.y);
      if (displacementMm < 1e-9) continue;

      stone.center.x += delta.x;
      stone.center.y += delta.y;
      movedStoneIds.add(stone.id);
      maxDisplacementMm = Math.max(maxDisplacementMm, displacementMm);
      movedThisPass = true;
    }

    resolutionPasses += 1;
    if (!movedThisPass) break;
  }

  while (true) {
    const remainingViolations = findViolatingPairs(stones, minGapMm);
    if (remainingViolations.length === 0) break;

    const [i, j] = remainingViolations[0]!;
    const a = stones[i]!;
    const b = stones[j]!;
    const removeItem = getStoneRadiusMm(a) <= getStoneRadiusMm(b)
      ? a
      : b;
    stones = stones.filter((stone) => stone.id !== removeItem.id);
    removedStoneCount += 1;
  }

  const maxStoneRadiusMm = stones.reduce((max, stone) => Math.max(max, getStoneRadiusMm(stone)), 0);
  const tooDenseForStoneSize = removedStoneCount > 0 || maxDisplacementMm > maxStoneRadiusMm * 1.5;

  return {
    ...template,
    stones,
    metadata: {
      ...metadata,
      resolvedSpacingMm: minGapMm,
      spacingStrategy: strategy,
      removedStoneCount,
      movedStoneCount: movedStoneIds.size,
      maxDisplacementMm,
      resolutionPasses,
      tooDenseForStoneSize,
    },
  };
}
