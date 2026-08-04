import { describe, expect, it } from 'vitest';
import {
  createBasicSvgExport,
  createDotMatrixTextTemplate,
  createOutlineTextTemplate,
  createPolylineFilledRhinestoneTemplate,
  createStoneGridTemplate,
  LEGACY_OUTLINE_FONT_ID,
  parseRhinestoneProject,
  scalePolylinesToFit,
  serializeRhinestoneProject,
  svgStringToPolylines,
  type GeneratorProjectState,
} from '../src/lib/rhinestone-engine/index';
import {
  DEFAULT_EDITOR_STATE,
  editorReducer,
  type EditableStone,
  type EditorState,
} from '../app/editor/EditorState';
import {
  buildEffectiveTemplate,
  buildProjectFileFromEditorState,
  savedStoneToEditableStone,
} from '../app/editor/projectPersistence';

function normalizeEditableStones(stones: readonly EditableStone[]) {
  return stones.map((stone) => ({
    id: stone.id,
    x: stone.center.x,
    y: stone.center.y,
    holeDiameterMm: stone.holeDiameterMm,
    stoneSize: stone.stoneSize,
  }));
}

function cloneState(): EditorState {
  return structuredClone(DEFAULT_EDITOR_STATE);
}

function addEditableMutations(state: EditorState): EditorState {
  const original = state.editableTemplate.stones[0]!;
  state = editorReducer(state, {
    type: 'MOVE_STONES',
    moves: [{ id: original.id, toX: original.center.x + 12, toY: original.center.y + 7 }],
  });
  state = editorReducer(state, {
    type: 'ADD_STONES',
    stones: [
      {
        id: 'manual-added',
        center: { x: 200, y: 200 },
        holeDiameterMm: 3,
        stoneSize: 'SS10',
      },
    ],
  });
  const deleteId = state.editableTemplate.stones[1]?.id;
  if (deleteId) {
    state = editorReducer(state, { type: 'DELETE_STONES', stoneIds: [deleteId] });
  }
  state = editorReducer(state, { type: 'SET_SELECTED_STONES', ids: new Set(['manual-added']) });
  return state;
}

function generateTemplateFromGeneratorState(generatorState: GeneratorProjectState) {
  switch (generatorState.generatorId) {
    case 'manual-grid':
      return createStoneGridTemplate({
        id: 'grid-preview',
        name: 'Grid Preview',
        stoneSize: generatorState.stoneSize,
        columns: generatorState.columns,
        rows: generatorState.rows,
        densityPreset: generatorState.densityPreset,
        customSpacingMm: generatorState.customSpacingMm,
      });
    case 'outline-text':
      return createOutlineTextTemplate({
        id: 'text-outline-preview',
        name: 'Outline Preview',
        text: generatorState.text,
        stoneSize: generatorState.stoneSize,
        fontId: generatorState.fontId,
        fontSizeMm: generatorState.fontSizeMm,
        align: generatorState.align,
        letterSpacingMm: generatorState.letterSpacingMm,
        lineSpacingMm: generatorState.lineSpacingMm,
        targetWidthMm: generatorState.targetWidthMm ?? undefined,
        targetHeightMm: generatorState.targetHeightMm ?? undefined,
        preserveAspectRatio: generatorState.preserveAspectRatio,
        densityPreset: generatorState.densityPreset,
        customSpacingMm: generatorState.customSpacingMm,
        fillMode: generatorState.fillMode,
        fillPattern: generatorState.fillPattern,
      });
    case 'dot-matrix-text':
      return createDotMatrixTextTemplate({
        id: 'text-dotmatrix-preview',
        name: 'Dot Preview',
        text: generatorState.text,
        stoneSize: generatorState.stoneSize,
        letterSpacingColumns: generatorState.letterSpacingColumns,
        lineSpacingRows: generatorState.lineSpacingRows,
        targetWidthMm: generatorState.targetWidthMm ?? undefined,
        targetHeightMm: generatorState.targetHeightMm ?? undefined,
        preserveAspectRatio: generatorState.preserveAspectRatio,
        densityPreset: generatorState.densityPreset,
        customSpacingMm: generatorState.customSpacingMm,
      });
    case 'svg-upload': {
      const polylines = svgStringToPolylines(generatorState.uploadedSvgText ?? '', {
        cleanupOptions: generatorState.cleanupEnabled
          ? {
              simplify: generatorState.cleanupSimplify,
              simplifyToleranceMm: generatorState.cleanupSimplifyTol,
              removeTinyPolylines: generatorState.cleanupRemoveTiny,
              minPolylineLengthMm: generatorState.cleanupMinLength,
              removeDuplicatePoints: generatorState.cleanupRemoveDups,
              duplicatePointToleranceMm: generatorState.cleanupDupTol,
            }
          : undefined,
      });
      const scaledPolylines =
        (generatorState.targetWidthMm !== null || generatorState.targetHeightMm !== null) && polylines.length > 0
          ? scalePolylinesToFit(polylines, {
              targetWidthMm: generatorState.targetWidthMm ?? undefined,
              targetHeightMm: generatorState.targetHeightMm ?? undefined,
              preserveAspectRatio: generatorState.preserveAspectRatio,
            })
          : polylines;
      return createPolylineFilledRhinestoneTemplate({
        id: 'svg-preview',
        name: 'SVG Preview',
        polylines: scaledPolylines,
        stoneSize: generatorState.stoneSize,
        fillMode: generatorState.fillMode,
        fillPattern: generatorState.fillPattern,
        densityPreset: generatorState.densityPreset,
        customSpacingMm: generatorState.customSpacingMm,
      });
    }
    case 'manual-editor':
      return null;
  }
}

