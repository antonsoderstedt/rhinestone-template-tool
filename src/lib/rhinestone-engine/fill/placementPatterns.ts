import type { Stone, StoneSizeId } from '../types/index';
import { getRecommendedHoleDiameter } from '../profiles/materialProfiles';
import type { DensityPreset } from '../spacing/density';
import { getDensitySpacing } from '../spacing/density';
import type { PolylinePoint } from '../path/polyline';
import {
  collectClosedLoopBounds,
  normalizeClosedPolylines,
  pointHasEdgeClearance,
  pointInClosedLoops,
  sortLoopsDeterministically,
  type ClosedLoop,
} from './compositeShape';
import { roundMm } from '../geometry/rounding';
import { circlesOverlap } from '../geometry/collision';
import type { FillPattern, PolygonFillOptions } from './polygonFill';
import { generateFillPointsForClosedPolylines } from './polygonFill';

export type FillPlacementPattern = 'default' | 'hexagonal' | 'radial';

export interface RadialPlacementSettings {
  ringSpacingMm: number;
  centerOffsetXmm: number;
  centerOffsetYmm: number;
  includeCenterStone: boolean;
}

export interface FillPlacementStrategyOptions {
  stoneSize: StoneSizeId;
  materialProfileId?: string;
  spacingMm?: number;
  densityPreset?: DensityPreset;
  customSpacingMm?: number;
  fillPattern?: FillPattern;
  placementPattern?: FillPlacementPattern;
  radialSettings?: Partial<RadialPlacementSettings>;
  existingStones?: readonly Stone[];
  idPrefix?: string;
}

const DEFAULT_RADIAL_SETTINGS: RadialPlacementSettings = {
  ringSpacingMm: 4,
  centerOffsetXmm: 0,
  centerOffsetYmm: 0,
  includeCenterStone: true,
};

function resolveSpacingMm(options: FillPlacementStrategyOptions): number {
  if (options.spacingMm !== undefined) return options.spacingMm;
  if (options.densityPreset !== undefined) {
    return getDensitySpacing({
      stoneSize: options.stoneSize,
      materialProfileId: options.materialProfileId,
      preset: options.densityPreset,
      customSpacingMm: options.customSpacingMm,
    }).spacingMm;
  }
  return getDensitySpacing({
    stoneSize: options.stoneSize,
    materialProfileId: options.materialProfileId,
    preset: 'standard',
  }).spacingMm;
}

function dedupeAndFilterFillPoints(
  points: readonly PolylinePoint[],
  loops: readonly ClosedLoop[],
  options: FillPlacementStrategyOptions,
): Stone[] {
  const holeDiameterMm = getRecommendedHoleDiameter(options.stoneSize, options.materialProfileId);
  const insetMm = holeDiameterMm / 2;
  const existingCircles = (options.existingStones ?? []).map((stone) => ({
    center: stone.center,
    radiusMm: stone.holeDiameterMm / 2,
  }));
  const kept: Stone[] = [];
  const prefix = options.idPrefix ?? `${options.stoneSize.toLowerCase()}-fill`;

  const sortedPoints = [...points].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 0.0001) return a.y - b.y;
    return a.x - b.x;
  });

  for (const point of sortedPoints) {
    if (!pointInClosedLoops(point, loops)) continue;
    if (!pointHasEdgeClearance(point, loops, insetMm)) continue;

    const circle = { center: point, radiusMm: holeDiameterMm / 2 };
    let collides = false;
    for (const other of existingCircles) {
      if (circlesOverlap(circle, other, 0)) {
        collides = true;
        break;
      }
    }
    if (collides) continue;
    for (const stone of kept) {
      if (circlesOverlap(circle, { center: stone.center, radiusMm: stone.holeDiameterMm / 2 }, 0)) {
        collides = true;
        break;
      }
    }
    if (collides) continue;

    kept.push({
      id: `${prefix}-f${kept.length + 1}`,
      center: { x: roundMm(point.x, 4), y: roundMm(point.y, 4) },
      stoneSize: options.stoneSize,
      holeDiameterMm,
    });
  }

  return kept;
}

function generateDefaultFillPoints(loops: readonly ClosedLoop[], options: FillPlacementStrategyOptions): PolylinePoint[] {
  return generateFillPointsForClosedPolylines(
    loops.map((loop) => ({ points: loop.points, closed: true })),
    {
      spacingMm: resolveSpacingMm(options),
      pattern: options.fillPattern ?? 'offset-grid',
      insetMm: 0,
    } satisfies PolygonFillOptions,
  );
}

function generateHexagonalFillPoints(loops: readonly ClosedLoop[], options: FillPlacementStrategyOptions): PolylinePoint[] {
  const spacingMm = resolveSpacingMm(options);
  const bounds = collectClosedLoopBounds(loops);
  const radiusStepY = spacingMm * Math.sqrt(3) / 2;
  const points: PolylinePoint[] = [];
  let rowIndex = 0;

  for (let y = bounds.minY + spacingMm / 2; y <= bounds.maxY - spacingMm / 2 + 0.001; y = roundMm(y + radiusStepY, 4)) {
    const xShift = rowIndex % 2 === 0 ? 0 : spacingMm / 2;
    for (let x = bounds.minX + spacingMm / 2 + xShift; x <= bounds.maxX - spacingMm / 2 + 0.001; x = roundMm(x + spacingMm, 4)) {
      points.push({ x: roundMm(x, 4), y: roundMm(y, 4) });
    }
    rowIndex += 1;
  }

  return points;
}

function generateRadialFillPoints(loops: readonly ClosedLoop[], options: FillPlacementStrategyOptions): PolylinePoint[] {
  const spacingMm = resolveSpacingMm(options);
  const radialSettings = { ...DEFAULT_RADIAL_SETTINGS, ...options.radialSettings };
  const bounds = collectClosedLoopBounds(loops);
  const center = {
    x: roundMm(bounds.minX + bounds.width / 2 + radialSettings.centerOffsetXmm, 4),
    y: roundMm(bounds.minY + bounds.height / 2 + radialSettings.centerOffsetYmm, 4),
  };
  const maxRadius = Math.max(bounds.width, bounds.height);
  const points: PolylinePoint[] = [];

  if (radialSettings.includeCenterStone) {
    points.push(center);
  }

  for (let radius = radialSettings.ringSpacingMm; radius <= maxRadius + 0.001; radius = roundMm(radius + radialSettings.ringSpacingMm, 4)) {
    const circumference = 2 * Math.PI * radius;
    const stoneCount = Math.max(6, Math.floor(circumference / spacingMm));
    for (let index = 0; index < stoneCount; index++) {
      const angle = (index / stoneCount) * Math.PI * 2;
      points.push({
        x: roundMm(center.x + Math.cos(angle) * radius, 4),
        y: roundMm(center.y + Math.sin(angle) * radius, 4),
      });
    }
  }

  return points;
}

export function generatePlacedFillStones(
  closedPolylines: readonly { points: PolylinePoint[]; closed?: boolean }[],
  options: FillPlacementStrategyOptions,
): Stone[] {
  const loops = sortLoopsDeterministically(normalizeClosedPolylines(closedPolylines.map((polyline) => ({ points: polyline.points, closed: polyline.closed }))));
  if (loops.length === 0) return [];

  const pattern = options.placementPattern ?? 'default';
  const points =
    pattern === 'hexagonal'
      ? generateHexagonalFillPoints(loops, options)
      : pattern === 'radial'
        ? generateRadialFillPoints(loops, options)
        : generateDefaultFillPoints(loops, options);

  return dedupeAndFilterFillPoints(points, loops, options);
}
