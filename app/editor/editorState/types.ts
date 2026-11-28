import type { AllOverPattern } from '@/src/lib/rhinestone-engine/index';
import { RhinestoneTemplate, StoneSizeId, DensityPreset, TemplateFillMode, TemplateCoverageMode, FillPattern, FillPlacementPattern, RadialPlacementSettings, ContourCoverageSettings, TextAlign as OutlineTextAlign, Stone, type GeneratorId } from '@/src/lib/rhinestone-engine/index';
import type { WorkspaceSettings } from '../../lib/workspaceSettings';
import { type PartAlign, type DesignPart, type PartTransform } from '../designParts';

export type EditorTool =
  | 'select'          // Select and move stones
  | 'text'            // Text (outline or dot-matrix)
  | 'svg'             // SVG import
  | 'grid'            // Grid generator
  | 'rhinestone-font' // Rhinestone font text
  | 'svg-alphabet'    // Compose text from a per-letter SVG alphabet
  | 'letter-stencil'  // Reusable per-letter stencil cards
  | 'template-import' // Import pre-placed stones from SVG
  | 'manual';         // Add individual stones

// ─── Text Tool State ──────────────────────────────────────────────────────────

export type TextMode = 'outline' | 'dot-matrix';

export type OutlineTextStyle = 'outline' | 'filled-typography';

export interface TextToolState {
  mode: TextMode;
  outlineTextStyle: OutlineTextStyle;
  text: string;
  stoneSize: StoneSizeId;
  fontId: string;
  unsupportedCharacters: string[];
  warnings: string[];

  // Outline-specific
  fontSizeMm: number | '';
  align: OutlineTextAlign;
  letterSpacingMm: number | '';
  lineSpacingMm: number | '';
  curveAmount: number;

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

export type SvgAssetKind = 'svg' | 'image';

export type SvgRenderMode = 'vector-layout' | 'artwork-dots';

export type SvgDimensionUnit = 'mm' | 'in';

export interface SvgToolState {
  /** Longest side (mm) an uploaded SVG is scaled to; falls back to DEFAULT_SVG_UPLOAD_LONGEST_SIDE_MM. */
  uploadLongestSideMm?: number;
  uploadedSvgText: string | null;
  svgFileName: string | null;
  assetKind: SvgAssetKind;
  uploadedImageDataUrl: string | null;
  imageFileName: string | null;
  renderMode: SvgRenderMode;
  dimensionUnit: SvgDimensionUnit;
  stoneSize: StoneSizeId;
  targetWidthMm: number | '';
  targetHeightMm: number | '';
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
  /** Colours (`#rrggbb`) the user turned on or off, overriding what the importer decided (e.g. a white background). */
  layerRoles: Record<string, 'stones' | 'ignore'>;
  /** The colour the stones of each artwork colour are (`#rrggbb`); absent = the artwork's own colour. */
  layerStoneColours: Record<string, string>;
  /** Show the artwork as drawn, faintly, behind the stones. A view setting: not part of the design, not saved. */
  showSourceBehind: boolean;
}

// ─── Grid Tool State ──────────────────────────────────────────────────────────

export type GridToolMode = 'rows' | 'area';

export interface GridToolState {
  stoneSize: StoneSizeId;
  columns: number;
  rows: number;
  densityPreset: DensityPreset;
  customSpacingMm: number | '';
  /** `rows`: a block of rows and columns. `area`: cover a whole area (jeans, a pocket) in a pattern. */
  mode: GridToolMode;
  areaWidthMm: number | '';
  areaHeightMm: number | '';
  areaPattern: AllOverPattern;
  /** Which "random" the scatter pattern uses. */
  areaSeed: number;
}

// ─── Manual Tool State ────────────────────────────────────────────────────────

export type ManualInteractionMode = 'place' | 'erase';

export type ManualDrawMode = 'freehand' | 'grid' | 'row';

export interface ManualToolState {
  addStoneSize: StoneSizeId;
  snapToGrid: boolean;
  gridSnapSize: number; // mm
  interactionMode: ManualInteractionMode;
  drawMode: ManualDrawMode;
  assistBrushSizeMm: number;
}

// ─── Rhinestone Font Tool State ───────────────────────────────────────────────

export type RhinestoneFontPresentationMode = 'stones' | 'line' | 'digits';

export interface RhinestoneFontToolState {
  text: string;
  rhinestoneFontId: string;
  stoneSize: StoneSizeId;
  letterSpacingMm: number | '';
  lineSpacingMm: number | '';
  presentationMode: RhinestoneFontPresentationMode;
  unsupportedCharacters: string[];
  warnings: string[];
}

export interface SvgAlphabetToolState {
  text: string;
  svgAlphabetId: string;
  stoneSize: StoneSizeId;
  letterSpacingMm: number | '';
  lineSpacingMm: number | '';
  unsupportedCharacters: string[];
  warnings: string[];
}

export type LetterStencilSourceType = 'svg-alphabet' | 'rhinestone-font';

export type LetterStencilLayoutMode = 'preview' | 'cut-sheet';

export interface LetterStencilToolState {
  sourceType: LetterStencilSourceType;
  text: string;
  svgAlphabetId: string;
  rhinestoneFontId: string;
  stoneSize: StoneSizeId;
  cardPaddingMm: number | '';
  cardCornerRadiusMm: number | '';
  minCardWidthMm: number | '';
  layoutMode: LetterStencilLayoutMode;
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
  /** Draw the stones as shiny stones instead of flat holes. A view setting. */
  realisticStones: boolean;
  gridSizeMm: number;         // mm per grid square
  showRulers: boolean;
}

// ─── Global Editor State ──────────────────────────────────────────────────────

export interface EditorState {
  // Project
  projectName: string;
  /** True while the name was made from the text, so changing the text renames the design. Typing a name turns it off. */
  projectNameIsAuto: boolean;
  
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

