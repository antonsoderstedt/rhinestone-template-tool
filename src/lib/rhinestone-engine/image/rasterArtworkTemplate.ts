import type { RhinestoneTemplate, Stone, StoneSizeId } from '../types/index';
import { createRhinestoneTemplate } from '../template/createTemplate';
import { getRecommendedHoleDiameter } from '../profiles/materialProfiles';
import { roundMm } from '../geometry/rounding';

export interface RasterArtworkImageData {
  widthPx: number;
  heightPx: number;
  rgba: ArrayLike<number>;
}

export interface CreateRasterArtworkTemplateOptions {
  image: RasterArtworkImageData;
  name: string;
  stoneSize: StoneSizeId;
  spacingMm: number;
  threshold: number;
  detail: number;
  invert: boolean;
  colorCount: 1 | 2 | 3 | 4;
  targetWidthMm?: number;
  targetHeightMm?: number;
  preserveAspectRatio?: boolean;
  materialProfileId?: string;
  maxStones?: number;
}

export interface RasterArtworkTemplateResult {
  template: RhinestoneTemplate;
  palette: string[];
  warnings: string[];
}

interface SampledPoint {
  xMm: number;
  yMm: number;
  rgb: [number, number, number];
  luminance: number;
}

interface ColorCluster {
  r: number;
  g: number;
  b: number;
}

const DEFAULT_MAX_STONES = 50000;
const HEX_ROW_FACTOR = Math.sqrt(3) / 2;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function assertFinitePositive(value: number | undefined, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`createRasterArtworkTemplate: "${field}" must be a positive finite number.`);
  }
  return value;
}

function resolveTargetSizeMm(options: CreateRasterArtworkTemplateOptions): { widthMm: number; heightMm: number } {
  const sourceAspect = options.image.widthPx / options.image.heightPx;
  const hasWidth = typeof options.targetWidthMm === 'number' && Number.isFinite(options.targetWidthMm) && options.targetWidthMm > 0;
  const hasHeight = typeof options.targetHeightMm === 'number' && Number.isFinite(options.targetHeightMm) && options.targetHeightMm > 0;

  if (!hasWidth && !hasHeight) {
    return { widthMm: options.image.widthPx, heightMm: options.image.heightPx };
  }

  if (hasWidth && hasHeight) {
    if (options.preserveAspectRatio === false) {
      return { widthMm: options.targetWidthMm!, heightMm: options.targetHeightMm! };
    }
    const widthLimitedHeight = options.targetWidthMm! / sourceAspect;
    if (widthLimitedHeight <= options.targetHeightMm!) {
      return { widthMm: options.targetWidthMm!, heightMm: widthLimitedHeight };
    }
    return { widthMm: options.targetHeightMm! * sourceAspect, heightMm: options.targetHeightMm! };
  }

  if (hasWidth) {
    return { widthMm: options.targetWidthMm!, heightMm: options.targetWidthMm! / sourceAspect };
  }

  return { widthMm: options.targetHeightMm! * sourceAspect, heightMm: options.targetHeightMm! };
}

function samplePixel(image: RasterArtworkImageData, xPx: number, yPx: number): [number, number, number] {
  const clampedX = clamp(Math.round(xPx), 0, image.widthPx - 1);
  const clampedY = clamp(Math.round(yPx), 0, image.heightPx - 1);
  const offset = (clampedY * image.widthPx + clampedX) * 4;
  const alpha = clamp(image.rgba[offset + 3] ?? 255, 0, 255) / 255;
  const r = 255 - (255 - (image.rgba[offset] ?? 255)) * alpha;
  const g = 255 - (255 - (image.rgba[offset + 1] ?? 255)) * alpha;
  const b = 255 - (255 - (image.rgba[offset + 2] ?? 255)) * alpha;
  return [r, g, b];
}

function averageNeighborhood(image: RasterArtworkImageData, centerXPx: number, centerYPx: number, radiusPx: number): [number, number, number] {
  if (radiusPx <= 0) {
    return samplePixel(image, centerXPx, centerYPx);
  }

  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let y = Math.floor(centerYPx - radiusPx); y <= Math.ceil(centerYPx + radiusPx); y += 1) {
    for (let x = Math.floor(centerXPx - radiusPx); x <= Math.ceil(centerXPx + radiusPx); x += 1) {
      const sample = samplePixel(image, x, y);
      r += sample[0];
      g += sample[1];
      b += sample[2];
      count += 1;
    }
  }

  return [r / count, g / count, b / count];
}

function luminanceOf(rgb: [number, number, number]): number {
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

function toHex(rgb: ColorCluster): string {
  const toChannel = (value: number) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
  return `#${toChannel(rgb.r)}${toChannel(rgb.g)}${toChannel(rgb.b)}`;
}

function nearestClusterIndex(rgb: [number, number, number], clusters: readonly ColorCluster[]): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let idx = 0; idx < clusters.length; idx += 1) {
    const cluster = clusters[idx]!;
    const dr = rgb[0] - cluster.r;
    const dg = rgb[1] - cluster.g;
    const db = rgb[2] - cluster.b;
    const distance = dr * dr + dg * dg + db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = idx;
    }
  }
  return bestIndex;
}

