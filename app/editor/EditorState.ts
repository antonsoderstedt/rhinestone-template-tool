/**
 * Centralized editor state management
 * 
 * This replaces the scattered useState hooks across separate generators
 * with a unified state model for the entire editor.
 */

import {
  RhinestoneTemplate,
  StoneSizeId,
  Unit,
  DensityPreset,
  TemplateFillMode,
  TemplateCoverageMode,
  FillPattern,
  FillPlacementPattern,
  RadialPlacementSettings,
  ContourCoverageSettings,
  TextAlign as OutlineTextAlign,
  Stone,
  type GeneratorId,
  LEGACY_OUTLINE_FONT_ID,
  getRhinestoneFontDefinition,
  getRhinestoneFontStyle,
  getPreferredRhinestoneFontStoneSize,
  getSupportedRhinestoneFontStoneSizes,
  getPreferredTextCoverageMode,
  getSupportedTextCoverageModes,
  suggestSvgUploadMode,
} from '@/src/lib/rhinestone-engine/index';
import { wouldCollide, wouldMoveCauseCollision } from './collisionDetection';

// ─── Tool Types ───────────────────────────────────────────────────────────────

export type EditorTool =
  | 'select'       // Select and move stones
  | 'text'         // Text (outline or dot-matrix)
  | 'svg'          // SVG import
  | 'grid'         // Grid generator
  | 'rhinestone-font'  // Rhinestone font text
  | 'svg-alphabet'     // SVG alphabet text (per-letter curated glyphs)
  | 'letter-stencil'   // Reusable per-letter stencil cards
  | 'template-import'  // Import pre-placed stones from SVG
  | 'manual';      // Add individual stones

// ─── Text Tool State ──────────────────────────────────────────────────────────

export type TextMode = 'outline' | 'dot-matrix';
export type OutlineTextStyle = 'outline' | 'filled-typography';

export interface TextToolState {
  mode: TextMode;
  outlineTextStyle: OutlineTextStyle;
  text: string;
  stoneSize: StoneSizeId;
  fontId: string;
  
  // Outline-specific
  fontSizeMm: number | '';
  align: OutlineTextAlign;
  letterSpacingMm: number | '';
  lineSpacingMm: number | '';
  
  // Dot-matrix-specific
  letterSpacingColumns: number;
  lineSpacingRows: number;
  
  // Shared
  targetWidthMm: number | '';
  targetHeightMm: number | '';
  preserveAspectRatio: boolean;
  coverageMode: TemplateCoverageMode;
  fillMode: TemplateFillMode;
  fillPattern: FillPattern;
  placementPattern: FillPlacementPattern;
  contourSettings: ContourCoverageSettings;
  radialSettings: RadialPlacementSettings;
  densityPreset: DensityPreset;
  customSpacingMm: number | '';
}

// ─── SVG Tool State ───────────────────────────────────────────────────────────

export type SvgRenderMode = 'vector-layout' | 'artwork-dots';

export interface SvgToolState {
  assetKind: 'svg' | 'image';
  uploadedSvgText: string | null;
  svgFileName: string | null;
  uploadedImageDataUrl: string | null;
  imageFileName: string | null;
  renderMode: SvgRenderMode;
  stoneSize: StoneSizeId;
  targetWidthMm: number | '';
  targetHeightMm: number | '';
  dimensionUnit: Unit;
  preserveAspectRatio: boolean;
  densityPreset: DensityPreset;
  customSpacingMm: number | '';
  imageColorCount: 1 | 2 | 3 | 4;
  imageThreshold: number;
  imageDetail: number;
  imageInvert: boolean;
  
  // Cleanup
  cleanupEnabled: boolean;
  cleanupSimplify: boolean;
  cleanupSimplifyTol: number;
  cleanupRemoveTiny: boolean;
  cleanupMinLength: number;
  cleanupRemoveDups: boolean;
  cleanupDupTol: number;
  
  coverageMode: TemplateCoverageMode;
  fillMode: TemplateFillMode;
  fillPattern: FillPattern;
  placementPattern: FillPlacementPattern;
  contourSettings: ContourCoverageSettings;
  radialSettings: RadialPlacementSettings;
}

// ─── Grid Tool State ──────────────────────────────────────────────────────────

export interface GridToolState {
  stoneSize: StoneSizeId;
  columns: number;
  rows: number;
  densityPreset: DensityPreset;
  customSpacingMm: number | '';
}

// ─── Manual Tool State ────────────────────────────────────────────────────────

export interface ManualToolState {
  addStoneSize: StoneSizeId;
  interactionMode: 'place' | 'erase';
  assistBrushSizeMm: number;
  snapToGrid: boolean;
  gridSnapSize: number; // mm
}

// ─── Rhinestone Font Tool State ───────────────────────────────────────────────

export interface RhinestoneFontToolState {
  presentationMode: 'stones' | 'line' | 'digits';
  text: string;
  rhinestoneFontId: string;
  stoneSize: StoneSizeId;
  letterSpacingMm: number | '';
  lineSpacingMm: number | '';
  unsupportedCharacters: string[];
  warnings: string[];
}

// ─── SVG Alphabet Tool State ──────────────────────────────────────────────────

