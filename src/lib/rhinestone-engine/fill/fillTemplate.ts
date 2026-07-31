/**
 * Filled rhinestone template generator.
 *
 * Extends polyline-based template generation with three fill modes:
 * - "outline":      stones placed along polyline outlines only (existing behaviour).
 * - "fill":         stones placed inside closed shapes only, using grid fill.
 * - "outline-fill": both outline and fill, deduplicated with a global collision filter.
 *
 * Fill Mode v1. Future: better edge inset, hole-aware fill, advanced packing,
 * manual fill cleanup.
 *
 * All coordinates are in millimeters. Output is deterministic.
 */

import type { StoneSizeId, Stone, RhinestoneTemplate } from '../types/index';
import type { DensityPreset } from '../spacing/density';
import type { Polyline } from '../path/polyline';
import { createRhinestoneTemplate } from '../template/createTemplate';
import { createPolylineRhinestoneTemplate } from '../path/pathTemplate';
import { scalePolylinesToFit } from '../sizing/scalePolylines';
import { getRecommendedHoleDiameter, getRecommendedCenterDistance } from '../profiles/materialProfiles';
import { getDensitySpacing } from '../spacing/density';
import { getStoneSizeProfile } from '../profiles/stoneSizes';
import type { FillPattern } from './polygonFill';
import type { FillPlacementPattern, RadialPlacementSettings } from './placementPatterns';
import { generatePlacedFillStones } from './placementPatterns';
import type { ContourDirection } from './contourPlacement';
import { createContourRhinestoneTemplate } from './contourPlacement';

const OUTLINE_COLLISION_PRIORITY = 2;
const FILL_COLLISION_PRIORITY = 1;

function sortStonesByGeometry(stones: readonly Stone[]): Stone[] {
  return [...stones].sort((left, right) => {
    const yDelta = left.center.y - right.center.y;
    if (Math.abs(yDelta) > 0.0001) return yDelta;
    const xDelta = left.center.x - right.center.x;
    if (Math.abs(xDelta) > 0.0001) return xDelta;
    return left.id.localeCompare(right.id);
  });
}

function getCollisionPriority(stone: Stone): number {
  const value = stone.metadata?.collisionPriority;
  return typeof value === 'number' ? value : 0;
}

function sortStonesForCollisionResolution(stones: readonly Stone[]): Stone[] {
  return [...stones].sort((left, right) => {
    const priorityDelta = getCollisionPriority(right) - getCollisionPriority(left);
    if (priorityDelta !== 0) return priorityDelta;

    const yDelta = left.center.y - right.center.y;
    if (Math.abs(yDelta) > 0.0001) return yDelta;
    const xDelta = left.center.x - right.center.x;
    if (Math.abs(xDelta) > 0.0001) return xDelta;
    return left.id.localeCompare(right.id);
  });
}

function withCollisionMetadata(
  stones: readonly Stone[],
  collisionSource: 'outline' | 'fill',
  collisionPriority: number,
): Stone[] {
  return stones.map((stone) => ({
    ...stone,
    metadata: {
      ...stone.metadata,
      collisionSource: stone.metadata?.collisionSource ?? collisionSource,
      collisionPriority: Math.max(
        typeof stone.metadata?.collisionPriority === 'number' ? stone.metadata.collisionPriority : 0,
        collisionPriority,
      ),
    },
  }));
}

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Controls how stones are placed relative to polyline shapes.
 *
 * - `'outline'`:      Stones follow the polyline paths (default, existing behaviour).
 * - `'fill'`:         Stones fill the interior of closed shapes.
 * - `'outline-fill'`: Both outline and fill, with global collision deduplication.
 */
export type TemplateFillMode = 'outline' | 'fill' | 'outline-fill';
export type TemplateCoverageMode = TemplateFillMode | 'contour';

export interface ContourCoverageSettings {
  rowCount: number;
  rowSpacingMm: number;
  direction: ContourDirection;
}

export interface CreatePolylineFilledRhinestoneTemplateOptions {
  id: string;
  name: string;
  polylines: Polyline[];
  stoneSize: StoneSizeId;
  /**
   * Stone placement mode.
   * Default: `'outline'` (equivalent to `createPolylineRhinestoneTemplate`).
   */
  coverageMode?: TemplateCoverageMode;
  fillMode?: TemplateFillMode;
  /**
   * Fill grid pattern. Only used when fillMode is `'fill'` or `'outline-fill'`.
   * Default: `'offset-grid'`.
   */
  fillPattern?: FillPattern;
  placementPattern?: FillPlacementPattern;
  /**
   * Minimum clearance from filled shape edges before a fill stone is placed.
   * Defaults to half the hole diameter so generic SVG fills stay fully inside
   * source shapes. Text generation may lower this to preserve narrow strokes.
   */
  fillEdgeInsetMm?: number;
  contourSettings?: Partial<ContourCoverageSettings>;
  radialSettings?: Partial<RadialPlacementSettings>;
  spacingMm?: number;
  densityPreset?: DensityPreset;
  customSpacingMm?: number;
  materialProfileId?: string;
  targetWidthMm?: number;
  targetHeightMm?: number;
  preserveAspectRatio?: boolean;
  originXmm?: number;
  originYmm?: number;
  metadata?: Record<string, string | number | boolean>;
}

