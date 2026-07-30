import type {
  DotMatrixTextProjectState,
  GeneratorId,
  GeneratorProjectState,
  ManualGridProjectState,
  ManualEditorProjectState,
  OutlineTextProjectState,
  RhinestoneProjectFile,
  SvgUploadProjectState,
} from '@/src/lib/rhinestone-engine/index';
import type { RhinestoneTemplate } from '@/src/lib/rhinestone-engine/index';
import type { EditableStone, EditorState } from './EditorState';

function toSavedStones(stones: readonly EditableStone[]) {
  return stones.map((stone) => ({
    id: stone.id,
    x: stone.center.x,
    y: stone.center.y,
    stoneSize: stone.stoneSize,
    holeDiameterMm: stone.holeDiameterMm,
  }));
}

export function buildEffectiveTemplate(state: Pick<EditorState, 'editableTemplate' | 'template' | 'projectName'>): RhinestoneTemplate | null {
  if (!state.editableTemplate.isEditable) {
    return state.template;
  }

  const baseTemplate = state.editableTemplate.originalTemplate ?? state.template ?? {
    id: 'editable-template',
    name: state.projectName,
    unit: 'mm' as const,
    stones: [],
  };

  return {
    ...baseTemplate,
    name: state.projectName,
    stones: state.editableTemplate.stones.map((stone) => ({ ...stone })),
  };
}

export function getEditableSourceGenerator(state: Pick<EditorState, 'activeTool' | 'textTool' | 'editableTemplate'>): GeneratorId | null {
  if (state.editableTemplate.isEditable && state.editableTemplate.sourceGenerator) {
    return state.editableTemplate.sourceGenerator;
  }

  switch (state.activeTool) {
    case 'grid':
      return 'manual-grid';
    case 'text':
      return state.textTool.mode === 'outline' ? 'outline-text' : 'dot-matrix-text';
    case 'svg':
      return 'svg-upload';
    case 'manual':
      return 'manual-editor';
    default:
      return null;
  }
}

