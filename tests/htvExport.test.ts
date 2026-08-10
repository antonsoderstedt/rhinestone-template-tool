import { describe, it, expect } from 'vitest';
import { createHtvSvgExport } from '../app/htv/htvExport';
import { createHtvVectorLayer, type HtvVectorLayer } from '../app/htv/HtvState';

function squareLayer(id: string, overrides: Partial<HtvVectorLayer> = {}) {
  return createHtvVectorLayer({
    id,
    polylines: [{ points: [{ x: -5, y: -5 }, { x: 5, y: -5 }, { x: 5, y: 5 }, { x: -5, y: 5 }], closed: true }],
    naturalWidthMm: 10,
    naturalHeightMm: 10,
    sourceKind: 'svg-upload',
    ...overrides,
  });
}

describe('createHtvSvgExport', () => {
  it('throws when there are no visible layers', async () => {
    await expect(createHtvSvgExport([], 'Empty')).rejects.toThrow(/no visible layers/i);
  });

  it('throws when every layer is hidden', async () => {
    const layer = squareLayer('a', { visible: false });
    await expect(createHtvSvgExport([layer], 'Hidden')).rejects.toThrow(/no visible layers/i);
  });

  it('produces a valid SVG with width/height in mm and no raster content', async () => {
    const layer = squareLayer('a');
    const result = await createHtvSvgExport([layer], 'Square Design');
    expect(result.svg).toContain('<svg');
    expect(result.svg).toMatch(/width="[\d.]+mm"/);
    expect(result.svg).toMatch(/height="[\d.]+mm"/);
    expect(result.svg).not.toContain('<image');
    expect(result.svg).not.toContain('data:image');
    // No nested <svg> beyond the root element.
    expect(result.svg.match(/<svg/g)?.length).toBe(1);
    expect(result.svg).not.toContain('<use');
    expect(result.layerCount).toBe(1);
  });

  it('includes one path per visible layer, skips hidden ones', async () => {
    const layers = [squareLayer('a'), squareLayer('b', { visible: false }), squareLayer('c')];
    const result = await createHtvSvgExport(layers, 'Multi');
    expect(result.layerCount).toBe(2);
    expect(result.svg.match(/<path/g)?.length).toBe(2);
  });

  it('positions layers using their x/y/rotation/scale in the exported transform', async () => {
    const layer = squareLayer('a', { x: 20, y: 30, rotationDeg: 45, scale: 2 });
    const result = await createHtvSvgExport([layer], 'Positioned');
    expect(result.svg).toContain('rotate(45)');
    expect(result.svg).toContain('scale(2)');
  });

  it('is deterministic for the same input', async () => {
    const layer = squareLayer('a', { x: 5, y: 5 });
    const a = await createHtvSvgExport([layer], 'Det');
    const b = await createHtvSvgExport([layer], 'Det');
    expect(a.svg).toBe(b.svg);
    expect(a.widthMm).toBe(b.widthMm);
    expect(a.heightMm).toBe(b.heightMm);
  });

  it('sanitizes the project name used as the SVG title', async () => {
    const layer = squareLayer('a');
    const result = await createHtvSvgExport([layer], '<script>evil()</script>');
    expect(result.svg).not.toContain('<script>');
  });

  it('computes bounds tightly around the actual (transformed) geometry, with padding', async () => {
    const layer = squareLayer('a'); // 10x10 square centered at origin
    const result = await createHtvSvgExport([layer], 'Bounds');
    // 10mm square + 6mm padding on each side = 22mm
    expect(result.widthMm).toBeCloseTo(22, 3);
    expect(result.heightMm).toBeCloseTo(22, 3);
  });
});
