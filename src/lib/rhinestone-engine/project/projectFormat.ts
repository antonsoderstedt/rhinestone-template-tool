/**
 * Rhinestone Template Tool — Project File Format v1
 *
 * Schema version 1. All measurements in millimeters.
 * Unknown fields in loaded files are silently ignored.
 *
 * Engine rules: pure functions only — no DOM, no file I/O.
 * Serialization / deserialization lives here.
 * UI download / upload logic lives in components.
 */

import type { StoneSizeId } from '../types/index';
import type { DensityPreset } from '../spacing/density';
import type { OutlineTextAlign } from '../textOutline/outlineTextTemplate';
import type { TemplateCoverageMode, TemplateFillMode, ContourCoverageSettings } from '../fill/fillTemplate';
import type { FillPattern } from '../fill/polygonFill';
import type { TextAlign } from '../text/textLayout';
import { LEGACY_OUTLINE_FONT_ID } from '../textOutline/fontRegistry';
import type { FillPlacementPattern, RadialPlacementSettings } from '../fill/placementPatterns';

// ─── Generator IDs ────────────────────────────────────────────────────────────

export type GeneratorId =
  | 'outline-text'
  | 'dot-matrix-text'
  | 'manual-grid'
  | 'polyline-logo'
  | 'svg-upload'
  | 'manual-editor';

export type PolylineDemoShape = 'diamond' | 'triangle' | 'rectangle' | 'zigzag';

// ─── Per-generator saved state ────────────────────────────────────────────────

export interface OutlineTextProjectState {
  generatorId: 'outline-text';
  text: string;
  stoneSize: StoneSizeId;
  fontId?: string;
  fontSizeMm: number;
  targetWidthMm: number | null;
  targetHeightMm: number | null;
  preserveAspectRatio: boolean;
  align: OutlineTextAlign;
  letterSpacingMm: number;
  lineSpacingMm: number;
  coverageMode?: TemplateCoverageMode;
  fillMode: TemplateFillMode;
  fillPattern: FillPattern;
  placementPattern?: FillPlacementPattern;
  contourSettings?: ContourCoverageSettings;
  radialSettings?: RadialPlacementSettings;
  densityPreset: DensityPreset;
  customSpacingMm: number;
  includeGuideBox: boolean;
  includeLabels: boolean;
  paddingMm: number;
}

export interface DotMatrixTextProjectState {
  generatorId: 'dot-matrix-text';
  text: string;
  stoneSize: StoneSizeId;
  includeGuideBox: boolean;
  includeLabels: boolean;
  paddingMm: number;
  densityPreset: DensityPreset;
  customSpacingMm: number;
  targetWidthMm: number | null;
  targetHeightMm: number | null;
  preserveAspectRatio: boolean;
  align: TextAlign;
  letterSpacingColumns: number;
  lineSpacingRows: number;
}

export interface ManualGridProjectState {
  generatorId: 'manual-grid';
  stoneSize: StoneSizeId;
  columns: number;
  rows: number;
  includeGuideBox: boolean;
  includeLabels: boolean;
  paddingMm: number;
  densityPreset: DensityPreset;
  customSpacingMm: number;
}

export interface PolylineLogoProjectState {
  generatorId: 'polyline-logo';
  shape: PolylineDemoShape;
  stoneSize: StoneSizeId;
  targetWidthMm: number | null;
  targetHeightMm: number | null;
  preserveAspectRatio: boolean;
  densityPreset: DensityPreset;
  customSpacingMm: number;
  fillMode: TemplateFillMode;
  fillPattern: FillPattern;
  includeGuideBox: boolean;
  includeLabels: boolean;
  paddingMm: number;
}

export interface SvgUploadProjectState {
  generatorId: 'svg-upload';
  /**
   * Raw uploaded SVG text — only ever passed through the safe parser, never rendered.
   * null if no SVG was uploaded when the project was saved.
   */
  uploadedSvgText: string | null;
  stoneSize: StoneSizeId;
  includeGuideBox: boolean;
  includeLabels: boolean;
  paddingMm: number;
  targetWidthMm: number | null;
  targetHeightMm: number | null;
  preserveAspectRatio: boolean;
  coverageMode?: TemplateCoverageMode;
  densityPreset: DensityPreset;
  customSpacingMm: number;
  cleanupEnabled: boolean;
  cleanupSimplify: boolean;
  cleanupSimplifyTol: number;
  cleanupRemoveTiny: boolean;
  cleanupMinLength: number;
  cleanupRemoveDups: boolean;
  cleanupDupTol: number;
  fillMode: TemplateFillMode;
  fillPattern: FillPattern;
  placementPattern?: FillPlacementPattern;
  contourSettings?: ContourCoverageSettings;
  radialSettings?: RadialPlacementSettings;
}

