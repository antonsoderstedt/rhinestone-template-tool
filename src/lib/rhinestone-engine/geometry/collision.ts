import type { Circle } from '../types/index.js';
import { distanceBetweenPoints } from './distance.js';

/**
 * Returns true when two circles overlap (i.e. they are closer together than
 * their combined radii plus the required gap).
 *
 * Circles that are exactly touching at the minimum allowed distance return
 * false — "exactly touching" is considered valid.
 *
 * @param a          First circle.
 * @param b          Second circle.
 * @param minGapMm   Required clear gap between circle edges (mm). Default 0.
 */
export function circlesOverlap(a: Circle, b: Circle, minGapMm = 0): boolean {
  const centerDist = distanceBetweenPoints(a.center, b.center);
  const minAllowedDist = a.radiusMm + b.radiusMm + minGapMm;
  return centerDist < minAllowedDist;
}

/**
 * Returns the index pairs of all circles in `circles` that overlap.
 *
 * Each pair is `[i, j]` where `i < j`.
 *
 * @param circles    Array of circles to test.
 * @param minGapMm   Required clear gap between circle edges (mm). Default 0.
 */
export function findOverlappingCirclePairs(
  circles: Circle[],
  minGapMm = 0,
): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      if (circlesOverlap(circles[i]!, circles[j]!, minGapMm)) {
        pairs.push([i, j]);
      }
    }
  }
  return pairs;
}

/**
 * Returns true if any two circles in `circles` overlap.
 *
 * @param circles    Array of circles to test.
 * @param minGapMm   Required clear gap between circle edges (mm). Default 0.
 */
export function hasCircleCollisions(circles: Circle[], minGapMm = 0): boolean {
  for (let i = 0; i < circles.length; i++) {
    for (let j = i + 1; j < circles.length; j++) {
      if (circlesOverlap(circles[i]!, circles[j]!, minGapMm)) {
        return true;
      }
    }
  }
  return false;
}
