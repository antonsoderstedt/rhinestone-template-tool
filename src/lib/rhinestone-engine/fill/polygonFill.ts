/**
 * Polygon fill utilities for rhinestone template generation.
 *
 * Generates candidate stone positions inside closed polygon shapes using
 * grid or offset-grid patterns, then tests each with point-in-polygon.
 *
 * Fill Mode v1. All coordinates are in millimeters.
 * Functions are pure and deterministic — no side effects, no randomness.
 *
 * Future: better edge inset, hole-aware fill, advanced packing algorithms.
 */

import type { Polyline, PolylinePoint } from '../path/polyline';
import { roundMm } from '../geometry/rounding';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Layout pattern for fill point generation. */
export type FillPattern = 'grid' | 'offset-grid';

export interface PolygonFillOptions {
  /** Centre-to-centre spacing between candidate fill points (mm). Must be > 0. */
  spacingMm: number;
  /**
   * Layout pattern.
   * - `'grid'`: regular rows and columns.
   * - `'offset-grid'`: every second row is shifted right by spacingMm / 2
   *   for denser, more natural-looking coverage.
   * Default: `'offset-grid'`.
   */
  pattern?: FillPattern;
  /**
   * Minimum distance from the polygon edge before a fill point is placed (mm).
   * Default: 0 (edge proximity is handled by the caller's collision filter).
   */
  insetMm?: number;
}

export interface PolygonBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

// ─── Geometry helpers ──────────────────────────────────────────────────────────

/**
 * Ray-casting point-in-polygon test (Jordan curve theorem).
 *
 * Returns `true` when `point` is strictly inside the polygon.
 * Points exactly on the boundary may return either true or false — callers
 * should not rely on boundary behaviour for rhinestone placement.
 *
 * Deterministic: result depends only on the input values.
 */
export function pointInPolygon(
  point: PolylinePoint,
  polygonPoints: PolylinePoint[],
): boolean {
  const { x, y } = point;
  const n = polygonPoints.length;
  if (n < 3) return false;

  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygonPoints[i]!.x;
    const yi = polygonPoints[i]!.y;
    const xj = polygonPoints[j]!.x;
    const yj = polygonPoints[j]!.y;

    // Edge from j → i crosses the horizontal ray from (x, y) to the right?
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Returns the axis-aligned bounding box of a set of polygon vertices.
 */
export function calculatePolygonBounds(points: PolylinePoint[]): PolygonBounds {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pt of points) {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

// ─── Edge-distance helper (for insetMm) ──────────────────────────────────────

/** Perpendicular distance from point P to the line segment (A, B). */
function pointToSegmentDistance(
  p: PolylinePoint,
  a: PolylinePoint,
  b: PolylinePoint,
): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

/** Returns true when `point` is at least `insetMm` from all polygon edges. */
function isInsetEnough(
  point: PolylinePoint,
  polygonPoints: PolylinePoint[],
  insetMm: number,
): boolean {
  const n = polygonPoints.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    if (pointToSegmentDistance(point, polygonPoints[j]!, polygonPoints[i]!) < insetMm) {
      return false;
    }
  }
  return true;
}

// ─── Fill point generators ────────────────────────────────────────────────────

/**
 * Generates fill points inside a single closed polyline.
 *
 * Only works for closed polylines (polyline.closed === true).
 * Returns an empty array for open polylines without throwing.
 *
 * @throws if spacingMm <= 0.
 * @throws if the polygon has fewer than 3 points.
 */
export function generateFillPointsForClosedPolyline(
  polyline: Polyline,
  options: PolygonFillOptions,
): PolylinePoint[] {
  if (!polyline.closed) return [];

  const { spacingMm, pattern = 'offset-grid', insetMm = 0 } = options;

  if (spacingMm <= 0) {
    throw new Error(
      `generateFillPointsForClosedPolyline: spacingMm must be > 0, got ${spacingMm}.`,
    );
  }
  if (polyline.points.length < 3) {
    throw new Error(
      `generateFillPointsForClosedPolyline: polygon must have at least 3 points, ` +
        `got ${polyline.points.length}.`,
    );
  }

  const pts = polyline.points;
  const bounds = calculatePolygonBounds(pts);

  // Candidate grid starts half-a-spacing inside the bounding box so the
  // first row/column lands near the centroid of the first "cell".
  const halfSpacing = spacingMm / 2;
  const startY = roundMm(bounds.minY + halfSpacing);
  const startX = roundMm(bounds.minX + halfSpacing);
  const endY = bounds.maxY - halfSpacing + 0.001;
  const endX = bounds.maxX - halfSpacing + 0.001;

  const results: PolylinePoint[] = [];
  let rowIndex = 0;

  for (let cy = startY; cy <= endY; cy = roundMm(cy + spacingMm)) {
    // Offset-grid: every second row shifts x by half a spacing
    const xShift = pattern === 'offset-grid' && rowIndex % 2 === 1 ? halfSpacing : 0;

    for (let cx = roundMm(startX + xShift); cx <= endX; cx = roundMm(cx + spacingMm)) {
      const candidate: PolylinePoint = { x: roundMm(cx), y: roundMm(cy) };

      if (!pointInPolygon(candidate, pts)) continue;
      if (insetMm > 0 && !isInsetEnough(candidate, pts, insetMm)) continue;

      results.push(candidate);
    }
    rowIndex++;
  }

  return results;
}

/**
 * Generates fill points for multiple polylines.
 *
 * Open polylines are silently skipped.
 * Closed polylines with fewer than 3 points are silently skipped.
 */
export function generateFillPointsForClosedPolylines(
  polylines: Polyline[],
  options: PolygonFillOptions,
): PolylinePoint[] {
  const results: PolylinePoint[] = [];
  for (const pl of polylines) {
    if (!pl.closed) continue;
    if (pl.points.length < 3) continue;
    const pts = generateFillPointsForClosedPolyline(pl, options);
    results.push(...pts);
  }
  return results;
}