export function buildGeneratorStateFromEditorState(state: EditorState): GeneratorProjectState | null {
  const sourceGenerator = getEditableSourceGenerator(state);

  switch (sourceGenerator) {
    case 'manual-grid':
      return {
        generatorId: 'manual-grid',
        stoneSize: state.gridTool.stoneSize,
        columns: state.gridTool.columns,
        rows: state.gridTool.rows,
        includeGuideBox: state.includeGuideBox,
        includeLabels: state.includeLabels,
        paddingMm: state.paddingMm,
        densityPreset: state.gridTool.densityPreset,
        customSpacingMm: typeof state.gridTool.customSpacingMm === 'number' ? state.gridTool.customSpacingMm : 4.0,
      } satisfies ManualGridProjectState;
    case 'outline-text':
      return {
        generatorId: 'outline-text',
        text: state.textTool.text,
        stoneSize: state.textTool.stoneSize,
        fontId: state.textTool.fontId,
        fontSizeMm: typeof state.textTool.fontSizeMm === 'number' ? state.textTool.fontSizeMm : 25,
        targetWidthMm: typeof state.textTool.targetWidthMm === 'number' ? state.textTool.targetWidthMm : null,
        targetHeightMm: typeof state.textTool.targetHeightMm === 'number' ? state.textTool.targetHeightMm : null,
        preserveAspectRatio: state.textTool.preserveAspectRatio,
        align: state.textTool.align,
        letterSpacingMm: typeof state.textTool.letterSpacingMm === 'number' ? state.textTool.letterSpacingMm : 0,
        lineSpacingMm: typeof state.textTool.lineSpacingMm === 'number' ? state.textTool.lineSpacingMm : 10,
        fillMode: state.textTool.fillMode,
        fillPattern: state.textTool.fillPattern,
        densityPreset: state.textTool.densityPreset,
        customSpacingMm: typeof state.textTool.customSpacingMm === 'number' ? state.textTool.customSpacingMm : 4.0,
        includeGuideBox: state.includeGuideBox,
        includeLabels: state.includeLabels,
        paddingMm: state.paddingMm,
      } satisfies OutlineTextProjectState;
    case 'dot-matrix-text':
      return {
        generatorId: 'dot-matrix-text',
        text: state.textTool.text,
        stoneSize: state.textTool.stoneSize,
        includeGuideBox: state.includeGuideBox,
        includeLabels: state.includeLabels,
        paddingMm: state.paddingMm,
        densityPreset: state.textTool.densityPreset,
        customSpacingMm: typeof state.textTool.customSpacingMm === 'number' ? state.textTool.customSpacingMm : 4.0,
        targetWidthMm: typeof state.textTool.targetWidthMm === 'number' ? state.textTool.targetWidthMm : null,
        targetHeightMm: typeof state.textTool.targetHeightMm === 'number' ? state.textTool.targetHeightMm : null,
        preserveAspectRatio: state.textTool.preserveAspectRatio,
        align: 'left',
        letterSpacingColumns: state.textTool.letterSpacingColumns,
        lineSpacingRows: state.textTool.lineSpacingRows,
      } satisfies DotMatrixTextProjectState;
    case 'svg-upload':
      if (!state.svgTool.uploadedSvgText) {
        return null;
      }
      return {
        generatorId: 'svg-upload',
        uploadedSvgText: state.svgTool.uploadedSvgText,
        stoneSize: state.svgTool.stoneSize,
        targetWidthMm: typeof state.svgTool.targetWidthMm === 'number' ? state.svgTool.targetWidthMm : null,
        targetHeightMm: typeof state.svgTool.targetHeightMm === 'number' ? state.svgTool.targetHeightMm : null,
        preserveAspectRatio: state.svgTool.preserveAspectRatio,
        fillMode: state.svgTool.fillMode,
        fillPattern: state.svgTool.fillPattern,
        densityPreset: state.svgTool.densityPreset,
        customSpacingMm: typeof state.svgTool.customSpacingMm === 'number' ? state.svgTool.customSpacingMm : 4.0,
        cleanupEnabled: state.svgTool.cleanupEnabled,
        cleanupSimplify: state.svgTool.cleanupSimplify,
        cleanupSimplifyTol: state.svgTool.cleanupSimplifyTol,
        cleanupRemoveTiny: state.svgTool.cleanupRemoveTiny,
        cleanupMinLength: state.svgTool.cleanupMinLength,
        cleanupRemoveDups: state.svgTool.cleanupRemoveDups,
        cleanupDupTol: state.svgTool.cleanupDupTol,
        includeGuideBox: state.includeGuideBox,
        includeLabels: state.includeLabels,
        paddingMm: state.paddingMm,
      } satisfies SvgUploadProjectState;
    case 'manual-editor':
      return {
        generatorId: 'manual-editor',
        stones: toSavedStones(state.editableTemplate.isEditable ? state.editableTemplate.stones : []),
        includeGuideBox: state.includeGuideBox,
        paddingMm: state.paddingMm,
      } satisfies ManualEditorProjectState;
    default:
      return null;
  }
}

export function buildProjectFileFromEditorState(state: EditorState): RhinestoneProjectFile | null {
  const generatorState = buildGeneratorStateFromEditorState(state);
  if (!generatorState) {
    return null;
  }

  return {
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    projectName: state.projectName,
    exportSettings: {
      includeGuideBox: state.includeGuideBox,
      includeLabels: state.includeLabels,
      paddingMm: state.paddingMm,
    },
    generatorState,
    editableState: state.editableTemplate.isEditable
      ? {
          isEditable: true,
          stones: toSavedStones(state.editableTemplate.stones),
          originalGeneratorState: generatorState.generatorId === 'manual-editor' ? null : generatorState,
        }
      : undefined,
    activeTool: state.activeTool,
    manualToolState: {
      snapToGrid: state.manualTool.snapToGrid,
      gridSnapSize: state.manualTool.gridSnapSize,
      addStoneSize: state.manualTool.addStoneSize,
    },
  };
}

export function savedStoneToEditableStone(stone: { id: string; x: number; y: number; stoneSize: EditableStone['stoneSize']; holeDiameterMm: number }): EditableStone {
  return {
    id: stone.id,
    center: { x: stone.x, y: stone.y },
    stoneSize: stone.stoneSize,
    holeDiameterMm: stone.holeDiameterMm,
  };
}