function quantizeColors(points: readonly SampledPoint[], desiredCount: number): { palette: string[]; assignments: number[] } {
  if (points.length === 0) {
    return { palette: [], assignments: [] };
  }

  const clusterCount = Math.max(1, Math.min(desiredCount, points.length));
  const sorted = [...points].sort((left, right) => left.luminance - right.luminance);
  let clusters: ColorCluster[] = Array.from({ length: clusterCount }, (_, idx) => {
    const sample = sorted[Math.floor((idx * (sorted.length - 1)) / Math.max(1, clusterCount - 1))] ?? sorted[0]!;
    return { r: sample.rgb[0], g: sample.rgb[1], b: sample.rgb[2] };
  });

  let assignments = new Array(points.length).fill(0);
  for (let iteration = 0; iteration < 6; iteration += 1) {
    const sums = clusters.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));
    assignments = points.map((point) => nearestClusterIndex(point.rgb, clusters));
    assignments.forEach((clusterIndex, pointIndex) => {
      const point = points[pointIndex]!;
      const sum = sums[clusterIndex]!;
      sum.r += point.rgb[0];
      sum.g += point.rgb[1];
      sum.b += point.rgb[2];
      sum.count += 1;
    });
    clusters = clusters.map((cluster, idx) => {
      const sum = sums[idx]!;
      if (sum.count === 0) return cluster;
      return {
        r: sum.r / sum.count,
        g: sum.g / sum.count,
        b: sum.b / sum.count,
      };
    });
  }

  const ordered = clusters
    .map((cluster, idx) => ({
      originalIndex: idx,
      cluster,
      luminance: luminanceOf([cluster.r, cluster.g, cluster.b]),
    }))
    .sort((left, right) => left.luminance - right.luminance);
  const remap = new Map<number, number>();
  ordered.forEach((entry, orderedIndex) => remap.set(entry.originalIndex, orderedIndex));

  return {
    palette: ordered.map((entry) => toHex(entry.cluster)),
    assignments: assignments.map((idx) => remap.get(idx) ?? 0),
  };
}

export function createRasterArtworkTemplate(
  options: CreateRasterArtworkTemplateOptions,
): RasterArtworkTemplateResult {
  const widthPx = assertFinitePositive(options.image.widthPx, 'image.widthPx');
  const heightPx = assertFinitePositive(options.image.heightPx, 'image.heightPx');
  if ((options.image.rgba?.length ?? 0) !== widthPx * heightPx * 4) {
    throw new Error('createRasterArtworkTemplate: image.rgba length must equal widthPx * heightPx * 4.');
  }

  const spacingMm = assertFinitePositive(options.spacingMm, 'spacingMm');
  const threshold = clamp(options.threshold, 0, 255);
  const detail = clamp(options.detail, 0, 255);
  const maxStones = options.maxStones ?? DEFAULT_MAX_STONES;
  const colorCount = clamp(options.colorCount, 1, 4);
  const { widthMm, heightMm } = resolveTargetSizeMm(options);
  const holeDiameterMm = getRecommendedHoleDiameter(options.stoneSize, options.materialProfileId);
  const sampleRadiusPx = Math.max(0, Math.round(((255 - detail) / 255) * 3));
  const rowSpacingMm = spacingMm * HEX_ROW_FACTOR;
  const rowCount = Math.max(1, Math.floor(heightMm / rowSpacingMm) + 1);
  const sampledPoints: SampledPoint[] = [];
  const warnings: string[] = [];

  for (let row = 0; row < rowCount; row += 1) {
    const offsetMm = row % 2 === 1 ? spacingMm / 2 : 0;
    const usableWidthMm = Math.max(widthMm - offsetMm, 0);
    const columnCount = Math.max(1, Math.floor(usableWidthMm / spacingMm) + 1);
    for (let column = 0; column < columnCount; column += 1) {
      const xMm = roundMm(offsetMm + column * spacingMm, 3);
      const yMm = roundMm(row * rowSpacingMm, 3);
      if (xMm > widthMm || yMm > heightMm) continue;
      const sampleXPx = (xMm / Math.max(widthMm, 0.001)) * (widthPx - 1);
      const sampleYPx = (yMm / Math.max(heightMm, 0.001)) * (heightPx - 1);
      const rgb = averageNeighborhood(options.image, sampleXPx, sampleYPx, sampleRadiusPx);
      const luminance = luminanceOf(rgb);
      const active = options.invert ? luminance >= threshold : luminance <= threshold;
      if (!active) continue;
      sampledPoints.push({ xMm, yMm, rgb, luminance });
      if (sampledPoints.length > maxStones) {
        throw new Error(`createRasterArtworkTemplate: image would generate more than ${maxStones} stones. Increase spacing or reduce target size.`);
      }
    }
  }

  const { palette, assignments } = quantizeColors(sampledPoints, colorCount);
  const stones: Stone[] = sampledPoints.map((point, idx) => ({
    id: `img-${idx}`,
    center: { x: point.xMm, y: point.yMm },
    stoneSize: options.stoneSize,
    holeDiameterMm,
    metadata: {
      generatedBy: 'createRasterArtworkTemplate',
      fill: palette[assignments[idx] ?? 0] ?? '#000000',
      colorLayer: assignments[idx] ?? 0,
    },
  }));

  if (stones.length === 0) {
    warnings.push('No stones passed the current threshold. Raise threshold or enable invert fill.');
  }

  return {
    template: createRhinestoneTemplate({
      id: 'image-artwork-preview',
      name: options.name,
      stones,
      widthMm: roundMm(widthMm, 3),
      heightMm: roundMm(heightMm, 3),
      metadata: {
        generatedBy: 'createRasterArtworkTemplate',
        spacingMm: roundMm(spacingMm, 3),
        threshold,
        detail,
        invert: options.invert,
        colorCount,
        sourceWidthPx: widthPx,
        sourceHeightPx: heightPx,
      },
    }),
    palette,
    warnings,
  };
}