export interface SvgAlphabetToolState {
  text: string;
  svgAlphabetId: string;
  stoneSize: StoneSizeId;
  letterSpacingMm: number | '';
  lineSpacingMm: number | '';
  unsupportedCharacters: string[];
  warnings: string[];
}

// ─── Letter Stencil Tool State ────────────────────────────────────────────────

export interface LetterStencilToolState {
  sourceType: 'svg-alphabet' | 'rhinestone-font';
  text: string;
  svgAlphabetId: string;
  rhinestoneFontId: string;
  stoneSize: StoneSizeId;
  cardPaddingMm: number | '';
  cardCornerRadiusMm: number | '';
  minCardWidthMm: number | '';
  layoutMode: 'preview' | 'cut-sheet';
  cutSheetGapMm: number | '';
  unsupportedCharacters: string[];
  warnings: string[];
}

// ─── Template Import Tool State ───────────────────────────────────────────────

export interface TemplateImportToolState {
  uploadedSvgText: string | null;
  svgFileName: string | null;
  pendingSvgText: string | null;
  pendingFileName: string | null;
  defaultStoneSize: StoneSizeId;
  detectedDiameters: number[];
  detectedColors: string[];
  ignoredElements: number;
  warnings: string[];
  importSummary: string | null;
  importError: string | null;
}

// ─── Editable Template State ──────────────────────────────────────────────────

// EditableStone is the same as Stone - they're already editable by nature
export type EditableStone = Stone;

export interface EditableTemplateState {
  isEditable: boolean;
  stones: EditableStone[];
  originalTemplate: RhinestoneTemplate | null; // For reference
  sourceGenerator: GeneratorId | null;
}

export interface HistoryEntry {
  stones: EditableStone[];
  selectedIds: Set<string>;
}

export interface EditHistory {
  past: HistoryEntry[];
  future: HistoryEntry[];
}

export interface ClipboardState {
  stones: EditableStone[];
}

// ─── Canvas State ─────────────────────────────────────────────────────────────

export interface CanvasState {
  zoom: number;               // 1.0 = 100%
  panX: number;               // px offset
  panY: number;               // px offset
  showGrid: boolean;
  gridSizeMm: number;         // mm per grid square
  showRulers: boolean;
}

// ─── Global Editor State ──────────────────────────────────────────────────────

export interface EditorState {
  // Project
  projectName: string;
  
  // Active tool & tool states
  activeTool: EditorTool;
  textTool: TextToolState;
  svgTool: SvgToolState;
  gridTool: GridToolState;
  manualTool: ManualToolState;
  rhinestoneFontTool: RhinestoneFontToolState;
  svgAlphabetTool: SvgAlphabetToolState;
  letterStencilTool: LetterStencilToolState;
  templateImportTool: TemplateImportToolState;
  
  // Current template (result of active tool)
  template: RhinestoneTemplate | null;
  
  // Editable template (when in manual/select mode)
  editableTemplate: EditableTemplateState;
  
  // Canvas
  canvas: CanvasState;
  
  // Export settings (global)
  includeGuideBox: boolean;
  includeLabels: boolean;
  paddingMm: number;
  
  // Selection (for select tool)
  
  // Clipboard (for copy/paste)
  clipboard: ClipboardState;
  selectedStoneIds: Set<string>;
  
  // History (for undo/redo)
  history: EditHistory;
}

// ─── Default States ───────────────────────────────────────────────────────────

export const DEFAULT_TEXT_TOOL_STATE: TextToolState = {
  mode: 'outline',
  outlineTextStyle: 'outline',
  text: 'SMOOCH',
  stoneSize: 'SS10',
  fontId: LEGACY_OUTLINE_FONT_ID,
  fontSizeMm: 25,
  align: 'left',
  letterSpacingMm: 2,
  lineSpacingMm: 8,
  letterSpacingColumns: 1,
  lineSpacingRows: 1,
  targetWidthMm: '',
  targetHeightMm: '',
  preserveAspectRatio: true,
  coverageMode: 'outline',
  fillMode: 'outline',
  fillPattern: 'offset-grid',
  placementPattern: 'default',
  contourSettings: {
    rowCount: 3,
    rowSpacingMm: 4,
    direction: 'inward',
  },
  radialSettings: {
    ringSpacingMm: 4,
    centerOffsetXmm: 0,
    centerOffsetYmm: 0,
    includeCenterStone: true,
  },
  densityPreset: 'standard',
  customSpacingMm: 4.0,
};

function preferredTextCoverageForFont(fontId: string): TemplateFillMode {
  return getPreferredTextCoverageMode(fontId);
}

function inferOutlineTextStyle(coverageMode: TemplateCoverageMode, fillMode: TemplateFillMode): OutlineTextStyle {
  if (coverageMode === 'fill' || coverageMode === 'outline-fill' || fillMode === 'fill' || fillMode === 'outline-fill') {
    return 'filled-typography';
  }
  return 'outline';
}

function clampTextCoverageForFont(next: TextToolState): void {
  const supportedCoverageModes = getSupportedTextCoverageModes(next.fontId);
  const preferredMode = preferredTextCoverageForFont(next.fontId);

  if (!supportedCoverageModes.includes(next.coverageMode)) {
    next.coverageMode = preferredMode;
  }

  if (next.coverageMode === 'contour') {
    if (!supportedCoverageModes.includes(next.fillMode)) {
      next.fillMode = preferredMode;
    }
    return;
  }

  next.fillMode = next.coverageMode;
  next.outlineTextStyle = inferOutlineTextStyle(next.coverageMode, next.fillMode);
}

