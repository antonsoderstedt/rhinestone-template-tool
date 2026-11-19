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
