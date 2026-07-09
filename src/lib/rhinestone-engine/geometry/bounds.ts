import type { Circle } from '../types/index.js';

/** Axis-aligned bounding box in millimeters. */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Calculates the axis-aligned bounding box that contains all circles,
 * including their full radius (not just center points).
 *
 * Returns zero bounds when the array is empty.
 */
export function calculateBounds(circles: Circle[]): Bounds {
  if (circles.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const c of circles) {
    minX = Math.min(minX, c.center.x - c.radiusMm);
    minY = Math.min(minY, c.center.y - c.radiusMm);
    maxX = Math.max(maxX, c.center.x + c.radiusMm);
    maxY = Math.max(maxY, c.center.y + c.radiusMm);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Returns a new Bounds expanded by `paddingMm` on every side.
 */
export function expandBounds(bounds: Bounds, paddingMm: number): Bounds {
  const minX = bounds.minX - paddingMm;
  const minY = bounds.minY - paddingMm;
  const maxX = bounds.maxX + paddingMm;
  const maxY = bounds.maxY + paddingMm;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Returns true when the entire circle (center + radius) lies within the
 * given bounds.
 */
export function isCircleInsideBounds(circle: Circle, bounds: Bounds): boolean {
  return (
    circle.center.x - circle.radiusMm >= bounds.minX &&
    circle.center.y - circle.radiusMm >= bounds.minY &&
    circle.center.x + circle.radiusMm <= bounds.maxX &&
    circle.center.y + circle.radiusMm <= bounds.maxY
  );
}
