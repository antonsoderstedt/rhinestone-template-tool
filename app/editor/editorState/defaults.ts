import { DEFAULT_SVG_ALPHABET_ID, svgStringToPolylines, calculatePolylineBounds } from '@/src/lib/rhinestone-engine/index';
import { CanvasState, ClipboardState, EditHistory, EditableTemplateState, EditorState, GridToolState, LetterStencilToolState, ManualToolState, RhinestoneFontToolState, SvgAlphabetToolState, SvgToolState, TemplateImportToolState, TextToolState } from './types';

export const DEFAULT_SVG_UPLOAD_LONGEST_SIDE_MM = 100;

export const MAX_EDITOR_PRINT_AREA_LONGEST_SIDE_MM = 280;

export function getDefaultSvgUploadTargetDimensions(
  svgText: string,
  longestSideMm: number = DEFAULT_SVG_UPLOAD_LONGEST_SIDE_MM,
): { widthMm: number; heightMm: number } {
  const targetLongestSideMm = Math.min(longestSideMm, MAX_EDITOR_PRINT_AREA_LONGEST_SIDE_MM);

  try {
    const polylines = svgStringToPolylines(svgText, { cleanup: false });
    const bounds = calculatePolylineBounds(polylines);
    const sourceWidthMm = Math.max(bounds.width, 1e-6);
    const sourceHeightMm = Math.max(bounds.height, 1e-6);

    if (sourceWidthMm >= sourceHeightMm) {
      return {
        widthMm: targetLongestSideMm,
        heightMm: Number(((sourceHeightMm / sourceWidthMm) * targetLongestSideMm).toFixed(2)),
      };
    }

    return {
      widthMm: Number(((sourceWidthMm / sourceHeightMm) * targetLongestSideMm).toFixed(2)),
      heightMm: targetLongestSideMm,
    };
  } catch {
    return {
      widthMm: targetLongestSideMm,
      heightMm: targetLongestSideMm,
    };
  }
}

// ─── Default States ───────────────────────────────────────────────────────────

export const DEFAULT_TEXT_FONT_ID = 'archivo-black';

export const DEFAULT_TEXT_TOOL_STATE: TextToolState = {
  mode: 'outline',
  outlineTextStyle: 'outline',
  // The first thing a new user sees has to look good right away: a heavy bundled font, large enough that each
  // letter gets two clean rows of stones (at 25 mm the rows touch and the letters turn to mush), on two lines so
  // it still fits a 12 x 12 in mat (about 207 x 118 mm).
  text: 'YOUR\nNAME',
  stoneSize: 'SS10',
  fontId: DEFAULT_TEXT_FONT_ID,
  unsupportedCharacters: [],
  warnings: [],
  fontSizeMm: 60,
  align: 'left',
  letterSpacingMm: 2,
  lineSpacingMm: 8,
  curveAmount: 0,
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

export const DEFAULT_SVG_TOOL_STATE: SvgToolState = {
  uploadedSvgText: null,
  svgFileName: null,
  assetKind: 'svg',
  uploadedImageDataUrl: null,
  imageFileName: null,
  renderMode: 'vector-layout',
  dimensionUnit: 'mm',
  stoneSize: 'SS10',
  targetWidthMm: 100,
  targetHeightMm: '',
  preserveAspectRatio: true,
  densityPreset: 'standard',
  customSpacingMm: 4.0,
  imageColorCount: 1,
  imageThreshold: 128,
  imageDetail: 128,
  imageInvert: false,
  cleanupEnabled: true,
  cleanupSimplify: false,
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
  layerRoles: {},
  layerStoneColours: {},
  showSourceBehind: false,
};

export const DEFAULT_GRID_TOOL_STATE: GridToolState = {
  stoneSize: 'SS10',
  columns: 5,
  rows: 3,
  densityPreset: 'standard',
  customSpacingMm: 4.0,
  mode: 'rows',
  areaWidthMm: 130,
  areaHeightMm: 140,
  areaPattern: 'hex',
  areaSeed: 1,
};

export const DEFAULT_MANUAL_TOOL_STATE: ManualToolState = {
  addStoneSize: 'SS10',
  snapToGrid: true,
  gridSnapSize: 5, // 5mm grid
  interactionMode: 'place',
  drawMode: 'freehand',
  assistBrushSizeMm: 12,
};

export const DEFAULT_RHINESTONE_FONT_TOOL_STATE: RhinestoneFontToolState = {
  text: 'Sulay',
  rhinestoneFontId: 'trw-clean-stone',
  stoneSize: 'SS10',
  letterSpacingMm: 1,
  lineSpacingMm: 0,
  presentationMode: 'stones',
  unsupportedCharacters: [],
  warnings: [],
};

export const DEFAULT_SVG_ALPHABET_TOOL_STATE: SvgAlphabetToolState = {
  text: 'SULAY',
  svgAlphabetId: DEFAULT_SVG_ALPHABET_ID,
  stoneSize: 'SS10',
  letterSpacingMm: 2,
  lineSpacingMm: 0,
  unsupportedCharacters: [],
  warnings: [],
};

export const DEFAULT_LETTER_STENCIL_TOOL_STATE: LetterStencilToolState = {
  sourceType: 'svg-alphabet',
  text: 'SULAY',
  svgAlphabetId: DEFAULT_SVG_ALPHABET_ID,
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
  realisticStones: false,
  gridSizeMm: 10,
  showRulers: false,
};

export const DEFAULT_EDITOR_STATE: EditorState = {
  projectName: 'Untitled Project',
  projectNameIsAuto: true,
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
  parts: [],
  workingOffset: { x: 0, y: 0 },
  designStoneColour: null,
  partsHistory: { past: [], future: [], lastKey: null },
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
