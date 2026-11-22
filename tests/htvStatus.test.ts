import { describe, expect, it } from 'vitest';
import { summarizeHtvStatus } from '../app/htv/htvStatus';

describe('summarizeHtvStatus', () => {
  it('warns that there is nothing to export for an empty design', () => {
    const result = summarizeHtvStatus([], 'full-front');
    expect(result.status).toBe('Warning');
    expect(result.activeLayerCount).toBe(0);
    expect(result.guidance).toMatch(/nothing to export/i);
  });

  it('never mentions calibration, profiles or the setup workflow', () => {
    const cases = [
      summarizeHtvStatus([], 'full-front'),
      summarizeHtvStatus([{ placementId: 'full-back' }], 'full-front'),
      summarizeHtvStatus([{ placementId: 'full-front' }], 'full-front'),
    ];
    for (const result of cases) {
      expect(result.guidance).not.toMatch(/calibrat|profile|setup/i);
    }
  });

  it('is ready when the active placement has layers', () => {
    const result = summarizeHtvStatus(
      [{ placementId: 'left-chest' }, { placementId: 'left-chest' }],
      'left-chest',
    );
    expect(result.status).toBe('Ready');
    expect(result.activeLayerCount).toBe(2);
    expect(result.guidance).toContain('2 layers');
    expect(result.guidance).toContain('left chest');
  });

  it('warns when only other placements have layers, because export includes only the active one', () => {
    const result = summarizeHtvStatus([{ placementId: 'full-back' }], 'full-front');
    expect(result.status).toBe('Warning');
    expect(result.otherPlacementLayerCount).toBe(1);
    expect(result.guidance).toMatch(/other placements/i);
  });

  it('stays ready but tells the user when some layers will be left out of the export', () => {
    const result = summarizeHtvStatus(
      [{ placementId: 'full-front' }, { placementId: 'full-back' }],
      'full-front',
    );
    expect(result.status).toBe('Ready');
    expect(result.guidance).toContain('1 layer on other placements will not be included');
  });
});

describe('HTV status chips (plan A10)', () => {
  const layers = [{ placementId: 'front-center' as never }];
  const size = (issues: Array<{ id: string; severity: 'warning' | 'info'; message: string }>) =>
    ({ designSizeMm: { widthMm: 210.4, heightMm: 59.6 }, zoneSizeMm: { widthMm: 300, heightMm: 300 }, zoneName: 'front', measuring: false, issues, sizeText: 'x' }) as never;

  it('says layers, size and mat fit as short chips', () => {
    const summary = summarizeHtvStatus(layers, 'front-center' as never, size([]));
    const labels = summary.chips.map((chip) => chip.label);
    expect(labels).toContain('210 × 60 mm');
    expect(labels).toContain('Fits a 12 × 12 in mat');
    expect(summary.chips.find((chip) => chip.label.startsWith('1 layer'))).toBeTruthy();
  });

  it('flags a design that needs the big mat or is too big', () => {
    const big = summarizeHtvStatus(layers, 'front-center' as never, size([{ id: 'needs-large-mat', severity: 'info', message: 'm' }]));
    expect(big.chips.some((chip) => chip.label === 'Needs a 12 × 24 in mat' && chip.tone === 'warning')).toBe(true);
    expect(big.chips.some((chip) => chip.label === 'Fits a 12 × 12 in mat')).toBe(false);
    const huge = summarizeHtvStatus(layers, 'front-center' as never, size([{ id: 'exceeds-mat', severity: 'warning', message: 'm' }]));
    expect(huge.chips.some((chip) => chip.label === 'Too big for a mat')).toBe(true);
  });

  it('has a chip when there is nothing to export', () => {
    expect(summarizeHtvStatus([], 'front-center' as never).chips[0]?.label).toBe('Nothing to export yet');
  });
});
