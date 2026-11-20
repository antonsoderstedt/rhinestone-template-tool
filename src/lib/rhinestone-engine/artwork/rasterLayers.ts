/**
 * Raster artwork (PNG, JPG, WEBP, GIF, BMP) as colour layers, so it goes through the same row layout as an SVG.
 *
 * The background is removed (transparent pixels, or the colour all along the border), what is left is reduced to a few
 * colours with a deterministic k-means, and each colour becomes a mask on a grid in millimetres. Isolated specks and pinholes
 * are smoothed away according to `detail`.
 *
 * Pure and deterministic: no randomness (k-means starts from quantiles of the brightness), no clock.
 */

import type { Polyline } from '../path/polyline';
import { createGrid, emptyMask, maskAreaMm2, type GridOptions } from './regionField';
import type { ArtworkLayer, ArtworkLayers } from './layers';

export interface RasterImage {
  widthPx: number;
  heightPx: number;
  /** RGBA, 4 bytes per pixel, row by row. */
  rgba: ArrayLike<number>;
}

export interface RasterLayersOptions {
  /** Number of stone colours to reduce to, 1-4. Default 1. */
  colorCount?: number;
  /** Scale to this width (mm). */
  widthMm?: number;
  heightMm?: number;
  preserveAspectRatio?: boolean;
  originMm?: { x: number; y: number };
  /** 0-255. Higher keeps smaller details; lower smooths away specks and pinholes. Default 128. */
  detail?: number;
  /** Swap the shape and the background (stones on the light parts). */
  invert?: boolean;
  /** Brightness cutoff (0-255) used when the image has no clear background, such as a photograph. Default 128. */
  threshold?: number;
  grid?: GridOptions;
}

const MAX_SIDE_PX = 1200;

interface Pixels {
  w: number;
  h: number;
  r: Uint8Array;
  g: Uint8Array;
  b: Uint8Array;
  a: Uint8Array;
}

/** Box-filters the image down so the longer side is at most `MAX_SIDE_PX`. */
function toPixels(image: RasterImage): Pixels {
  const factor = Math.max(1, Math.ceil(Math.max(image.widthPx, image.heightPx) / MAX_SIDE_PX));
  const w = Math.max(1, Math.floor(image.widthPx / factor));
  const h = Math.max(1, Math.floor(image.heightPx / factor));
  const out: Pixels = { w, h, r: new Uint8Array(w * h), g: new Uint8Array(w * h), b: new Uint8Array(w * h), a: new Uint8Array(w * h) };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const o = ((y * factor + dy) * image.widthPx + (x * factor + dx)) * 4;
          const alpha = (image.rgba[o + 3] ?? 255) / 255;
          r += (image.rgba[o] ?? 0) * alpha;
          g += (image.rgba[o + 1] ?? 0) * alpha;
          b += (image.rgba[o + 2] ?? 0) * alpha;
          a += image.rgba[o + 3] ?? 255;
        }
      }
      const n = factor * factor;
      const alphaMean = a / n / 255;
      const i = y * w + x;
      out.a[i] = Math.round(a / n);
      // colour of the visible part (undo the premultiplication)
      out.r[i] = alphaMean > 0 ? Math.round(r / n / alphaMean) : 0;
      out.g[i] = alphaMean > 0 ? Math.round(g / n / alphaMean) : 0;
      out.b[i] = alphaMean > 0 ? Math.round(b / n / alphaMean) : 0;
    }
  }
  return out;
}

const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');

/** Colour shared by (almost) the whole border, or null when the border is not one colour. */
function borderColour(p: Pixels): [number, number, number] | null {
  const samples: number[] = [];
  const push = (x: number, y: number) => {
    const i = y * p.w + x;
    if (p.a[i]! > 200) samples.push(i);
  };
  for (let x = 0; x < p.w; x++) {
    push(x, 0);
    push(x, p.h - 1);
  }
  for (let y = 1; y < p.h - 1; y++) {
    push(0, y);
    push(p.w - 1, y);
  }
  if (samples.length < 8) return null;
  const channel = (pick: (i: number) => number) => {
    const values = samples.map(pick).sort((a, b) => a - b);
    return values[values.length >> 1]!;
  };
  const centre: [number, number, number] = [channel((i) => p.r[i]!), channel((i) => p.g[i]!), channel((i) => p.b[i]!)];
  let close = 0;
  for (const i of samples) {
    if (Math.hypot(p.r[i]! - centre[0], p.g[i]! - centre[1], p.b[i]! - centre[2]) < 40) close++;
  }
  return close / samples.length >= 0.85 ? centre : null;
}

