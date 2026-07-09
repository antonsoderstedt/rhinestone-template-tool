/**
 * Public API for the rhinestone engine.
 *
 * Import from this file — do not import directly from sub-modules.
 *
 * Engine rules:
 * - All coordinates and measurements are in millimeters.
 * - All functions are pure and deterministic.
 * - No DOM, no network, no randomness.
 */

// Types
export type {
  StoneSizeId,
  Unit,
  Point,
  Circle,
  Stone,
  StoneSizeProfile,
  MaterialProfile,
  RhinestoneTemplate,
  ExportOptions,
} from './types/index.js';

// Stone size profiles
export {
  STONE_SIZE_PROFILES,
  getStoneSizeProfile,
  assertStoneSizeProfile,
} from './profiles/stoneSizes.js';

// Material profiles
export {
  MATERIAL_PROFILES,
  MAGIC_FLOCK_CRICUT_MAKER_PROFILE,
  getMaterialProfile,
  getDefaultMaterialProfile,
  getRecommendedHoleDiameter,
  getRecommendedCenterDistance,
} from './profiles/materialProfiles.js';

// Geometry utilities
export { distanceBetweenPoints } from './geometry/distance.js';
export { circleCenterDistance, circleDiameter, circleToStoneCircle } from './geometry/circle.js';
export type { Bounds } from './geometry/bounds.js';
export { calculateBounds, expandBounds, isCircleInsideBounds } from './geometry/bounds.js';
export { circlesOverlap, findOverlappingCirclePairs, hasCircleCollisions } from './geometry/collision.js';
export { roundMm } from './geometry/rounding.js';

// SVG export
export { createBasicSvgExport } from './export/svgExport.js';

// Calibration
export type { CalibrationSheetOptions } from './calibration/calibrationSheet.js';
export {
  createCalibrationSheet,
  createDefaultMagicFlockCalibrationSheet,
} from './calibration/calibrationSheet.js';