const DEFAULT_CONTOUR_SETTINGS: ContourCoverageSettings = {
  rowCount: 3,
  rowSpacingMm: 4,
  direction: 'inward',
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a rhinestone template from polylines with configurable fill mode.
 *
 * - `'outline'` mode delegates fully to `createPolylineRhinestoneTemplate`.
 * - `'fill'` mode generates stones inside closed shapes using a grid fill.
 * - `'outline-fill'` mode combines both, then applies a global greedy
 *   collision filter to prevent any two holes from overlapping.
 *
 * @throws if id, name, or polylines is empty.
 * @throws if spacingMm is below the recommended minimum.
 */
export function createPolylineFilledRhinestoneTemplate(
  options: CreatePolylineFilledRhinestoneTemplateOptions,
): RhinestoneTemplate {
  const {
    id,
    name,
    polylines,
    stoneSize,
    coverageMode,
    fillMode = 'outline',
    fillPattern = 'offset-grid',
    placementPattern = 'default',
    materialProfileId,
    targetWidthMm,
    targetHeightMm,
    preserveAspectRatio = true,
    originXmm,
    originYmm,
  } = options;

  // ── Guards ──────────────────────────────────────────────────────────────
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('createPolylineFilledRhinestoneTemplate: "id" must be a non-empty string.');
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('createPolylineFilledRhinestoneTemplate: "name" must be a non-empty string.');
  }
  if (!Array.isArray(polylines) || polylines.length === 0) {
    throw new Error(
      'createPolylineFilledRhinestoneTemplate: "polylines" must be a non-empty array.',
    );
  }
  if (options.fillEdgeInsetMm !== undefined && (!isFinite(options.fillEdgeInsetMm) || options.fillEdgeInsetMm < 0)) {
    throw new Error(
      `createPolylineFilledRhinestoneTemplate: "fillEdgeInsetMm" must be a non-negative finite number, got ${options.fillEdgeInsetMm}.`,
    );
  }

  const resolvedCoverageMode = coverageMode ?? fillMode;

  // ── Outline-only mode — delegate fully ──────────────────────────────────
  if (resolvedCoverageMode === 'outline') {
    const meta: Record<string, string | number | boolean> = {
      generatedBy: 'createPolylineFilledRhinestoneTemplate',
      coverageMode: resolvedCoverageMode,
      fillMode,
      fillPattern,
      placementPattern,
      stoneSize,
      materialProfileId: materialProfileId ?? 'magic-flock-cricut-maker',
      preserveAspectRatio,
      ...(targetWidthMm !== undefined && { targetWidthMm }),
      ...(targetHeightMm !== undefined && { targetHeightMm }),
      ...options.metadata,
    };
    return createPolylineRhinestoneTemplate({
      id,
      name,
      polylines,
      stoneSize,
      spacingMm: options.spacingMm,
      densityPreset: options.densityPreset,
      customSpacingMm: options.customSpacingMm,
      materialProfileId,
      targetWidthMm,
      targetHeightMm,
      preserveAspectRatio,
      originXmm,
      originYmm,
      metadata: meta,
    });
  }

  if (resolvedCoverageMode === 'contour') {
    const contourSettings = { ...DEFAULT_CONTOUR_SETTINGS, ...options.contourSettings };
    const contourResult = createContourRhinestoneTemplate({
      id,
      name,
      polylines,
      stoneSize,
      rowCount: contourSettings.rowCount,
      rowSpacingMm: contourSettings.rowSpacingMm,
      direction: contourSettings.direction,
      spacingMm: options.spacingMm,
      densityPreset: options.densityPreset,
      customSpacingMm: options.customSpacingMm,
      materialProfileId,
      metadata: options.metadata,
    });

    return createRhinestoneTemplate({
      id,
      name,
      stones: contourResult.stones,
      metadata: {
        generatedBy: 'createPolylineFilledRhinestoneTemplate',
        coverageMode: 'contour',
        contourRowCount: contourSettings.rowCount,
        contourRowSpacingMm: contourSettings.rowSpacingMm,
        contourDirection: contourSettings.direction,
        contourSkippedRows: contourResult.skippedRows,
        stoneSize,
        materialProfileId: materialProfileId ?? 'magic-flock-cricut-maker',
        ...options.metadata,
      },
    });
  }

  // ── Resolve spacing ─────────────────────────────────────────────────────
  const minSpacing = getRecommendedCenterDistance(stoneSize, materialProfileId);
  let resolvedSpacingMm: number;

  if (options.spacingMm !== undefined) {
    resolvedSpacingMm = options.spacingMm;
    if (resolvedSpacingMm < minSpacing) {
      const sizeProfile = getStoneSizeProfile(stoneSize);
      throw new Error(
        `createPolylineFilledRhinestoneTemplate: spacingMm (${options.spacingMm} mm) ` +
          `is smaller than the recommended centre distance for ${stoneSize} ` +
          `(${minSpacing} mm = minCenterDistanceMm ${sizeProfile.minCenterDistanceMm} + ` +
          `spacingSafetyMarginMm). Stones would overlap or tear the material.`,
      );
    }
  } else if (options.densityPreset !== undefined) {
    const dr = getDensitySpacing({
      stoneSize,
      materialProfileId,
      preset: options.densityPreset,
      customSpacingMm: options.customSpacingMm,
    });
    resolvedSpacingMm = dr.spacingMm;
  } else {
    resolvedSpacingMm = minSpacing;
  }

  const holeDiameterMm = getRecommendedHoleDiameter(stoneSize, materialProfileId);
  const fillEdgeInsetMm = options.fillEdgeInsetMm ?? holeDiameterMm / 2;

  // ── Scale polylines to physical dimensions ───────────────────────────────
  const workingPolylines =
    targetWidthMm !== undefined || targetHeightMm !== undefined
      ? scalePolylinesToFit(polylines, {
          targetWidthMm,
          targetHeightMm,
          preserveAspectRatio,
          originXmm,
          originYmm,
        })
      : polylines;

  // ── Metadata ─────────────────────────────────────────────────────────────
  const metadata: Record<string, string | number | boolean> = {
    generatedBy: 'createPolylineFilledRhinestoneTemplate',
    coverageMode: resolvedCoverageMode,
    fillMode,
    fillPattern,
    placementPattern,
    fillEdgeInsetMm,
    resolvedSpacingMm,
    stoneSize,
    materialProfileId: materialProfileId ?? 'magic-flock-cricut-maker',
    preserveAspectRatio,
    ...(targetWidthMm !== undefined && { targetWidthMm }),
    ...(targetHeightMm !== undefined && { targetHeightMm }),
    ...options.metadata,
  };

  // ── Outline stones (for outline-fill mode) ────────────────────────────────
  let outlineStones: Stone[] = [];
  if (resolvedCoverageMode === 'outline-fill') {
    const outlineTemplate = createPolylineRhinestoneTemplate({
      id: `${id}-outline-pass`,
      name: `${name} outline pass`,
      polylines: workingPolylines,
      stoneSize,
      spacingMm: options.spacingMm,
      densityPreset: options.densityPreset,
      customSpacingMm: options.customSpacingMm,
      materialProfileId,
      // workingPolylines already scaled — no target dimensions here
    });
    outlineStones = withCollisionMetadata(
      outlineTemplate.stones,
      'outline',
      OUTLINE_COLLISION_PRIORITY,
    );
  }

  // ── Fill stones ───────────────────────────────────────────────────────────
  const fillStones = withCollisionMetadata(generatePlacedFillStones(workingPolylines, {
    stoneSize,
    spacingMm: options.spacingMm,
    densityPreset: options.densityPreset,
    customSpacingMm: options.customSpacingMm,
    materialProfileId,
    fillPattern,
    placementPattern,
    fillEdgeInsetMm,
    radialSettings: options.radialSettings,
    existingStones: outlineStones,
    idPrefix: `${stoneSize.toLowerCase()}-${placementPattern}-fill`,
  }), 'fill', FILL_COLLISION_PRIORITY);

  // ── Combine and deduplicate ───────────────────────────────────────────────
  const combinedStones = sortStonesForCollisionResolution([...outlineStones, ...fillStones]);

  if (combinedStones.length === 0) {
    // No closed shapes produced fill points and no outline was requested.
    // Return empty template — export readiness will correctly flag it as not ready.
    return createRhinestoneTemplate({ id, name, stones: [], metadata });
  }

  // Global greedy collision filter: keep each stone only when its centre is
  // at least holeDiameterMm from every already-kept stone.
  const minDist2 = holeDiameterMm * holeDiameterMm;
  const keptStones: Stone[] = [];

  for (const stone of combinedStones) {
    let tooClose = false;
    for (const prev of keptStones) {
      const dx = stone.center.x - prev.center.x;
      const dy = stone.center.y - prev.center.y;
      if (dx * dx + dy * dy < minDist2) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) keptStones.push(stone);
  }

  return createRhinestoneTemplate({ id, name, stones: sortStonesByGeometry(keptStones), metadata });
}
