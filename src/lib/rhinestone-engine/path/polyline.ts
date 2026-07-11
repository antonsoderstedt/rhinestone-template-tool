/**
 * Polyline sampling utilities for the rhinestone engine.
 *
 * All coordinates are in millimeters. Functions are pure and deterministic.
 */

import { roundMm } from '../geometry/rounding';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PolylinePoint {
  x: number;
  y: number;
}

export interface Polyline {
  points: PolylinePoint[];
  /**
   * When true, the final segment from the last point back to the first
   * point is included in length calculations and sampling.
   */
  closed?: boolean;
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates and returns a deep clone of the input points array.
 *
 * @throws if fewer than 2 points are provided.
 * @throws if any x or y coordinate is not a finite number.
 */
export function normalizePolylineInput(points: PolylinePoint[]): PolylinePoint[] {
  if (!Array.isArray(points) || points.length < 2) {
    throw new Error(
      `normalizePolylineInput: polyline must have at least 2 points, got ${points?.length ?? 0}.`,
    );
  }

  return points.map((pt, i) => {
    if (!isFinite(pt.x) || !isFinite(pt.y)) {
      throw new Error(
        `normalizePolylineInput: point at index ${i} has non-finite coordinates ` +
          `(x=${pt.x}, y=${pt.y}).`,
      );
    }
    return { x: pt.x, y: pt.y };
  });
}

// ─── Length ───────────────────────────────────────────────────────────────────

/**
 * Returns the total arc length of the polyline (mm).
 *
 * When `polyline.closed` is true, the segment from the last point back to
 * the first point is included.
 */
export function getPolylineLength(polyline: Polyline): number {
  const pts = polyline.points;
  let total = 0;

  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    total += Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }

  if (polyline.closed && pts.length >= 2) {
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    total += Math.hypot(first.x - last.x, first.y - last.y);
  }

  return total;
}

// ─── Sampling ─────────────────────────────────────────────────────────────────

/**
 * Returns an array of points sampled along the polyline at approximately
 * every `spacingMm` millimeters.
 *
 * The first point of the polyline is always included. Subsequent points are
 * placed by walking along the path and interpolating within segments. Output
 * coordinates are rounded to 4 decimal places.
 *
 * For closed polylines, the closing segment (last → first) is included.
 * If the spacing exactly divides the total length, the duplicate endpoint
 * is removed.
 *
 * @throws if spacingMm is <= 0.
 */
export function samplePolylineBySpacing(
  polyline: Polyline,
  spacingMm: number,
): PolylinePoint[] {
  if (spacingMm <= 0) {
    throw new Error(
      `samplePolylineBySpacing: spacingMm must be > 0, got ${spacingMm}.`,
    );
  }

  const rawPts = polyline.points;

  if (rawPts.length === 0) return [];
  if (rawPts.length === 1) return [{ x: rawPts[0]!.x, y: rawPts[0]!.y }];

  // Build working array; for closed polylines append a copy of the first point
  const pts: PolylinePoint[] = [...rawPts];
  if (polyline.closed) {
    pts.push({ x: rawPts[0]!.x, y: rawPts[0]!.y });
  }

  const dp = 4;
  const result: PolylinePoint[] = [
    { x: roundMm(pts[0]!.x, dp), y: roundMm(pts[0]!.y, dp) },
  ];
  let distanceAccumulated = 0;

  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);

    if (segLen < 1e-10) continue; // skip zero-length segments

    let cursor = 0; // distance traveled along this segment

    while (true) {
      const distToNextStone = spacingMm - distanceAccumulated;

      if (cursor + distToNextStone > segLen) {
        // Next stone placement is on a future segment
        distanceAccumulated += segLen - cursor;
        break;
      }

      cursor += distToNextStone;
      const t = cursor / segLen;
      result.push({
        x: roundMm(p1.x + t * (p2.x - p1.x), dp),
        y: roundMm(p1.y + t * (p2.y - p1.y), dp),
      });
      distanceAccumulated = 0;
    }
  }

  // For closed polylines, the last sampled stone may be too close to the first
  // stone (the closure point). This happens when the remaining path distance
  // after the last stone (distanceAccumulated) is less than spacingMm — the
  // "rhythm" of spacing would place the next stone at the first point but
  // there isn't a full spacing gap before it.
  //
  // In that case, remove the last stone to prevent a collision between it and
  // the first stone. The resulting gap (distanceAccumulated + spacingMm from
  // the new last stone) is always ≥ spacingMm, so no collision can occur.
  if (polyline.closed && result.length > 1) {
    if (distanceAccumulated < spacingMm) {
      result.pop();
    }
  }

  return result;
}
