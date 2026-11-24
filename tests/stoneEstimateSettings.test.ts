import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STONE_ESTIMATE_SETTINGS,
  STONE_ESTIMATE_STORAGE_KEY,
  readStoneEstimateSettings,
  sanitizeStoneEstimateSettings,
  writeStoneEstimateSettings,
} from '../app/lib/stoneEstimateSettings';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => { data[key] = value; },
    data,
  };
}

describe('stone estimate settings', () => {
  it('falls back to defaults for missing or broken data', () => {
    expect(readStoneEstimateSettings(memoryStorage())).toEqual(DEFAULT_STONE_ESTIMATE_SETTINGS);
    expect(readStoneEstimateSettings(memoryStorage({ [STONE_ESTIMATE_STORAGE_KEY]: '{nope' }))).toEqual(DEFAULT_STONE_ESTIMATE_SETTINGS);
    expect(sanitizeStoneEstimateSettings('x')).toEqual(DEFAULT_STONE_ESTIMATE_SETTINGS);
  });

  it('keeps valid values and drops invalid ones', () => {
    const cleaned = sanitizeStoneEstimateSettings({
      wastePercent: 250,
      packSizeStones: 999,
      pricePerPackBySize: { SS10: 4.5, SS99: 1, SS12: -3, SS6: 'free' },
    });
    expect(cleaned.wastePercent).toBe(100);
    expect(cleaned.packSizeStones).toBe(144);
    expect(cleaned.pricePerPackBySize).toEqual({ SS10: 4.5 });
  });

  it('round-trips through storage', () => {
    const storage = memoryStorage();
    writeStoneEstimateSettings({ wastePercent: 5, packSizeStones: 1440, pricePerPackBySize: { SS10: 12 } }, storage);
    expect(readStoneEstimateSettings(storage)).toEqual({ wastePercent: 5, packSizeStones: 1440, pricePerPackBySize: { SS10: 12 } });
  });

  it('does not throw when storage is unavailable', () => {
    expect(() => writeStoneEstimateSettings(DEFAULT_STONE_ESTIMATE_SETTINGS, null)).not.toThrow();
    expect(readStoneEstimateSettings(null)).toEqual(DEFAULT_STONE_ESTIMATE_SETTINGS);
  });
});
