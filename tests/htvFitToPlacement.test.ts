import { describe, expect, it } from 'vitest';
import { planFitToPlacement } from '../app/htv/htvFitToPlacement';
import { computeDesignBounds } from '../app/htv/htvGeometry';
import { createHtvVectorLayer, type HtvLayer } from '../app/htv/HtvState';

function rect(id: string, widthMm: number, heightMm: number, x: number, y: number, locked = false): HtvLayer {
  const w = widthMm / 2;
  const h = heightMm / 2;
  return {
    ...createHtvVectorLayer({
      id,
      name: id,
      polylines: [{ closed: true, points: [{ x: -w, y: -h }, { x: w, y: -h }, { x: w, y: h }, { x: -w, y: h }, { x: -w, y: -h }] }],
      naturalWidthMm: widthMm,
      naturalHeightMm: heightMm,
      placementId: 'left-chest',
      sourceKind: 'svg-upload',
    }),
    x,
    y,
    locked,
  };
}

const apply = (layers: HtvLayer[], plan: NonNullable<ReturnType<typeof planFitToPlacement>>) =>
  layers.map((layer) => ({ ...layer, ...(plan.updates.find((u) => u.id === layer.id)?.updates ?? {}) }));

describe('fit to the print area', () => {
  it('shrinks a design that is too wide, keeping its centre and proportions', () => {
    const layers = [rect('a', 200, 50, 100, 100), rect('b', 60, 60, 160, 130)];
    const before = computeDesignBounds(layers)!;
    const plan = planFitToPlacement(layers, { widthMm: 100, heightMm: 100 })!;
    expect(plan.limitedBy).toBe('placement');
    const after = computeDesignBounds(apply(layers, plan))!;
    expect(after.width).toBeLessThanOrEqual(100);
    expect(after.width).toBeGreaterThan(95);
    expect(after.width / after.height).toBeCloseTo(before.width / before.height, 2);
    expect((after.minX + after.maxX) / 2).toBeCloseTo((before.minX + before.maxX) / 2, 1);
    expect((after.minY + after.maxY) / 2).toBeCloseTo((before.minY + before.maxY) / 2, 1);
  });

  it('has nothing to do when the design already fits', () => {
    expect(planFitToPlacement([rect('a', 40, 40, 100, 100)], { widthMm: 100, heightMm: 100 })).toBeNull();
  });

  it('is limited by the mat when the placement is bigger than a mat', () => {
    const layers = [rect('a', 900, 200, 160, 160)];
    const plan = planFitToPlacement(layers, { widthMm: 2000, heightMm: 2000 }, new Map(), 5)!;
    expect(plan.limitedBy).toBe('mat');
    const after = computeDesignBounds(apply(layers, plan))!;
    // 12 x 24 in mat: about 292 x 597 mm usable, and the weeding border (5 mm each side) is part of the cut file.
    expect(after.width + 10).toBeLessThanOrEqual(597);
  });

  it('does not touch a design with a locked layer', () => {
    expect(planFitToPlacement([rect('a', 200, 50, 100, 100, true)], { widthMm: 100, heightMm: 100 })).toBeNull();
  });

  it('ignores hidden layers', () => {
    const hidden = { ...rect('h', 900, 900, 0, 0), visible: false };
    expect(planFitToPlacement([hidden, rect('a', 40, 40, 100, 100)], { widthMm: 100, heightMm: 100 })).toBeNull();
  });
});
