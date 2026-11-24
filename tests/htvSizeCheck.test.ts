import { describe, expect, it } from 'vitest';
import {
  checkZoneFit,
  findHtvSizeIssues,
  formatLengthMmAndInches,
  formatSizeMmAndInches,
  summarizeHtvSize,
} from '../app/htv/htvSizeCheck';
import { getPlacementsForGarmentType, getPlacementZoneSizeMm } from '../app/htv/htvPlacementZones';
import { summarizeHtvStatus } from '../app/htv/htvStatus';
import { createHtvTextLayer, createHtvVectorLayer } from '../app/htv/HtvState';

function rectLayer(widthMm: number, heightMm: number, placementId: 'full-front' | 'left-chest' = 'left-chest') {
  const w = widthMm / 2;
  const h = heightMm / 2;
  return createHtvVectorLayer({
    id: `rect-${widthMm}x${heightMm}`,
    name: 'Rect',
    polylines: [{ closed: true, points: [{ x: -w, y: -h }, { x: w, y: -h }, { x: w, y: h }, { x: -w, y: h }, { x: -w, y: -h }] }],
    naturalWidthMm: widthMm,
    naturalHeightMm: heightMm,
    placementId,
    sourceKind: 'svg-upload',
  });
}

describe('formatting', () => {
  it('shows millimetres and inches together', () => {
    expect(formatSizeMmAndInches({ widthMm: 254, heightMm: 127 })).toBe('254 × 127 mm (10 × 5 in)');
    expect(formatLengthMmAndInches(292.1)).toBe('292.1 mm (11.5 in)');
  });
});

describe('placement sizes', () => {
  it('keeps the descriptions the UI already showed', () => {
    const tee = getPlacementsForGarmentType('tee');
    expect(tee.find((z) => z.id === 'full-front')?.description).toBe('Front · 290 x 360 mm');
    expect(tee.find((z) => z.id === 'left-sleeve')?.description).toBe('Left · 90 x 260 mm');
    expect(getPlacementsForGarmentType('hoodie').find((z) => z.id === 'left-chest')?.description).toBe('Front · 110 x 110 mm');
    expect(getPlacementsForGarmentType('tote').map((z) => z.description)).toEqual(['Front · 280 x 240 mm', 'Back · 280 x 240 mm']);
  });

  it('exposes the same size as numbers', () => {
    expect(getPlacementZoneSizeMm('tee', 'left-chest')).toEqual({ widthMm: 120, heightMm: 120 });
    expect(getPlacementZoneSizeMm('cropped-tee', 'full-back')).toEqual({ widthMm: 260, heightMm: 300 });
  });
});

describe('checkZoneFit', () => {
  const zone = { widthMm: 120, heightMm: 120 };
  it('accepts a design that fits, and one within rounding slack', () => {
    expect(checkZoneFit({ widthMm: 100, heightMm: 120 }, zone).fits).toBe(true);
    expect(checkZoneFit({ widthMm: 120.3, heightMm: 119 }, zone).fits).toBe(true);
  });
  it('reports how far each side sticks out', () => {
    const fit = checkZoneFit({ widthMm: 150, heightMm: 130 }, zone);
    expect(fit.fits).toBe(false);
    expect(fit.overWidthMm).toBe(30);
    expect(fit.overHeightMm).toBe(10);
  });
});

describe('findHtvSizeIssues', () => {
  const zone = { widthMm: 290, heightMm: 360 };
  const args = { zoneSizeMm: zone, zoneName: 'full front', weedMarginMm: 6 };

  it('has no issues for a design that fits placement and a 12x12 mat', () => {
    expect(findHtvSizeIssues({ ...args, designSizeMm: { widthMm: 200, heightMm: 200 } })).toEqual([]);
  });

  it('warns, in mm and inches, when the design is bigger than its placement', () => {
    const issues = findHtvSizeIssues({ ...args, designSizeMm: { widthMm: 300, heightMm: 200 } });
    const placement = issues.find((i) => i.id === 'exceeds-placement');
    expect(placement?.severity).toBe('warning');
    expect(placement?.message).toContain('300 × 200 mm (11.8 × 7.9 in)');
    expect(placement?.message).toContain('10 mm too wide');
  });

  it('tells the user a 12 x 24 mat is needed, without making it a warning', () => {
    const issues = findHtvSizeIssues({ ...args, designSizeMm: { widthMm: 250, heightMm: 340 } });
    const mat = issues.find((i) => i.id === 'needs-large-mat');
    expect(mat?.severity).toBe('info');
    expect(mat?.message).toContain('12 × 24');
  });

  it('warns when the cut file is larger than any Cricut mat', () => {
    const issues = findHtvSizeIssues({ ...args, designSizeMm: { widthMm: 400, heightMm: 700 } });
    expect(issues.some((i) => i.id === 'exceeds-mat' && i.severity === 'warning')).toBe(true);
  });
});

describe('summarizeHtvSize + status', () => {
  it('reports nothing for an empty placement', () => {
    const summary = summarizeHtvSize([], 'left-chest', 'tee');
    expect(summary.designSizeMm).toBeNull();
    expect(summary.issues).toEqual([]);
    expect(summary.sizeText).toBe('');
  });

  it('ignores layers on other placements', () => {
    const summary = summarizeHtvSize([rectLayer(500, 500, 'full-front')], 'left-chest', 'tee');
    expect(summary.designSizeMm).toBeNull();
  });

  it('turns the status into a warning when the design is too big for the placement', () => {
    const layers = [rectLayer(150, 100)];
    const size = summarizeHtvSize(layers, 'left-chest', 'tee');
    const status = summarizeHtvStatus(layers, 'left-chest', size);
    expect(status.status).toBe('Warning');
    expect(status.guidance).toContain('30 mm too wide');
    expect(status.guidance).toContain('left chest');
  });

  it('stays ready and shows the design size when everything fits', () => {
    const layers = [rectLayer(100, 80)];
    const size = summarizeHtvSize(layers, 'left-chest', 'tee');
    const status = summarizeHtvStatus(layers, 'left-chest', size);
    expect(status.status).toBe('Ready');
    expect(status.guidance).toContain('100 × 80 mm (3.9 × 3.1 in)');
  });

  it('waits for text outlines instead of warning about a guessed size', () => {
    const text = createHtvTextLayer({ id: 'text-1', text: 'A long line of text that is not measured yet', fontId: 'x', placementId: 'left-chest' });
    const pending = summarizeHtvSize([text], 'left-chest', 'tee');
    expect(pending.measuring).toBe(true);
    expect(pending.issues).toEqual([]);
    expect(summarizeHtvStatus([text], 'left-chest', pending).status).toBe('Ready');

    const measured = summarizeHtvSize([text], 'left-chest', 'tee', 6, new Map([['text-1', { width: 200, height: 30 }]]));
    expect(measured.measuring).toBe(false);
    expect(measured.designSizeMm).toEqual({ widthMm: 200, heightMm: 30 });
    expect(measured.issues.some((i) => i.id === 'exceeds-placement')).toBe(true);
  });

  it('is deterministic', () => {
    const layers = [rectLayer(150, 100)];
    expect(summarizeHtvSize(layers, 'left-chest', 'tee')).toEqual(summarizeHtvSize(layers, 'left-chest', 'tee'));
  });
});
