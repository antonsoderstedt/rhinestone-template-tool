import { describe, it, expect } from 'vitest';
import {
  traceImageSilhouette,
  signedPolygonArea,
  type TraceableImageData,
} from '../src/lib/rhinestone-engine/imageTrace/imageTrace';

function makeImage(width: number, height: number, isBlack: (x: number, y: number) => boolean): TraceableImageData {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const black = isBlack(x, y);
      const value = black ? 0 : 255;
      rgba[offset] = value;
      rgba[offset + 1] = value;
      rgba[offset + 2] = value;
      rgba[offset + 3] = 255;
    }
  }
  return { widthPx: width, heightPx: height, rgba };
}

describe('traceImageSilhouette', () => {
  it('throws on invalid dimensions', () => {
    expect(() =>
      traceImageSilhouette({ image: { widthPx: 0, heightPx: 10, rgba: new Uint8Array(0) }, threshold: 128 }),
    ).toThrow(/widthPx/);
  });

  it('throws when rgba length does not match dimensions', () => {
    expect(() =>
      traceImageSilhouette({ image: { widthPx: 10, heightPx: 10, rgba: new Uint8Array(4) }, threshold: 128 }),
    ).toThrow(/rgba length/);
  });

  it('traces a single filled square as one closed contour with the correct area', () => {
    // 10x10 white canvas with a solid black 4x4 square in the middle.
    const image = makeImage(10, 10, (x, y) => x >= 3 && x < 7 && y >= 3 && y < 7);
    const result = traceImageSilhouette({ image, threshold: 128, minAreaMm2: 0, smoothingToleranceMm: 0 });

    expect(result.warnings).toHaveLength(0);
    expect(result.polylines).toHaveLength(1);
    const area = Math.abs(signedPolygonArea(result.polylines[0]!.points));
    // Marching-squares places crossings at pixel-edge midpoints, so the
    // traced square is ~1px larger on each side than the raw mask (3..7 in
    // mask space becomes roughly 2.5..7.5) — expect ~5x5=25, not exactly 16.
    expect(area).toBeGreaterThan(15);
    expect(area).toBeLessThan(30);
  });

  it('produces no contours (and a warning) for a blank image', () => {
    const image = makeImage(10, 10, () => false);
    const result = traceImageSilhouette({ image, threshold: 128 });
    expect(result.polylines).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('fills the whole canvas when every pixel is black', () => {
    const image = makeImage(6, 6, () => true);
    const result = traceImageSilhouette({ image, threshold: 128, minAreaMm2: 0 });
    expect(result.polylines).toHaveLength(1);
  });

  it('invert flips which pixels are treated as foreground', () => {
    const image = makeImage(10, 10, (x, y) => x >= 3 && x < 7 && y >= 3 && y < 7);
    const normal = traceImageSilhouette({ image, threshold: 128, minAreaMm2: 0 });
    const inverted = traceImageSilhouette({ image, threshold: 128, invert: true, minAreaMm2: 0 });

    // Normal traces the black square (small, contained). Inverted traces
    // the white surround touching all four image edges (much bigger).
    const normalArea = Math.abs(signedPolygonArea(normal.polylines[0]!.points));
    const invertedArea = Math.abs(signedPolygonArea(inverted.polylines[0]!.points));
    expect(invertedArea).toBeGreaterThan(normalArea);
  });

  it('traces a donut shape as two contours — an outer boundary and an inner hole with opposite winding', () => {
    // 20x20 canvas: solid 16x16 black square with a 6x6 white hole cut from its center.
    const image = makeImage(20, 20, (x, y) => {
      const inOuter = x >= 2 && x < 18 && y >= 2 && y < 18;
      const inHole = x >= 7 && x < 13 && y >= 7 && y < 13;
      return inOuter && !inHole;
    });
    const result = traceImageSilhouette({ image, threshold: 128, minAreaMm2: 0, smoothingToleranceMm: 0 });

    expect(result.polylines).toHaveLength(2);
    const signedAreas = result.polylines.map((pl) => signedPolygonArea(pl.points));
    const outer = Math.max(...signedAreas.map(Math.abs));
    const inner = Math.min(...signedAreas.map(Math.abs));
    expect(outer).toBeGreaterThan(inner * 3); // outer ring is clearly bigger than the hole
    // Outer boundary and hole boundary wind in opposite directions.
    expect(Math.sign(signedAreas[0]!)).not.toBe(Math.sign(signedAreas[1]!));
  });

  it('filters out contours below minAreaMm2 (noise specks)', () => {
    const image = makeImage(20, 20, (x, y) => {
      const bigSquare = x >= 8 && x < 14 && y >= 8 && y < 14;
      const speck = x === 1 && y === 1;
      return bigSquare || speck;
    });
    const withoutFilter = traceImageSilhouette({ image, threshold: 128, minAreaMm2: 0 });
    const withFilter = traceImageSilhouette({ image, threshold: 128, minAreaMm2: 4 });

    expect(withoutFilter.polylines.length).toBeGreaterThan(withFilter.polylines.length);
    expect(withFilter.polylines).toHaveLength(1);
  });

  it('scales output to targetWidthMm/targetHeightMm preserving aspect ratio', () => {
    const image = makeImage(10, 20, (x, y) => x >= 3 && x < 7 && y >= 8 && y < 12);
    const result = traceImageSilhouette({
      image,
      threshold: 128,
      targetWidthMm: 50,
      preserveAspectRatio: true,
    });
    expect(result.widthMm).toBe(50);
    expect(result.heightMm).toBe(100); // 10x20 source -> 2x aspect, width 50 -> height 100
  });

  it('is deterministic — same input always produces the same output', () => {
    const image = makeImage(16, 16, (x, y) => (x - 8) ** 2 + (y - 8) ** 2 < 36);
    const a = traceImageSilhouette({ image, threshold: 128 });
    const b = traceImageSilhouette({ image, threshold: 128 });
    expect(a.polylines).toEqual(b.polylines);
  });

  it('smoothingToleranceMm reduces point count on a circular blob', () => {
    const image = makeImage(30, 30, (x, y) => (x - 15) ** 2 + (y - 15) ** 2 < 100);
    const rough = traceImageSilhouette({ image, threshold: 128, smoothingToleranceMm: 0 });
    const smooth = traceImageSilhouette({ image, threshold: 128, smoothingToleranceMm: 2 });
    expect(smooth.polylines[0]!.points.length).toBeLessThan(rough.polylines[0]!.points.length);
  });
});

describe('signedPolygonArea', () => {
  it('returns the correct magnitude for a simple square', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    expect(Math.abs(signedPolygonArea(square))).toBe(16);
  });

  it('sign flips with winding direction', () => {
    const cw = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ];
    const ccw = [...cw].reverse();
    expect(Math.sign(signedPolygonArea(cw))).toBe(-Math.sign(signedPolygonArea(ccw)));
  });
});