function normalizeTextToolUpdate(current: TextToolState, updates: Partial<TextToolState>): TextToolState {
  const next: TextToolState = { ...current, ...updates };
  const styleChanged = updates.outlineTextStyle !== undefined;
  const changesFontOnly =
    updates.fontId !== undefined &&
    updates.outlineTextStyle === undefined &&
    updates.coverageMode === undefined &&
    updates.fillMode === undefined;

  if (styleChanged && next.mode === 'outline') {
    const desiredMode = next.outlineTextStyle === 'filled-typography' ? 'outline-fill' : 'outline';
    next.coverageMode = desiredMode;
    next.fillMode = desiredMode;
  }

  if (changesFontOnly) {
    const preferredMode = preferredTextCoverageForFont(next.fontId);
    next.coverageMode = preferredMode;
    next.fillMode = preferredMode;
  } else if (updates.coverageMode !== undefined && updates.coverageMode !== 'contour' && updates.fillMode === undefined) {
    next.fillMode = updates.coverageMode;
  } else if (updates.fillMode !== undefined && updates.coverageMode === undefined) {
    next.coverageMode = updates.fillMode;
  }

  clampTextCoverageForFont(next);

  return next;
}

function normalizeSvgToolUpdate(current: SvgToolState, updates: Partial<SvgToolState>): SvgToolState {
  const next: SvgToolState = { ...current, ...updates };
  const usingDefaultSize = current.targetWidthMm === 100 && current.targetHeightMm === '';

  if (typeof updates.uploadedImageDataUrl === 'string') {
    next.assetKind = 'image';
    next.uploadedSvgText = null;
    next.svgFileName = null;
    next.renderMode = 'artwork-dots';
    next.coverageMode = 'fill';
    next.fillMode = 'fill';
    next.placementPattern = 'hexagonal';
    if (updates.targetWidthMm === undefined && usingDefaultSize) {
      next.targetWidthMm = 203.2;
    }
  }

  if (typeof updates.uploadedSvgText === 'string' && updates.coverageMode === undefined && updates.fillMode === undefined) {
    next.assetKind = 'svg';
    next.uploadedImageDataUrl = null;
    next.imageFileName = null;
    const suggestedMode = suggestSvgUploadMode(updates.uploadedSvgText);
    if (suggestedMode === 'outline-fill') {
      next.renderMode = 'artwork-dots';
      next.coverageMode = 'fill';
      next.fillMode = 'fill';
      next.placementPattern = 'hexagonal';
      next.densityPreset = 'dense';
      if (updates.targetWidthMm === undefined && usingDefaultSize) {
        next.targetWidthMm = 280;
      }
    } else {
      next.renderMode = 'vector-layout';
      next.coverageMode = 'outline';
      next.fillMode = 'outline';
      next.placementPattern = 'default';
    }
  }

  if (updates.renderMode === 'artwork-dots') {
    if (updates.coverageMode === undefined) next.coverageMode = 'fill';
    if (updates.fillMode === undefined) next.fillMode = 'fill';
    if (updates.placementPattern === undefined) next.placementPattern = 'hexagonal';
    if (updates.densityPreset === undefined && current.densityPreset === 'standard') {
      next.densityPreset = 'dense';
    }
    if (updates.targetWidthMm === undefined && usingDefaultSize) {
      next.targetWidthMm = 280;
    }
  } else if (updates.renderMode === 'vector-layout') {
    if (updates.coverageMode === undefined && updates.fillMode === undefined) {
      next.coverageMode = 'outline-fill';
      next.fillMode = 'outline-fill';
    }
    if (updates.placementPattern === undefined) next.placementPattern = 'default';
  }

  if (updates.coverageMode !== undefined && updates.coverageMode !== 'contour' && updates.fillMode === undefined) {
    next.fillMode = updates.coverageMode;
  } else if (updates.fillMode !== undefined && updates.coverageMode === undefined) {
    next.coverageMode = updates.fillMode;
  }

  return next;
}

function getDefaultRhinestoneFontSpacing(presentationMode: RhinestoneFontToolState['presentationMode']): {
  letterSpacingMm: number;
  lineSpacingMm: number;
} {
  if (presentationMode === 'line' || presentationMode === 'digits') {
    return { letterSpacingMm: 0, lineSpacingMm: 0 };
  }

  return { letterSpacingMm: 1, lineSpacingMm: 0 };
}

