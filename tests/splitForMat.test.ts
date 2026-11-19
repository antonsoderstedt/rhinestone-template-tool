import { describe, expect, it } from 'vitest';
import { buildPartTemplate, planSplitForMat, validateRhinestoneTemplate } from '../src/lib/rhinestone-engine/index';
import type { RhinestoneTemplate, Stone } from '../src/lib/rhinestone-engine/index';

const MAT_12X12 = { shortSideMm: 292.1, longSideMm: 292.1 };
const MAT_12X24 = { shortSideMm: 292.1, longSideMm: 596.9 };
const PITCH = 4;
const D = 3;

function stone(id: string, x: number, y: number, d = D): Stone {
  return { id, center: { x, y }, stoneSize: 'SS10', holeDiameterMm: d };
}
function template(stones: Stone[]): RhinestoneTemplate {
  return { id: 't', name: 'Design', unit: 'mm', stones };
}
/** A block of stones on a 4 mm grid. */
function block(prefix: string, x0: number, y0: number, cols: number, rows: number): Stone[] {
  return Array.from({ length: cols * rows }, (_, i) => stone(`${prefix}${i}`, x0 + (i % cols) * PITCH, y0 + Math.floor(i / cols) * PITCH));
}
/** Letters of `cols` stones with a gap of `gapStones` empty columns between them, like a word. */
function word(letters: number, cols = 14, rows = 6, gapStones = 3): Stone[] {
  return Array.from({ length: letters }, (_, i) => block(`L${i}-`, 5 + i * (cols + gapStones) * PITCH, 5, cols, rows)).flat();
}
function allStonesOnce(plan: ReturnType<typeof planSplitForMat>, original: readonly Stone[]) {
  const ids = plan.parts.flatMap((p) => p.stones.map((s) => s.id)).sort();
  expect(ids).toEqual(original.map((s) => s.id).sort());
}

describe('planSplitForMat', () => {
  it('leaves a design that fits one mat as a single part', () => {
    const design = template(block('a', 10, 10, 30, 10));
    const plan = planSplitForMat(design, MAT_12X12);
    expect(plan.fitsWhole).toBe(true);
    expect(plan.parts).toHaveLength(1);
    allStonesOnce(plan, design.stones);
  });

  it('counts a wide design that fits a 12 x 24 mat when turned as fitting, not as needing a split', () => {
    const design = template(block('a', 10, 10, 120, 12)); // about 480 x 48 mm
    const plan = planSplitForMat(design, MAT_12X24);
    expect(plan.fitsWhole).toBe(true);
    expect(plan.parts[0]!.needsTurn).toBe(true);
  });

  it('puts the seams in the gaps between letters, so no stone is on a seam', () => {
    const design = template(word(8)); // about 8 x 68 mm = 540 mm wide
    const plan = planSplitForMat(design, MAT_12X12);
    expect(plan.fitsWhole).toBe(false);
    expect(plan.parts.length).toBe(2);
    expect(plan.seamCrossings).toBe(0);
    allStonesOnce(plan, design.stones);
    for (const part of plan.parts) expect(part.widthMm).toBeLessThanOrEqual(292.1 + 1e-6);
    // a seam falls in an empty gap: no stone circle touches it
    const seam = plan.verticalSeamsMm[0]!;
    expect(design.stones.every((s) => Math.abs(s.center.x - seam) >= D / 2)).toBe(true);
  });

  it('makes as few parts as the mat allows', () => {
    const design = template(word(14)); // about 950 mm wide: 4 parts at 292 mm (3 would need 876 mm and 3 seams do not fit)
    const plan = planSplitForMat(design, MAT_12X12);
    expect(plan.parts.length).toBe(4);
    allStonesOnce(plan, design.stones);
    expect(plan.parts.every((p) => p.widthMm <= 292.1 + 1e-6 && p.heightMm <= 292.1 + 1e-6)).toBe(true);
  });

  it('on a solid design with no gaps still keeps every stone whole and every part within the mat', () => {
    const design = template(block('s', 5, 5, 140, 12)); // 560 mm of continuous stones
    const plan = planSplitForMat(design, MAT_12X12);
    expect(plan.parts.length).toBe(2);
    allStonesOnce(plan, design.stones);
    expect(plan.parts.every((p) => p.widthMm <= 292.1 + 1e-6)).toBe(true);
    // the seam crosses as few stones as possible: one column of the grid at most
    expect(plan.seamCrossings).toBeLessThanOrEqual(12);
    // and a part never contains a stone whose centre lies beyond it (stones are assigned by centre)
    const [a, b] = plan.parts;
    expect(Math.max(...a!.stones.map((s) => s.center.x))).toBeLessThan(Math.min(...b!.stones.map((s) => s.center.x)));
  });

  it('splits in both directions and numbers the parts column by column', () => {
    const design = template(block('g', 5, 5, 150, 150)); // 600 x 600 mm
    const plan = planSplitForMat(design, MAT_12X12);
    expect(plan.columnCount).toBe(3);
    expect(plan.parts.length).toBe(9);
    expect(plan.parts.map((p) => p.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(plan.parts.slice(0, 3).every((p) => p.column === 0)).toBe(true);
    expect(plan.parts.slice(0, 3).map((p) => p.row)).toEqual([0, 1, 2]);
    allStonesOnce(plan, design.stones);
    expect(plan.parts.every((p) => p.widthMm <= 292.1 + 1e-6 && p.heightMm <= 292.1 + 1e-6)).toBe(true);
  });

  it('uses the larger mat to need fewer parts, trying the mat both ways round', () => {
    const design = template(block('g', 5, 5, 125, 125)); // 500 x 500 mm
    const on24 = planSplitForMat(design, MAT_12X24);
    const on12 = planSplitForMat(design, MAT_12X12);
    expect(on24.parts.length).toBe(2);
    expect(on12.parts.length).toBe(4);
    allStonesOnce(on24, design.stones);
  });

  it('does not change stone positions or sizes, and gives every part a valid template of its own', () => {
    const design = template(word(8));
    const snapshot = JSON.parse(JSON.stringify(design));
    const plan = planSplitForMat(design, MAT_12X12);
    expect(design).toEqual(snapshot);
    const byId = new Map(design.stones.map((s) => [s.id, s]));
    for (const part of plan.parts) {
      for (const s of part.stones) expect(s).toEqual(byId.get(s.id));
      const partTemplate = buildPartTemplate(design, plan, part);
      expect(partTemplate.metadata?.partIndex).toBe(part.index);
      expect(partTemplate.metadata?.partCount).toBe(plan.parts.length);
      expect(validateRhinestoneTemplate(partTemplate, { minGapMm: 0.508 }).issues.filter((i) => i.severity === 'error')).toEqual([]);
    }
  });

  it('is deterministic', () => {
    const design = template(block('g', 5, 5, 150, 90));
    expect(planSplitForMat(design, MAT_12X12)).toEqual(planSplitForMat(design, MAT_12X12));
  });

  it('says so when the stones are too big to split for the mat, and copes with an empty design', () => {
    const huge = template([stone('a', 0, 0, 300), stone('b', 500, 0, 300)]);
    const plan = planSplitForMat(huge, MAT_12X12);
    expect(plan.splittable).toBe(false);
    expect(planSplitForMat(template([]), MAT_12X12).parts).toEqual([]);
  });
});
