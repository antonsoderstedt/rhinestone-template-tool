import { describe, expect, it } from 'vitest';
import {
  boundsOfPolylines,
  buildRegionField,
  createGrid,
  distanceToSet,
  emptyMask,
  fillLoops,
  fillStrokes,
  maskAreaMm2,
  sampleField,
} from '../src/lib/rhinestone-engine/artwork/regionField';
import type { Polyline } from '../src/lib/rhinestone-engine/index';

const rect = (x: number, y: number, w: number, h: number, reverse = false): Polyline => {
  const points = [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
  return { points: reverse ? points.reverse() : points, closed: true };
};
const maskOf = (loops: Polyline[], rule: 'nonzero' | 'evenodd' = 'nonzero', cellMm = 0.25) => {
  const mask = emptyMask(createGrid(boundsOfPolylines(loops), { cellMm }));
  fillLoops(mask, loops, rule);
  return mask;
};

describe('fillLoops', () => {
  it('fills a rectangle to within one cell row/column of its true area', () => {
    const m = maskOf([rect(0, 0, 40, 20)]);
    expect(maskAreaMm2(m)).toBeGreaterThan(800 * 0.985);
    expect(maskAreaMm2(m)).toBeLessThan(800 * 1.015);
  });

  it('even-odd makes a nested loop a hole; nonzero fills it when both run the same way, and not when they oppose', () => {
    const nested = [rect(0, 0, 40, 40), rect(10, 10, 20, 20)];
    expect(maskAreaMm2(maskOf(nested, 'evenodd'))).toBeCloseTo(1200, -1);
    expect(maskAreaMm2(maskOf(nested, 'nonzero'))).toBeCloseTo(1600, -1);
    expect(maskAreaMm2(maskOf([rect(0, 0, 40, 40), rect(10, 10, 20, 20, true)], 'nonzero'))).toBeCloseTo(1200, -1);
  });

  it('ignores open polylines', () => {
    const open: Polyline = { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] };
    const mask = emptyMask(createGrid({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, { cellMm: 0.5 }));
    fillLoops(mask, [open], 'nonzero');
    expect(maskAreaMm2(mask)).toBe(0);
  });
});

describe('fillStrokes', () => {
  it('draws a line of the requested width', () => {
    const line: Polyline = { points: [{ x: 0, y: 0 }, { x: 40, y: 0 }] };
    const mask = emptyMask(createGrid({ minX: -5, minY: -5, maxX: 45, maxY: 5 }, { cellMm: 0.25 }));
    fillStrokes(mask, [line], 6);
    // a 40 x 6 bar plus two round caps of radius 3
    expect(maskAreaMm2(mask)).toBeCloseTo(40 * 6 + Math.PI * 9, -1);
  });
});

describe('distanceToSet', () => {
  it('is the Euclidean distance in cells', () => {
    const source = new Uint8Array(11 * 11);
    source[5 * 11 + 5] = 1;
    const d = distanceToSet(source, 11, 11);
    expect(d[5 * 11 + 5]).toBe(0);
    expect(d[5 * 11 + 9]).toBeCloseTo(4, 5);
    expect(d[8 * 11 + 9]).toBeCloseTo(5, 5);
    expect(d[0]).toBeCloseTo(Math.hypot(5, 5), 5);
  });
});

describe('buildRegionField', () => {
  const field = buildRegionField(maskOf([rect(0, 0, 40, 40)]));

  it('is positive inside and negative outside, about the true distance to the edge', () => {
    expect(sampleField(field, 20, 20)).toBeCloseTo(20, 0);
    expect(sampleField(field, 5, 20)).toBeCloseTo(5, 0);
    expect(sampleField(field, -1, 20)).toBeCloseTo(-1, 0);
    expect(sampleField(field, 20, 20)).toBeGreaterThan(sampleField(field, 10, 20));
  });

  it('reports positions outside the grid as far outside', () => {
    expect(sampleField(field, 1000, 1000)).toBe(-Infinity);
  });

  it('is deterministic', () => {
    const again = buildRegionField(maskOf([rect(0, 0, 40, 40)]));
    expect(Array.from(again.sdf.slice(0, 200))).toEqual(Array.from(field.sdf.slice(0, 200)));
  });
});
