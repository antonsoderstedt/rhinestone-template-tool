/**
 * A small test patch: a few rows of stones with the same hole size and the same tight spacing as the design, to cut
 * first on a scrap of material. If the patch cuts cleanly and the stones sit well, the real design will too; if not,
 * only a few centimetres of flock were wasted.
 *
 * Pure.
 */

import { createRhinestoneTemplate, getMinimumCenterDistance, type RhinestoneTemplate, type Stone } from '@/src/lib/rhinestone-engine/index';

export const TEST_PATCH_COLUMNS = 5;
export const TEST_PATCH_ROWS = 5;

/** The spacing and hole size the patch copies from a design, or null when there is nothing to copy. */
export function measureForTestPatch(
  stones: ReadonlyArray<{ center: { x: number; y: number }; holeDiameterMm: number; stoneSize: string }>,
): { holeDiameterMm: number; pitchMm: number; stoneSize: string } | null {
  if (stones.length === 0) return null;
  const holes = stones.map((s) => s.holeDiameterMm).sort((a, b) => a - b);
  const holeDiameterMm = holes[Math.floor(holes.length / 2)]!;
  const stoneSize = stones[0]!.stoneSize;

  // Distance from each stone to its nearest neighbour (a sample of the design is enough). The tight spots are what a test
  // should prove, so take the 10th percentile rather than the typical distance.
  const step = Math.max(1, Math.floor(stones.length / 300));
  const nearest: number[] = [];
  for (let i = 0; i < stones.length; i += step) {
    let best = Infinity;
    for (let j = 0; j < stones.length; j++) {
      if (j === i) continue;
      const d = Math.hypot(stones[i]!.center.x - stones[j]!.center.x, stones[i]!.center.y - stones[j]!.center.y);
      if (d < best) best = d;
    }
    if (Number.isFinite(best)) nearest.push(best);
  }
  const floor = getMinimumCenterDistance(holeDiameterMm / 2, holeDiameterMm / 2);
  nearest.sort((a, b) => a - b);
  const tight = nearest.length > 0 ? nearest[Math.floor(nearest.length * 0.1)]! : floor * 1.2;
  return { holeDiameterMm, pitchMm: Math.round(Math.max(tight, floor) * 1000) / 1000, stoneSize };
}

export function buildTestPatch(
  stones: ReadonlyArray<{ center: { x: number; y: number }; holeDiameterMm: number; stoneSize: string }>,
): RhinestoneTemplate | null {
  const measured = measureForTestPatch(stones);
  if (!measured) return null;
  const patch: Stone[] = [];
  for (let row = 0; row < TEST_PATCH_ROWS; row++) {
    for (let col = 0; col < TEST_PATCH_COLUMNS; col++) {
      patch.push({
        id: `patch-${row * TEST_PATCH_COLUMNS + col + 1}`,
        center: { x: 10 + col * measured.pitchMm, y: 10 + row * measured.pitchMm },
        stoneSize: measured.stoneSize as Stone['stoneSize'],
        holeDiameterMm: measured.holeDiameterMm,
        metadata: { testPatch: true },
      });
    }
  }
  return createRhinestoneTemplate({ id: 'test-patch', name: 'Test patch', stones: patch, metadata: { generatedBy: 'testPatch', spacingMm: measured.pitchMm } });
}
