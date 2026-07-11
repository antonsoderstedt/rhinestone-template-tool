/**
 * Polyline Cleanup Module
 *
 * Cleans up polylines converted from SVG uploads or other sources to
 * improve rhinestone placement quality:
 * - Removes duplicate/near-duplicate consecutive points
 * - Removes short segments caused by noise or over-sampling
 * - Removes tiny polylines unlikely to hold stones
 * - Optional: simplifies using Ramer-Douglas-Peucker algorithm
 *
 * All functions are pure — they never mutate input polylines.
 * Output polylines always have at least 2 points.
 */

import type { Polyline, PolylinePoint } from './polyline';
import { getPolylineLength } from './polyline';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PolylineCleanupOptions {
  /** Remove consecutive duplicate (or near-duplicate) points. Default: true. */
  removeDuplicatePoints?: boolean;
  /** Max Euclidean distance (mm) to treat two points as duplicates. Default: 0.05. */
  duplicatePointToleranceMm?: number;
  /** Remove segments shorter than a threshold. Default: true. */
  removeShortSegments?: boolean;
  /** Minimum allowed segment length (mm). Default: 0.25. */
  minSegmentLengthMm?: number;
  /** Simplify polylines using Ramer-Douglas-Peucker. Default: false. */
  simplify?: boolean;
  /** RDP tolerance (mm) — larger = more aggressive simplification. Default: 0.25. */
  simplifyToleranceMm?: number;
  /** Remove polylines whose total arc length is below a threshold. Default: true. */
  removeTinyPolylines?: boolean;
  /** Minimum arc length (mm) for a polyline to be kept. Default: 1. */
  minPolylineLengthMm?: number;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function perpendicularDistance(
  pt: PolylinePoint,
  lineStart: PolylinePoint,
  lineEnd: PolylinePoint,
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-20) {
    return Math.hypot(pt.x - lineStart.x, pt.y - lineStart.y);
  }
  const t = ((pt.x - lineStart.x) * dx + (pt.y - lineStart.y) * dy) / len2;
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  return Math.hypot(pt.x - projX, pt.y - projY);
}

function rdpSimplify(pts: PolylinePoint[], tolerance: number): PolylinePoint[] {
  if (pts.length <= 2) return pts.map((p) => ({ ...p }));

  const first = pts[0]!;
  const last  = pts[pts.length - 1]!;

  let maxDist  = 0;
  let maxIndex = 1;

  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpendicularDistance(pts[i]!, first, last);
    if (d > maxDist) {
      maxDist  = d;
      maxIndex = i;
    }
  }

  if (maxDist > tolerance) {
    const left  = rdpSimplify(pts.slice(0, maxIndex + 1), tolerance);
    const right = rdpSimplify(pts.slice(maxIndex), tolerance);
    return [...left, ...right.slice(1)];
  }

  return [{ ...first }, { ...last }];
}

// ─── Public utility functions ─────────────────────────────────────────────────

/**
 * Removes consecutive duplicate (or near-duplicate) points.
 *
 * For closed polylines, also removes a repeated closure point
 * (last point equal to first).
 *
 * @throws if toleranceMm <= 0.
 */
export function removeDuplicatePolylinePoints(
  polyline: Polyline,
  toleranceMm: number,
): Polyline {
  if (toleranceMm <= 0) {
    throw new Error(
      `removeDuplicatePolylinePoints: toleranceMm must be > 0, got ${toleranceMm}.`,
    );
  }

  const pts = polyline.points;
  if (pts.length <= 1) return { points: pts.map((p) => ({ ...p })), closed: polyline.closed };

  const result: PolylinePoint[] = [{ ...pts[0]! }];
  for (let i = 1; i < pts.length; i++) {
    const prev = result[result.length - 1]!;
    const curr = pts[i]!;
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) > toleranceMm) {
      result.push({ ...curr });
    }
  }

  // Remove repeated closure point for closed polylines
  if (polyline.closed && result.length >= 2) {
    const first = result[0]!;
    const last  = result[result.length - 1]!;
    if (Math.hypot(last.x - first.x, last.y - first.y) <= toleranceMm) {
      result.pop();
    }
  }

  return { points: result, closed: polyline.closed };
}

/**
 * Removes intermediate points that create segments shorter than `minSegmentLengthMm`.
 * Always preserves the first and last points.
 *
 * @throws if minSegmentLengthMm <= 0.
 */
