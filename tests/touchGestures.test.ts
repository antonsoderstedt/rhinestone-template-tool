import { describe, expect, it } from 'vitest';
import { computePinchStep, distance, fitRect, midpoint } from '../app/lib/touchGestures';

const rect = { left: 10, top: 20, width: 400, height: 300 };
const viewBox = { x: -100, y: -75, width: 200, height: 150 }; // same aspect as rect: 0.5 mm/px

/** Drawing (mm) point under a screen point for a view box drawn into `r`. */
const mmAt = (vb: typeof viewBox, r: typeof rect, px: number, py: number) => ({
  x: vb.x + ((px - r.left) / r.width) * vb.width,
  y: vb.y + ((py - r.top) / r.height) * vb.height,
});

describe('computePinchStep', () => {
  const base = { rect, viewBox, zoom: 1, minZoom: 0.1, maxZoom: 5 };

  it('keeps the point under the fingers fixed while spreading', () => {
    const prev = { mid: { x: 210, y: 170 }, dist: 100 };
    const next = { mid: { x: 210, y: 170 }, dist: 200 };
    const result = computePinchStep({ ...base, prev, next });
    expect(result.zoom).toBeCloseTo(2);
    expect(result.viewBox.width).toBeCloseTo(100);
    expect(result.viewBox.height).toBeCloseTo(75);
    const before = mmAt(viewBox, rect, 210, 170);
    const after = mmAt(result.viewBox, rect, 210, 170);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('pans when both fingers move together, without changing zoom', () => {
    const prev = { mid: { x: 210, y: 170 }, dist: 120 };
    const next = { mid: { x: 260, y: 150 }, dist: 120 };
    const result = computePinchStep({ ...base, prev, next });
    expect(result.zoom).toBe(1);
    expect(result.viewBox.width).toBe(200);
    // Dragging the artwork 50px right / 20px up (0.5 mm per px) moves the view box 25 mm left / 10 mm down.
    expect(result.viewBox.x).toBeCloseTo(-125);
    expect(result.viewBox.y).toBeCloseTo(-65);
  });

  it('holds the artwork under the moving midpoint while zooming', () => {
    const prev = { mid: { x: 150, y: 120 }, dist: 80 };
    const next = { mid: { x: 300, y: 250 }, dist: 160 };
    const result = computePinchStep({ ...base, prev, next });
    const before = mmAt(viewBox, rect, prev.mid.x, prev.mid.y);
    const after = mmAt(result.viewBox, rect, next.mid.x, next.mid.y);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('clamps zoom to the limits', () => {
    const prev = { mid: { x: 210, y: 170 }, dist: 10 };
    const tooFar = computePinchStep({ ...base, prev, next: { mid: prev.mid, dist: 1000 } });
    expect(tooFar.zoom).toBe(5);
    expect(tooFar.viewBox.width).toBeCloseTo(40);
    const tooClose = computePinchStep({ ...base, prev: { mid: prev.mid, dist: 1000 }, next: { mid: prev.mid, dist: 10 } });
    expect(tooClose.zoom).toBe(0.1);
  });

  it('does nothing for degenerate input', () => {
    const same = { zoom: 1, viewBox };
    expect(computePinchStep({ ...base, prev: { mid: { x: 0, y: 0 }, dist: 0 }, next: { mid: { x: 0, y: 0 }, dist: 5 } })).toEqual(same);
    expect(computePinchStep({ ...base, rect: { ...rect, width: 0 }, prev: { mid: { x: 0, y: 0 }, dist: 5 }, next: { mid: { x: 0, y: 0 }, dist: 5 } })).toEqual(same);
  });

  it('is deterministic', () => {
    const args = { ...base, prev: { mid: { x: 100, y: 100 }, dist: 50 }, next: { mid: { x: 130, y: 90 }, dist: 70 } };
    expect(computePinchStep(args)).toEqual(computePinchStep(args));
  });
});

describe('fitRect', () => {
  it('returns the whole rect when aspects match', () => {
    expect(fitRect(rect, { width: 200, height: 150 })).toEqual(rect);
  });

  it('centres a square view box in a tall rect', () => {
    const tall = { left: 0, top: 0, width: 390, height: 600 };
    expect(fitRect(tall, { width: 100, height: 100 })).toEqual({ left: 0, top: 105, width: 390, height: 390 });
  });

  it('centres a square view box in a wide rect', () => {
    const wide = { left: 5, top: 0, width: 800, height: 400 };
    expect(fitRect(wide, { width: 50, height: 50 })).toEqual({ left: 205, top: 0, width: 400, height: 400 });
  });
});

describe('geometry helpers', () => {
  it('computes midpoint and distance', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 });
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});
