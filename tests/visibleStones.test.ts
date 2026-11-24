import { describe, expect, it } from 'vitest';
import { CULLING_THRESHOLD, visibleStonesForView } from '../app/editor/visibleStones';

const stone = (id: string, x: number, y: number) => ({ id, center: { x, y }, holeDiameterMm: 3 });
const grid = (n: number) => Array.from({ length: n }, (_, i) => stone(`s${i}`, (i % 100) * 5, Math.floor(i / 100) * 5));

describe('drawing only what is in view (plan C6)', () => {
  it('draws everything for a small design', () => {
    const small = grid(CULLING_THRESHOLD);
    expect(visibleStonesForView(small, { x: 0, y: 0, width: 10, height: 10 })).toBe(small);
  });

  it('draws only the stones in view and a margin for a big design', () => {
    const big = grid(6000); // 100 columns x 60 rows, 5 mm apart: x 0..495, y 0..295
    const drawn = visibleStonesForView(big, { x: 100, y: 100, width: 50, height: 50 }, new Set(), 0);
    expect(drawn.length).toBeGreaterThan(50);
    expect(drawn.length).toBeLessThan(200);
    expect(drawn.every((s) => s.center.x >= 98 && s.center.x <= 152 && s.center.y >= 98 && s.center.y <= 152)).toBe(true);
  });

  it('always keeps the selected stones, even far outside the view', () => {
    const big = grid(6000);
    const drawn = visibleStonesForView(big, { x: 100, y: 100, width: 50, height: 50 }, new Set(['s5999']), 0);
    expect(drawn.some((s) => s.id === 's5999')).toBe(true);
  });

  it('keeps a stone that is only partly in view', () => {
    const big = [...grid(2500), stone('edge', 99, 120)];
    const drawn = visibleStonesForView(big, { x: 100, y: 100, width: 50, height: 50 }, new Set(), 0);
    expect(drawn.some((s) => s.id === 'edge')).toBe(true);
  });
});
