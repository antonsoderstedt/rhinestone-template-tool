import type { Stone, StoneSizeId } from '../types/index';
import type { Polyline } from '../path/polyline';
import type { DensityPreset } from '../spacing/density';
import { createPolylineRhinestoneTemplate } from '../path/pathTemplate';
import { getRecommendedCenterDistance, getRecommendedHoleDiameter } from '../profiles/materialProfiles';
import { getDensitySpacing } from '../spacing/density';
import { circlesOverlap } from '../geometry/collision';
import { closedLoopsToPolylines, offsetClosedLoops, sortLoopsDeterministically, normalizeClosedPolylines } from './compositeShape';

export type ContourDirection = 'inward' | 'outward' | 'centered';

export interface ContourCoverageOptions {
  id: string;
  name: string;
  polylines: Polyline[];
  stoneSize: StoneSizeId;
  rowCount: number;
  rowSpacingMm: number;
  direction: ContourDirection;
  spacingMm?: number;
  densityPreset?: DensityPreset;
  customSpacingMm?: number;
  materialProfileId?: string;
  metadata?: Record<string, string | number | boolean>;
}

function resolveOutlineSpacingMm(options: ContourCoverageOptions): number {
  if (options.spacingMm !== undefined) return options.spacingMm;
  if (options.densityPreset !== undefined) {
    return getDensitySpacing({
      stoneSize: options.stoneSize,
      materialProfileId: options.materialProfileId,
      preset: options.densityPreset,
      customSpacingMm: options.customSpacingMm,
    }).spacingMm;
  }
  return getRecommendedCenterDistance(options.stoneSize, options.materialProfileId);
}

function contourOffsets(rowCount: number, rowSpacingMm: number, direction: ContourDirection): number[] {
  if (direction === 'outward') {
    return Array.from({ length: rowCount }, (_, index) => rowSpacingMm * index);
  }
  if (direction === 'centered') {
    const middle = (rowCount - 1) / 2;
    return Array.from({ length: rowCount }, (_, index) => (index - middle) * rowSpacingMm);
  }
  return Array.from({ length: rowCount }, (_, index) => -rowSpacingMm * index);
}

export function createContourRhinestoneTemplate(options: ContourCoverageOptions): { stones: Stone[]; skippedRows: number } {
  const loops = sortLoopsDeterministically(normalizeClosedPolylines(options.polylines));
  if (loops.length === 0) {
    return { stones: [], skippedRows: options.rowCount };
  }

  const spacingMm = resolveOutlineSpacingMm(options);
  const holeDiameterMm = getRecommendedHoleDiameter(options.stoneSize, options.materialProfileId);
  const offsets = contourOffsets(options.rowCount, options.rowSpacingMm, options.direction);
  const keptStones: Stone[] = [];
  let skippedRows = 0;

  offsets.forEach((offset, rowIndex) => {
    const offsetLoops = offset === 0 ? loops : offsetClosedLoops(loops, offset);
    if (offsetLoops.length === 0) {
      skippedRows += 1;
      return;
    }

    const sampled = createPolylineRhinestoneTemplate({
      id: `${options.id}-contour-${rowIndex + 1}`,
      name: `${options.name} contour ${rowIndex + 1}`,
      polylines: closedLoopsToPolylines(offsetLoops),
      stoneSize: options.stoneSize,
      spacingMm,
      materialProfileId: options.materialProfileId,
    }).stones;

    if (sampled.length === 0) {
      skippedRows += 1;
      return;
    }

    for (const stone of sampled) {
      const collides = keptStones.some((existing) =>
        circlesOverlap(
          { center: stone.center, radiusMm: holeDiameterMm / 2 },
          { center: existing.center, radiusMm: existing.holeDiameterMm / 2 },
          0,
        ),
      );
      if (collides) continue;

      keptStones.push({
        ...stone,
        id: `${options.stoneSize.toLowerCase()}-contour-r${rowIndex + 1}-p${keptStones.length + 1}`,
      });
    }
  });

  return { stones: keptStones, skippedRows };
}