function restoreStateFromProject(projectJson: string): EditorState {
  const project = parseRhinestoneProject(projectJson);
  let restored = cloneState();
  restored = editorReducer(restored, { type: 'SET_PROJECT_NAME', name: project.projectName });

  if (project.exportSettings) {
    restored = editorReducer(restored, {
      type: 'UPDATE_EXPORT_SETTINGS',
      updates: project.exportSettings,
    });
  }

  switch (project.generatorState.generatorId) {
    case 'manual-grid':
      restored.activeTool = 'grid';
      restored.gridTool = {
        ...restored.gridTool,
        stoneSize: project.generatorState.stoneSize,
        columns: project.generatorState.columns,
        rows: project.generatorState.rows,
        densityPreset: project.generatorState.densityPreset,
        customSpacingMm: project.generatorState.customSpacingMm,
      };
      break;
    case 'outline-text':
      restored.activeTool = 'text';
      restored.textTool = {
        ...restored.textTool,
        mode: 'outline',
        text: project.generatorState.text,
        stoneSize: project.generatorState.stoneSize,
        fontSizeMm: project.generatorState.fontSizeMm,
        targetWidthMm: project.generatorState.targetWidthMm ?? '',
        targetHeightMm: project.generatorState.targetHeightMm ?? '',
        preserveAspectRatio: project.generatorState.preserveAspectRatio,
        align: project.generatorState.align,
        letterSpacingMm: project.generatorState.letterSpacingMm,
        lineSpacingMm: project.generatorState.lineSpacingMm,
        fillMode: project.generatorState.fillMode,
        fillPattern: project.generatorState.fillPattern,
        densityPreset: project.generatorState.densityPreset,
        customSpacingMm: project.generatorState.customSpacingMm,
        fontId: project.generatorState.fontId ?? LEGACY_OUTLINE_FONT_ID,
      };
      break;
    case 'dot-matrix-text':
      restored.activeTool = 'text';
      restored.textTool = {
        ...restored.textTool,
        mode: 'dot-matrix',
        text: project.generatorState.text,
        stoneSize: project.generatorState.stoneSize,
        targetWidthMm: project.generatorState.targetWidthMm ?? '',
        targetHeightMm: project.generatorState.targetHeightMm ?? '',
        preserveAspectRatio: project.generatorState.preserveAspectRatio,
        densityPreset: project.generatorState.densityPreset,
        customSpacingMm: project.generatorState.customSpacingMm,
        letterSpacingColumns: project.generatorState.letterSpacingColumns,
        lineSpacingRows: project.generatorState.lineSpacingRows,
      };
      break;
    case 'svg-upload':
      restored.activeTool = 'svg';
      restored.svgTool = {
        ...restored.svgTool,
        uploadedSvgText: project.generatorState.uploadedSvgText,
        svgFileName: 'restored.svg',
        stoneSize: project.generatorState.stoneSize,
        targetWidthMm: project.generatorState.targetWidthMm ?? '',
        targetHeightMm: project.generatorState.targetHeightMm ?? '',
        preserveAspectRatio: project.generatorState.preserveAspectRatio,
        densityPreset: project.generatorState.densityPreset,
        customSpacingMm: project.generatorState.customSpacingMm,
        cleanupEnabled: project.generatorState.cleanupEnabled,
        cleanupSimplify: project.generatorState.cleanupSimplify,
        cleanupSimplifyTol: project.generatorState.cleanupSimplifyTol,
        cleanupRemoveTiny: project.generatorState.cleanupRemoveTiny,
        cleanupMinLength: project.generatorState.cleanupMinLength,
        cleanupRemoveDups: project.generatorState.cleanupRemoveDups,
        cleanupDupTol: project.generatorState.cleanupDupTol,
        fillMode: project.generatorState.fillMode,
        fillPattern: project.generatorState.fillPattern,
      };
      break;
    case 'manual-editor':
      restored.activeTool = 'manual';
      break;
  }

  if (project.manualToolState) {
    restored.manualTool = {
      ...restored.manualTool,
      ...project.manualToolState,
      assistBrushSizeMm: project.manualToolState.assistBrushSizeMm ?? restored.manualTool.assistBrushSizeMm,
    };
  }

  restored = editorReducer(restored, {
    type: 'SET_TEMPLATE',
    template: generateTemplateFromGeneratorState(project.generatorState) ?? null,
  });

  if (project.editableState) {
    restored = editorReducer(restored, {
      type: 'RESTORE_EDITABLE',
      stones: project.editableState.stones.map(savedStoneToEditableStone),
      sourceGenerator: project.generatorState.generatorId,
    });
  }

  if (project.activeTool) {
    restored = editorReducer(restored, { type: 'SET_ACTIVE_TOOL', tool: project.activeTool });
  }

  return restored;
}

