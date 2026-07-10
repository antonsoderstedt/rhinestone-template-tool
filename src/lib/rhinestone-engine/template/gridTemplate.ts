import type { StoneSizeId, Stone, RhinestoneTemplate } from '../types/index';
import {
  getRecommendedHoleDiameter,
  getRecommendedCenterDistance,
} from '../profiles/materialProfiles';
import { getStoneSizeProfile } from '../profiles/stoneSizes';
import { roundMm } from '../geometry/rounding';
import type { DensityPreset, DensitySpacingResult } from '../spacing/density';
import { getDensitySpacing } from '../spacing/density';

// ─── Options type ─────────────────────────────────────────────────────────────

export interface CreateStoneGridTemplateOptions {
  id: string;
  name: string;
  stoneSize: StoneSizeId;
  columns: number;
  rows: number;
  /** X coordinate of the top-left stone centre (mm). Default: 10. */
  startXmm?: number;
  /** Y coordinate of the top-left stone centre (mm). Default: 10. */
  startYmm?: number;
  /**
   * Centre-to-centre spacing between adjacent stones (mm).
   * Defaults to getRecommendedCenterDistance(stoneSize, materialProfileId).
   * Must not be smaller than the recommended centre distance.
   */
  spacingMm?: number;
  /**
   * Material profile id used to look up recommended dimensions.
   * Defaults to the default Magic Flock profile.
   */
  materialProfileId?: string;
  // ── Density controls ────────────────────────────────────────────────────
  /** Density preset. If spacingMm is also set, spacingMm takes precedence. */
  densityPreset?: DensityPreset;
  /** Required when densityPreset is "custom". */
  customSpacingMm?: number;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a rectangular grid of rhinestones as a RhinestoneTemplate.
 *
 * Stone IDs are deterministic: `${stoneSize.toLowerCase()}-r{row}-c{col}` (1-based).
 *
 * @throws if rows or columns < 1.
 * @throws if a custom spacingMm is smaller than the recommended centre distance.
 */
export function createStoneGridTemplate(
  options: CreateStoneGridTemplateOptions,
): RhinestoneTemplate {
  const {
    id,
    name,
    stoneSize,
    columns,
    rows,
    startXmm = 10,
    startYmm = 10,
    materialProfileId,
  } = options;

  if (!Number.isInteger(rows) || rows < 1) {
    throw new Error(
      `createStoneGridTemplate: "rows" must be an integer >= 1, got ${rows}.`,
    );
  }
  if (!Number.isInteger(columns) || columns < 1) {
    throw new Error(
      `createStoneGridTemplate: "columns" must be an integer >= 1, got ${columns}.`,
    );
  }

  const recommendedSpacing = getRecommendedCenterDistance(stoneSize, materialProfileId);
  const holeDiameterMm = getRecommendedHoleDiameter(stoneSize, materialProfileId);
  const dp = 3;

  // ── Spacing ──────────────────────────────────────────────────────────────
  let spacing: number;
  let densityResult: DensitySpacingResult | undefined;

  if (options.spacingMm !== undefined) {
    spacing = options.spacingMm;
    if (spacing < recommendedSpacing) {
      const sizeProfile = getStoneSizeProfile(stoneSize);
      throw new Error(
        `createStoneGridTemplate: spacingMm (${spacing} mm) is smaller than the ` +
          `recommended centre distance for ${stoneSize} ` +
          `(${recommendedSpacing} mm = minCenterDistanceMm ${sizeProfile.minCenterDistanceMm} + ` +
          `spacingSafetyMarginMm). Stones would overlap or tear the material.`,
      );
    }
  } else if (options.densityPreset !== undefined) {
    densityResult = getDensitySpacing({
      stoneSize,
      materialProfileId,
      preset: options.densityPreset,
      customSpacingMm: options.customSpacingMm,
    });
    spacing = densityResult.spacingMm;
  } else {
    spacing = recommendedSpacing;
  }

  const stones: Stone[] = [];

  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= columns; col++) {
      const cx = roundMm(startXmm + (col - 1) * spacing, dp);
      const cy = roundMm(startYmm + (row - 1) * spacing, dp);
      const stoneId = `${stoneSize.toLowerCase()}-r${row}-c${col}`;

      stones.push({
        id: stoneId,
        center: { x: cx, y: cy },
        stoneSize,
        holeDiameterMm,
        metadata: {
          generatedBy: 'createStoneGridTemplate',
          stoneSize,
          columns,
          rows,
          materialProfileId: materialProfileId ?? 'magic-flock-cricut-maker',
        },
      });
    }
  }

  const templateMetadata: Record<string, string | number | boolean> = {
    generatedBy: 'createStoneGridTemplate',
    stoneSize,
    columns,
    rows,
    materialProfileId: materialProfileId ?? 'magic-flock-cricut-maker',
    spacingMm: spacing,
  };
  if (densityResult) {
    templateMetadata.densityPreset = densityResult.preset;
    templateMetadata.resolvedSpacingMm = densityResult.spacingMm;
    if (densityResult.warning) templateMetadata.densityWarning = densityResult.warning;
  }

  return {
    id,
    name,
    unit: 'mm',
    stones,
    metadata: templateMetadata,
  };
}