function normalizeRhinestoneFontToolUpdate(
  current: RhinestoneFontToolState,
  updates: Partial<RhinestoneFontToolState>,
): RhinestoneFontToolState {
  const next: RhinestoneFontToolState = { ...current, ...updates };
  const fontChanged = updates.rhinestoneFontId !== undefined && updates.rhinestoneFontId !== current.rhinestoneFontId;

  if (fontChanged && updates.text === undefined) {
    const previousDefinition = getRhinestoneFontDefinition(current.rhinestoneFontId as never);
    const nextDefinition = getRhinestoneFontDefinition(next.rhinestoneFontId as never);
    const currentText = current.text.trim();
    if (currentText.length === 0 || current.text === previousDefinition.suggestedText) {
      next.text = nextDefinition.suggestedText;
    }
  }

  const supportedSizes = getSupportedRhinestoneFontStoneSizes(next.rhinestoneFontId);
  if (!supportedSizes.includes(next.stoneSize)) {
    next.stoneSize = getPreferredRhinestoneFontStoneSize(next.rhinestoneFontId);
  }
  const fontStyle = getRhinestoneFontStyle(next.rhinestoneFontId);
  next.presentationMode = fontStyle === 'Line'
    ? 'line'
    : fontStyle === 'Digits'
      ? 'digits'
      : 'stones';

  if (fontChanged && updates.letterSpacingMm === undefined && updates.lineSpacingMm === undefined) {
    const previousDefaults = getDefaultRhinestoneFontSpacing(current.presentationMode);
    const currentLetterSpacing = typeof current.letterSpacingMm === 'number' ? current.letterSpacingMm : previousDefaults.letterSpacingMm;
    const currentLineSpacing = typeof current.lineSpacingMm === 'number' ? current.lineSpacingMm : previousDefaults.lineSpacingMm;

    if (
      currentLetterSpacing === previousDefaults.letterSpacingMm &&
      currentLineSpacing === previousDefaults.lineSpacingMm
    ) {
      const nextDefaults = getDefaultRhinestoneFontSpacing(next.presentationMode);
      next.letterSpacingMm = nextDefaults.letterSpacingMm;
      next.lineSpacingMm = nextDefaults.lineSpacingMm;
    }
  }

  return next;
}

export const DEFAULT_SVG_TOOL_STATE: SvgToolState = {
  assetKind: 'svg',
  uploadedSvgText: null,
  svgFileName: null,
  uploadedImageDataUrl: null,
  imageFileName: null,
  renderMode: 'vector-layout',
  stoneSize: 'SS10',
  targetWidthMm: 100,
  targetHeightMm: '',
  dimensionUnit: 'mm',
  preserveAspectRatio: true,
  densityPreset: 'standard',
  customSpacingMm: 4.0,
  imageColorCount: 1,
  imageThreshold: 128,
  imageDetail: 128,
  imageInvert: false,
  cleanupEnabled: true,
  cleanupSimplify: true,
  cleanupSimplifyTol: 0.25,
  cleanupRemoveTiny: true,
  cleanupMinLength: 1,
  cleanupRemoveDups: true,
  cleanupDupTol: 0.05,
  coverageMode: 'outline',
  fillMode: 'outline',
  fillPattern: 'offset-grid',
  placementPattern: 'default',
  contourSettings: {
    rowCount: 3,
    rowSpacingMm: 4,
    direction: 'inward',
  },
  radialSettings: {
    ringSpacingMm: 4,
    centerOffsetXmm: 0,
    centerOffsetYmm: 0,
    includeCenterStone: true,
  },
};

export const DEFAULT_GRID_TOOL_STATE: GridToolState = {
  stoneSize: 'SS10',
  columns: 5,
  rows: 3,
  densityPreset: 'standard',
  customSpacingMm: 4.0,
};

export const DEFAULT_MANUAL_TOOL_STATE: ManualToolState = {
  addStoneSize: 'SS10',
  interactionMode: 'place',
  assistBrushSizeMm: 12,
  snapToGrid: false,
  gridSnapSize: 2,
};

export const DEFAULT_RHINESTONE_FONT_TOOL_STATE: RhinestoneFontToolState = {
  presentationMode: 'stones',
  text: 'Sulay',
  rhinestoneFontId: 'trw-clean-stone',
  stoneSize: 'SS10',
  letterSpacingMm: 1,
  lineSpacingMm: 0,
  unsupportedCharacters: [],
  warnings: [],
};

export const DEFAULT_SVG_ALPHABET_TOOL_STATE: SvgAlphabetToolState = {
  text: 'SCORE 2026',
  svgAlphabetId: 'scoreboard-block',
  stoneSize: 'SS10',
  letterSpacingMm: 2,
  lineSpacingMm: 0,
  unsupportedCharacters: [],
  warnings: [],
};

export const DEFAULT_LETTER_STENCIL_TOOL_STATE: LetterStencilToolState = {
  sourceType: 'svg-alphabet',
  text: 'NAME',
  svgAlphabetId: 'scoreboard-block',
  rhinestoneFontId: 'trw-clean-stone',
  stoneSize: 'SS10',
  cardPaddingMm: 3,
  cardCornerRadiusMm: 2,
  minCardWidthMm: 12,
  layoutMode: 'cut-sheet',
  cutSheetGapMm: 3,
  unsupportedCharacters: [],
  warnings: [],
};

export const DEFAULT_TEMPLATE_IMPORT_TOOL_STATE: TemplateImportToolState = {
  uploadedSvgText: null,
  svgFileName: null,
  pendingSvgText: null,
  pendingFileName: null,
  defaultStoneSize: 'SS10',
  detectedDiameters: [],
  detectedColors: [],
  ignoredElements: 0,
  warnings: [],
  importSummary: null,
  importError: null,
};

