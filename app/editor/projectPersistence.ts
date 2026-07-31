import type {
  DotMatrixTextProjectState,
  GeneratorId,
  GeneratorProjectState,
  ManualGridProjectState,
  ManualEditorProjectState,
  OutlineTextProjectState,
  RhinestoneFontProjectState,
  RhinestoneProjectFile,
  SvgAlphabetProjectState,
  LetterStencilProjectState,
  SvgUploadProjectState,
  TemplateImportProjectState,
} from '@/src/lib/rhinestone-engine/index';
import { TRW_STONE_SIZE_CALIBRATION } from '@/src/lib/rhinestone-engine/index';
import type { RhinestoneTemplate } from '@/src/lib/rhinestone-engine/index';
import type { EditableStone, EditorState } from './EditorState';

function toSavedStones(stones: readonly EditableStone[]) {
  return stones.map((stone) => {
    const saved = {
      id: stone.id,
      x: stone.center.x,
      y: stone.center.y,
      stoneSize: stone.stoneSize,
      holeDiameterMm: stone.holeDiameterMm,
      color: typeof stone.metadata?.fill === 'string'
        ? stone.metadata.fill
        : typeof stone.metadata?.stroke === 'string'
          ? stone.metadata.stroke
          : undefined,
      group: typeof stone.metadata?.group === 'string' ? stone.metadata.group : undefined,
    };
    return saved;
  });
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
    case 'rhinestone-font':
      return state.editableTemplate.isEditable && state.editableTemplate.sourceGenerator
        ? state.editableTemplate.sourceGenerator
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
        outlineTextStyle: state.textTool.outlineTextStyle,
        fontId: state.textTool.fontId,
        fontSizeMm: typeof state.textTool.fontSizeMm === 'number' ? state.textTool.fontSizeMm : 25,
        targetWidthMm: typeof state.textTool.targetWidthMm === 'number' ? state.textTool.targetWidthMm : null,
        targetHeightMm: typeof state.textTool.targetHeightMm === 'number' ? state.textTool.targetHeightMm : null,
        preserveAspectRatio: state.textTool.preserveAspectRatio,
        align: state.textTool.align,
        letterSpacingMm: typeof state.textTool.letterSpacingMm === 'number' ? state.textTool.letterSpacingMm : 0,
        lineSpacingMm: typeof state.textTool.lineSpacingMm === 'number' ? state.textTool.lineSpacingMm : 10,
        coverageMode: state.textTool.coverageMode,
        fillMode: state.textTool.fillMode,
        fillPattern: state.textTool.fillPattern,
        placementPattern: state.textTool.placementPattern,
        contourSettings: state.textTool.contourSettings,
        radialSettings: state.textTool.radialSettings,
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
        coverageMode: state.svgTool.coverageMode,
        fillMode: state.svgTool.fillMode,
        fillPattern: state.svgTool.fillPattern,
        placementPattern: state.svgTool.placementPattern,
        contourSettings: state.svgTool.contourSettings,
        radialSettings: state.svgTool.radialSettings,
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
    case 'rhinestone-font': {
      const calibration = TRW_STONE_SIZE_CALIBRATION[
        state.rhinestoneFontTool.stoneSize as keyof typeof TRW_STONE_SIZE_CALIBRATION
      ];
      if (!calibration) return null;
      return {
        generatorId: state.rhinestoneFontTool.presentationMode === 'line'
          ? 'rhinestone-font-line'
          : state.rhinestoneFontTool.presentationMode === 'digits'
            ? 'rhinestone-font-digits'
            : 'rhinestone-font',
        presentationMode: state.rhinestoneFontTool.presentationMode,
        text: state.rhinestoneFontTool.text,
        stoneSize: state.rhinestoneFontTool.stoneSize,
        rhinestoneFontId: state.rhinestoneFontTool.rhinestoneFontId,
        targetStoneSizeMm: calibration.diameterMm,
        letterSpacingMm: typeof state.rhinestoneFontTool.letterSpacingMm === 'number' ? state.rhinestoneFontTool.letterSpacingMm : 0,
        lineSpacingMm: typeof state.rhinestoneFontTool.lineSpacingMm === 'number' ? state.rhinestoneFontTool.lineSpacingMm : 0,
        includeGuideBox: state.includeGuideBox,
        includeLabels: state.includeLabels,
        paddingMm: state.paddingMm,
      } satisfies RhinestoneFontProjectState;
    }
    case 'template-import':
      if (!state.templateImportTool.uploadedSvgText) return null;
      return {
        generatorId: 'template-import',
        uploadedSvgText: state.templateImportTool.uploadedSvgText,
        svgFileName: state.templateImportTool.svgFileName,
        defaultStoneSize: state.templateImportTool.defaultStoneSize,
        importMetadata: {
          detectedDiameters: [...state.templateImportTool.detectedDiameters],
          detectedColors: [...state.templateImportTool.detectedColors],
          ignoredElements: state.templateImportTool.ignoredElements,
          originalStoneCount: state.template?.stones.length ?? state.editableTemplate.stones.length,
        },
        includeGuideBox: state.includeGuideBox,
        includeLabels: state.includeLabels,
        paddingMm: state.paddingMm,
      } satisfies TemplateImportProjectState;
    case 'svg-alphabet': {
      const calibration = TRW_STONE_SIZE_CALIBRATION[
        state.svgAlphabetTool.stoneSize as keyof typeof TRW_STONE_SIZE_CALIBRATION
      ];
      if (!calibration) return null;
      return {
        generatorId: 'svg-alphabet',
        text: state.svgAlphabetTool.text,
        svgAlphabetId: state.svgAlphabetTool.svgAlphabetId,
        stoneSize: state.svgAlphabetTool.stoneSize,
        targetStoneSizeMm: calibration.diameterMm,
        letterSpacingMm: typeof state.svgAlphabetTool.letterSpacingMm === 'number' ? state.svgAlphabetTool.letterSpacingMm : 2,
        lineSpacingMm: typeof state.svgAlphabetTool.lineSpacingMm === 'number' ? state.svgAlphabetTool.lineSpacingMm : 0,
        includeGuideBox: state.includeGuideBox,
        includeLabels: state.includeLabels,
        paddingMm: state.paddingMm,
      } satisfies SvgAlphabetProjectState;
    }
    case 'letter-stencil': {
      const calibration = TRW_STONE_SIZE_CALIBRATION[
        state.letterStencilTool.stoneSize as keyof typeof TRW_STONE_SIZE_CALIBRATION
      ];
      if (!calibration) return null;
      return {
        generatorId: 'letter-stencil',
        text: state.letterStencilTool.text,
        svgAlphabetId: state.letterStencilTool.svgAlphabetId,
        stoneSize: state.letterStencilTool.stoneSize,
        targetStoneSizeMm: calibration.diameterMm,
        cardPaddingMm: typeof state.letterStencilTool.cardPaddingMm === 'number' ? state.letterStencilTool.cardPaddingMm : 3,
        cardCornerRadiusMm: typeof state.letterStencilTool.cardCornerRadiusMm === 'number' ? state.letterStencilTool.cardCornerRadiusMm : 2,
        minCardWidthMm: typeof state.letterStencilTool.minCardWidthMm === 'number' ? state.letterStencilTool.minCardWidthMm : 12,
        layoutMode: state.letterStencilTool.layoutMode,
        cutSheetGapMm: typeof state.letterStencilTool.cutSheetGapMm === 'number' ? state.letterStencilTool.cutSheetGapMm : 3,
        includeGuideBox: state.includeGuideBox,
        includeLabels: state.includeLabels,
        paddingMm: state.paddingMm,
      } satisfies LetterStencilProjectState;
    }
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

export function savedStoneToEditableStone(stone: { id: string; x: number; y: number; stoneSize: EditableStone['stoneSize']; holeDiameterMm: number; color?: string; group?: string }): EditableStone {
  const metadata: NonNullable<EditableStone['metadata']> = {};
  if (stone.color) metadata.fill = stone.color;
  if (stone.group) metadata.group = stone.group;
  return {
    id: stone.id,
    center: { x: stone.x, y: stone.y },
    stoneSize: stone.stoneSize,
    holeDiameterMm: stone.holeDiameterMm,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
}