export function removeShortPolylineSegments(
  polyline: Polyline,
  minSegmentLengthMm: number,
): Polyline {
  if (minSegmentLengthMm <= 0) {
    throw new Error(
      `removeShortPolylineSegments: minSegmentLengthMm must be > 0, got ${minSegmentLengthMm}.`,
    );
  }

  const pts = polyline.points;
  if (pts.length <= 2) return { points: pts.map((p) => ({ ...p })), closed: polyline.closed };

  // Keep first point, then add a point only when it's >= minSegmentLengthMm from last kept
  const result: PolylinePoint[] = [{ ...pts[0]! }];

  for (let i = 1; i < pts.length - 1; i++) {
    const prev = result[result.length - 1]!;
    const curr = pts[i]!;
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) >= minSegmentLengthMm) {
      result.push({ ...curr });
    }
  }

  // Always keep the last point
  result.push({ ...pts[pts.length - 1]! });

  return { points: result, closed: polyline.closed };
}

/**
 * Simplifies a polyline using the Ramer-Douglas-Peucker algorithm.
 *
 * For closed polylines, the algorithm is applied treating the polyline as
 * open; the closed flag is preserved on the result.
 *
 * @throws if toleranceMm <= 0.
 */
export function simplifyPolyline(polyline: Polyline, toleranceMm: number): Polyline {
  if (toleranceMm <= 0) {
    throw new Error(`simplifyPolyline: toleranceMm must be > 0, got ${toleranceMm}.`);
  }

  const pts = polyline.points;
  if (pts.length <= 2) {
    return { points: pts.map((p) => ({ ...p })), closed: polyline.closed };
  }

  const simplified = rdpSimplify(pts, toleranceMm);
  // Ensure at least 2 points
  const result = simplified.length >= 2 ? simplified : pts.slice(0, 2).map((p) => ({ ...p }));

  return { points: result, closed: polyline.closed };
}

/**
 * Removes polylines whose total arc length is below `minPolylineLengthMm`.
 *
 * @throws if minPolylineLengthMm <= 0.
 */
export function removeTinyPolylines(
  polylines: Polyline[],
  minPolylineLengthMm: number,
): Polyline[] {
  if (minPolylineLengthMm <= 0) {
    throw new Error(
      `removeTinyPolylines: minPolylineLengthMm must be > 0, got ${minPolylineLengthMm}.`,
    );
  }
  return polylines.filter((p) => getPolylineLength(p) >= minPolylineLengthMm);
}

// ─── Main cleanup functions ───────────────────────────────────────────────────

/**
 * Applies the cleanup pipeline to a single polyline.
 *
 * Returns `null` if the result would have fewer than 2 points.
 * Input is never mutated.
 */
export function cleanupPolyline(
  polyline: Polyline,
  options: PolylineCleanupOptions = {},
): Polyline | null {
  const {
    removeDuplicatePoints: doDedup  = true,
    duplicatePointToleranceMm       = 0.05,
    removeShortSegments: doShort    = true,
    minSegmentLengthMm              = 0.25,
    simplify: doSimplify            = false,
    simplifyToleranceMm             = 0.25,
  } = options;

  let current: Polyline = polyline;

  if (doDedup) {
    current = removeDuplicatePolylinePoints(current, duplicatePointToleranceMm);
  }
  if (doShort) {
    current = removeShortPolylineSegments(current, minSegmentLengthMm);
  }
  if (doSimplify) {
    current = simplifyPolyline(current, simplifyToleranceMm);
  }

  return current.points.length >= 2 ? current : null;
}

/**
 * Applies the cleanup pipeline to an array of polylines.
 *
 * Polylines with fewer than 2 points after cleanup are discarded.
 * Tiny polylines (total length < minPolylineLengthMm) are discarded.
 *
 * @throws if all polylines are removed.
 */
export function cleanupPolylines(
  polylines: Polyline[],
  options: PolylineCleanupOptions = {},
): Polyline[] {
  const {
    removeTinyPolylines: doRemoveTiny = true,
    minPolylineLengthMm               = 1,
  } = options;

  // Per-polyline cleanup
  let result: Polyline[] = polylines
    .map((p) => cleanupPolyline(p, options))
    .filter((p): p is Polyline => p !== null);

  // Tiny polyline removal
  if (doRemoveTiny && result.length > 0) {
    result = removeTinyPolylines(result, minPolylineLengthMm);
  }

  if (result.length === 0) {
    throw new Error(
      'cleanupPolylines: all polylines were removed during cleanup. ' +
        'Try reducing cleanup strictness, or check that the SVG contains ' +
        'shapes larger than the minimum size threshold.',
    );
  }

  return result;
}
