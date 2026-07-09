import { describe, it, expect } from 'vitest';
import {
  createRhinestoneTemplate,
  createStoneGridTemplate,
  createBasicSvgExport,
  getRecommendedHoleDiameter,
  getRecommendedCenterDistance,
} from '../src/lib/rhinestone-engine/index.js';
import type { Stone } from '../src/lib/rhinestone-engine/index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeStone(overrides: Partial<Stone> = {}): Stone {
  return {
    id: 'stone-1',
    center: { x: 10, y: 10 },
    stoneSize: 'SS10',
    holeDiameterMm: 3.0,
    ...overrides,
  };
}

// ─── createRhinestoneTemplate ─────────────────────────────────────────────────

describe('createRhinestoneTemplate', () => {
  it('returns a template with unit "mm"', () => {
    const t = createRhinestoneTemplate({ id: 't1', name: 'Test', stones: [makeStone()] });
    expect(t.unit).toBe('mm');
  });

  it('preserves stone order', () => {
    const stones = [
      makeStone({ id: 'a', center: { x: 1, y: 1 } }),
      makeStone({ id: 'b', center: { x: 2, y: 2 } }),
      makeStone({ id: 'c', center: { x: 3, y: 3 } }),
    ];
    const t = createRhinestoneTemplate({ id: 't1', name: 'Test', stones });
    expect(t.stones.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input stones array', () => {
    const stones = [makeStone()];
    const original = [...stones];
    createRhinestoneTemplate({ id: 't1', name: 'Test', stones });
    expect(stones).toEqual(original);
  });

  it('throws on empty id', () => {
    expect(() =>
      createRhinestoneTemplate({ id: '', name: 'Test', stones: [] }),
    ).toThrow(/id/);
  });

  it('throws on whitespace-only id', () => {
    expect(() =>
      createRhinestoneTemplate({ id: '   ', name: 'Test', stones: [] }),
    ).toThrow(/id/);
  });

  it('throws on empty name', () => {
    expect(() =>
      createRhinestoneTemplate({ id: 't1', name: '', stones: [] }),
    ).toThrow(/name/);
  });

  it('throws on duplicate stone ids', () => {
    const stones = [makeStone({ id: 'dup' }), makeStone({ id: 'dup' })];
    expect(() =>
      createRhinestoneTemplate({ id: 't1', name: 'Test', stones }),
    ).toThrow(/duplicate/i);
  });

  it('throws on stone with holeDiameterMm <= 0', () => {
    const stones = [makeStone({ id: 'bad', holeDiameterMm: 0 })];
    expect(() =>
      createRhinestoneTemplate({ id: 't1', name: 'Test', stones }),
    ).toThrow(/holeDiameterMm/);
  });

  it('throws on stone with negative holeDiameterMm', () => {
    const stones = [makeStone({ id: 'neg', holeDiameterMm: -1 })];
    expect(() =>
      createRhinestoneTemplate({ id: 't1', name: 'Test', stones }),
    ).toThrow(/holeDiameterMm/);
  });

  it('throws on stone with empty id', () => {
    const stones = [makeStone({ id: '' })];
    expect(() =>
      createRhinestoneTemplate({ id: 't1', name: 'Test', stones }),
    ).toThrow(/empty/i);
  });

  it('preserves optional widthMm and heightMm', () => {
    const t = createRhinestoneTemplate({
      id: 't1',
      name: 'Test',
      stones: [],
      widthMm: 100,
      heightMm: 50,
    });
    expect(t.widthMm).toBe(100);
    expect(t.heightMm).toBe(50);
  });
});

// ─── createStoneGridTemplate ──────────────────────────────────────────────────

describe('createStoneGridTemplate', () => {
  it('creates the correct number of stones (5 × 3 = 15)', () => {
    const t = createStoneGridTemplate({
      id: 'g1',
      name: 'Grid',
      stoneSize: 'SS10',
      columns: 5,
      rows: 3,
    });
    expect(t.stones.length).toBe(15);
  });

  it('creates 1 stone for 1×1 grid', () => {
    const t = createStoneGridTemplate({
      id: 'g1',
      name: 'Grid',
      stoneSize: 'SS6',
      columns: 1,
      rows: 1,
    });
    expect(t.stones.length).toBe(1);
  });

  it('uses SS10 recommended hole diameter', () => {
    const expected = getRecommendedHoleDiameter('SS10');
    const t = createStoneGridTemplate({
      id: 'g1',
      name: 'Grid',
      stoneSize: 'SS10',
      columns: 2,
      rows: 2,
    });
    for (const stone of t.stones) {
      expect(stone.holeDiameterMm).toBe(expected);
    }
  });

  it('uses recommended spacing by default', () => {
    const spacing = getRecommendedCenterDistance('SS10');
    const t = createStoneGridTemplate({
      id: 'g1',
      name: 'Grid',
      stoneSize: 'SS10',
      columns: 2,
      rows: 1,
      startXmm: 0,
      startYmm: 0,
    });
    const [s1, s2] = t.stones;
    expect(Math.abs(s2!.center.x - s1!.center.x - spacing)).toBeLessThan(0.001);
  });

  it('generates deterministic IDs (1-based, stoneSize.toLowerCase())', () => {
    const t = createStoneGridTemplate({
      id: 'g1',
      name: 'Grid',
      stoneSize: 'SS10',
      columns: 2,
      rows: 2,
    });
    const ids = t.stones.map((s) => s.id);
    expect(ids).toEqual(['ss10-r1-c1', 'ss10-r1-c2', 'ss10-r2-c1', 'ss10-r2-c2']);
  });

  it('includes metadata with generatedBy and stoneSize', () => {
    const t = createStoneGridTemplate({
      id: 'g1',
      name: 'Grid',
      stoneSize: 'SS10',
      columns: 1,
      rows: 1,
    });
    expect(t.stones[0]!.metadata?.generatedBy).toBe('createStoneGridTemplate');
    expect(t.stones[0]!.metadata?.stoneSize).toBe('SS10');
    expect(t.stones[0]!.metadata?.columns).toBe(1);
    expect(t.stones[0]!.metadata?.rows).toBe(1);
  });

  it('throws on rows < 1', () => {
    expect(() =>
      createStoneGridTemplate({ id: 'g', name: 'G', stoneSize: 'SS10', columns: 1, rows: 0 }),
    ).toThrow(/rows/);
  });

  it('throws on columns < 1', () => {
    expect(() =>
      createStoneGridTemplate({ id: 'g', name: 'G', stoneSize: 'SS10', columns: 0, rows: 1 }),
    ).toThrow(/columns/);
  });

  it('throws if custom spacingMm is smaller than recommended centre distance', () => {
    const recommended = getRecommendedCenterDistance('SS10');
    expect(() =>
      createStoneGridTemplate({
        id: 'g',
        name: 'G',
        stoneSize: 'SS10',
        columns: 2,
        rows: 1,
        spacingMm: recommended - 0.1,
      }),
    ).toThrow(/spacing/i);
  });

  it('accepts custom spacingMm equal to recommended (boundary)', () => {
    const recommended = getRecommendedCenterDistance('SS10');
    expect(() =>
      createStoneGridTemplate({
        id: 'g',
        name: 'G',
        stoneSize: 'SS10',
        columns: 2,
        rows: 1,
        spacingMm: recommended,
      }),
    ).not.toThrow();
  });

  it('can be exported with createBasicSvgExport without error', () => {
    const t = createStoneGridTemplate({
      id: 'g1',
      name: 'Grid',
      stoneSize: 'SS10',
      columns: 3,
      rows: 2,
    });
    expect(() => createBasicSvgExport(t)).not.toThrow();
  });

  it('exported SVG has correct circle count', () => {
    const t = createStoneGridTemplate({
      id: 'g1',
      name: 'Grid',
      stoneSize: 'SS10',
      columns: 4,
      rows: 2,
    });
    const svg = createBasicSvgExport(t);
    expect((svg.match(/<circle/g) ?? []).length).toBe(8);
  });

  it('template.unit is "mm"', () => {
    const t = createStoneGridTemplate({
      id: 'g1',
      name: 'Grid',
      stoneSize: 'SS10',
      columns: 1,
      rows: 1,
    });
    expect(t.unit).toBe('mm');
  });
});
