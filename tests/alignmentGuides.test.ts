import { describe, expect, it } from 'vitest';
import { findSnapCandidates } from '../app/editor/alignmentGuides';

describe('findSnapCandidates', () => {
  it('snaps to a nearby stone center on the x axis', () => {
    const result = findSnapCandidates(10.2, 50, [{ x: 10, y: 20 }], { x: 0, y: 0 });
    expect(result.x).toBe(10);
    expect(result.guides).toContainEqual({ axis: 'x', value: 10 });
  });

  it('snaps to a nearby stone center on the y axis', () => {
    const result = findSnapCandidates(50, 20.3, [{ x: 10, y: 20 }], { x: 0, y: 0 });
    expect(result.y).toBe(20);
    expect(result.guides).toContainEqual({ axis: 'y', value: 20 });
  });

  it('snaps to the workspace centerline', () => {
    const result = findSnapCandidates(100.1, 5, [], { x: 100, y: 0 });
    expect(result.x).toBe(100);
  });

  it('does not snap beyond the threshold', () => {
    const result = findSnapCandidates(15, 50, [{ x: 10, y: 20 }], { x: 0, y: 0 }, 0.5);
    expect(result.x).toBe(15);
    expect(result.guides).toHaveLength(0);
  });

  it('picks the closest candidate when multiple are within threshold', () => {
    const result = findSnapCandidates(
      10.1,
      50,
      [{ x: 10, y: 20 }, { x: 10.4, y: 20 }],
      { x: 0, y: 0 },
      1,
    );
    expect(result.x).toBe(10);
  });

  it('snaps both axes independently', () => {
    const result = findSnapCandidates(10.1, 20.1, [{ x: 10, y: 20 }], { x: 0, y: 0 });
    expect(result).toEqual({ x: 10, y: 20, guides: [{ axis: 'x', value: 10 }, { axis: 'y', value: 20 }] });
  });

  it('returns no guides when nothing is close', () => {
    const result = findSnapCandidates(500, 500, [{ x: 10, y: 20 }], { x: 0, y: 0 });
    expect(result).toEqual({ x: 500, y: 500, guides: [] });
  });
});
