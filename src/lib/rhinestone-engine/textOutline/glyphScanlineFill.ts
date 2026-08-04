import type { RhinestoneTemplate, Stone, StoneSizeId } from '../types/index';
import type { DensityPreset, DensitySpacingResult } from '../spacing/density';
import { getDensitySpacing } from '../spacing/density';
import { roundMm } from '../geometry/rounding';
import type { Polyline, PolylinePoint } from '../path/polyline';
import {
  collectClosedLoopBounds,
  normalizeClosedPolylines,
  pointInClosedLoops,
  sortLoopsDeterministically,
  type ClosedLoop,
} from '../fill/compositeShape';
import {
  getRecommendedCenterDistance,
  getRecommendedHoleDiameter,
} from '../profiles/materialProfiles';
import { getStoneSizeProfile } from '../profiles/stoneSizes';
import { createRhinestoneTemplate } from '../template/createTemplate';

export interface CreateGlyphScanlineFillTemplateOptions {
  id: string;
  name: string;
  polylines: Polyline[];
  stoneSize: StoneSizeId;
  spacingMm?: number;
  densityPreset?: DensityPreset;
  customSpacingMm?: number;
  materialProfileId?: string;
  existingStones?: readonly Stone[];
  metadata?: Record<string, string | number | boolean>;
}

interface GlyphScanlineCandidate extends PolylinePoint {
  collisionPriority: number;
  edgeBand: 'edge' | 'interior';
}

interface ResolvedSpacing {
  spacingMm: number;
  densityResult?: DensitySpacingResult;
}

function resolveSpacing({
  stoneSize,
  materialProfileId,
  spacingMm,
  densityPreset,
  customSpacingMm,
}: Pick<CreateGlyphScanlineFillTemplateOptions, 'stoneSize' | 'materialProfileId' | 'spacingMm' | 'densityPreset' | 'customSpacingMm'>): ResolvedSpacing {
  const minSpacing = getRecommendedCenterDistance(stoneSize, materialProfileId);

  if (spacingMm !== undefined) {
    if (spacingMm < minSpacing) {
      const sizeProfile = getStoneSizeProfile(stoneSize);
      throw new Error(
        `createGlyphScanlineFillTemplate: spacingMm (${spacingMm} mm) is ` +
          `smaller than the recommended centre distance for ${stoneSize} ` +
          `(${minSpacing} mm = minCenterDistanceMm ${sizeProfile.minCenterDistanceMm} + ` +
          `spacingSafetyMarginMm). Stones would overlap or tear the material.`,
      );
    }
    return { spacingMm };
  }

  if (densityPreset !== undefined) {
    const densityResult = getDensitySpacing({
      stoneSize,
      materialProfileId,
      preset: densityPreset,
      customSpacingMm,
    });
    return { spacingMm: densityResult.spacingMm, densityResult };
  }

  return { spacingMm: minSpacing };
}

function horizontalInsideIntervalsAtY(loops: readonly ClosedLoop[], y: number): Array<[number, number]> {
  const intersections: number[] = [];

  for (const loop of loops) {
    const points = loop.points;
    for (let index = 0; index < points.length; index++) {
      const start = points[index]!;
      const end = points[(index + 1) % points.length]!;
      const crossesScanline =
        (start.y <= y && end.y > y) ||
        (end.y <= y && start.y > y);

      if (!crossesScanline) continue;

      const t = (y - start.y) / (end.y - start.y);
      intersections.push(start.x + t * (end.x - start.x));
    }
  }

  intersections.sort((a, b) => a - b);

  const intervals: Array<[number, number]> = [];
  for (let index = 0; index + 1 < intersections.length; index += 2) {
    const left = intersections[index]!;
    const right = intersections[index + 1]!;
    if (right - left > 0.1) {
      intervals.push([left, right]);
    }
  }

  return intervals;
}

// Snaps candidates in this interval to a GLOBAL x-grid (shared across every
// row and interval, offset every other row) instead of evenly re-distributing
// points across each interval's own width. A per-interval distribution drifts
// out of alignment between neighboring rows/letters — especially on bold or
// curvy glyphs with many short intervals — producing a visually messy, non-
// gridded fill. Snapping to one shared lattice (the same approach the
// polygon offset-grid fill already uses) keeps the result reading as an
// orderly pattern instead of scattered dots.
function createIntervalCandidates(
  interval: [number, number],
  y: number,
  spacingMm: number,
  gridOriginX: number,
  rowXShift: number,
): GlyphScanlineCandidate[] {
  const [startX, endX] = interval;
  const width = endX - startX;
  if (width < 0.65) return [];

  const edgeInset = Math.min(
    Math.max(spacingMm * 0.08, 0.18),
    Math.max(0, width / 2 - 0.01),
  );
  const left = startX + edgeInset;
  const right = endX - edgeInset;

  if (right <= left) {
    return [{
      x: roundMm((startX + endX) / 2, 4),
      y: roundMm(y, 4),
      collisionPriority: 2,
      edgeBand: 'edge',
    }];
  }

  const firstIndex = Math.ceil((left - gridOriginX - rowXShift) / spacingMm);
  const candidates: GlyphScanlineCandidate[] = [];
  for (let index = firstIndex; ; index++) {
    const x = gridOriginX + rowXShift + index * spacingMm;
    if (x > right) break;
    if (x < left) continue;
    const isEdgeCandidate = x - left < spacingMm * 0.5 || right - x < spacingMm * 0.5;
    candidates.push({
      x: roundMm(x, 4),
      y: roundMm(y, 4),
      collisionPriority: isEdgeCandidate ? 2 : 1,
      edgeBand: isEdgeCandidate ? 'edge' : 'interior',
    });
  }

  if (candidates.length === 0) {
    return [{
      x: roundMm((startX + endX) / 2, 4),
      y: roundMm(y, 4),
      collisionPriority: 2,
      edgeBand: 'edge',
    }];
  }

  return candidates;
}

