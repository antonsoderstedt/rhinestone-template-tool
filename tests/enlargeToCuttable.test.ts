import { describe, expect, it } from 'vitest';
import {
  enlargeToCuttableSpacing,
  hasOverlappingStones,
  validateRhinestoneTemplate,
} from '../src/lib/rhinestone-engine/index';
import type { RhinestoneTemplate, Stone } from '../src/lib/rhinestone-engine/index';

const GAP = 0.508;
function stone(id: string, x: number, y: number, d = 3): Stone {
  return { id, center: { x, y }, stoneSize: 'SS10', holeDiameterMm: d };
}
function template(stones: Stone[], extra: Partial<RhinestoneTemplate> = {}): RhinestoneTemplate {
  return { id: 't', name: 't', unit: 'mm', source: 'vendor', stones, ...extra };
}
/** A letter-like block of dots 1.5 mm apart (half a stone diameter): overlapping on purpose, like a solid vendor font. */
function denseBlock(cols = 8, rows = 6, pitch = 1.5): Stone[] {
  return Array.from({ length: cols * rows }, (_, i) => stone(`s${i}`, 10 + (i % cols) * pitch, 20 + Math.floor(i / cols) * pitch));
}

describe('enlargeToCuttableSpacing', () => {
  it('leaves a layout without overlaps exactly as it is', () => {
    const fine = template([stone('a', 0, 0), stone('b', 4, 0), stone('c', 8, 0)]);
    const result = enlargeToCuttableSpacing(fine, { minGapMm: GAP });
    expect(result.template).toBe(fine);
    expect(result.scale).toBe(1);
    expect(result.removedCount).toBe(0);
  });

  it('enlarges dense overlapping dots until they can be cut, keeping every stone and the shape', () => {
    const dense = template(denseBlock(), { widthMm: 14, heightMm: 10 });
    expect(hasOverlappingStones(dense.stones)).toBe(true);

    const result = enlargeToCuttableSpacing(dense, { minGapMm: GAP });
    expect(result.scale).toBeCloseTo(((3 + GAP) / 1.5) * 1.002, 3);
    expect(result.removedCount).toBe(0);
    expect(result.template.stones).toHaveLength(dense.stones.length);
    expect(hasOverlappingStones(result.template.stones)).toBe(false);
    expect(validateRhinestoneTemplate(result.template, { minGapMm: GAP }).issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(result.template.widthMm).toBeCloseTo(14 * result.scale, 6);
  });

  it('scales about the top-left corner, so the design stays where it was placed', () => {
    const result = enlargeToCuttableSpacing(template(denseBlock()), { minGapMm: GAP });
    const xs = result.template.stones.map((s) => s.center.x);
    const ys = result.template.stones.map((s) => s.center.y);
    expect(Math.min(...xs)).toBeCloseTo(10, 6);
    expect(Math.min(...ys)).toBeCloseTo(20, 6);
  });

  it('does not change the size of the stones, only where they are', () => {
    const result = enlargeToCuttableSpacing(template(denseBlock()), { minGapMm: GAP });
    expect(new Set(result.template.stones.map((s) => s.holeDiameterMm))).toEqual(new Set([3]));
  });

  it('is not blown up by one odd pair; the few stones still too close are removed', () => {
    const stones = [...denseBlock(10, 10, 4.2), stone('odd', 10.4, 20, 3)]; // one stone almost on top of another
    const result = enlargeToCuttableSpacing(template(stones), { minGapMm: GAP });
    expect(result.scale).toBeLessThan(1.1);
    expect(result.removedCount).toBeGreaterThanOrEqual(1);
    expect(hasOverlappingStones(result.template.stones)).toBe(false);
  });

  it('is deterministic and does not touch its input', () => {
    const input = template(denseBlock());
    const snapshot = JSON.parse(JSON.stringify(input));
    const a = enlargeToCuttableSpacing(input, { minGapMm: GAP });
    const b = enlargeToCuttableSpacing(input, { minGapMm: GAP });
    expect(input).toEqual(snapshot);
    expect(a.template.stones).toEqual(b.template.stones);
  });
});