export const DEFAULT_EDITABLE_TEMPLATE_STATE: EditableTemplateState = {
  isEditable: false,
  stones: [],
  originalTemplate: null,
  sourceGenerator: null,
};

export const DEFAULT_CLIPBOARD: ClipboardState = {
  stones: [],
};

export const DEFAULT_HISTORY: EditHistory = {
  past: [],
  future: [],
};

export const DEFAULT_CANVAS_STATE: CanvasState = {
  zoom: 1.0,
  panX: 0,
  panY: 0,
  showGrid: true,
  gridSizeMm: 10,
  showRulers: true,
};

export const DEFAULT_EDITOR_STATE: EditorState = {
  projectName: 'Untitled Project',
  activeTool: 'text',
  textTool: { ...DEFAULT_TEXT_TOOL_STATE },
  clipboard: { ...DEFAULT_CLIPBOARD },
  svgTool: { ...DEFAULT_SVG_TOOL_STATE },
  gridTool: { ...DEFAULT_GRID_TOOL_STATE },
  manualTool: { ...DEFAULT_MANUAL_TOOL_STATE },
  rhinestoneFontTool: { ...DEFAULT_RHINESTONE_FONT_TOOL_STATE },
  svgAlphabetTool: { ...DEFAULT_SVG_ALPHABET_TOOL_STATE },
  letterStencilTool: { ...DEFAULT_LETTER_STENCIL_TOOL_STATE },
  templateImportTool: { ...DEFAULT_TEMPLATE_IMPORT_TOOL_STATE },
  template: null,
  editableTemplate: { ...DEFAULT_EDITABLE_TEMPLATE_STATE },
  canvas: { ...DEFAULT_CANVAS_STATE },
  includeGuideBox: true,
  includeLabels: false,
  paddingMm: 5,
  selectedStoneIds: new Set(),
  history: { ...DEFAULT_HISTORY },
};

// ─── Action Types ─────────────────────────────────────────────────────────────

