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
} from './types/index';

// Stone size profiles
export {
  STONE_SIZE_PROFILES,
  getStoneSizeProfile,
  assertStoneSizeProfile,
} from './profiles/stoneSizes';

// Material profiles
export {
  MATERIAL_PROFILES,
  MAGIC_FLOCK_CRICUT_MAKER_PROFILE,
  getMaterialProfile,
  getDefaultMaterialProfile,
  getRecommendedHoleDiameter,
  getRecommendedCenterDistance,
} from './profiles/materialProfiles';

// Geometry utilities
export { distanceBetweenPoints } from './geometry/distance';
export { circleCenterDistance, circleDiameter, circleToStoneCircle } from './geometry/circle';
export type { Bounds } from './geometry/bounds';
export { calculateBounds, expandBounds, isCircleInsideBounds } from './geometry/bounds';
export { circlesOverlap, findOverlappingCirclePairs, hasCircleCollisions } from './geometry/collision';
export { roundMm } from './geometry/rounding';

// SVG export
export { createBasicSvgExport } from './export/svgExport';

// Calibration
export type { CalibrationSheetOptions } from './calibration/calibrationSheet';
export {
  createCalibrationSheet,
  createDefaultMagicFlockCalibrationSheet,
} from './calibration/calibrationSheet';
export type {
  CalibratedHoleSizeOverride,
  CalibrationOverrideSet,
  CreateCalibrationOverrideSetInput,
} from './calibration/calibrationOverrides';
export {
  createCalibrationOverrideSet,
  getCalibratedHoleDiameter,
  applyCalibrationOverridesToTemplate,
} from './calibration/calibrationOverrides';

// Template creation
export type { CreateRhinestoneTemplateInput } from './template/createTemplate';
export { createRhinestoneTemplate } from './template/createTemplate';
export type { CreateStoneGridTemplateOptions } from './template/gridTemplate';
export { createStoneGridTemplate } from './template/gridTemplate';

// Template validation
export type {
  TemplateValidationSeverity,
  TemplateValidationIssue,
  TemplateValidationResult,
  TemplateValidationOptions,
} from './validation/templateValidation';
export { validateRhinestoneTemplate } from './validation/templateValidation';

// Text — dot matrix (Text v1 + Layout v2)
export type { DotMatrixGlyph } from './text/dotMatrixFont';
export {
  DOT_MATRIX_5X7_FONT,
  SUPPORTED_DOT_MATRIX_CHARACTERS,
  getDotMatrixGlyph,
} from './text/dotMatrixFont';
export type { CreateDotMatrixTextTemplateOptions } from './text/textTemplate';
export { createDotMatrixTextTemplate } from './text/textTemplate';
export type { TextLayoutBounds, TextAlign } from './text/textLayout';
export {
  GLYPH_COLUMNS,
  GLYPH_ROWS,
  calculateDotMatrixTextLayoutBounds,
  alignDotMatrixLine,
  computeTextScaleFactors,
  scaleDotMatrixTextPoints,
} from './text/textLayout';

// Path / polyline (SVG/logo foundation v1)
export type { PolylinePoint, Polyline } from './path/polyline';
export {
  getPolylineLength,
  samplePolylineBySpacing,
  normalizePolylineInput,
} from './path/polyline';
export type { CreatePolylineRhinestoneTemplateOptions } from './path/pathTemplate';
export { createPolylineRhinestoneTemplate } from './path/pathTemplate';
export type { PolylineCleanupOptions } from './path/polylineCleanup';
export {
  cleanupPolyline,
  cleanupPolylines,
  removeDuplicatePolylinePoints,
  removeShortPolylineSegments,
  simplifyPolyline,
  removeTinyPolylines,
} from './path/polylineCleanup';

// SVG upload (v2 — curves + transforms, no raw SVG rendering)
export type { ParsedSvgElement, SvgSafetyResult } from './svg/svgParser';
export {
  parseSvgAttributes,
  validateSafeSvgInput,
  extractSvgElements,
} from './svg/svgParser';
export type { SvgToPolylineOptions } from './svg/svgToPolyline';
export { svgStringToPolylines } from './svg/svgToPolyline';
export type { SvgViewBox, SvgRootAttributes } from './svg/svgUnits';
export { parseSvgViewBox, getSvgRootAttributes } from './svg/svgUnits';

// Physical size controls
export type { PolylineBounds, ScalePolylinesToFitOptions } from './sizing/scalePolylines';
export {
  calculatePolylineBounds,
  scalePolylinesToWidth,
  scalePolylinesToHeight,
  scalePolylinesToFit,
} from './sizing/scalePolylines';
export type { TemplatePhysicalSize } from './sizing/templateSizing';
export {
  getTemplateStoneBounds,
  getTemplatePhysicalSize,
  estimateTemplatePhysicalSizeFromStones,
} from './sizing/templateSizing';

// Spacing / density controls
export type { DensityPreset, GetDensitySpacingOptions, DensitySpacingResult } from './spacing/density';
export { getDensitySpacing, getDensityPresetOptions } from './spacing/density';

// Export readiness / Cricut QA
export type {
  ExportReadinessSeverity,
  ExportReadinessIssue,
  ExportReadinessSummary,
  ExportReadinessResult,
  ExportReadinessOptions,
} from './exportQa/exportReadiness';
export { checkExportReadiness } from './exportQa/exportReadiness';

// Cricut Test Pack
export type { CricutTestPackOptions, CricutTestPackItem, CricutTestPack } from './testPack/cricutTestPack';
export { createCricutTestPack } from './testPack/cricutTestPack';

// Font Outline Text (Font Outline Foundation v1)
// Real TTF/OTF parsing is deferred — uses built-in vector-outline glyphs only.
export type { VectorGlyph, VectorFont } from './textOutline/vectorFont';
export {
  BUILT_IN_VECTOR_FONT,
  SUPPORTED_VECTOR_FONT_CHARACTERS,
  getVectorGlyph,
} from './textOutline/vectorFont';
export type { OutlineTextAlign, CreateOutlineTextTemplateOptions } from './textOutline/outlineTextTemplate';
export { createOutlineTextTemplate } from './textOutline/outlineTextTemplate';

// Manual Stone Editor
export type {
  TemplateEditOperationType,
  TemplateEditOperation,
  TemplateEditHistory,
  TemplateEditorOptions,
  CreateStoneAtPointOptions,
} from './editor/templateEditor';
export {
  createEditHistory,
  commitEditedTemplate,
  undoEdit,
  redoEdit,
  findStoneById,
  generateManualStoneId,
  addStoneToTemplate,
  removeStoneFromTemplate,
  applyTemplateEditOperation,
  createStoneAtPoint,
} from './editor/templateEditor';
