import { describe, expect, it } from 'vitest';
import { estimateStoneUsage, STONES_PER_GROSS } from '../src/lib/rhinestone-engine/index';
import type { StoneSizeId } from '../src/lib/rhinestone-engine/index';

function stones(counts: Partial<Record<StoneSizeId, number>>) {
  return (Object.entries(counts) as Array<[StoneSizeId, number]>).flatMap(([stoneSize, n]) =>
    Array.from({ length: n }, () => ({ stoneSize })),
  );
}

describe('estimateStoneUsage', () => {
  it('counts per size, adds the default 10 % spare and rounds up to whole grosses', () => {
    const estimate = estimateStoneUsage(stones({ SS10: 200 }));
    const line = estimate.lines[0]!;
    expect(line.stoneCount).toBe(200);
    expect(line.stonesWithSpare).toBe(220);
    expect(line.packs).toBe(2); // 220 / 144 -> 2 grosses
    expect(line.gross).toBe(1.53);
    expect(estimateStoneUsage(stones({ SS10: 135 })).lines[0]!.gross).toBe(1.03); // 148 stones: just over one gross, so two packs
    expect(estimate.packSizeStones).toBe(STONES_PER_GROSS);
  });

  it('reports every size separately, smallest first, in a stable order', () => {
    const estimate = estimateStoneUsage(stones({ SS12: 10, SS6: 20, SS10: 30 }));
    expect(estimate.lines.map((l) => l.stoneSize)).toEqual(['SS6', 'SS10', 'SS12']);
    expect(estimate.totalStones).toBe(60);
  });

  it('uses the chosen pack size and spare allowance', () => {
    const estimate = estimateStoneUsage(stones({ SS10: 1000 }), { packSizeStones: 1440, wastePercent: 0 });
    expect(estimate.lines[0]!.stonesWithSpare).toBe(1000);
    expect(estimate.lines[0]!.packs).toBe(1);
    const more = estimateStoneUsage(stones({ SS10: 1000 }), { packSizeStones: 1440, wastePercent: 50 });
    expect(more.lines[0]!.packs).toBe(2);
  });

  it('multiplies packs by the price only for sizes that have one', () => {
    const estimate = estimateStoneUsage(stones({ SS10: 144, SS12: 144 }), {
      wastePercent: 0,
      pricePerPackBySize: { SS10: 4.5 },
    });
    expect(estimate.lines.find((l) => l.stoneSize === 'SS10')!.cost).toBe(4.5);
    expect(estimate.lines.find((l) => l.stoneSize === 'SS12')!.cost).toBeNull();
    expect(estimate.totalCost).toBe(4.5);
    expect(estimate.costComplete).toBe(false);
  });

  it('has no cost at all when no price was given, and never invents one', () => {
    const estimate = estimateStoneUsage(stones({ SS10: 50 }));
    expect(estimate.totalCost).toBeNull();
    expect(estimate.costComplete).toBe(false);
  });

  it('marks the total complete when every size is priced', () => {
    const estimate = estimateStoneUsage(stones({ SS10: 10, SS12: 10 }), { pricePerPackBySize: { SS10: 3, SS12: 3.25 } });
    expect(estimate.costComplete).toBe(true);
    expect(estimate.totalCost).toBe(6.25);
  });

  it('handles an empty design and ignores nonsense options', () => {
    const empty = estimateStoneUsage([]);
    expect(empty.lines).toEqual([]);
    expect(empty.totalPacks).toBe(0);
    expect(empty.totalCost).toBeNull();

    const odd = estimateStoneUsage(stones({ SS10: 10 }), { wastePercent: Number.NaN, packSizeStones: -5, pricePerPackBySize: { SS10: -2 } });
    expect(odd.wastePercent).toBe(10);
    expect(odd.packSizeStones).toBe(STONES_PER_GROSS);
    expect(odd.lines[0]!.cost).toBeNull();
  });

  it('is deterministic', () => {
    const input = stones({ SS10: 37, SS8: 5 });
    expect(estimateStoneUsage(input)).toEqual(estimateStoneUsage(input));
  });
});
