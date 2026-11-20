import { describe, expect, it } from 'vitest';
import { buildRasterLayers, checkExportReadiness, createArtworkTemplate } from '../src/lib/rhinestone-engine/index';

type Painter = (x: number, y: number) => [number, number, number, number] | null;
/** An RGBA image of the given size; `paint` returns a pixel or null for the background. */
function image(w: number, h: number, paint: Painter, background: [number, number, number, number] = [255, 255, 255, 255]) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = paint(x, y) ?? background;
      rgba.set(px, (y * w + x) * 4);
    }
  }
  return { widthPx: w, heightPx: h, rgba };
}
const disc = (cx: number, cy: number, r: number, colour: [number, number, number, number]): Painter => (x, y) => ((x - cx) ** 2 + (y - cy) ** 2 <= r * r ? colour : null);

describe('buildRasterLayers', () => {
  it('removes a plain background and keeps the shape at the size asked for', () => {
    const { layers } = buildRasterLayers(image(200, 200, disc(100, 100, 60, [0, 0, 0, 255])), { widthMm: 100 });
    expect(layers).toHaveLength(1);
    // a disc of radius 60 px in a 200 px image that is 100 mm wide: radius 30 mm
    expect(layers[0]!.areaMm2).toBeGreaterThan(Math.PI * 30 * 30 * 0.97);
    expect(layers[0]!.areaMm2).toBeLessThan(Math.PI * 30 * 30 * 1.03);
    expect(layers[0]!.colour).toBe('#000000');
  });

  it('takes a transparent background as the background', () => {
    const { layers } = buildRasterLayers(image(100, 100, disc(50, 50, 30, [255, 0, 128, 255]), [0, 0, 0, 0]), { widthMm: 50 });
    expect(layers).toHaveLength(1);
    expect(layers[0]!.colour).toBe('#ff0080');
  });

  it('reduces to the number of colours asked for, with the colours of the image', () => {
    const paint: Painter = (x, y) => disc(60, 100, 40, [220, 20, 20, 255])(x, y) ?? disc(140, 100, 40, [20, 20, 220, 255])(x, y);
    const two = buildRasterLayers(image(200, 200, paint), { widthMm: 100, colorCount: 2 });
    expect(two.layers).toHaveLength(2);
    const colours = two.layers.map((l) => l.colour).sort();
    expect(colours).toEqual(['#1414dc', '#dc1414']);
    const one = buildRasterLayers(image(200, 200, paint), { widthMm: 100, colorCount: 1 });
    expect(one.layers).toHaveLength(1);
    expect(one.layers[0]!.areaMm2).toBeCloseTo(two.layers[0]!.areaMm2 + two.layers[1]!.areaMm2, -1);
  });

  it('invert puts the stones on the background instead', () => {
    const img = image(200, 200, disc(100, 100, 60, [0, 0, 0, 255]));
    const normal = buildRasterLayers(img, { widthMm: 100 }).layers[0]!.areaMm2;
    const inverted = buildRasterLayers(img, { widthMm: 100, invert: true }).layers[0]!.areaMm2;
    expect(normal + inverted).toBeCloseTo(100 * 100, -2);
  });

  it('cuts a picture with no clear background by brightness, and says so', () => {
    const gradient = image(100, 100, (x) => [x * 2.5, x * 2.5, x * 2.5, 255], [255, 255, 255, 255]);
    const dark = buildRasterLayers(gradient, { widthMm: 100, threshold: 64 });
    const light = buildRasterLayers(gradient, { widthMm: 100, threshold: 192 });
    expect(dark.warnings.join(' ')).toMatch(/brightness/);
    expect(light.layers[0]!.areaMm2).toBeGreaterThan(dark.layers[0]!.areaMm2 * 2);
  });

  it('smooths away a single-pixel speck at low detail and keeps it at high detail', () => {
    const paint: Painter = (x, y) => disc(100, 100, 50, [0, 0, 0, 255])(x, y) ?? (x === 10 && y === 10 ? [0, 0, 0, 255] : null);
    const img = image(200, 200, paint);
    const smooth = buildRasterLayers(img, { widthMm: 200, detail: 0 }).layers[0]!;
    const sharp = buildRasterLayers(img, { widthMm: 200, detail: 255 }).layers[0]!;
    const at = (layer: typeof smooth, xMm: number, yMm: number) => {
      const col = Math.floor((xMm + 10 - layer.mask.originX) / layer.mask.cell);
      const row = Math.floor((yMm + 10 - layer.mask.originY) / layer.mask.cell);
      return layer.mask.data[row * layer.mask.cols + col];
    };
    expect(at(smooth, 10.5, 10.5)).toBe(0);
    expect(at(sharp, 10.5, 10.5)).toBe(1);
  });

  it('copes with a large image and an empty one', () => {
    const big = image(2400, 1600, disc(1200, 800, 600, [10, 10, 10, 255]));
    const started = Date.now();
    expect(buildRasterLayers(big, { widthMm: 150 }).layers).toHaveLength(1);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(buildRasterLayers(image(10, 10, () => null), { widthMm: 50 }).layers).toEqual([]);
  });

  it('is deterministic', () => {
    const paint: Painter = (x, y) => disc(60, 100, 40, [220, 20, 20, 255])(x, y) ?? disc(140, 100, 40, [20, 20, 220, 255])(x, y);
    const a = buildRasterLayers(image(200, 200, paint), { widthMm: 100, colorCount: 2 });
    const b = buildRasterLayers(image(200, 200, paint), { widthMm: 100, colorCount: 2 });
    expect(a.layers.map((l) => l.colour)).toEqual(b.layers.map((l) => l.colour));
    expect(Array.from(a.layers[0]!.mask.data)).toEqual(Array.from(b.layers[0]!.mask.data));
  });
});

describe('a raster image through the artwork layout', () => {
  it('gives a cuttable template in each look, with a stone colour per image colour', () => {
    const paint: Painter = (x, y) => disc(70, 100, 50, [220, 20, 20, 255])(x, y) ?? disc(150, 100, 40, [20, 20, 220, 255])(x, y);
    const layers = buildRasterLayers(image(220, 200, paint), { widthMm: 120, colorCount: 2 });
    for (const look of ['outline', 'rows', 'solid'] as const) {
      const r = createArtworkTemplate({ id: 'r', name: 'r', layers, stoneSize: 'SS10', look });
      expect(r.template.stones.length).toBeGreaterThan(40);
      expect(new Set(r.template.stones.map((s) => s.metadata?.layerColour)).size).toBe(2);
      expect(checkExportReadiness(r.template).issues.filter((i) => i.code.startsWith('STONE_'))).toEqual([]);
    }
  });
});
