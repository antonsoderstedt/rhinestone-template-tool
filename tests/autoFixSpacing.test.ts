import { describe, expect, it } from 'vitest';
import { autoFixSpacing, checkExportReadiness, validateRhinestoneTemplate } from '../src/lib/rhinestone-engine/index';
import type { RhinestoneTemplate, Stone } from '../src/lib/rhinestone-engine/index';

const MIN_GAP = 0.508;

function stone(id: string, x: number, y: number): Stone {
  return { id, center: { x, y }, stoneSize: 'SS10', holeDiameterMm: 3 };
}

function template(stones: Stone[]): RhinestoneTemplate {
  return { id: 't', name: 'Test', unit: 'mm', stones };
}

describe('autoFixSpacing', () => {
  it('leaves a clean design alone and says so', () => {
    const clean = template([stone('a', 10, 10), stone('b', 20, 10), stone('c', 30, 10)]);
    const result = autoFixSpacing(clean, { minGapMm: MIN_GAP });
    expect(result.changed).toBe(false);
    expect(result.issuesBefore).toBe(0);
    expect(result.template).toBe(clean);
  });

  it('moves overlapping stones apart until the spacing rule holds', () => {
    const crowded = template([stone('a', 10, 10), stone('b', 10.5, 10), stone('c', 11, 10.4), stone('d', 40, 40)]);
    expect(validateRhinestoneTemplate(crowded, { minGapMm: MIN_GAP }).issues.length).toBeGreaterThan(0);

    const result = autoFixSpacing(crowded, { minGapMm: MIN_GAP });
    expect(result.changed).toBe(true);
    expect(result.issuesBefore).toBeGreaterThan(0);
    expect(result.movedStoneCount + result.removedStoneCount).toBeGreaterThan(0);
    expect(result.remainingIssues.filter((i) => /OVERLAP|COLLISION|TIGHT_GAP/.test(i.code))).toEqual([]);
    expect(checkExportReadiness(result.template).issues.some((i) => i.code === 'STONE_COLLISION' || i.code === 'STONE_TIGHT_GAP')).toBe(false);
  });

  it('does not touch the stone that was already fine', () => {
    const crowded = template([stone('a', 10, 10), stone('b', 10.5, 10), stone('far', 80, 80)]);
    const result = autoFixSpacing(crowded, { minGapMm: MIN_GAP });
    const far = result.template.stones.find((s) => s.id === 'far')!;
    expect(far.center).toEqual({ x: 80, y: 80 });
  });

  it('does not mutate its input and is deterministic', () => {
    const crowded = template([stone('a', 10, 10), stone('b', 10.5, 10)]);
    const snapshot = JSON.parse(JSON.stringify(crowded));
    const first = autoFixSpacing(crowded, { minGapMm: MIN_GAP });
    const second = autoFixSpacing(crowded, { minGapMm: MIN_GAP });
    expect(crowded).toEqual(snapshot);
    expect(first.template.stones).toEqual(second.template.stones);
  });

  it('reports the work of this run only, not counts left over from an earlier run', () => {
    const crowded = { ...template([stone('a', 10, 10), stone('b', 10.5, 10)]), metadata: { movedStoneCount: 99, removedStoneCount: 99 } };
    const result = autoFixSpacing(crowded, { minGapMm: MIN_GAP });
    expect(result.movedStoneCount).toBeLessThan(99);
    expect(result.removedStoneCount).toBeLessThan(99);
  });
});

describe('export readiness warnings for big designs', () => {
  function bigGrid(count: number, pitchMm: number): RhinestoneTemplate {
    const cols = Math.ceil(Math.sqrt(count));
    return template(Array.from({ length: count }, (_, i) => stone(`s${i}`, 5 + (i % cols) * pitchMm, 5 + Math.floor(i / cols) * pitchMm)));
  }

  it('does not warn at exactly 1500 stones but does at 1501', () => {
    const at = checkExportReadiness(bigGrid(1500, 4));
    const over = checkExportReadiness(bigGrid(1501, 4));
    expect(at.issues.some((i) => i.code === 'HIGH_STONE_COUNT')).toBe(false);
    const warning = over.issues.find((i) => i.code === 'HIGH_STONE_COUNT');
    expect(warning?.severity).toBe('warning');
    expect(warning?.message).toContain('1501');
    expect(over.ready).toBe(true); // a warning, not a blocker
  });

  it('warns when the design is larger than a 12 x 24 mat, but not when it fits one', () => {
    const wide = checkExportReadiness(template([stone('a', 5, 5), stone('b', 700, 5)]));
    expect(wide.issues.find((i) => i.code === 'EXCEEDS_MAT_SIZE')?.severity).toBe('warning');
    const ok = checkExportReadiness(template([stone('a', 5, 5), stone('b', 400, 5)]));
    expect(ok.issues.some((i) => i.code === 'EXCEEDS_MAT_SIZE')).toBe(false);
  });
});
