/**
 * The user's stone-estimate inputs (spare allowance, pack size, price per pack for each size),
 * remembered in this browser. Prices are typed by the user; nothing here knows what a pack costs.
 */

import {
  DEFAULT_WASTE_PERCENT,
  MAX_WASTE_PERCENT,
  STONES_PER_GROSS,
  type StoneSizeId,
} from '@/src/lib/rhinestone-engine/index';

export const STONE_ESTIMATE_STORAGE_KEY = 'rhinestone-stone-estimate';

/** Pack sizes offered in the picker: one gross, five gross, ten gross. */
export const PACK_SIZE_OPTIONS = [
  { stones: STONES_PER_GROSS, label: '1 gross (144)' },
  { stones: STONES_PER_GROSS * 5, label: '5 gross (720)' },
  { stones: STONES_PER_GROSS * 10, label: '10 gross (1,440)' },
] as const;

export interface StoneEstimateSettings {
  wastePercent: number;
  packSizeStones: number;
  pricePerPackBySize: Partial<Record<StoneSizeId, number>>;
}

export const DEFAULT_STONE_ESTIMATE_SETTINGS: StoneEstimateSettings = {
  wastePercent: DEFAULT_WASTE_PERCENT,
  packSizeStones: STONES_PER_GROSS,
  pricePerPackBySize: {},
};

const STONE_SIZE_IDS = new Set<string>(['SS6', 'SS8', 'SS10', 'SS12', 'SS16', 'SS20']);

export function sanitizeStoneEstimateSettings(value: unknown): StoneEstimateSettings {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_STONE_ESTIMATE_SETTINGS, pricePerPackBySize: {} };
  const record = value as Record<string, unknown>;

  const waste = typeof record.wastePercent === 'number' && Number.isFinite(record.wastePercent)
    ? Math.min(MAX_WASTE_PERCENT, Math.max(0, record.wastePercent))
    : DEFAULT_WASTE_PERCENT;

  const packSize = PACK_SIZE_OPTIONS.some((option) => option.stones === record.packSizeStones)
    ? (record.packSizeStones as number)
    : STONES_PER_GROSS;

  const prices: Partial<Record<StoneSizeId, number>> = {};
  if (typeof record.pricePerPackBySize === 'object' && record.pricePerPackBySize !== null) {
    for (const [size, price] of Object.entries(record.pricePerPackBySize as Record<string, unknown>)) {
      if (STONE_SIZE_IDS.has(size) && typeof price === 'number' && Number.isFinite(price) && price >= 0 && price <= 1_000_000) {
        prices[size as StoneSizeId] = price;
      }
    }
  }

  return { wastePercent: waste, packSizeStones: packSize, pricePerPackBySize: prices };
}

export function readStoneEstimateSettings(storage: Pick<Storage, 'getItem'> | null = typeof window === 'undefined' ? null : window.localStorage): StoneEstimateSettings {
  try {
    const raw = storage?.getItem(STONE_ESTIMATE_STORAGE_KEY);
    return sanitizeStoneEstimateSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return sanitizeStoneEstimateSettings(null);
  }
}

export function writeStoneEstimateSettings(
  settings: StoneEstimateSettings,
  storage: Pick<Storage, 'setItem'> | null = typeof window === 'undefined' ? null : window.localStorage,
): void {
  try {
    storage?.setItem(STONE_ESTIMATE_STORAGE_KEY, JSON.stringify(sanitizeStoneEstimateSettings(settings)));
  } catch {
    // Storage can be full or blocked; the estimate still works for this visit.
  }
}