export interface SavedStone {
  id: string;
  x: number;
  y: number;
  stoneSize: StoneSizeId;
  holeDiameterMm: number;
}

export interface EditableTemplateState {
  /** Whether the template has been converted to editable mode */
  isEditable: true;
  /** Editable stones (may differ from original generator output) */
  stones: SavedStone[];
  /** Original generator state that created this template (for re-generation) */
  originalGeneratorState: GeneratorProjectState | null;
}

export interface ManualEditorProjectState {
  generatorId: 'manual-editor';
  /** Stones from the present template. Undo/redo history is not serialized. */
  stones: SavedStone[];
  includeGuideBox: boolean;
  paddingMm: number;
}

// ─── Discriminated union ──────────────────────────────────────────────────────

export type GeneratorProjectState =
  | OutlineTextProjectState
  | DotMatrixTextProjectState
  | ManualGridProjectState
  | PolylineLogoProjectState
  | SvgUploadProjectState
  | ManualEditorProjectState;

// ─── Project file format ──────────────────────────────────────────────────────

export interface RhinestoneProjectFile {
  schemaVersion: 1;
  /** ISO 8601 timestamp. */
  savedAt: string;
  /** Human-readable project name derived from generator content. */
  projectName: string;
  /** Export settings relevant to the current project. */
  exportSettings?: {
    includeGuideBox: boolean;
    includeLabels: boolean;
    paddingMm: number;
  };
  /** Generator configuration (always present for re-generation) */
  generatorState: GeneratorProjectState;
  /** Editable template state (present when user has made manual edits) */
  editableState?: EditableTemplateState;
  /** Active tool when saved (optional, defaults to generator's tool) */
  activeTool?: 'select' | 'text' | 'svg' | 'grid' | 'manual';
  /** Manual tool settings */
  manualToolState?: {
    snapToGrid: boolean;
    gridSnapSize: number;
    addStoneSize: StoneSizeId;
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_STONE_SIZES = new Set(['SS6', 'SS8', 'SS10', 'SS12']);
const VALID_DENSITY_PRESETS = new Set(['safe', 'standard', 'dense', 'loose', 'custom']);
const VALID_FILL_MODES = new Set(['outline', 'fill', 'outline-fill']);
const VALID_COVERAGE_MODES = new Set(['outline', 'fill', 'outline-fill', 'contour']);
const VALID_FILL_PATTERNS = new Set(['grid', 'offset-grid']);
const VALID_PLACEMENT_PATTERNS = new Set(['default', 'hexagonal', 'radial']);
const VALID_TEXT_ALIGNS = new Set(['left', 'center', 'right']);
const VALID_DEMO_SHAPES = new Set(['diamond', 'triangle', 'rectangle', 'zigzag']);
const VALID_GENERATOR_IDS = new Set([
  'outline-text',
  'dot-matrix-text',
  'manual-grid',
  'polyline-logo',
  'svg-upload',
  'manual-editor',
]);

type UnknownRecord = Record<string, unknown>;

function asRecord(v: unknown, ctx: string): UnknownRecord {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new Error(`[Project] ${ctx} must be an object`);
  }
  return v as UnknownRecord;
}

function requireString(obj: UnknownRecord, key: string, ctx: string): string {
  const v = obj[key];
  if (typeof v !== 'string') {
    throw new Error(`[Project] ${ctx}.${key} must be a string`);
  }
  return v;
}

function requireFiniteNumber(obj: UnknownRecord, key: string, ctx: string): number {
  const v = obj[key];
  if (typeof v !== 'number' || !isFinite(v)) {
    throw new Error(`[Project] ${ctx}.${key} must be a finite number`);
  }
  return v;
}

function requireBoolean(obj: UnknownRecord, key: string, ctx: string): boolean {
  const v = obj[key];
  if (typeof v !== 'boolean') {
    throw new Error(`[Project] ${ctx}.${key} must be a boolean`);
  }
  return v;
}

function requireNumberOrNull(obj: UnknownRecord, key: string, ctx: string): number | null {
  const v = obj[key];
  if (v === null) return null;
  if (typeof v !== 'number' || !isFinite(v)) {
    throw new Error(`[Project] ${ctx}.${key} must be a finite number or null`);
  }
  return v;
}

function requireEnum<T extends string>(
  obj: UnknownRecord,
  key: string,
  ctx: string,
  valid: Set<string>,
): T {
  const v = obj[key];
  if (typeof v !== 'string' || !valid.has(v)) {
    throw new Error(
      `[Project] ${ctx}.${key} must be one of: ${[...valid].join(', ')}. Got: ${String(v)}`,
    );
  }
  return v as T;
}

function parseContourSettings(value: unknown, ctx: string): ContourCoverageSettings | undefined {
  if (value === undefined) return undefined;
  const settings = asRecord(value, `${ctx}.contourSettings`);
  const direction = settings['direction'];
  if (direction !== 'inward' && direction !== 'outward' && direction !== 'centered') {
    throw new Error(`[Project] ${ctx}.contourSettings.direction must be inward, outward, or centered.`);
  }
  return {
    rowCount: requireFiniteNumber(settings, 'rowCount', `${ctx}.contourSettings`),
    rowSpacingMm: requireFiniteNumber(settings, 'rowSpacingMm', `${ctx}.contourSettings`),
    direction,
  };
}

function parseRadialSettings(value: unknown, ctx: string): RadialPlacementSettings | undefined {
  if (value === undefined) return undefined;
  const settings = asRecord(value, `${ctx}.radialSettings`);
  return {
    ringSpacingMm: requireFiniteNumber(settings, 'ringSpacingMm', `${ctx}.radialSettings`),
    centerOffsetXmm: requireFiniteNumber(settings, 'centerOffsetXmm', `${ctx}.radialSettings`),
    centerOffsetYmm: requireFiniteNumber(settings, 'centerOffsetYmm', `${ctx}.radialSettings`),
    includeCenterStone: requireBoolean(settings, 'includeCenterStone', `${ctx}.radialSettings`),
  };
}

// ─── Per-generator validators ─────────────────────────────────────────────────

function validateOutlineText(s: UnknownRecord): OutlineTextProjectState {
  const ctx = 'generatorState';
  return {
    generatorId: 'outline-text',
    text: requireString(s, 'text', ctx),
    stoneSize: requireEnum<StoneSizeId>(s, 'stoneSize', ctx, VALID_STONE_SIZES),
    fontId: typeof s.fontId === 'string' ? s.fontId : LEGACY_OUTLINE_FONT_ID,
    fontSizeMm: requireFiniteNumber(s, 'fontSizeMm', ctx),
    targetWidthMm: requireNumberOrNull(s, 'targetWidthMm', ctx),
    targetHeightMm: requireNumberOrNull(s, 'targetHeightMm', ctx),
    preserveAspectRatio: requireBoolean(s, 'preserveAspectRatio', ctx),
    align: requireEnum<OutlineTextAlign>(s, 'align', ctx, VALID_TEXT_ALIGNS),
    letterSpacingMm: requireFiniteNumber(s, 'letterSpacingMm', ctx),
    lineSpacingMm: requireFiniteNumber(s, 'lineSpacingMm', ctx),
    coverageMode: s.coverageMode === undefined ? 'outline' : requireEnum<TemplateCoverageMode>(s, 'coverageMode', ctx, VALID_COVERAGE_MODES),
    fillMode: requireEnum<TemplateFillMode>(s, 'fillMode', ctx, VALID_FILL_MODES),
    fillPattern: requireEnum<FillPattern>(s, 'fillPattern', ctx, VALID_FILL_PATTERNS),
    placementPattern: s.placementPattern === undefined ? 'default' : requireEnum<FillPlacementPattern>(s, 'placementPattern', ctx, VALID_PLACEMENT_PATTERNS),
    contourSettings: parseContourSettings(s.contourSettings, ctx),
    radialSettings: parseRadialSettings(s.radialSettings, ctx),
    densityPreset: requireEnum<DensityPreset>(s, 'densityPreset', ctx, VALID_DENSITY_PRESETS),
    customSpacingMm: requireFiniteNumber(s, 'customSpacingMm', ctx),
    includeGuideBox: requireBoolean(s, 'includeGuideBox', ctx),
    includeLabels: requireBoolean(s, 'includeLabels', ctx),
    paddingMm: requireFiniteNumber(s, 'paddingMm', ctx),
  };
}

function validateDotMatrixText(s: UnknownRecord): DotMatrixTextProjectState {
  const ctx = 'generatorState';
  return {
    generatorId: 'dot-matrix-text',
    text: requireString(s, 'text', ctx),
    stoneSize: requireEnum<StoneSizeId>(s, 'stoneSize', ctx, VALID_STONE_SIZES),
    includeGuideBox: requireBoolean(s, 'includeGuideBox', ctx),
    includeLabels: requireBoolean(s, 'includeLabels', ctx),
    paddingMm: requireFiniteNumber(s, 'paddingMm', ctx),
    densityPreset: requireEnum<DensityPreset>(s, 'densityPreset', ctx, VALID_DENSITY_PRESETS),
    customSpacingMm: requireFiniteNumber(s, 'customSpacingMm', ctx),
    targetWidthMm: requireNumberOrNull(s, 'targetWidthMm', ctx),
    targetHeightMm: requireNumberOrNull(s, 'targetHeightMm', ctx),
    preserveAspectRatio: requireBoolean(s, 'preserveAspectRatio', ctx),
    align: requireEnum<TextAlign>(s, 'align', ctx, VALID_TEXT_ALIGNS),
    letterSpacingColumns: requireFiniteNumber(s, 'letterSpacingColumns', ctx),
    lineSpacingRows: requireFiniteNumber(s, 'lineSpacingRows', ctx),
  };
}

function validateManualGrid(s: UnknownRecord): ManualGridProjectState {
  const ctx = 'generatorState';
  return {
    generatorId: 'manual-grid',
    stoneSize: requireEnum<StoneSizeId>(s, 'stoneSize', ctx, VALID_STONE_SIZES),
    columns: requireFiniteNumber(s, 'columns', ctx),
    rows: requireFiniteNumber(s, 'rows', ctx),
    includeGuideBox: requireBoolean(s, 'includeGuideBox', ctx),
    includeLabels: requireBoolean(s, 'includeLabels', ctx),
    paddingMm: requireFiniteNumber(s, 'paddingMm', ctx),
    densityPreset: requireEnum<DensityPreset>(s, 'densityPreset', ctx, VALID_DENSITY_PRESETS),
    customSpacingMm: requireFiniteNumber(s, 'customSpacingMm', ctx),
  };
}

function validatePolylineLogo(s: UnknownRecord): PolylineLogoProjectState {
  const ctx = 'generatorState';
  return {
    generatorId: 'polyline-logo',
    shape: requireEnum<PolylineDemoShape>(s, 'shape', ctx, VALID_DEMO_SHAPES),
    stoneSize: requireEnum<StoneSizeId>(s, 'stoneSize', ctx, VALID_STONE_SIZES),
    targetWidthMm: requireNumberOrNull(s, 'targetWidthMm', ctx),
    targetHeightMm: requireNumberOrNull(s, 'targetHeightMm', ctx),
    preserveAspectRatio: requireBoolean(s, 'preserveAspectRatio', ctx),
    densityPreset: requireEnum<DensityPreset>(s, 'densityPreset', ctx, VALID_DENSITY_PRESETS),
    customSpacingMm: requireFiniteNumber(s, 'customSpacingMm', ctx),
    fillMode: requireEnum<TemplateFillMode>(s, 'fillMode', ctx, VALID_FILL_MODES),
    fillPattern: requireEnum<FillPattern>(s, 'fillPattern', ctx, VALID_FILL_PATTERNS),
    includeGuideBox: requireBoolean(s, 'includeGuideBox', ctx),
    includeLabels: requireBoolean(s, 'includeLabels', ctx),
    paddingMm: requireFiniteNumber(s, 'paddingMm', ctx),
  };
}

function validateSvgUpload(s: UnknownRecord): SvgUploadProjectState {
  const ctx = 'generatorState';
  const svgText = s.uploadedSvgText;
  if (svgText !== null && typeof svgText !== 'string') {
    throw new Error('[Project] generatorState.uploadedSvgText must be a string or null');
  }
  return {
    generatorId: 'svg-upload',
    uploadedSvgText: svgText as string | null,
    stoneSize: requireEnum<StoneSizeId>(s, 'stoneSize', ctx, VALID_STONE_SIZES),
    includeGuideBox: requireBoolean(s, 'includeGuideBox', ctx),
    includeLabels: requireBoolean(s, 'includeLabels', ctx),
    paddingMm: requireFiniteNumber(s, 'paddingMm', ctx),
    targetWidthMm: requireNumberOrNull(s, 'targetWidthMm', ctx),
    targetHeightMm: requireNumberOrNull(s, 'targetHeightMm', ctx),
    preserveAspectRatio: requireBoolean(s, 'preserveAspectRatio', ctx),
    coverageMode: s.coverageMode === undefined ? 'outline' : requireEnum<TemplateCoverageMode>(s, 'coverageMode', ctx, VALID_COVERAGE_MODES),
    densityPreset: requireEnum<DensityPreset>(s, 'densityPreset', ctx, VALID_DENSITY_PRESETS),
    customSpacingMm: requireFiniteNumber(s, 'customSpacingMm', ctx),
    cleanupEnabled: requireBoolean(s, 'cleanupEnabled', ctx),
    cleanupSimplify: requireBoolean(s, 'cleanupSimplify', ctx),
    cleanupSimplifyTol: requireFiniteNumber(s, 'cleanupSimplifyTol', ctx),
    cleanupRemoveTiny: requireBoolean(s, 'cleanupRemoveTiny', ctx),
    cleanupMinLength: requireFiniteNumber(s, 'cleanupMinLength', ctx),
    cleanupRemoveDups: requireBoolean(s, 'cleanupRemoveDups', ctx),
    cleanupDupTol: requireFiniteNumber(s, 'cleanupDupTol', ctx),
    fillMode: requireEnum<TemplateFillMode>(s, 'fillMode', ctx, VALID_FILL_MODES),
    fillPattern: requireEnum<FillPattern>(s, 'fillPattern', ctx, VALID_FILL_PATTERNS),
    placementPattern: s.placementPattern === undefined ? 'default' : requireEnum<FillPlacementPattern>(s, 'placementPattern', ctx, VALID_PLACEMENT_PATTERNS),
    contourSettings: parseContourSettings(s.contourSettings, ctx),
    radialSettings: parseRadialSettings(s.radialSettings, ctx),
  };
}

function validateSavedStone(v: unknown, idx: number): SavedStone {
  const ctx = `generatorState.stones[${idx}]`;
  const s = asRecord(v, ctx);
  return {
    id: requireString(s, 'id', ctx),
    x: requireFiniteNumber(s, 'x', ctx),
    y: requireFiniteNumber(s, 'y', ctx),
    stoneSize: requireEnum<StoneSizeId>(s, 'stoneSize', ctx, VALID_STONE_SIZES),
    holeDiameterMm: requireFiniteNumber(s, 'holeDiameterMm', ctx),
  };
}

function validateManualEditor(s: UnknownRecord): ManualEditorProjectState {
  const ctx = 'generatorState';
  const stonesRaw = s.stones;
  if (!Array.isArray(stonesRaw)) {
    throw new Error('[Project] generatorState.stones must be an array');
  }
  return {
    generatorId: 'manual-editor',
    stones: stonesRaw.map((item, i) => validateSavedStone(item, i)),
    includeGuideBox: requireBoolean(s, 'includeGuideBox', ctx),
    paddingMm: requireFiniteNumber(s, 'paddingMm', ctx),
  };
}

function validateGeneratorState(raw: unknown): GeneratorProjectState {
  const s = asRecord(raw, 'generatorState');
  const gid = s.generatorId;
  if (typeof gid !== 'string' || !VALID_GENERATOR_IDS.has(gid)) {
    throw new Error(
      `[Project] generatorState.generatorId must be one of: ${[...VALID_GENERATOR_IDS].join(', ')}`,
    );
  }
  switch (gid) {
    case 'outline-text':
      return validateOutlineText(s);
    case 'dot-matrix-text':
      return validateDotMatrixText(s);
    case 'manual-grid':
      return validateManualGrid(s);
    case 'polyline-logo':
      return validatePolylineLogo(s);
    case 'svg-upload':
      return validateSvgUpload(s);
    case 'manual-editor':
      return validateManualEditor(s);
    default:
      throw new Error(`[Project] Unknown generatorId: ${String(gid)}`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parses and validates a JSON string as a RhinestoneProjectFile.
 *
 * - Throws with a human-readable message on invalid JSON, incompatible schema
 *   version, missing required fields, or invalid field values.
 * - Unknown top-level fields are silently ignored (forward-compatible).
 */
export function parseRhinestoneProject(json: string): RhinestoneProjectFile {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Invalid file — could not be parsed as JSON.');
  }

  const obj = asRecord(raw, 'project root');

  if (obj.schemaVersion !== 1) {
    throw new Error(
      `Incompatible project file (schema version ${String(obj.schemaVersion ?? 'missing')}). ` +
        `This app supports schema version 1 only.`,
    );
  }

  if (typeof obj.savedAt !== 'string') {
    throw new Error('Invalid project file — missing or invalid savedAt field.');
  }

  if (typeof obj.projectName !== 'string') {
    throw new Error('Invalid project file — missing projectName field.');
  }

  const generatorState = validateGeneratorState(obj.generatorState);
  
  // Optional editable state
  let editableState: EditableTemplateState | undefined = undefined;
  if (obj.editableState !== undefined) {
    const es = asRecord(obj.editableState, 'editableState');
    if (es.isEditable !== true) {
      throw new Error('[Project] editableState.isEditable must be true');
    }
    
    if (!Array.isArray(es.stones)) {
      throw new Error('[Project] editableState.stones must be an array');
    }
    
    const stones: SavedStone[] = es.stones.map((s: unknown, i: number) => {
      const stone = asRecord(s, `editableState.stones[${i}]`);
      return {
        id: requireString(stone, 'id', `editableState.stones[${i}]`),
        x: requireFiniteNumber(stone, 'x', `editableState.stones[${i}]`),
        y: requireFiniteNumber(stone, 'y', `editableState.stones[${i}]`),
        stoneSize: requireEnum<StoneSizeId>(stone, 'stoneSize', `editableState.stones[${i}]`, VALID_STONE_SIZES),
        holeDiameterMm: requireFiniteNumber(stone, 'holeDiameterMm', `editableState.stones[${i}]`),
      };
    });
    
    let originalGeneratorState: GeneratorProjectState | null = null;
    if (es.originalGeneratorState !== null && es.originalGeneratorState !== undefined) {
      originalGeneratorState = validateGeneratorState(es.originalGeneratorState);
    }
    
    editableState = {
      isEditable: true,
      stones,
      originalGeneratorState,
    };
  }
  
  // Optional active tool
  let activeTool: 'select' | 'text' | 'svg' | 'grid' | 'manual' | undefined = undefined;
  if (typeof obj.activeTool === 'string') {
    const validTools = new Set(['select', 'text', 'svg', 'grid', 'manual']);
    if (validTools.has(obj.activeTool)) {
      activeTool = obj.activeTool as 'select' | 'text' | 'svg' | 'grid' | 'manual';
    }
  }
  
  // Optional manual tool state
  let manualToolState: { snapToGrid: boolean; gridSnapSize: number; addStoneSize: StoneSizeId } | undefined = undefined;
  if (obj.manualToolState !== undefined) {
    const mts = asRecord(obj.manualToolState, 'manualToolState');
    manualToolState = {
      snapToGrid: requireBoolean(mts, 'snapToGrid', 'manualToolState'),
      gridSnapSize: requireFiniteNumber(mts, 'gridSnapSize', 'manualToolState'),
      addStoneSize: requireEnum<StoneSizeId>(mts, 'addStoneSize', 'manualToolState', VALID_STONE_SIZES),
    };
  }

  let exportSettings:
    | { includeGuideBox: boolean; includeLabels: boolean; paddingMm: number }
    | undefined = undefined;
  if (obj.exportSettings !== undefined) {
    const settings = asRecord(obj.exportSettings, 'exportSettings');
    exportSettings = {
      includeGuideBox: requireBoolean(settings, 'includeGuideBox', 'exportSettings'),
      includeLabels: requireBoolean(settings, 'includeLabels', 'exportSettings'),
      paddingMm: requireFiniteNumber(settings, 'paddingMm', 'exportSettings'),
    };
  }

  return {
    schemaVersion: 1,
    savedAt: obj.savedAt,
    projectName: obj.projectName,
    exportSettings,
    generatorState,
    editableState,
    activeTool,
    manualToolState,
  };
}

/**
 * Serializes a RhinestoneProjectFile to a formatted JSON string.
 */
export function serializeRhinestoneProject(project: RhinestoneProjectFile): string {
  return JSON.stringify(project, null, 2);
}
