import { describe, expect, it } from 'vitest';
import { measureArtworkQuality, rasterizeSilhouette } from '../src/lib/rhinestone-engine/index';
import type { Polyline } from '../src/lib/rhinestone-engine/index';

const square = (x: number, y: number, size: number): Polyline => ({
  closed: true,
  points: [{ x, y }, { x: x + size, y }, { x: x + size, y: y + size }, { x, y: y + size }],
});

describe('rasterizeSilhouette', () => {
  it('fills a square and leaves a nested square as a hole (even-odd)', () => {
    const grid = rasterizeSilhouette([square(0, 0, 40), square(10, 10, 20)], 1);
    const filled = grid.inside.reduce((n, v) => n + v, 0);
    expect(filled).toBe(40 * 40 - 20 * 20);
  });

  it('ignores open polylines', () => {
    const open: Polyline = { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] };
    expect(rasterizeSilhouette([open], 1).inside.reduce((n, v) => n + v, 0)).toBe(0);
  });
});

describe('measureArtworkQuality', () => {
  const stoneAt = (x: number, y: number) => ({ center: { x, y }, holeDiameterMm: 3.4 });
  const gridStones = (size: number, pitch: number) => {
    const stones = [];
    for (let y = pitch / 2; y < size; y += pitch) for (let x = pitch / 2; x < size; x += pitch) stones.push(stoneAt(x, y));
    return stones;
  };

  it('scores a full grid of stones as covering the square, without strays or outsiders', () => {
    const q = measureArtworkQuality({ polylines: [square(0, 0, 40)], stones: gridStones(40, 4.2), pitchMm: 4.2 });
    expect(q.areaCoverage).toBeGreaterThan(0.97);
    expect(q.outsideStones).toBe(0);
    expect(q.strayStones).toBe(0);
    expect(q.minGapMm).toBeCloseTo(0.8, 1);
  });

  it('notices a missing region, a stray stone and a stone outside the shape', () => {
    const stones = gridStones(40, 4.2).filter((s) => !(s.center.x < 20 && s.center.y < 20));
    stones.push(stoneAt(60, 60));
    stones.push(stoneAt(20.5, 10.5));
    const q = measureArtworkQuality({ polylines: [square(0, 0, 40)], stones, pitchMm: 4.2 });
    expect(q.areaCoverage).toBeLessThan(0.85);
    expect(q.outsideStones).toBe(1);
    expect(q.strayStones).toBeGreaterThanOrEqual(1);
  });

  it('measures outline coverage along the boundary', () => {
    const ring = [];
    for (let x = 0; x <= 40; x += 4.2) { ring.push(stoneAt(x, 0), stoneAt(x, 40)); }
    for (let y = 4.2; y < 40; y += 4.2) { ring.push(stoneAt(0, y), stoneAt(40, y)); }
    const q = measureArtworkQuality({ polylines: [square(0, 0, 40)], stones: ring, pitchMm: 4.2 });
    expect(q.outlineCoverage).toBeGreaterThan(0.97);
    expect(q.outsideStones).toBe(0);
  });

  it('is deterministic', () => {
    const args = { polylines: [square(0, 0, 40)], stones: gridStones(40, 4.2), pitchMm: 4.2 };
    expect(measureArtworkQuality(args)).toEqual(measureArtworkQuality(args));
  });
});
