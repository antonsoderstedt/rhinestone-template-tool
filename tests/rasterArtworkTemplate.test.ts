import { describe, expect, it } from 'vitest';
import { createRasterArtworkTemplate } from '../src/lib/rhinestone-engine/index';

function imageFromRows(rows: readonly (readonly number[])[][]): { widthPx: number; heightPx: number; rgba: Uint8ClampedArray } {
  const heightPx = rows.length;
  const widthPx = rows[0]!.length;
  const rgba = new Uint8ClampedArray(widthPx * heightPx * 4);
  rows.forEach((row, y) => {
    row.forEach((pixel, x) => {
      const offset = (y * widthPx + x) * 4;
      rgba[offset] = pixel[0]!;
      rgba[offset + 1] = pixel[1]!;
      rgba[offset + 2] = pixel[2]!;
      rgba[offset + 3] = pixel[3] ?? 255;
    });
  });
  return { widthPx, heightPx, rgba };
}

describe('Raster artwork template', () => {
  it('creates stones from dark image regions', () => {
    const image = imageFromRows([
      [[0, 0, 0], [255, 255, 255]],
      [[0, 0, 0], [255, 255, 255]],
    ]);
    const result = createRasterArtworkTemplate({
      image,
      name: 'Dark split',
      stoneSize: 'SS10',
      spacingMm: 1,
      threshold: 100,
      detail: 255,
      invert: false,
      colorCount: 1,
      targetWidthMm: 2,
      targetHeightMm: 2,
    });

    expect(result.template.stones.length).toBeGreaterThan(0);
    expect(result.template.stones.every((stone) => stone.center.x <= 1.1)).toBe(true);
  });

  it('invert fill flips selection to lighter regions', () => {
    const image = imageFromRows([
      [[0, 0, 0], [255, 255, 255]],
      [[0, 0, 0], [255, 255, 255]],
    ]);
    const normal = createRasterArtworkTemplate({
      image,
      name: 'Normal',
      stoneSize: 'SS10',
      spacingMm: 1,
      threshold: 100,
      detail: 255,
      invert: false,
      colorCount: 1,
      targetWidthMm: 2,
      targetHeightMm: 2,
    });
    const inverted = createRasterArtworkTemplate({
      image,
      name: 'Inverted',
      stoneSize: 'SS10',
      spacingMm: 1,
      threshold: 100,
      detail: 255,
      invert: true,
      colorCount: 1,
      targetWidthMm: 2,
      targetHeightMm: 2,
    });

    expect(normal.template.stones.some((stone) => stone.center.x <= 1.1)).toBe(true);
    expect(inverted.template.stones.some((stone) => stone.center.x >= 0.9)).toBe(true);
  });

  it('detail smoothing can suppress isolated dark noise', () => {
    const white = [255, 255, 255] as const;
    const black = [0, 0, 0] as const;
    const image = imageFromRows([
      [white, white, white],
      [white, black, white],
      [white, white, white],
    ]);
    const sharp = createRasterArtworkTemplate({
      image,
      name: 'Sharp',
      stoneSize: 'SS10',
      spacingMm: 1,
      threshold: 64,
      detail: 255,
      invert: false,
      colorCount: 1,
      targetWidthMm: 3,
      targetHeightMm: 3,
    });
    const smoothed = createRasterArtworkTemplate({
      image,
      name: 'Smoothed',
      stoneSize: 'SS10',
      spacingMm: 1,
      threshold: 64,
      detail: 0,
      invert: false,
      colorCount: 1,
      targetWidthMm: 3,
      targetHeightMm: 3,
    });

    expect(sharp.template.stones.length).toBeGreaterThan(smoothed.template.stones.length);
  });

  it('clusters active stones into multiple color layers', () => {
    const red = [255, 0, 0] as const;
    const blue = [0, 0, 255] as const;
    const image = imageFromRows([
      [red, red, blue, blue],
      [red, red, blue, blue],
    ]);
    const result = createRasterArtworkTemplate({
      image,
      name: 'Two color',
      stoneSize: 'SS10',
      spacingMm: 1,
      threshold: 255,
      detail: 255,
      invert: false,
      colorCount: 2,
      targetWidthMm: 4,
      targetHeightMm: 2,
    });

    expect(new Set(result.template.stones.map((stone) => stone.metadata?.fill)).size).toBe(2);
    expect(result.palette).toHaveLength(2);
  });

  it('preserves source aspect ratio when only width is provided', () => {
    const image = imageFromRows([
      [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
      [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
    ]);
    const result = createRasterArtworkTemplate({
      image,
      name: 'Aspect',
      stoneSize: 'SS10',
      spacingMm: 2,
      threshold: 255,
      detail: 255,
      invert: false,
      colorCount: 1,
      targetWidthMm: 40,
    });

    expect(result.template.widthMm).toBeCloseTo(40, 3);
    expect(result.template.heightMm).toBeCloseTo(20, 3);
  });

  it('is deterministic for the same input', () => {
    const image = imageFromRows([
      [[30, 30, 30], [220, 220, 220]],
      [[30, 30, 30], [220, 220, 220]],
    ]);
    const options = {
      image,
      name: 'Stable',
      stoneSize: 'SS10' as const,
      spacingMm: 1,
      threshold: 100,
      detail: 128,
      invert: false,
      colorCount: 1 as const,
      targetWidthMm: 2,
      targetHeightMm: 2,
    };
    const first = createRasterArtworkTemplate(options);
    const second = createRasterArtworkTemplate(options);
    expect(first).toEqual(second);
  });
});