  // Pieces kept with "Add to design", and where the piece being worked on sits.
  parts: DesignPart[];
  workingOffset: { x: number; y: number };
  /** One colour for every stone that has none of its own; null = no colour (the plain purple). */
  designStoneColour: string | null;
  /** Undo and redo for changes to the parts (adding, moving, turning, removing). */
  partsHistory: { past: DesignPart[][]; future: DesignPart[][]; lastKey: string | null };
  
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

export type EditorAction =
  | { type: 'SET_ACTIVE_TOOL'; tool: EditorTool }
  | { type: 'SET_PROJECT_NAME'; name: string; auto?: boolean }
  | { type: 'UPDATE_TEXT_TOOL'; updates: Partial<TextToolState> }
  | { type: 'UPDATE_SVG_TOOL'; updates: Partial<SvgToolState> }
  | { type: 'UPDATE_GRID_TOOL'; updates: Partial<GridToolState> }
  | { type: 'UPDATE_MANUAL_TOOL'; updates: Partial<ManualToolState> }
  | { type: 'UPDATE_RHINESTONE_FONT_TOOL'; updates: Partial<RhinestoneFontToolState> }
  | { type: 'UPDATE_SVG_ALPHABET_TOOL'; updates: Partial<SvgAlphabetToolState> }
  | { type: 'UPDATE_LETTER_STENCIL_TOOL'; updates: Partial<LetterStencilToolState> }
  | { type: 'UPDATE_TEMPLATE_IMPORT_TOOL'; updates: Partial<TemplateImportToolState> }
  | { type: 'SET_TEMPLATE'; template: RhinestoneTemplate | null }
  | { type: 'ADD_PART'; part: DesignPart }
  | { type: 'REMOVE_PART'; id: string }
  | { type: 'UPDATE_PART'; id: string; updates: Partial<Pick<DesignPart, 'name' | 'offsetX' | 'offsetY'>> }
  | { type: 'SET_WORKING_OFFSET'; x: number; y: number }
  | { type: 'SET_PARTS'; parts: DesignPart[]; workingOffset: { x: number; y: number } }
  | { type: 'TRANSFORM_PART'; id: string; op: PartTransform }
  | { type: 'DUPLICATE_PART'; id: string }
  | { type: 'ALIGN_PART'; id: string; align: PartAlign }
  | { type: 'ALIGN_WORKING'; align: PartAlign }
  | { type: 'TURN_PART_BY'; id: string; degrees: number }
  | { type: 'SPREAD_PART'; id: string; factor: number }
  /** Takes a kept part back into the piece being worked on, to edit its stones. Only when there is no piece now. */
  | { type: 'EDIT_PART'; id: string }
  | { type: 'SET_DESIGN_STONE_COLOUR'; colour: string | null }
  | { type: 'SET_STONES_COLOUR'; ids: string[]; colour: string | null }
  | { type: 'END_PARTS_STEP' }
  | { type: 'UNDO_PARTS' }
  | { type: 'REDO_PARTS' }
  | { type: 'UPDATE_CANVAS'; updates: Partial<CanvasState> }
  | { type: 'UPDATE_EXPORT_SETTINGS'; updates: { includeGuideBox?: boolean; includeLabels?: boolean; paddingMm?: number } }
  | { type: 'SET_SELECTED_STONES'; ids: Set<string> }
  | { type: 'CONVERT_TO_EDITABLE' } // Convert current template to editable mode
  | { type: 'RESTORE_EDITABLE'; stones: EditableStone[]; sourceGenerator: GeneratorId | null } // Restore editable state from saved project
  | { type: 'DISCARD_EDITABLE_CHANGES' }
  | { type: 'ADD_STONES'; stones: EditableStone[] }
  | { type: 'DELETE_STONES'; stoneIds: string[] }
  /** Replaces every stone at once (auto-fix). Converts a generated design to editable first. One undo step. */
  | { type: 'REPLACE_STONES'; stones: EditableStone[] }
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
  | { type: 'APPLY_WORKSPACE_DEFAULTS'; settings: WorkspaceSettings } // new-project defaults from Settings; keeps everything else
  | { type: 'RESET_EDITOR' };

// ─── Reducer ──────────────────────────────────────────────────────────────────
