import { describe, expect, it } from 'vitest';
import { wouldMoveCauseCollision } from '../app/editor/collisionDetection';

const stone = (id: string, x: number, y: number) => ({ id, center: { x, y }, stoneSize: 'SS10' as const, holeDiameterMm: 3.43 });

/** The old way: every pair. Kept here as the reference the fast version must agree with. */
function reference(moves: Array<{ id: string; toX: number; toY: number }>, stones: ReturnType<typeof stone>[], gap: number) {
  const pos = new Map(moves.map((m) => [m.id, { x: m.toX, y: m.toY }]));
  const moving = new Set(moves.map((m) => m.id));
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < stones.length; i++) {
    for (let j = i + 1; j < stones.length; j++) {
      const a = stones[i]!;
      const b = stones[j]!;
      if (!moving.has(a.id) && !moving.has(b.id)) continue;
      const pa = pos.get(a.id) ?? a.center;
      const pb = pos.get(b.id) ?? b.center;
      if (Math.hypot(pa.x - pb.x, pa.y - pb.y) - (a.holeDiameterMm / 2 + b.holeDiameterMm / 2) < gap) pairs.push([a.id, b.id]);
    }
  }
  return pairs;
}

describe('moving stones (plan C5)', () => {
  const grid = Array.from({ length: 400 }, (_, i) => stone(`s${i}`, 10 + (i % 20) * 5, 10 + Math.floor(i / 20) * 5));

  it('finds the same colliding pairs as comparing every pair, in the same order', () => {
    const moves = [
      { id: 's21', toX: 14, toY: 10.5 }, // onto s1 and s0
      { id: 's22', toX: 15, toY: 11 }, // onto s21's new place and s2
      { id: 's300', toX: 200, toY: 200 }, // far away: no collision
    ];
    const fast = wouldMoveCauseCollision(moves, grid).collidingPairs;
    const slow = reference(moves, grid, 0.508);
    expect(fast.length).toBeGreaterThan(0);
    expect(fast).toEqual(slow);
  });

  it('says there is no collision for a move into free space and for a move that changes nothing', () => {
    expect(wouldMoveCauseCollision([{ id: 's5', toX: 500, toY: 500 }], grid).collides).toBe(false);
    expect(wouldMoveCauseCollision([{ id: 's5', toX: 35, toY: 10 }], grid).collides).toBe(false);
  });

  it('is fast on a big design (5,000 stones, all of them moved a little)', () => {
    const big = Array.from({ length: 5000 }, (_, i) => stone(`b${i}`, (i % 100) * 5, Math.floor(i / 100) * 5));
    const moves = big.map((s) => ({ id: s.id, toX: s.center.x + 0.5, toY: s.center.y }));
    const started = performance.now();
    const result = wouldMoveCauseCollision(moves, big);
    const ms = performance.now() - started;
    expect(result.collides).toBe(false);
    expect(ms).toBeLessThan(500);
  });
});