function expectRoundTrip(state: EditorState) {
  const beforeProject = buildProjectFileFromEditorState(state);
  expect(beforeProject).not.toBeNull();
  const serialized = serializeRhinestoneProject(beforeProject!);
  const beforeTemplate = buildEffectiveTemplate(state);
  expect(beforeTemplate).not.toBeNull();
  const beforeSvg = createBasicSvgExport(beforeTemplate!, {
    includeGuideBox: state.includeGuideBox,
    includeLabels: state.includeLabels,
    paddingMm: state.paddingMm,
    decimalPlaces: 3,
  });

  const parsed = parseRhinestoneProject(serialized);
  const restored = restoreStateFromProject(serialized);
  const afterTemplate = buildEffectiveTemplate(restored);
  const afterSvg = createBasicSvgExport(afterTemplate!, {
    includeGuideBox: restored.includeGuideBox,
    includeLabels: restored.includeLabels,
    paddingMm: restored.paddingMm,
    decimalPlaces: 3,
  });

  expect(parsed.activeTool).toBe(beforeProject!.activeTool);
  expect(serialized).not.toContain('selectedStoneIds');
  expect(serialized).not.toContain('history');
  expect(serialized).not.toContain('hoverPosition');
  expect(serialized).not.toContain('boxSelection');
  expect(parsed.manualToolState).toEqual(beforeProject!.manualToolState);
  expect(parsed.editableState?.stones).toEqual(beforeProject!.editableState?.stones);
  expect(restored.editableTemplate.isEditable).toBe(state.editableTemplate.isEditable);
  expect(normalizeEditableStones(restored.editableTemplate.stones)).toEqual(
    normalizeEditableStones(state.editableTemplate.stones),
  );
  expect(restored.history.past).toHaveLength(0);
  expect(restored.history.future).toHaveLength(0);
  expect(restored.selectedStoneIds.size).toBe(0);
  expect(restored.includeGuideBox).toBe(state.includeGuideBox);
  expect(restored.includeLabels).toBe(state.includeLabels);
  expect(restored.paddingMm).toBe(state.paddingMm);
  expect(restored.activeTool).toBe(state.activeTool);
  expect(afterTemplate?.stones).toHaveLength(beforeTemplate!.stones.length);
  expect(afterTemplate?.widthMm).toBe(beforeTemplate?.widthMm);
  expect(afterTemplate?.heightMm).toBe(beforeTemplate?.heightMm);
  expect(afterSvg).toBe(beforeSvg);
  expect(afterSvg).not.toContain('3b82f6');
  expect(afterSvg).not.toContain('cursor');
  expect(afterSvg).not.toContain('url(#grid)');
  expect(afterSvg).not.toContain('Editable');
  expect(afterSvg).not.toContain('Generated');

  const continuedEdit = editorReducer(restored, {
    type: 'ADD_STONES',
    stones: [{ id: 'continued-edit', center: { x: 260, y: 260 }, holeDiameterMm: 3, stoneSize: 'SS10' }],
  });
  expect(continuedEdit.editableTemplate.stones.length).toBe(restored.editableTemplate.stones.length + 1);
}

