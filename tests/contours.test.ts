import { describe, expect, it } from 'vitest';
import { extractContours, sampleLoop } from '../src/lib/rhinestone-engine/artwork/contours';
import { boundsOfPolylines, buildRegionField, createGrid, emptyMask, fillLoops } from '../src/lib/rhinestone-engine/artwork/regionField';
import type { Polyline } from '../src/lib/rhinestone-engine/index';

const rect = (x: number, y: number, w: number, h: number): Polyline => ({
  closed: true,
  points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }],
});
const circle = (cx: number, cy: number, r: number, n = 180): Polyline => ({
  closed: true,
  points: Array.from({ length: n }, (_, i) => ({ x: cx + r * Math.cos((2 * Math.PI * i) / n), y: cy + r * Math.sin((2 * Math.PI * i) / n) })),
});
const fieldOf = (loops: Polyline[], rule: 'nonzero' | 'evenodd' = 'evenodd') => {
  const mask = emptyMask(createGrid(boundsOfPolylines(loops), { cellMm: 0.2 }));
  fillLoops(mask, loops, rule);
  return buildRegionField(mask);
};
const signedArea = (points: { x: number; y: number }[]) => {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const q = points[(i + 1) % points.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
};

describe('extractContours', () => {
  it('gives the edge moved inwards: a 40 mm square at depth 2 is a 36 mm square', () => {
    const loops = extractContours(fieldOf([rect(0, 0, 40, 40)]), 2);
    expect(loops).toHaveLength(1);
    expect(loops[0]!.length).toBeGreaterThan(143 * 0.98);
    expect(loops[0]!.length).toBeLessThan(144 * 1.02);
    const xs = loops[0]!.points.map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(2, 0);
    expect(Math.max(...xs)).toBeCloseTo(38, 0);
  });

  it('gives a circle of radius r - d', () => {
    const [loop] = extractContours(fieldOf([circle(50, 50, 30)]), 5);
    expect(loop!.length).toBeCloseTo(2 * Math.PI * 25, -1);
  });

  it('a hole grows and the outer edge shrinks: two loops for a ring, running in opposite directions', () => {
    const loops = extractContours(fieldOf([circle(50, 50, 40), circle(50, 50, 15)]), 3);
    expect(loops).toHaveLength(2);
    const [outer, inner] = loops;
    expect(outer!.length).toBeCloseTo(2 * Math.PI * 37, -1);
    expect(inner!.length).toBeCloseTo(2 * Math.PI * 18, -1);
    expect(Math.sign(signedArea(outer!.points))).toBe(-Math.sign(signedArea(inner!.points)));
  });

  it('has nothing to give where the level is deeper than the shape', () => {
    expect(extractContours(fieldOf([rect(0, 0, 10, 10)]), 8)).toEqual([]);
  });

  it('separates a neck: a dumbbell loses its handle at a depth the handle cannot hold', () => {
    const dumbbell = [rect(0, 0, 30, 30), rect(30, 12, 20, 6), rect(50, 0, 30, 30)];
    // handle is 6 mm wide: at depth 4 only the two blocks remain
    expect(extractContours(fieldOf(dumbbell, 'nonzero'), 4)).toHaveLength(2);
    expect(extractContours(fieldOf(dumbbell, 'nonzero'), 1)).toHaveLength(1);
  });

  it('is deterministic', () => {
    const f = fieldOf([circle(50, 50, 40), circle(50, 50, 15)]);
    expect(extractContours(f, 3)).toEqual(extractContours(f, 3));
  });
});

describe('sampleLoop', () => {
  it('puts a stone on every corner of a square and spaces the rest evenly, never closer than the pitch', () => {
    const [loop] = extractContours(fieldOf([rect(0, 0, 40, 40)]), 2);
    const stones = sampleLoop(loop!, { pitchMm: 4.2 });
    const near = (x: number, y: number) => stones.some((s) => Math.hypot(s.x - x, s.y - y) < 0.4);
    expect(near(2, 2) && near(38, 2) && near(38, 38) && near(2, 38)).toBe(true);
    expect(stones.length).toBe(32);
    let min = Infinity;
    for (let i = 0; i < stones.length; i++) for (let j = i + 1; j < stones.length; j++) min = Math.min(min, Math.hypot(stones[i]!.x - stones[j]!.x, stones[i]!.y - stones[j]!.y));
    expect(min).toBeGreaterThanOrEqual(4.2 - 0.2);
  });

  it('a smooth circle has no corners: evenly spaced, count = floor(length / pitch)', () => {
    const [loop] = extractContours(fieldOf([circle(50, 50, 30)]), 2);
    const stones = sampleLoop(loop!, { pitchMm: 4.2 });
    expect(stones.length).toBe(Math.floor(loop!.length / 4.2));
  });

  it('gives nothing for a loop that cannot hold three stones', () => {
    const [loop] = extractContours(fieldOf([circle(20, 20, 5)]), 3); // a 2 mm circle: 12.5 mm round
    expect(sampleLoop(loop!, { pitchMm: 4.2 })).toEqual([]);
  });

  it('does not depend on where the tracer started', () => {
    const [loop] = extractContours(fieldOf([circle(50, 50, 30)]), 2);
    const rotated = { ...loop!, points: [...loop!.points.slice(37), ...loop!.points.slice(0, 37)] };
    expect(sampleLoop(rotated, { pitchMm: 4.2 })).toEqual(sampleLoop(loop!, { pitchMm: 4.2 }));
  });
});
