import { describe, expect, it } from 'vitest';
import {
  createContourRhinestoneTemplate,
  createOutlineTextTemplateAsync,
  createPolylineFilledRhinestoneTemplate,
  circlesOverlap,
  generatePlacedFillStones,
  svgStringToPolylines,
} from '../src/lib/rhinestone-engine/index';
import type { Polyline } from '../src/lib/rhinestone-engine/index';

const donut: Polyline[] = [
  { points: [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 80 }, { x: 0, y: 80 }], closed: true },
  { points: [{ x: 25, y: 25 }, { x: 55, y: 25 }, { x: 55, y: 55 }, { x: 25, y: 55 }], closed: true },
];

const concave: Polyline[] = [
  { points: [{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 20 }, { x: 45, y: 20 }, { x: 45, y: 60 }, { x: 80, y: 60 }, { x: 80, y: 80 }, { x: 0, y: 80 }], closed: true },
];

function hasCollisions(stones: { center: { x: number; y: number }; holeDiameterMm: number }[]) {
  for (let i = 0; i < stones.length; i++) {
    for (let j = i + 1; j < stones.length; j++) {
      if (
        circlesOverlap(
          { center: stones[i]!.center, radiusMm: stones[i]!.holeDiameterMm / 2 },
          { center: stones[j]!.center, radiusMm: stones[j]!.holeDiameterMm / 2 },
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

describe('advanced placement modes', () => {
  it('contour generates multiple rows and changes geometry when row count changes', () => {
    const oneRow = createContourRhinestoneTemplate({
      id: 'contour-1',
      name: 'Contour 1',
      polylines: donut,
      stoneSize: 'SS10',
      rowCount: 1,
      rowSpacingMm: 4,
      direction: 'inward',
      spacingMm: 4,
    });
    const threeRows = createContourRhinestoneTemplate({
      id: 'contour-3',
      name: 'Contour 3',
      polylines: donut,
      stoneSize: 'SS10',
      rowCount: 3,
      rowSpacingMm: 4,
      direction: 'inward',
      spacingMm: 4,
    });
    expect(threeRows.stones.length).toBeGreaterThan(oneRow.stones.length);
    expect(hasCollisions(threeRows.stones)).toBe(false);
  });

  it('contour handles concave forms and safely skips collapsed rows', () => {
    const contour = createContourRhinestoneTemplate({
      id: 'concave',
      name: 'Concave',
      polylines: concave,
      stoneSize: 'SS10',
      rowCount: 5,
      rowSpacingMm: 10,
      direction: 'inward',
      spacingMm: 4,
    });
    expect(contour.stones.length).toBeGreaterThan(0);
    expect(contour.skippedRows).toBeGreaterThanOrEqual(0);
  });

  it('hexagonal placement differs from default and avoids hole interiors', () => {
    const defaultFill = generatePlacedFillStones(donut, {
      stoneSize: 'SS10',
      spacingMm: 4,
      placementPattern: 'default',
      fillPattern: 'offset-grid',
    });
    const hexFill = generatePlacedFillStones(donut, {
      stoneSize: 'SS10',
      spacingMm: 4,
      placementPattern: 'hexagonal',
      fillPattern: 'offset-grid',
    });
    expect(hexFill.length).toBeGreaterThan(0);
    expect(hexFill).not.toEqual(defaultFill);
    expect(hexFill.some((stone) => stone.center.x > 25 && stone.center.x < 55 && stone.center.y > 25 && stone.center.y < 55)).toBe(false);
    expect(hasCollisions(hexFill)).toBe(false);
  });

  it('radial placement is deterministic and responds to center offsets', () => {
    const radial = generatePlacedFillStones(donut, {
      stoneSize: 'SS10',
      spacingMm: 4,
      placementPattern: 'radial',
      radialSettings: { ringSpacingMm: 4, centerOffsetXmm: 0, centerOffsetYmm: 0, includeCenterStone: true },
    });
    const radialAgain = generatePlacedFillStones(donut, {
      stoneSize: 'SS10',
      spacingMm: 4,
      placementPattern: 'radial',
      radialSettings: { ringSpacingMm: 4, centerOffsetXmm: 0, centerOffsetYmm: 0, includeCenterStone: true },
    });
    const shifted = generatePlacedFillStones(donut, {
      stoneSize: 'SS10',
      spacingMm: 4,
      placementPattern: 'radial',
      radialSettings: { ringSpacingMm: 4, centerOffsetXmm: 6, centerOffsetYmm: -4, includeCenterStone: true },
    });
    expect(radial).toEqual(radialAgain);
    expect(shifted).not.toEqual(radial);
    expect(hasCollisions(radial)).toBe(false);
  });

  it('outline + hexagonal and outline + radial remain collision-free', () => {
    const hex = createPolylineFilledRhinestoneTemplate({
      id: 'hex-template',
      name: 'Hex Template',
      polylines: donut,
      stoneSize: 'SS10',
      coverageMode: 'outline-fill',
      fillMode: 'outline-fill',
      placementPattern: 'hexagonal',
      fillPattern: 'offset-grid',
      spacingMm: 4,
    });
    const radial = createPolylineFilledRhinestoneTemplate({
      id: 'radial-template',
      name: 'Radial Template',
      polylines: donut,
      stoneSize: 'SS10',
      coverageMode: 'outline-fill',
      fillMode: 'outline-fill',
      placementPattern: 'radial',
      radialSettings: { ringSpacingMm: 4, centerOffsetXmm: 0, centerOffsetYmm: 0, includeCenterStone: true },
      spacingMm: 4,
    });
    expect(hasCollisions(hex.stones)).toBe(false);
    expect(hasCollisions(radial.stones)).toBe(false);
  });

  it('advanced modes work for OpenType text with holes', async () => {
    const contour = await createOutlineTextTemplateAsync({
      id: 'text-contour',
      name: 'Text Contour',
      text: 'B8O ÅÄÖ',
      stoneSize: 'SS10',
      fontId: 'archivo-black',
      coverageMode: 'contour',
      contourSettings: { rowCount: 3, rowSpacingMm: 4, direction: 'inward' },
    });
    const hex = await createOutlineTextTemplateAsync({
      id: 'text-hex',
      name: 'Text Hex',
      text: 'B8O ÅÄÖ',
      stoneSize: 'SS10',
      fontId: 'archivo-black',
      coverageMode: 'fill',
      placementPattern: 'hexagonal',
      fillMode: 'fill',
    });
    const radial = await createOutlineTextTemplateAsync({
      id: 'text-radial',
      name: 'Text Radial',
      text: 'B8O ÅÄÖ',
      stoneSize: 'SS10',
      fontId: 'archivo-black',
      coverageMode: 'fill',
      placementPattern: 'radial',
      fillMode: 'fill',
      radialSettings: { ringSpacingMm: 4, centerOffsetXmm: 0, centerOffsetYmm: 0, includeCenterStone: true },
    });
    expect(contour.stones.length).toBeGreaterThan(0);
    expect(hex.stones.length).toBeGreaterThan(0);
    expect(radial.stones.length).toBeGreaterThan(0);
  });

  it('SVG geometry shares the same advanced placement engine', () => {
    const polylines = svgStringToPolylines('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 0 L100 0 L100 100 L0 100 Z M30 30 L70 30 L70 70 L30 70 Z" /></svg>');
    const contour = createPolylineFilledRhinestoneTemplate({
      id: 'svg-contour',
      name: 'SVG Contour',
      polylines,
      stoneSize: 'SS10',
      coverageMode: 'contour',
      contourSettings: { rowCount: 2, rowSpacingMm: 4, direction: 'inward' },
      fillMode: 'outline',
    });
    const radial = createPolylineFilledRhinestoneTemplate({
      id: 'svg-radial',
      name: 'SVG Radial',
      polylines,
      stoneSize: 'SS10',
      coverageMode: 'fill',
      fillMode: 'fill',
      placementPattern: 'radial',
      radialSettings: { ringSpacingMm: 4, centerOffsetXmm: 0, centerOffsetYmm: 0, includeCenterStone: true },
    });
    expect(contour.stones.length).toBeGreaterThan(0);
    expect(radial.stones.length).toBeGreaterThan(0);
  });
});