describe('project round-trip for editable designs', () => {
  it('round-trips editable Grid', () => {
    let state = cloneState();
    state.activeTool = 'grid';
    state.gridTool.columns = 4;
    state.gridTool.rows = 3;
    state.template = createStoneGridTemplate({
      id: 'grid-preview',
      name: 'Grid',
      stoneSize: state.gridTool.stoneSize,
      columns: state.gridTool.columns,
      rows: state.gridTool.rows,
      densityPreset: state.gridTool.densityPreset,
      customSpacingMm: 4,
    });
    state = editorReducer(state, { type: 'CONVERT_TO_EDITABLE' });
    state.activeTool = 'select';
    state = addEditableMutations(state);
    expectRoundTrip(state);
  });

  it('round-trips editable Outline Text', () => {
    let state = cloneState();
    state.activeTool = 'text';
    state.textTool.mode = 'outline';
    state.textTool.text = 'HI';
    state.template = createOutlineTextTemplate({
      id: 'text-outline-preview',
      name: 'Outline',
      text: 'HI',
      stoneSize: state.textTool.stoneSize,
      fontSizeMm: 25,
      align: state.textTool.align,
      letterSpacingMm: 2,
      lineSpacingMm: 8,
      preserveAspectRatio: true,
      densityPreset: state.textTool.densityPreset,
      customSpacingMm: 4,
      fillMode: state.textTool.fillMode,
      fillPattern: state.textTool.fillPattern,
    });
    state = editorReducer(state, { type: 'CONVERT_TO_EDITABLE' });
    state.activeTool = 'select';
    state = addEditableMutations(state);
    expectRoundTrip(state);
  });

  it('round-trips editable Dot Matrix Text', () => {
    let state = cloneState();
    state.activeTool = 'text';
    state.textTool.mode = 'dot-matrix';
    state.textTool.text = 'OK';
    state.template = createDotMatrixTextTemplate({
      id: 'text-dotmatrix-preview',
      name: 'Dot',
      text: 'OK',
      stoneSize: state.textTool.stoneSize,
      letterSpacingColumns: state.textTool.letterSpacingColumns,
      lineSpacingRows: state.textTool.lineSpacingRows,
      preserveAspectRatio: true,
      densityPreset: state.textTool.densityPreset,
      customSpacingMm: 4,
    });
    state = editorReducer(state, { type: 'CONVERT_TO_EDITABLE' });
    state.activeTool = 'select';
    state = addEditableMutations(state);
    expectRoundTrip(state);
  });

  it('round-trips editable SVG', () => {
    let state = cloneState();
    state.activeTool = 'svg';
    state.svgTool.uploadedSvgText = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 10"><path d="M0 5 L30 5" /></svg>';
    const polylines = svgStringToPolylines(state.svgTool.uploadedSvgText, {
      cleanupOptions: {
        simplify: state.svgTool.cleanupSimplify,
        simplifyToleranceMm: state.svgTool.cleanupSimplifyTol,
        removeTinyPolylines: state.svgTool.cleanupRemoveTiny,
        minPolylineLengthMm: state.svgTool.cleanupMinLength,
        removeDuplicatePoints: state.svgTool.cleanupRemoveDups,
        duplicatePointToleranceMm: state.svgTool.cleanupDupTol,
      },
    });
    state.template = createPolylineFilledRhinestoneTemplate({
      id: 'svg-preview',
      name: 'SVG',
      polylines,
      stoneSize: state.svgTool.stoneSize,
      fillMode: state.svgTool.fillMode,
      fillPattern: state.svgTool.fillPattern,
      densityPreset: state.svgTool.densityPreset,
      customSpacingMm: 4,
    });
    state = editorReducer(state, { type: 'CONVERT_TO_EDITABLE' });
    state.activeTool = 'select';
    state = addEditableMutations(state);
    expectRoundTrip(state);
  });

  it('round-trips a fully manual editable design', () => {
    let state = cloneState();
    state.activeTool = 'manual';
    state = editorReducer(state, {
      type: 'RESTORE_EDITABLE',
      sourceGenerator: 'manual-editor',
      stones: [
        { id: 'm1', center: { x: 10, y: 10 }, holeDiameterMm: 3, stoneSize: 'SS10' },
        { id: 'm2', center: { x: 40, y: 10 }, holeDiameterMm: 3, stoneSize: 'SS10' },
        { id: 'm3', center: { x: 70, y: 10 }, holeDiameterMm: 3, stoneSize: 'SS10' },
      ],
    });
    state.includeGuideBox = false;
    state.includeLabels = true;
    state = addEditableMutations(state);
    expectRoundTrip(state);
  });
});
