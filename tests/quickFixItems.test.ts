import { describe, expect, it } from 'vitest';
import { checkExportReadiness } from '../src/lib/rhinestone-engine/index';
import type { RhinestoneTemplate, Stone } from '../src/lib/rhinestone-engine/index';
import { getQuickFixes, hasSpacingIssues } from '../app/editor/quickFixItems';

function stone(id: string, x: number, y: number): Stone {
  return { id, center: { x, y }, stoneSize: 'SS10', holeDiameterMm: 3 };
}
function template(stones: Stone[]): RhinestoneTemplate {
  return { id: 't', name: 'T', unit: 'mm', stones };
}

describe('getQuickFixes', () => {
  it('offers nothing for a clean design that fits a 12 x 12 mat', () => {
    const result = checkExportReadiness(template([stone('a', 10, 10), stone('b', 30, 10)]));
    expect(getQuickFixes(result)).toEqual([]);
    expect(hasSpacingIssues(result)).toBe(false);
  });

  it('offers nothing without a design', () => {
    expect(getQuickFixes(null)).toEqual([]);
    expect(getQuickFixes(checkExportReadiness(template([])))).toEqual([]);
  });

  it('offers an automatic spacing fix when stones are too close', () => {
    const result = checkExportReadiness(template([stone('a', 10, 10), stone('b', 10.5, 10)]));
    expect(hasSpacingIssues(result)).toBe(true);
    const fix = getQuickFixes(result).find((item) => item.id === 'spacing');
    expect(fix?.action).toBe('auto-fix-spacing');
    expect(fix?.title).toMatch(/too close/);
  });

  it('offers to shrink a design that needs a 12 x 24 mat, as information', () => {
    const result = checkExportReadiness(template([stone('a', 10, 10), stone('b', 400, 10)]));
    const fix = getQuickFixes(result).find((item) => item.id === 'mat-needs-large');
    expect(fix?.tone).toBe('info');
    expect(fix?.action).toBe('fit-12x12');
  });

  it('warns and offers fit to a 12 x 24 mat when nothing fits', () => {
    const result = checkExportReadiness(template([stone('a', 10, 10), stone('b', 800, 10)]));
    const fix = getQuickFixes(result).find((item) => item.id === 'mat-too-large');
    expect(fix?.tone).toBe('warning');
    expect(fix?.action).toBe('fit-12x24');
  });

  it('explains a very high stone count without offering a button', () => {
    const cols = 40;
    const stones = Array.from({ length: 1600 }, (_, i) => stone(`s${i}`, 5 + (i % cols) * 4, 5 + Math.floor(i / cols) * 4));
    const fix = getQuickFixes(checkExportReadiness(template(stones))).find((item) => item.id === 'many-stones');
    expect(fix?.action).toBeNull();
    expect(fix?.title).toContain('1,600');
  });
});
