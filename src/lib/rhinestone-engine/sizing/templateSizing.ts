/**
 * Template physical size helpers.
 *
 * Uses stone hole circles (not just center points) to compute accurate
 * bounding dimensions. All values are in millimeters.
 */

import type { RhinestoneTemplate } from '../types/index';
import { circleToStoneCircle } from '../geometry/circle';
import { calculateBounds } from '../geometry/bounds';
import type { Bounds } from '../geometry/bounds';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TemplatePhysicalSize {
  /** Total physical width including hole radii (mm). */
  widthMm: number;
  /** Total physical height including hole radii (mm). */
  heightMm: number;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the axis-aligned bounding box of all stone holes in the template.
 *
 * Includes the full hole radius so the bounds represent the actual
 * cut area, not just the stone centre points.
 *
 * Returns zero-width/height bounds for templates with no stones.
 */
export function getTemplateStoneBounds(template: RhinestoneTemplate): Bounds {
  if (template.stones.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  const circles = template.stones.map(circleToStoneCircle);
  return calculateBounds(circles);
}

/**
 * Returns the physical width and height of the template output (mm).
 *
 * Includes full hole radii — represents the actual cut sheet dimensions.
 *
 * ⚠️ Stone size values are provisional until calibrated. This is an estimate.
 */
export function getTemplatePhysicalSize(template: RhinestoneTemplate): TemplatePhysicalSize {
  const bounds = getTemplateStoneBounds(template);
  return { widthMm: bounds.width, heightMm: bounds.height };
}

/**
 * Alias for `getTemplatePhysicalSize`. Named to make clear the returned
 * dimensions are estimated from stone positions and may differ from the
 * actual cut sheet after calibration.
 */
export function estimateTemplatePhysicalSizeFromStones(
  template: RhinestoneTemplate,
): TemplatePhysicalSize {
  return getTemplatePhysicalSize(template);
}
