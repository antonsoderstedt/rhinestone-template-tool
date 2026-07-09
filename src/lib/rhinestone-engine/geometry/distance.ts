import type { Point } from '../types/index';

/**
 * Returns the Euclidean distance between two points (mm).
 *
 * Both points must already be in millimeters. No unit conversion is applied.
 */
export function distanceBetweenPoints(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
