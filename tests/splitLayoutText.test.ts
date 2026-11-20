import { describe, expect, it } from 'vitest';
import { planSplitForMat } from '../src/lib/rhinestone-engine/index';
import { buildLayoutText } from '../app/editor/SplitExportPanel';

describe('buildLayoutText', () => {
  it('lists every part with its file, size and offset from the design top left', () => {
    const stones = Array.from({ length: 80 }, (_, i) => ({ id: `s${i}`, center: { x: 2 + i * 5, y: 10 }, holeDiameterMm: 3 }));
    const plan = planSplitForMat(
      { id: 't', name: 't', unit: 'mm', stones } as never,
      { shortSideMm: 150, longSideMm: 150 },
    );
    expect(plan.parts.length).toBeGreaterThan(1);
    const files = plan.parts.map((_, i) => `p${i + 1}.svg`);
    const text = buildLayoutText('My name', plan, '12 × 12 in', files);
    expect(text).toContain(`My name – split into ${plan.parts.length} parts`);
    for (const file of files) expect(text).toContain(file);
    expect(text).toMatch(/Part 1: p1\.svg\n {2}column 1, row 1/);
    expect(text).toContain('0.0 mm right, 0.0 mm down');
    expect(text).not.toMatch(/\n\n\n/);
  });
});