/** k-means on the colours of `indices`, starting from quantiles of their brightness. Returns labels aligned to `indices`. */
function cluster(p: Pixels, indices: number[], k: number): { centres: Array<[number, number, number]>; labels: Uint8Array } {
  const labels = new Uint8Array(indices.length);
  if (k <= 1 || indices.length === 0) {
    let r = 0;
    let g = 0;
    let b = 0;
    for (const i of indices) {
      r += p.r[i]!;
      g += p.g[i]!;
      b += p.b[i]!;
    }
    const n = Math.max(1, indices.length);
    return { centres: [[r / n, g / n, b / n]], labels };
  }
  const step = Math.max(1, Math.floor(indices.length / 20000));
  const sample = indices.filter((_, n) => n % step === 0);
  const byBrightness = [...sample].sort((a, b) => luminance(p.r[a]!, p.g[a]!, p.b[a]!) - luminance(p.r[b]!, p.g[b]!, p.b[b]!) || a - b);
  let centres: Array<[number, number, number]> = Array.from({ length: k }, (_, c) => {
    const i = byBrightness[Math.min(byBrightness.length - 1, Math.floor(((c + 0.5) / k) * byBrightness.length))]!;
    return [p.r[i]!, p.g[i]!, p.b[i]!];
  });
  for (let iteration = 0; iteration < 10; iteration++) {
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (const i of sample) {
      let best = 0;
      let bestD = Infinity;
      centres.forEach((c, n) => {
        const d = (p.r[i]! - c[0]) ** 2 + (p.g[i]! - c[1]) ** 2 + (p.b[i]! - c[2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      });
      const s = sums[best]!;
      s[0]! += p.r[i]!;
      s[1]! += p.g[i]!;
      s[2]! += p.b[i]!;
      s[3]! += 1;
    }
    centres = centres.map((c, n) => (sums[n]![3]! > 0 ? ([sums[n]![0]! / sums[n]![3]!, sums[n]![1]! / sums[n]![3]!, sums[n]![2]! / sums[n]![3]!] as [number, number, number]) : c));
  }
  indices.forEach((i, n) => {
    let best = 0;
    let bestD = Infinity;
    centres.forEach((c, c2) => {
      const d = (p.r[i]! - c[0]) ** 2 + (p.g[i]! - c[1]) ** 2 + (p.b[i]! - c[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = c2;
      }
    });
    labels[n] = best;
  });
  return { centres, labels };
}

export function buildRasterLayers(image: RasterImage, options: RasterLayersOptions = {}): ArtworkLayers {
  const { colorCount = 1, preserveAspectRatio = true, detail = 128, invert = false, threshold = 128 } = options;
  const origin = options.originMm ?? { x: 10, y: 10 };
  const warnings: string[] = [];
  const empty: ArtworkLayers = { layers: [], grid: createGrid({ minX: 0, minY: 0, maxX: 1, maxY: 1 }), scale: 1, polylines: [] as Polyline[], warnings };
  if (image.widthPx < 1 || image.heightPx < 1) return { ...empty, warnings: ['The image is empty.'] };

  const p = toPixels(image);

  // Size on the page.
  const aspect = p.w / p.h;
  let widthMm: number;
  let heightMm: number;
  if (options.widthMm !== undefined && options.heightMm !== undefined) {
    if (preserveAspectRatio) {
      widthMm = Math.min(options.widthMm, options.heightMm * aspect);
      heightMm = widthMm / aspect;
    } else {
      widthMm = options.widthMm;
      heightMm = options.heightMm;
    }
  } else if (options.widthMm !== undefined) {
    widthMm = options.widthMm;
    heightMm = widthMm / aspect;
  } else if (options.heightMm !== undefined) {
    heightMm = options.heightMm;
    widthMm = heightMm * aspect;
  } else {
    widthMm = p.w * 0.2646; // 96 dpi
    heightMm = p.h * 0.2646;
  }

  // Which pixels are the shape: not transparent, not the border colour; or by brightness when there is no clear background.
  const bg = borderColour(p);
  const hasAlpha = p.a.some((a) => a < 250);
  const foreground = new Uint8Array(p.w * p.h);
  for (let i = 0; i < foreground.length; i++) {
    if (p.a[i]! < 128) continue;
    if (bg) foreground[i] = Math.hypot(p.r[i]! - bg[0], p.g[i]! - bg[1], p.b[i]! - bg[2]) >= 40 ? 1 : 0;
    else if (hasAlpha) foreground[i] = 1;
    else foreground[i] = luminance(p.r[i]!, p.g[i]!, p.b[i]!) <= threshold ? 1 : 0;
  }
  if (invert) {
    for (let i = 0; i < foreground.length; i++) {
      if (p.a[i]! >= 128) foreground[i] = foreground[i] ? 0 : 1;
    }
  }
  if (!bg && !hasAlpha) warnings.push('The image has no clear background, so it was cut by brightness. Use the brightness cutoff to adjust it.');

  const indices: number[] = [];
  for (let i = 0; i < foreground.length; i++) if (foreground[i]) indices.push(i);
  if (indices.length === 0) return { ...empty, warnings: [...warnings, 'No part of the image is left after removing the background.'] };

  const k = Math.max(1, Math.min(4, Math.round(colorCount)));
  const { centres, labels } = cluster(p, indices, k);
  const label = new Int8Array(p.w * p.h).fill(-1);
  indices.forEach((i, n) => {
    label[i] = labels[n]!;
  });

  // Smoothing: a pixel takes the majority label of its 3x3 neighbourhood when detail is low.
  const passes = detail >= 192 ? 0 : detail >= 96 ? 1 : 2;
  let current = label;
  for (let pass = 0; pass < passes; pass++) {
    const next = new Int8Array(current.length);
    for (let y = 0; y < p.h; y++) {
      for (let x = 0; x < p.w; x++) {
        const counts = new Int16Array(k + 1); // index k = none
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            const v = xx < 0 || yy < 0 || xx >= p.w || yy >= p.h ? -1 : current[yy * p.w + xx]!;
            counts[v < 0 ? k : v]!++;
          }
        }
        // Start from the pixel's own label: only a strictly bigger group changes it, so smoothing is stable.
        const own = current[y * p.w + x]!;
        let best = own < 0 ? k : own;
        for (let c = 0; c <= k; c++) if (counts[c]! > counts[best]!) best = c;
        next[y * p.w + x] = best === k ? -1 : best;
      }
    }
    current = next;
  }

  // Onto the grid in mm.
  const grid = createGrid({ minX: origin.x, minY: origin.y, maxX: origin.x + widthMm, maxY: origin.y + heightMm }, options.grid);
  const masks = Array.from({ length: k }, () => emptyMask(grid));
  for (let row = 0; row < grid.rows; row++) {
    const yMm = grid.originY + (row + 0.5) * grid.cell - origin.y;
    const py = Math.floor((yMm / heightMm) * p.h);
    if (py < 0 || py >= p.h) continue;
    for (let col = 0; col < grid.cols; col++) {
      const xMm = grid.originX + (col + 0.5) * grid.cell - origin.x;
      const px = Math.floor((xMm / widthMm) * p.w);
      if (px < 0 || px >= p.w) continue;
      const l = current[py * p.w + px]!;
      if (l >= 0) masks[l]!.data[row * grid.cols + col] = 1;
    }
  }

  const layers: ArtworkLayer[] = masks
    .map((mask, c) => ({ colour: hex(centres[c]![0], centres[c]![1], centres[c]![2]), mask, areaMm2: maskAreaMm2(mask), role: 'stones' as const }))
    .filter((layer) => layer.areaMm2 > 0.5)
    // Distinct colours only: two clusters that round to the same hex would be one entry in the colour list.
    .filter((layer, i, all) => all.findIndex((other) => other.colour === layer.colour) === i);

  return { layers, grid, scale: widthMm / p.w, polylines: [], warnings };
}
