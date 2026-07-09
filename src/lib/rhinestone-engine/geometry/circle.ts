import type { Circle, Stone } from '../types/index.js';
import { distanceBetweenPoints } from './distance.js';

/**
 * Returns the distance between the centers of two circles (mm).
 */
export function circleCenterDistance(a: Circle, b: Circle): number {
  return distanceBetweenPoints(a.center, b.center);
}

/**
 * Returns the diameter of a circle (mm).
 */
export function circleDiameter(circle: Circle): number {
  return circle.radiusMm * 2;
}

/**
 * Converts a Stone to a Circle using holeDiameterMm / 2 as the radius.
 *
 * The resulting circle represents the hole that will be cut in the template
 * material, not the physical stone.
 */
export function circleToStoneCircle(stone: Stone): Circle {
  return {
    center: stone.center,
    radiusMm: stone.holeDiameterMm / 2,
  };
}
