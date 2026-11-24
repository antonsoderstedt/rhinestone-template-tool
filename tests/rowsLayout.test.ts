import { describe, expect, it } from 'vitest';
import { layoutRows, type PlacedStone } from '../src/lib/rhinestone-engine/artwork/rowsLayout';
import { boundsOfPolylines, buildRegionField, createGrid, emptyMask, fillLoops, sampleField } from '../src/lib/rhinestone-engine/artwork/regionField';
import { measureArtworkQuality } from '../src/lib/rhinestone-engine/index';
import type { Polyline } from '../src/lib/rhinestone-engine/index';

const HOLE = 3.43;
const PITCH = 4.188;
const MIN = HOLE + 0.508;

const rect = (x: number, y: number, w: number, h: number): Polyline => ({
  closed: true,
  points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }],
});
const circle = (cx: number, cy: number, r: number, n = 180): Polyline => ({
  closed: true,
  points: Array.from({ length: n }, (_, i) => ({ x: cx + r * Math.cos((2 * Math.PI * i) / n), y: cy + r * Math.sin((2 * Math.PI * i) / n) })),
});
const fieldOf = (loops: Polyline[]) => {
  const mask = emptyMask(createGrid(boundsOfPolylines(loops), { cellMm: 0.2 }));
  fillLoops(mask, loops, 'evenodd');
  return buildRegionField(mask);
};
const run = (loops: Polyline[], rows: number | 'all') => {
  const field = fieldOf(loops);
  return { field, stones: layoutRows(field, { holeDiameterMm: HOLE, pitchMm: PITCH, minCentreDistanceMm: MIN, rows }) };
};
const smallestCentreDistance = (stones: PlacedStone[]) => {
  let min = Infinity;
  for (let i = 0; i < stones.length; i++) for (let j = i + 1; j < stones.length; j++) min = Math.min(min, Math.hypot(stones[i]!.x - stones[j]!.x, stones[i]!.y - stones[j]!.y));
  return min;
};

describe('layoutRows: outline (one row)', () => {
  it('traces the inside of the edge: every stone lies one half hole in, none outside', () => {
    const { field, stones } = run([circle(50, 50, 30)], 1);
    expect(stones.length).toBeGreaterThan(30);
    for (const s of stones) {
      expect(sampleField(field, s.x, s.y)).toBeGreaterThan(HOLE / 2 - 0.4);
      expect(sampleField(field, s.x, s.y)).toBeLessThan(HOLE / 2 + 0.4);
    }
    expect(stones.every((s) => s.kind === 'edge')).toBe(true);
  });

  it('never puts two stones closer than the minimum', () => {
    expect(smallestCentreDistance(run([circle(50, 50, 30)], 1).stones)).toBeGreaterThanOrEqual(MIN);
    expect(smallestCentreDistance(run([rect(0, 0, 60, 40)], 1).stones)).toBeGreaterThanOrEqual(MIN);
  });

  it('gives a ring (a shape with a hole) a row on both edges', () => {
    const { stones } = run([circle(50, 50, 40), circle(50, 50, 15)], 1);
    const radii = stones.map((s) => Math.hypot(s.x - 50, s.y - 50));
    expect(radii.some((r) => Math.abs(r - (40 - HOLE / 2)) < 0.5)).toBe(true);
    expect(radii.some((r) => Math.abs(r - (15 + HOLE / 2)) < 0.5)).toBe(true);
  });
});

describe('layoutRows: rows and solid', () => {
  it('three rows are three parallel rows', () => {
    const { stones } = run([rect(0, 0, 80, 80)], 3);
    expect(new Set(stones.map((s) => s.row))).toEqual(new Set([0, 1, 2]));
    expect(smallestCentreDistance(stones)).toBeGreaterThanOrEqual(MIN);
  });

  it('all rows plus the hex remainder cover a square, with no overlaps, no strays and nothing outside', () => {
    const loops = [rect(0, 0, 60, 60)];
    const { stones } = run(loops, 'all');
    expect(smallestCentreDistance(stones)).toBeGreaterThanOrEqual(MIN);
    const q = measureArtworkQuality({ polylines: loops, stones: stones.map((s) => ({ center: { x: s.x, y: s.y }, holeDiameterMm: HOLE })), pitchMm: PITCH });
    expect(q.areaCoverage).toBeGreaterThan(0.97);
    expect(q.outsideStones).toBe(0);
    expect(q.strayStones).toBe(0);
  });

  it('keeps the hole of a ring empty and still covers the band', () => {
    const loops = [circle(50, 50, 40), circle(50, 50, 15)];
    const { stones } = run(loops, 'all');
    expect(stones.every((s) => Math.hypot(s.x - 50, s.y - 50) > 15 + HOLE / 2 - 0.4)).toBe(true);
    const q = measureArtworkQuality({ polylines: loops, stones: stones.map((s) => ({ center: { x: s.x, y: s.y }, holeDiameterMm: HOLE })), pitchMm: PITCH });
    expect(q.areaCoverage).toBeGreaterThan(0.95);
    expect(smallestCentreDistance(stones)).toBeGreaterThanOrEqual(MIN);
  });
});

describe('layoutRows: thin parts', () => {
  it('a bar too thin for two rows gets one row down the middle, not two colliding edge rows', () => {
    const { field, stones } = run([rect(0, 0, 80, 5.5)], 1);
    expect(stones.length).toBeGreaterThan(10);
    expect(smallestCentreDistance(stones)).toBeGreaterThanOrEqual(MIN);
    // every stone but the two end stones (kept on their corners) is on the centre line
    const middle = stones.filter((s) => s.x > 5 && s.x < 75).map((s) => s.y);
    expect(Math.max(...middle) - Math.min(...middle)).toBeLessThan(0.3);
    for (const s of stones) expect(sampleField(field, s.x, s.y)).toBeGreaterThan(HOLE / 2 - 0.4);
  });

  it('a bar thinner than a stone gets none', () => {
    expect(run([rect(0, 0, 80, 2.5)], 1).stones).toEqual([]);
  });

  it('a wide bar keeps two edge rows', () => {
    const { stones } = run([rect(0, 0, 80, 12)], 1);
    const ys = new Set(stones.map((s) => Math.round(s.y)));
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(6);
  });
});

describe('layoutRows: general', () => {
  it('is deterministic', () => {
    const loops = [circle(50, 50, 40), circle(50, 50, 15)];
    expect(run(loops, 'all').stones).toEqual(run(loops, 'all').stones);
  });

  it('gives nothing for a shape smaller than a stone', () => {
    expect(run([circle(10, 10, 1.2)], 'all').stones).toEqual([]);
  });

  it('rows = 0 gives nothing', () => {
    expect(run([rect(0, 0, 40, 40)], 0).stones).toEqual([]);
  });
});
