/**
 * Polyline bounds calculation and physical-size scaling utilities.
 *
 * All values are in millimeters. Functions are pure and deterministic.
 * Input polylines are never mutated.
 */

import type { Polyline, PolylinePoint } from '../path/polyline';
import { roundMm } from '../geometry/rounding';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PolylineBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface ScalePolylinesToFitOptions {
  /** Target physical width (mm). */
  targetWidthMm?: number;
  /** Target physical height (mm). */
  targetHeightMm?: number;
  /**
   * When true (default), scale by the smaller of the two factors so the
   * polylines fit inside the target box without distortion.
   * When false, scale X and Y independently (stretches the shape).
   */
  preserveAspectRatio?: boolean;
  /** X coordinate of the top-left corner after scaling (mm). Default: 10. */
  originXmm?: number;
  /** Y coordinate of the top-left corner after scaling (mm). Default: 10. */
  originYmm?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getScaleFactors(
  bounds: PolylineBounds,
  options: ScalePolylinesToFitOptions,
): { sx: number; sy: number } {
  const { targetWidthMm, targetHeightMm, preserveAspectRatio = true } = options;

  if (targetWidthMm === undefined && targetHeightMm === undefined) {
    return { sx: 1, sy: 1 };
  }

  const hasW = targetWidthMm !== undefined;
  const hasH = targetHeightMm !== undefined;

  if (!hasW) {
    // Only height given — scale uniformly
    if (bounds.height === 0) {
      throw new Error(
        'scalePolylinesToFit: cannot scale to targetHeightMm — polyline bounds height is 0.',
      );
    }
    const s = targetHeightMm! / bounds.height;
    return { sx: s, sy: s };
  }

  if (!hasH) {
    // Only width given — scale uniformly
    if (bounds.width === 0) {
      throw new Error(
        'scalePolylinesToFit: cannot scale to targetWidthMm — polyline bounds width is 0.',
      );
    }
    const s = targetWidthMm! / bounds.width;
    return { sx: s, sy: s };
  }

  // Both given
  if (preserveAspectRatio) {
    if (bounds.width === 0 && bounds.height === 0) {
      throw new Error(
        'scalePolylinesToFit: cannot scale — polyline bounds are 0 in both dimensions.',
      );
    }
    const scaleX = bounds.width  > 0 ? targetWidthMm!  / bounds.width  : Infinity;
    const scaleY = bounds.height > 0 ? targetHeightMm! / bounds.height : Infinity;
    const s = Math.min(scaleX, scaleY);
    return { sx: s, sy: s };
  } else {
    // Scale independently
    if (bounds.width === 0) {
      throw new Error(
        'scalePolylinesToFit: cannot scale X — polyline bounds width is 0.',
      );
    }
    if (bounds.height === 0) {
      throw new Error(
        'scalePolylinesToFit: cannot scale Y — polyline bounds height is 0.',
      );
    }
    return {
      sx: targetWidthMm!  / bounds.width,
      sy: targetHeightMm! / bounds.height,
    };
  }
}

function applyScale(
  poly: Polyline,
  bounds: PolylineBounds,
  sx: number,
  sy: number,
  originX: number,
  originY: number,
): Polyline {
  return {
    points: poly.points.map((pt): PolylinePoint => ({
      x: roundMm((pt.x - bounds.minX) * sx + originX, 4),
      y: roundMm((pt.y - bounds.minY) * sy + originY, 4),
    })),
    closed: poly.closed,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the axis-aligned bounding box of all points in all polylines (mm).
 *
 * @throws if polylines is empty.
 */
export function calculatePolylineBounds(polylines: Polyline[]): PolylineBounds {
  if (!Array.isArray(polylines) || polylines.length === 0) {
    throw new Error('calculatePolylineBounds: polylines must be a non-empty array.');
  }

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const poly of polylines) {
    for (const pt of poly.points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
  }

  return {
    minX, minY, maxX, maxY,
    width:  maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Scales all polylines so their combined bounding width equals `targetWidthMm`.
 * Both X and Y are scaled by the same factor (aspect ratio preserved).
 * The top-left of the scaled result is moved to (`originXmm`, `originYmm`).
 *
 * @throws if polylines is empty or targetWidthMm <= 0.
 */
export function scalePolylinesToWidth(
  polylines: Polyline[],
  targetWidthMm: number,
  originXmm = 10,
  originYmm = 10,
): Polyline[] {
  if (targetWidthMm <= 0) {
    throw new Error(
      `scalePolylinesToWidth: targetWidthMm must be > 0, got ${targetWidthMm}.`,
    );
  }
  return scalePolylinesToFit(polylines, { targetWidthMm, originXmm, originYmm });
}

/**
 * Scales all polylines so their combined bounding height equals `targetHeightMm`.
 * Both X and Y are scaled by the same factor (aspect ratio preserved).
 * The top-left of the scaled result is moved to (`originXmm`, `originYmm`).
 *
 * @throws if polylines is empty or targetHeightMm <= 0.
 */
export function scalePolylinesToHeight(
  polylines: Polyline[],
  targetHeightMm: number,
  originXmm = 10,
  originYmm = 10,
): Polyline[] {
  if (targetHeightMm <= 0) {
    throw new Error(
      `scalePolylinesToHeight: targetHeightMm must be > 0, got ${targetHeightMm}.`,
    );
  }
  return scalePolylinesToFit(polylines, { targetHeightMm, originXmm, originYmm });
}

/**
 * Scales all polylines to fit a target physical size (mm).
 *
 * - If only `targetWidthMm` or `targetHeightMm` is given, scales uniformly.
 * - If both are given and `preserveAspectRatio` is true (default): scales to
 *   fit inside the box (the smaller factor wins — no distortion).
 * - If both are given and `preserveAspectRatio` is false: scales X and Y
 *   independently (stretches the shape to fill exactly).
 * - After scaling, the top-left is placed at (`originXmm`, `originYmm`).
 *
 * Input polylines are never mutated. Returns a new array.
 *
 * @throws if polylines is empty.
 * @throws if targetWidthMm or targetHeightMm is <= 0.
 * @throws if required bounds dimension is 0.
 */
export function scalePolylinesToFit(
  polylines: Polyline[],
  options: ScalePolylinesToFitOptions = {},
): Polyline[] {
  if (!Array.isArray(polylines) || polylines.length === 0) {
    throw new Error('scalePolylinesToFit: polylines must be a non-empty array.');
  }

  const { targetWidthMm, targetHeightMm } = options;

  if (targetWidthMm !== undefined && targetWidthMm <= 0) {
    throw new Error(
      `scalePolylinesToFit: targetWidthMm must be > 0, got ${targetWidthMm}.`,
    );
  }
  if (targetHeightMm !== undefined && targetHeightMm <= 0) {
    throw new Error(
      `scalePolylinesToFit: targetHeightMm must be > 0, got ${targetHeightMm}.`,
    );
  }

  const originX = options.originXmm ?? 10;
  const originY = options.originYmm ?? 10;

  const bounds = calculatePolylineBounds(polylines);
  const { sx, sy } = getScaleFactors(bounds, options);

  return polylines.map((poly) => applyScale(poly, bounds, sx, sy, originX, originY));
}
