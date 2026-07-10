/**
 * Path-to-rhinestone template generator.
 *
 * Converts an array of polylines into a RhinestoneTemplate by sampling
 * stone positions along each path at the recommended (or provided) spacing.
 *
 * SVG/logo-to-rhinestones foundation v1 — uses explicit polyline input only.
 * Raw SVG upload and path extraction are deferred to a future phase.
 */

import type { StoneSizeId, Stone, RhinestoneTemplate } from '../types/index';
import {
  getRecommendedHoleDiameter,
  getRecommendedCenterDistance,
} from '../profiles/materialProfiles';
import { getStoneSizeProfile } from '../profiles/stoneSizes';
import { createRhinestoneTemplate } from '../template/createTemplate';
import type { Polyline } from './polyline';
import { samplePolylineBySpacing, normalizePolylineInput } from './polyline';
import { scalePolylinesToFit } from '../sizing/scalePolylines';

// ─── Options ──────────────────────────────────────────────────────────────────

export interface CreatePolylineRhinestoneTemplateOptions {
  id: string;
  name: string;
  polylines: Polyline[];
  stoneSize: StoneSizeId;
  /**
   * Centre-to-centre spacing between adjacent stones along the path (mm).
   * Defaults to getRecommendedCenterDistance(stoneSize, materialProfileId).
   * Must not be smaller than the recommended centre distance.
   */
  spacingMm?: number;
  /**
   * Material profile id used to look up recommended dimensions.
   * Defaults to the default Magic Flock profile.
   */
  materialProfileId?: string;
  /** Optional extra metadata attached to the template. */
  // ── Physical size controls ────────────────────────────────────────────────
  /** Scale polylines to this width before sampling stones (mm). */
  targetWidthMm?: number;
  /** Scale polylines to this height before sampling stones (mm). */
  targetHeightMm?: number;
  /**
   * When true (default), scale preserving aspect ratio.
   * When false and both dimensions given, scale X and Y independently.
   */
  preserveAspectRatio?: boolean;
  /** X coordinate of the top-left corner after scaling (mm). Default: 10. */
  originXmm?: number;
  /** Y coordinate of the top-left corner after scaling (mm). Default: 10. */
  originYmm?: number;
  metadata?: Record<string, string | number | boolean>;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Samples stone positions along one or more polylines and returns a
 * validated RhinestoneTemplate.
 *
 * Stone IDs are deterministic: `{stoneSize}-path{N}-p{M}` (1-based).
 *
 * @throws if id, name, or polylines is empty.
 * @throws if spacingMm is smaller than the recommended centre distance.
 */
export function createPolylineRhinestoneTemplate(
  options: CreatePolylineRhinestoneTemplateOptions,
): RhinestoneTemplate {
  const { id, name, polylines, stoneSize, materialProfileId } = options;

  // ── Guards ────────────────────────────────────────────────────────────────
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('createPolylineRhinestoneTemplate: "id" must be a non-empty string.');
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('createPolylineRhinestoneTemplate: "name" must be a non-empty string.');
  }
  if (!Array.isArray(polylines) || polylines.length === 0) {
    throw new Error(
      'createPolylineRhinestoneTemplate: "polylines" must be a non-empty array.',
    );
  }

  // ── Spacing ──────────────────────────────────────────────────────────────
  const minSpacing = getRecommendedCenterDistance(stoneSize, materialProfileId);
  const spacingMm = options.spacingMm ?? minSpacing;

  if (options.spacingMm !== undefined && options.spacingMm < minSpacing) {
    const sizeProfile = getStoneSizeProfile(stoneSize);
    throw new Error(
      `createPolylineRhinestoneTemplate: spacingMm (${options.spacingMm} mm) is ` +
        `smaller than the recommended centre distance for ${stoneSize} ` +
        `(${minSpacing} mm = minCenterDistanceMm ${sizeProfile.minCenterDistanceMm} + ` +
        `spacingSafetyMarginMm). Stones would overlap or tear the material.`,
    );
  }

  const holeDiameterMm = getRecommendedHoleDiameter(stoneSize, materialProfileId);

  // ── Apply physical sizing (optional) ─────────────────────────────────────
  const { targetWidthMm, targetHeightMm, preserveAspectRatio, originXmm, originYmm } = options;
  const workingPolylines =
    targetWidthMm !== undefined || targetHeightMm !== undefined
      ? scalePolylinesToFit(polylines, {
          targetWidthMm,
          targetHeightMm,
          preserveAspectRatio: preserveAspectRatio ?? true,
          originXmm,
          originYmm,
        })
      : polylines;

  // ── Place stones ─────────────────────────────────────────────────────────
  const stones: Stone[] = [];

  workingPolylines.forEach((polyline, pi) => {
    // Validate and clone points before sampling
    const validatedPoints = normalizePolylineInput(polyline.points);
    const normalizedPolyline: Polyline = {
      points: validatedPoints,
      closed: polyline.closed,
    };

    const sampled = samplePolylineBySpacing(normalizedPolyline, spacingMm);

    sampled.forEach((pt, si) => {
      const stoneId = `${stoneSize.toLowerCase()}-path${pi + 1}-p${si + 1}`;
      stones.push({
        id: stoneId,
        center: { x: pt.x, y: pt.y },
        stoneSize,
        holeDiameterMm,
      });
    });
  });

  // ── Assemble ─────────────────────────────────────────────────────────────
  return createRhinestoneTemplate({
    id,
    name,
    stones,
    metadata: {
      generatedBy: 'createPolylineRhinestoneTemplate',
      stoneSize,
      materialProfileId: materialProfileId ?? 'magic-flock-cricut-maker',
      pathCount: polylines.length,
      spacingMm,
      ...(targetWidthMm  !== undefined && { targetWidthMm }),
      ...(targetHeightMm !== undefined && { targetHeightMm }),
      ...(preserveAspectRatio !== undefined && { preserveAspectRatio }),
      ...(originXmm !== undefined && { originXmm }),
      ...(originYmm !== undefined && { originYmm }),
      ...options.metadata,
    },
  });
}
