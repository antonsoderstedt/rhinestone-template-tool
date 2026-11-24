import { describe, expect, it } from 'vitest';
import { TEST_PATCH_COLUMNS, TEST_PATCH_ROWS, buildTestPatch, measureForTestPatch } from '../app/editor/testPatch';
import { checkExportReadiness, createOutlineTextTemplateAsync, getMinimumCenterDistance } from '../src/lib/rhinestone-engine/index';

const stone = (x: number, y: number, hole = 3.43) => ({ center: { x, y }, holeDiameterMm: hole, stoneSize: 'SS10' });

describe('test patch', () => {
  it('has nothing to copy from an empty design', () => {
    expect(measureForTestPatch([])).toBeNull();
    expect(buildTestPatch([])).toBeNull();
  });

  it('copies the hole size and the tight spacing of the design', () => {
    // A row 5 mm apart with a few pairs 4.3 mm apart: the tight spots decide the pitch.
    const row = Array.from({ length: 20 }, (_, i) => stone(10 + i * 5, 10));
    const tight = [stone(10, 30), stone(14.3, 30), stone(30, 30), stone(34.3, 30)];
    const measured = measureForTestPatch([...row, ...tight])!;
    expect(measured.holeDiameterMm).toBeCloseTo(3.43);
    expect(measured.pitchMm).toBeGreaterThanOrEqual(getMinimumCenterDistance(1.715, 1.715));
    expect(measured.pitchMm).toBeLessThan(5);
  });

  it('never goes below what the material can be cut at, whatever the design does', () => {
    const crowded = [stone(0, 0), stone(1, 0), stone(2, 0), stone(3, 0)];
    const measured = measureForTestPatch(crowded)!;
    expect(measured.pitchMm).toBeGreaterThanOrEqual(getMinimumCenterDistance(1.715, 1.715));
  });

  it('makes a 5 x 5 grid that can be cut', () => {
    const patch = buildTestPatch(Array.from({ length: 30 }, (_, i) => stone(10 + (i % 6) * 5, 10 + Math.floor(i / 6) * 5)))!;
    expect(patch.stones).toHaveLength(TEST_PATCH_COLUMNS * TEST_PATCH_ROWS);
    const bad = checkExportReadiness(patch).issues.filter((i) => ['STONE_OVERLAP', 'STONE_COLLISION', 'STONE_TIGHT_GAP'].includes(i.code));
    expect(bad).toEqual([]);
  });

  it('works from a real generated design', async () => {
    const design = await createOutlineTextTemplateAsync({ id: 'd', name: 'd', text: 'Mia', stoneSize: 'SS10', fontId: 'archivo-black', fontSizeMm: 45 });
    const patch = buildTestPatch(design.stones)!;
    expect(patch.stones).toHaveLength(25);
    expect(patch.stones[0]!.holeDiameterMm).toBeCloseTo(design.stones[0]!.holeDiameterMm, 2);
  });
});
