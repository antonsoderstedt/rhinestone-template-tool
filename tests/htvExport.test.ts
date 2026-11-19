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
    expect(result.svg).toMatch(/scale\(2(?:\s+2)?\)/);
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

// ─── C4: mirror, weed border, registration marks ──────────────────────────────

/** Applies `translate(tx ty) rotate(deg) scale(sx sy)` to a point (SVG order: translate · rotate · scale). */
function applyLayerTransform(transform: string, point: { x: number; y: number }) {
  const match = transform.match(/translate\(([-\d.]+) ([-\d.]+)\) rotate\(([-\d.]+)\) scale\(([-\d.]+) ([-\d.]+)\)/);
  if (!match) throw new Error(`Unexpected transform: ${transform}`);
  const [tx, ty, deg, sx, sy] = match.slice(1).map(Number) as [number, number, number, number, number];
  const theta = (deg * Math.PI) / 180;
  const x = point.x * sx;
  const y = point.y * sy;
  return {
    x: x * Math.cos(theta) - y * Math.sin(theta) + tx,
    y: x * Math.sin(theta) + y * Math.cos(theta) + ty,
  };
}

function layerTransformOf(svg: string): string {
  const match = svg.match(/<g transform="([^"]+)"><path/);
  if (!match) throw new Error('No layer group found');
  return match[1]!;
}

function asymmetricLayer(overrides: Partial<HtvVectorLayer> = {}) {
  return createHtvVectorLayer({
    id: 'asym',
    polylines: [{ points: [{ x: -5, y: -5 }, { x: 15, y: -5 }, { x: 15, y: 5 }, { x: -5, y: 5 }], closed: true }],
    naturalWidthMm: 20,
    naturalHeightMm: 10,
    sourceKind: 'svg-upload',
    ...overrides,
  });
}

describe('createHtvSvgExport — mirror', () => {
  it('does not mirror by default', async () => {
    const result = await createHtvSvgExport([asymmetricLayer()], 'Plain');
    expect(result.mirrored).toBe(false);
    expect(result.svg).not.toContain('data-mirrored');
  });

  it('reflects every point about the file\'s vertical centre axis (x -> W - x, y unchanged)', async () => {
    const layer = asymmetricLayer({ x: 20, y: 30, rotationDeg: 30, scale: 1.5 });
    const plain = await createHtvSvgExport([layer], 'Mirror', { mirror: false });
    const mirrored = await createHtvSvgExport([layer], 'Mirror', { mirror: true });

    expect(mirrored.mirrored).toBe(true);
    expect(mirrored.svg).toContain('data-mirrored="true"');
    expect(mirrored.widthMm).toBeCloseTo(plain.widthMm, 6);
    expect(mirrored.heightMm).toBeCloseTo(plain.heightMm, 6);

    const plainTransform = layerTransformOf(plain.svg);
    const mirroredTransform = layerTransformOf(mirrored.svg);
    for (const point of [{ x: -5, y: -5 }, { x: 15, y: -5 }, { x: 15, y: 5 }, { x: 0, y: 0 }]) {
      const before = applyLayerTransform(plainTransform, point);
      const after = applyLayerTransform(mirroredTransform, point);
      expect(after.x).toBeCloseTo(plain.widthMm - before.x, 2);
      expect(after.y).toBeCloseTo(before.y, 2);
    }
  });

  it('keeps the mirrored file mm-sized and free of raster, <use> and nested <svg>', async () => {
    const result = await createHtvSvgExport([asymmetricLayer()], 'Safe', { mirror: true });
    expect(result.svg).toMatch(/width="[\d.]+mm"/);
    expect(result.svg).toMatch(/height="[\d.]+mm"/);
    expect(result.svg).not.toContain('<image');
    expect(result.svg).not.toContain('<use');
    expect(result.svg.match(/<svg/g)?.length).toBe(1);
  });

  it('is deterministic with mirror on', async () => {
    const a = await createHtvSvgExport([asymmetricLayer({ x: 3, y: 4 })], 'Det', { mirror: true });
    const b = await createHtvSvgExport([asymmetricLayer({ x: 3, y: 4 })], 'Det', { mirror: true });
    expect(a.svg).toBe(b.svg);
  });
});

describe('createHtvSvgExport — weed border and registration marks', () => {
  it('adds no border or marks unless requested', async () => {
    const result = await createHtvSvgExport([squareLayer('a')], 'None');
    expect(result.svg).not.toContain('data-weed-border');
    expect(result.svg).not.toContain('data-registration-mark');
  });

  it('draws a stroke-only rectangular weed border around the design when enabled', async () => {
    const result = await createHtvSvgExport([squareLayer('a')], 'Weed', { weedBorder: true, marginMm: 6 });
    const rect = result.svg.match(/<rect[^>]*data-weed-border="true"[^>]*\/>/)?.[0];
    expect(rect).toBeDefined();
    expect(rect).toContain('fill="none"');
    expect(rect).toContain('stroke="#000000"');
    expect(result.designWidthMm).toBeCloseTo(10, 6);
    expect(result.widthMm).toBeCloseTo(10 + 12, 6);
  });

  it('adds four registration crosses outside the weed border and grows the canvas by the band', async () => {
    const plain = await createHtvSvgExport([squareLayer('a')], 'Plain', { weedBorder: true });
    const marked = await createHtvSvgExport([squareLayer('a')], 'Marks', { weedBorder: true, registrationMarks: true });
    expect(marked.svg.match(/data-registration-mark="true"/g)).toHaveLength(4);
    expect(marked.widthMm).toBeCloseTo(plain.widthMm + 16, 6);
    expect(marked.heightMm).toBeCloseTo(plain.heightMm + 16, 6);
    expect(marked.svg).not.toContain('opacity');
  });

  it('honours the weed margin option (wires the Settings "HTV weed margin" value)', async () => {
    const narrow = await createHtvSvgExport([squareLayer('a')], 'Margin', { marginMm: 2 });
    const wide = await createHtvSvgExport([squareLayer('a')], 'Margin', { marginMm: 10 });
    expect(wide.widthMm - narrow.widthMm).toBeCloseTo(16, 6);
  });

  it('falls back to the default margin for an invalid value', async () => {
    const result = await createHtvSvgExport([squareLayer('a')], 'Bad', { marginMm: -5 });
    expect(result.widthMm).toBeCloseTo(22, 6);
  });
});
