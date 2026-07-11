/**
 * Fill mode barrel export.
 *
 * Fill Mode v1 — outline, fill, and outline-fill modes for rhinestone templates.
 */

export type { FillPattern, PolygonFillOptions, PolygonBounds } from './polygonFill';
export {
  pointInPolygon,
  calculatePolygonBounds,
  generateFillPointsForClosedPolyline,
  generateFillPointsForClosedPolylines,
} from './polygonFill';

export type { TemplateFillMode, CreatePolylineFilledRhinestoneTemplateOptions } from './fillTemplate';
export { createPolylineFilledRhinestoneTemplate } from './fillTemplate';