function createScanlineCandidates(
  loops: readonly ClosedLoop[],
  spacingMm: number,
): GlyphScanlineCandidate[] {
  const bounds = collectClosedLoopBounds(loops);
  const rowStepMm = spacingMm * Math.sqrt(3) / 2;
  const yValues: number[] = [];

  if (bounds.height <= rowStepMm) {
    yValues.push(roundMm(bounds.minY + bounds.height / 2, 4));
  } else {
    for (
      let y = bounds.minY + rowStepMm / 2;
      y <= bounds.maxY - rowStepMm / 2 + 0.001;
      y = roundMm(y + rowStepMm, 4)
    ) {
      yValues.push(roundMm(y, 4));
    }
  }

  const candidates: GlyphScanlineCandidate[] = [];
  yValues.forEach((y, rowIndex) => {
    const intervals = horizontalInsideIntervalsAtY(loops, y);
    if (intervals.length === 0) return;
    const rowXShift = rowIndex % 2 === 1 ? spacingMm / 2 : 0;
    for (const interval of intervals) {
      candidates.push(...createIntervalCandidates(interval, y, spacingMm, bounds.minX, rowXShift));
    }
  });

  return candidates;
}

function filterCollidingCandidates(
  candidates: readonly GlyphScanlineCandidate[],
  loops: readonly ClosedLoop[],
  minDistanceMm: number,
  holeDiameterMm: number,
  stoneSize: StoneSizeId,
  existingStones: readonly Stone[],
): Stone[] {
  const kept: Stone[] = [];
  const minDist2 = minDistanceMm * minDistanceMm;

  const sortedCandidates = [...candidates].sort((a, b) => {
    const priorityDelta = b.collisionPriority - a.collisionPriority;
    if (priorityDelta !== 0) return priorityDelta;
    if (Math.abs(a.y - b.y) > 0.0001) return a.y - b.y;
    return a.x - b.x;
  });

  for (const point of sortedCandidates) {
    if (!pointInClosedLoops(point, loops)) continue;

    let collides = false;
    for (const stone of existingStones) {
      const dx = point.x - stone.center.x;
      const dy = point.y - stone.center.y;
      if (dx * dx + dy * dy < minDist2) {
        collides = true;
        break;
      }
    }
    if (collides) continue;

    for (const stone of kept) {
      const dx = point.x - stone.center.x;
      const dy = point.y - stone.center.y;
      if (dx * dx + dy * dy < minDist2) {
        collides = true;
        break;
      }
    }
    if (collides) continue;

    kept.push({
      id: `${stoneSize.toLowerCase()}-glyph-scanline-${kept.length + 1}`,
      center: { x: roundMm(point.x, 4), y: roundMm(point.y, 4) },
      stoneSize,
      holeDiameterMm,
      metadata: {
        collisionSource: 'fill',
        collisionPriority: point.collisionPriority,
        edgeBand: point.edgeBand,
      },
    });
  }

  return kept.sort((left, right) => {
    const yDelta = left.center.y - right.center.y;
    if (Math.abs(yDelta) > 0.0001) return yDelta;
    const xDelta = left.center.x - right.center.x;
    if (Math.abs(xDelta) > 0.0001) return xDelta;
    return left.id.localeCompare(right.id);
  });
}

export function createGlyphScanlineFillTemplate(
  options: CreateGlyphScanlineFillTemplateOptions,
): RhinestoneTemplate {
  const {
    id,
    name,
    polylines,
    stoneSize,
    materialProfileId,
    customSpacingMm,
    existingStones = [],
    metadata,
  } = options;

  const loops = sortLoopsDeterministically(normalizeClosedPolylines(polylines));
  if (loops.length === 0) {
    return createRhinestoneTemplate({
      id,
      name,
      stones: [],
      metadata: {
        generatedBy: 'createGlyphScanlineFillTemplate',
        coverageMode: 'fill',
        fillMode: 'fill',
        textPlacementStrategy: 'glyph-scanline-fill-v1',
        stoneSize,
        materialProfileId: materialProfileId ?? 'magic-flock-cricut-maker',
        ...metadata,
      },
    });
  }

  const { spacingMm, densityResult } = resolveSpacing(options);
  const holeDiameterMm = getRecommendedHoleDiameter(stoneSize, materialProfileId);
  const rowStepMm = spacingMm * Math.sqrt(3) / 2;
  const candidates = createScanlineCandidates(loops, spacingMm);
  const stones = filterCollidingCandidates(candidates, loops, spacingMm, holeDiameterMm, stoneSize, existingStones);

  return createRhinestoneTemplate({
    id,
    name,
    stones,
    metadata: {
      generatedBy: 'createGlyphScanlineFillTemplate',
      coverageMode: 'fill',
      fillMode: 'fill',
      resolvedSpacingMm: spacingMm,
      glyphScanlineRowStepMm: roundMm(rowStepMm, 4),
      glyphScanlineCandidateCount: candidates.length,
      glyphScanlineExistingStoneCount: existingStones.length,
      stoneSize,
      materialProfileId: materialProfileId ?? 'magic-flock-cricut-maker',
      ...(densityResult && {
        densityPreset: densityResult.preset,
        ...(densityResult.warning && { densityWarning: densityResult.warning }),
      }),
      ...(customSpacingMm !== undefined && { customSpacingMm }),
      ...metadata,
      textPlacementStrategy: 'glyph-scanline-fill-v1',
    },
  });
}