export type EditorAction =
  | { type: 'SET_ACTIVE_TOOL'; tool: EditorTool }
  | { type: 'SET_PROJECT_NAME'; name: string }
  | { type: 'UPDATE_TEXT_TOOL'; updates: Partial<TextToolState> }
  | { type: 'UPDATE_SVG_TOOL'; updates: Partial<SvgToolState> }
  | { type: 'UPDATE_GRID_TOOL'; updates: Partial<GridToolState> }
  | { type: 'UPDATE_MANUAL_TOOL'; updates: Partial<ManualToolState> }
  | { type: 'UPDATE_RHINESTONE_FONT_TOOL'; updates: Partial<RhinestoneFontToolState> }
  | { type: 'UPDATE_SVG_ALPHABET_TOOL'; updates: Partial<SvgAlphabetToolState> }
  | { type: 'UPDATE_LETTER_STENCIL_TOOL'; updates: Partial<LetterStencilToolState> }
  | { type: 'UPDATE_TEMPLATE_IMPORT_TOOL'; updates: Partial<TemplateImportToolState> }
  | { type: 'SET_TEMPLATE'; template: RhinestoneTemplate | null }
  | { type: 'UPDATE_CANVAS'; updates: Partial<CanvasState> }
  | { type: 'UPDATE_EXPORT_SETTINGS'; updates: { includeGuideBox?: boolean; includeLabels?: boolean; paddingMm?: number } }
  | { type: 'SET_SELECTED_STONES'; ids: Set<string> }
  | { type: 'CONVERT_TO_EDITABLE' } // Convert current template to editable mode
  | { type: 'RESTORE_EDITABLE'; stones: EditableStone[]; sourceGenerator: GeneratorId | null } // Restore editable state from saved project
  | { type: 'DISCARD_EDITABLE_CHANGES' }
  | { type: 'ADD_STONES'; stones: EditableStone[] }
  | { type: 'DELETE_STONES'; stoneIds: string[] }
  | { type: 'MOVE_STONES'; moves: Array<{ id: string; toX: number; toY: number }> }
  | { type: 'UPDATE_STONE'; id: string; updates: Partial<EditableStone> }
  | { type: 'DUPLICATE_STONES'; stoneIds: string[] }
  | { type: 'COPY_STONES'; stoneIds: string[] }
  | { type: 'PASTE_STONES' }
  | { type: 'ALIGN_STONES'; stoneIds: string[]; direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' }
  | { type: 'DISTRIBUTE_STONES'; stoneIds: string[]; direction: 'horizontal' | 'vertical' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'LOAD_PROJECT_STATE'; state: Partial<EditorState> }
  | { type: 'RESET_EDITOR' };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function inferEditableSourceGenerator(state: EditorState): GeneratorId | null {
  switch (state.activeTool) {
    case 'grid':
      return 'manual-grid';
    case 'text':
      return state.textTool.mode === 'outline' ? 'outline-text' : 'dot-matrix-text';
    case 'svg':
      return 'svg-upload';
    case 'rhinestone-font':
      return state.rhinestoneFontTool.presentationMode === 'line'
        ? 'rhinestone-font-line'
        : state.rhinestoneFontTool.presentationMode === 'digits'
          ? 'rhinestone-font-digits'
          : 'rhinestone-font';
    case 'svg-alphabet':
      return 'svg-alphabet';
    case 'letter-stencil':
      return 'letter-stencil';
    case 'template-import':
      return 'template-import';
    case 'manual':
      return 'manual-editor';
    default:
      return state.editableTemplate.sourceGenerator;
  }
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'SET_ACTIVE_TOOL':
      if (action.tool === 'manual' && state.activeTool !== 'manual') {
        const looksLikeOldCoarseSnapDefault = state.manualTool.snapToGrid && state.manualTool.gridSnapSize === 5;
        return {
          ...state,
          activeTool: action.tool,
          manualTool: looksLikeOldCoarseSnapDefault
            ? { ...state.manualTool, snapToGrid: false, gridSnapSize: 2 }
            : state.manualTool,
        };
      }
      return { ...state, activeTool: action.tool };
    
    case 'SET_PROJECT_NAME':
      return { ...state, projectName: action.name };
    
    case 'UPDATE_TEXT_TOOL':
      return { ...state, textTool: normalizeTextToolUpdate(state.textTool, action.updates) };
    
    case 'UPDATE_SVG_TOOL':
      return { ...state, svgTool: normalizeSvgToolUpdate(state.svgTool, action.updates) };
    
    case 'UPDATE_GRID_TOOL':
      return { ...state, gridTool: { ...state.gridTool, ...action.updates } };
    
    case 'UPDATE_MANUAL_TOOL':
      return { ...state, manualTool: { ...state.manualTool, ...action.updates } };
    
    case 'UPDATE_RHINESTONE_FONT_TOOL':
      return { ...state, rhinestoneFontTool: normalizeRhinestoneFontToolUpdate(state.rhinestoneFontTool, action.updates) };

    case 'UPDATE_SVG_ALPHABET_TOOL':
      return { ...state, svgAlphabetTool: { ...state.svgAlphabetTool, ...action.updates } };

    case 'UPDATE_LETTER_STENCIL_TOOL':
      return { ...state, letterStencilTool: { ...state.letterStencilTool, ...action.updates } };
    
    case 'UPDATE_TEMPLATE_IMPORT_TOOL':
      return { ...state, templateImportTool: { ...state.templateImportTool, ...action.updates } };
    
    case 'SET_TEMPLATE':
      return { ...state, template: action.template };
    
    case 'UPDATE_CANVAS':
      return { ...state, canvas: { ...state.canvas, ...action.updates } };
    
    case 'UPDATE_EXPORT_SETTINGS':
      return { ...state, ...action.updates };
    
    case 'SET_SELECTED_STONES':
      return { ...state, selectedStoneIds: action.ids };
    
    case 'CONVERT_TO_EDITABLE': {
      if (!state.template) return state;
      
      // Save current state to history before converting
      const historyEntry: HistoryEntry = {
        stones: state.editableTemplate.stones,
        selectedIds: new Set(state.selectedStoneIds),
      };
      
      return {
        ...state,
        editableTemplate: {
          isEditable: true,
          stones: state.template.stones.map(s => ({ ...s })),
          originalTemplate: state.template,
          sourceGenerator: inferEditableSourceGenerator(state),
        },
        history: {
          past: [...state.history.past, historyEntry],
          future: [],
        },
      };
    }
    
    case 'RESTORE_EDITABLE': {
      // Restore editable state from saved project (don't create history)
      return {
        ...state,
        editableTemplate: {
          isEditable: true,
          stones: action.stones,
          originalTemplate: state.template,
          sourceGenerator: action.sourceGenerator,
        },
        selectedStoneIds: new Set(),
        history: {
          past: [],
          future: [],
        },
      };
    }

    case 'DISCARD_EDITABLE_CHANGES': {
      return {
        ...state,
        editableTemplate: {
          isEditable: false,
          stones: [],
          originalTemplate: null,
          sourceGenerator: null,
        },
        selectedStoneIds: new Set(),
        history: {
          past: [],
          future: [],
        },
      };
    }
    
    case 'ADD_STONES': {
      if (!state.editableTemplate.isEditable) return state;

      const prospectiveStones = [...state.editableTemplate.stones];
      for (const stone of action.stones) {
        const collision = wouldCollide(
          stone.center.x,
          stone.center.y,
          stone.holeDiameterMm / 2,
          prospectiveStones,
        );
        if (collision.collides) {
          return state;
        }
        prospectiveStones.push(stone);
      }
      
      const historyEntry: HistoryEntry = {
        stones: state.editableTemplate.stones,
        selectedIds: new Set(state.selectedStoneIds),
      };
      
      return {
        ...state,
        editableTemplate: {
          ...state.editableTemplate,
          stones: [...state.editableTemplate.stones, ...action.stones],
        },
        history: {
          past: [...state.history.past, historyEntry],
          future: [],
        },
      };
    }
    
    case 'DELETE_STONES': {
      if (!state.editableTemplate.isEditable) return state;
      
      const deleteIds = new Set(action.stoneIds);
      const historyEntry: HistoryEntry = {
        stones: state.editableTemplate.stones,
        selectedIds: new Set(state.selectedStoneIds),
      };
      
      return {
        ...state,
        editableTemplate: {
          ...state.editableTemplate,
          stones: state.editableTemplate.stones.filter(s => !deleteIds.has(s.id)),
        },
        selectedStoneIds: new Set(
          [...state.selectedStoneIds].filter(id => !deleteIds.has(id))
        ),
        history: {
          past: [...state.history.past, historyEntry],
          future: [],
        },
      };
    }
    
    case 'MOVE_STONES': {
      if (!state.editableTemplate.isEditable) return state;

      if (action.moves.every((move) => {
        const currentStone = state.editableTemplate.stones.find((stone) => stone.id === move.id);
        return currentStone && currentStone.center.x === move.toX && currentStone.center.y === move.toY;
      })) {
        return state;
      }

      const moveCollision = wouldMoveCauseCollision(action.moves, state.editableTemplate.stones);
      if (moveCollision.collides) return state;
      
      const moveMap = new Map(action.moves.map(m => [m.id, { x: m.toX, y: m.toY }]));
      const historyEntry: HistoryEntry = {
        stones: state.editableTemplate.stones,
        selectedIds: new Set(state.selectedStoneIds),
      };
      
      return {
        ...state,
        editableTemplate: {
          ...state.editableTemplate,
          stones: state.editableTemplate.stones.map(stone => {
            const newPos = moveMap.get(stone.id);
            return newPos ? { ...stone, center: { x: newPos.x, y: newPos.y } } : stone;
          }),
        },
        history: {
          past: [...state.history.past, historyEntry],
          future: [],
        },
      };
    }
    
    case 'UPDATE_STONE': {
      if (!state.editableTemplate.isEditable) return state;

      const currentStone = state.editableTemplate.stones.find((stone) => stone.id === action.id);
      if (!currentStone) return state;

      const nextStone = { ...currentStone, ...action.updates };
      if ('center' in action.updates || 'holeDiameterMm' in action.updates) {
        const collision = wouldCollide(
          nextStone.center.x,
          nextStone.center.y,
          nextStone.holeDiameterMm / 2,
          state.editableTemplate.stones,
          [action.id],
        );
        if (collision.collides) return state;
      }
      
      const historyEntry: HistoryEntry = {
        stones: state.editableTemplate.stones,
        selectedIds: new Set(state.selectedStoneIds),
      };
      
      return {
        ...state,
        editableTemplate: {
          ...state.editableTemplate,
          stones: state.editableTemplate.stones.map(stone =>
            stone.id === action.id ? { ...stone, ...action.updates } : stone
          ),
        },
        history: {
          past: [...state.history.past, historyEntry],
          future: [],
        },
      };
    }
    
    case 'UNDO': {
      if (state.history.past.length === 0) return state;
      
      const lastEntry = state.history.past[state.history.past.length - 1];
      
      return {
        ...state,
        editableTemplate: {
          ...state.editableTemplate,
          stones: lastEntry.stones,
        },
        selectedStoneIds: lastEntry.selectedIds,
        history: {
          past: state.history.past.slice(0, -1),
          future: [
            {
              stones: state.editableTemplate.stones,
              selectedIds: new Set(state.selectedStoneIds),
            },
            ...state.history.future,
          ],
        },
      };
    }
    
    case 'REDO': {
      if (state.history.future.length === 0) return state;
      
      const nextEntry = state.history.future[0];
      
      return {
        ...state,
        editableTemplate: {
          ...state.editableTemplate,
          stones: nextEntry.stones,
        },
        selectedStoneIds: nextEntry.selectedIds,
        history: {
          past: [
            ...state.history.past,
            {
              stones: state.editableTemplate.stones,
              selectedIds: new Set(state.selectedStoneIds),
            },
          ],
          future: state.history.future.slice(1),
        },
      };
    }
    
    case 'DUPLICATE_STONES': {
      if (!state.editableTemplate.isEditable) return state;
      if (action.stoneIds.length === 0) return state;
      
      const historyEntry: HistoryEntry = {
        stones: state.editableTemplate.stones,
        selectedIds: new Set(state.selectedStoneIds),
      };
      
      // Duplicate selected stones with offset
      const stonesToDuplicate = state.editableTemplate.stones.filter(s => action.stoneIds.includes(s.id));
      const duplicatedStones = stonesToDuplicate.map(stone => ({
        ...stone,
        id: `stone-${Date.now()}-${Math.random()}`,
        center: { x: stone.center.x + 5, y: stone.center.y + 5 }, // 5mm offset
      }));
      
      const newSelectedIds = new Set(duplicatedStones.map(s => s.id));
      
      return {
        ...state,
        editableTemplate: {
          ...state.editableTemplate,
          stones: [...state.editableTemplate.stones, ...duplicatedStones],
        },
        selectedStoneIds: newSelectedIds,
        history: {
          past: [...state.history.past, historyEntry],
          future: [],
        },
      };
    }
    
    case 'COPY_STONES': {
      if (!state.editableTemplate.isEditable) return state;
      if (action.stoneIds.length === 0) return state;
      
      const stonesToCopy = state.editableTemplate.stones.filter(s => action.stoneIds.includes(s.id));
      
      return {
        ...state,
        clipboard: {
          stones: stonesToCopy.map(s => ({ ...s })),
        },
      };
    }
    
    case 'PASTE_STONES': {
      if (!state.editableTemplate.isEditable) return state;
      if (state.clipboard.stones.length === 0) return state;
      
      const historyEntry: HistoryEntry = {
        stones: state.editableTemplate.stones,
        selectedIds: new Set(state.selectedStoneIds),
      };
      
      // Paste with offset
      const pastedStones = state.clipboard.stones.map(stone => ({
        ...stone,
        id: `stone-${Date.now()}-${Math.random()}`,
        center: { x: stone.center.x + 10, y: stone.center.y + 10 }, // 10mm offset
      }));
      
      const newSelectedIds = new Set(pastedStones.map(s => s.id));
      
      return {
        ...state,
        editableTemplate: {
          ...state.editableTemplate,
          stones: [...state.editableTemplate.stones, ...pastedStones],
        },
        selectedStoneIds: newSelectedIds,
        history: {
          past: [...state.history.past, historyEntry],
          future: [],
        },
      };
    }
    
    case 'ALIGN_STONES': {
      if (!state.editableTemplate.isEditable) return state;
      if (action.stoneIds.length < 2) return state;
      
      const historyEntry: HistoryEntry = {
        stones: state.editableTemplate.stones,
        selectedIds: new Set(state.selectedStoneIds),
      };
      
      const selectedStones = state.editableTemplate.stones.filter(s => action.stoneIds.includes(s.id));
      
      // Calculate alignment target
      let alignValue = 0;
      if (action.direction === 'left') {
        alignValue = Math.min(...selectedStones.map(s => s.center.x));
      } else if (action.direction === 'right') {
        alignValue = Math.max(...selectedStones.map(s => s.center.x));
      } else if (action.direction === 'center') {
        const minX = Math.min(...selectedStones.map(s => s.center.x));
        const maxX = Math.max(...selectedStones.map(s => s.center.x));
        alignValue = (minX + maxX) / 2;
      } else if (action.direction === 'top') {
        alignValue = Math.min(...selectedStones.map(s => s.center.y));
      } else if (action.direction === 'bottom') {
        alignValue = Math.max(...selectedStones.map(s => s.center.y));
      } else if (action.direction === 'middle') {
        const minY = Math.min(...selectedStones.map(s => s.center.y));
        const maxY = Math.max(...selectedStones.map(s => s.center.y));
        alignValue = (minY + maxY) / 2;
      }
      
      const selectedIds = new Set(action.stoneIds);
      const alignedStones = state.editableTemplate.stones.map(stone => {
        if (!selectedIds.has(stone.id)) return stone;
        
        if (action.direction === 'left' || action.direction === 'center' || action.direction === 'right') {
          return { ...stone, center: { ...stone.center, x: alignValue } };
        } else {
          return { ...stone, center: { ...stone.center, y: alignValue } };
        }
      });
      
      return {
        ...state,
        editableTemplate: {
          ...state.editableTemplate,
          stones: alignedStones,
        },
        history: {
          past: [...state.history.past, historyEntry],
          future: [],
        },
      };
    }
    
    case 'DISTRIBUTE_STONES': {
      if (!state.editableTemplate.isEditable) return state;
      if (action.stoneIds.length < 3) return state;
      
      const historyEntry: HistoryEntry = {
        stones: state.editableTemplate.stones,
        selectedIds: new Set(state.selectedStoneIds),
      };
      
      const selectedStones = state.editableTemplate.stones.filter(s => action.stoneIds.includes(s.id));
      
      // Sort stones by position
      const sortedStones = [...selectedStones].sort((a, b) => {
        if (action.direction === 'horizontal') {
          return a.center.x - b.center.x;
        } else {
          return a.center.y - b.center.y;
        }
      });
      
      // Calculate spacing
      const first = sortedStones[0];
      const last = sortedStones[sortedStones.length - 1];
      const totalDistance = action.direction === 'horizontal'
        ? last.center.x - first.center.x
        : last.center.y - first.center.y;
      const spacing = totalDistance / (sortedStones.length - 1);
      
      // Create map of new positions
      const positionMap = new Map<string, { x: number; y: number }>();
      sortedStones.forEach((stone, index) => {
        if (index === 0 || index === sortedStones.length - 1) {
          // Keep first and last in place
          positionMap.set(stone.id, { x: stone.center.x, y: stone.center.y });
        } else {
          if (action.direction === 'horizontal') {
            positionMap.set(stone.id, {
              x: first.center.x + spacing * index,
              y: stone.center.y,
            });
          } else {
            positionMap.set(stone.id, {
              x: stone.center.x,
              y: first.center.y + spacing * index,
            });
          }
        }
      });
      
      const distributedStones = state.editableTemplate.stones.map(stone => {
        const newPos = positionMap.get(stone.id);
        return newPos ? { ...stone, center: newPos } : stone;
      });
      
      return {
        ...state,
        editableTemplate: {
          ...state.editableTemplate,
          stones: distributedStones,
        },
        history: {
          past: [...state.history.past, historyEntry],
          future: [],
        },
      };
    }
    
    case 'LOAD_PROJECT_STATE':
      return { ...state, ...action.state };
    
    case 'RESET_EDITOR':
      return { ...DEFAULT_EDITOR_STATE };
    
    default:
      return state;
  }
}
