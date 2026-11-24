/**
 * Stone usage and cost estimate.
 *
 * Pure and deterministic. Rhinestones are sold by the gross (144 stones) or in larger packs, per
 * size. The estimate adds a spare allowance, rounds up to whole packs and, when the user has typed
 * a price for a size, multiplies it out. The engine never invents a price: sizes without a price
 * simply have no cost.
 */

import type { StoneSizeId } from '../types/index';

export const STONES_PER_GROSS = 144;
export const DEFAULT_WASTE_PERCENT = 10;
export const MAX_WASTE_PERCENT = 100;

export interface StoneUsageInput {
  stoneSize: StoneSizeId;
}

export interface StoneUsageOptions {
  /** Spare stones for drops and mistakes, as a percentage of the count. Default 10. */
  wastePercent?: number;
  /** Stones in one pack you buy. Default 144 (one gross). */
  packSizeStones?: number;
  /** Price of one pack, by stone size. Sizes without an entry have no cost. */
  pricePerPackBySize?: Partial<Record<StoneSizeId, number>>;
}

export interface StoneUsageLine {
  stoneSize: StoneSizeId;
  /** Stones in the design. */
  stoneCount: number;
  /** Stones to buy including the spare allowance (rounded up). */
  stonesWithSpare: number;
  /** `stonesWithSpare` in gross, to two decimals (148 stones is 1.03 gross, which is why it takes two packs). */
  gross: number;
  /** Whole packs to buy. */
  packs: number;
  /** `packs` times the price of one pack, or null when no price was given for this size. */
  cost: number | null;
}

export interface StoneUsageEstimate {
  lines: StoneUsageLine[];
  totalStones: number;
  totalStonesWithSpare: number;
  totalPacks: number;
  /** Sum of the priced lines, or null when no size has a price. */
  totalCost: number | null;
  /** False when some sizes are priced and others are not, so the total is incomplete. */
  costComplete: boolean;
  wastePercent: number;
  packSizeStones: number;
}

function sanitizeWastePercent(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return DEFAULT_WASTE_PERCENT;
  return Math.min(MAX_WASTE_PERCENT, Math.max(0, value));
}

function sanitizePackSize(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value < 1) return STONES_PER_GROSS;
  return Math.floor(value);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function estimateStoneUsage(
  stones: readonly StoneUsageInput[],
  options: StoneUsageOptions = {},
): StoneUsageEstimate {
  const wastePercent = sanitizeWastePercent(options.wastePercent);
  const packSizeStones = sanitizePackSize(options.packSizeStones);
  const prices = options.pricePerPackBySize ?? {};

  const counts = new Map<StoneSizeId, number>();
  for (const stone of stones) {
    counts.set(stone.stoneSize, (counts.get(stone.stoneSize) ?? 0) + 1);
  }

  // Smallest size first so the list reads the same every time.
  const sizes = [...counts.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const lines: StoneUsageLine[] = sizes.map((stoneSize) => {
    const stoneCount = counts.get(stoneSize) ?? 0;
    // Integer-style maths first: 200 * 1.1 is 220.00000000000003 in floating point and must not round up to 221.
    const stonesWithSpare = Math.ceil(Number(((stoneCount * (100 + wastePercent)) / 100).toFixed(6)));
    const packs = stonesWithSpare === 0 ? 0 : Math.ceil(stonesWithSpare / packSizeStones);
    const price = prices[stoneSize];
    const hasPrice = typeof price === 'number' && Number.isFinite(price) && price >= 0;
    return {
      stoneSize,
      stoneCount,
      stonesWithSpare,
      gross: Math.round((stonesWithSpare / STONES_PER_GROSS) * 100) / 100,
      packs,
      cost: hasPrice ? roundMoney(packs * price) : null,
    };
  });

  const pricedLines = lines.filter((line) => line.cost !== null);
  return {
    lines,
    totalStones: lines.reduce((sum, line) => sum + line.stoneCount, 0),
    totalStonesWithSpare: lines.reduce((sum, line) => sum + line.stonesWithSpare, 0),
    totalPacks: lines.reduce((sum, line) => sum + line.packs, 0),
    totalCost: pricedLines.length > 0 ? roundMoney(pricedLines.reduce((sum, line) => sum + (line.cost ?? 0), 0)) : null,
    costComplete: lines.length > 0 && pricedLines.length === lines.length,
    wastePercent,
    packSizeStones,
  };
}
