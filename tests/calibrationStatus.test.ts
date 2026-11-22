import { describe, expect, it } from 'vitest';
import { allSizesUsable, calibrationStatusBySize } from '../app/lib/calibrationStatus';

const profile = (approvedAt: string | undefined, overrides: Array<{ stoneSize: string; holeDiameterMm: number }>) => ({
  name: 'My flock', materialProfileId: 'magic-flock-cricut-maker', approvedAt, overrides,
});

describe('calibration by stone size (plan E3)', () => {
  it('says measured for a size in an approved profile', () => {
    const [status] = calibrationStatusBySize(['SS10'], profile('2026-11-01T00:00:00Z', [{ stoneSize: 'SS10', holeDiameterMm: 3.45 }]));
    expect(status).toMatchObject({ stoneSize: 'SS10', state: 'measured' });
    expect(status!.text).toContain('3.45 mm');
    expect(status!.text).toContain('My flock');
  });

  it('does not count a profile that is not approved', () => {
    const [status] = calibrationStatusBySize(['SS10'], profile(undefined, [{ stoneSize: 'SS10', holeDiameterMm: 3.45 }]));
    expect(status!.state).not.toBe('measured');
  });

  it('uses the verified standard value for the material when the size was not measured', () => {
    const [status] = calibrationStatusBySize(['SS10'], null);
    expect(status).toMatchObject({ state: 'verified-default' });
    expect(status!.text).toMatch(/test patch/);
  });

  it('flags a size with no verified value as unverified', () => {
    const [status] = calibrationStatusBySize(['SS12'], null);
    expect(status!.state).toBe('unverified');
    expect(allSizesUsable([status!])).toBe(false);
  });

  it('lists each size once, smallest first', () => {
    const statuses = calibrationStatusBySize(['SS16', 'SS6', 'SS10', 'SS6', 'SS16'], null);
    expect(statuses.map((s) => s.stoneSize)).toEqual(['SS6', 'SS10', 'SS16']);
    expect(allSizesUsable(statuses)).toBe(true);
  });
});
