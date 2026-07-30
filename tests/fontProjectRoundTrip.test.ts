import { describe, expect, it } from 'vitest';
import {
  createBasicSvgExport,
  createOutlineTextTemplateAsync,
  parseRhinestoneProject,
  serializeRhinestoneProject,
} from '../src/lib/rhinestone-engine/index';
import { DEFAULT_EDITOR_STATE, editorReducer } from '../app/editor/EditorState';
import { buildEffectiveTemplate, buildProjectFileFromEditorState } from '../app/editor/projectPersistence';

function cloneState() {
  return structuredClone(DEFAULT_EDITOR_STATE);
}

describe('font project round-trip', () => {
  it('preserves fontId through save/open and keeps exported SVG identical after editable restore', async () => {
    let state = cloneState();
    state.activeTool = 'text';
    state.textTool.mode = 'outline';
    state.textTool.text = 'Sulay 2026 ÅÄÖ';
    state.textTool.fontId = 'archivo-black';
    state.template = await createOutlineTextTemplateAsync({
      id: 'text-outline-preview',
      name: 'Outline Preview',
      text: state.textTool.text,
      stoneSize: state.textTool.stoneSize,
      fontId: state.textTool.fontId,
      fontSizeMm: 28,
      align: state.textTool.align,
      letterSpacingMm: 2,
      lineSpacingMm: 8,
      densityPreset: state.textTool.densityPreset,
      customSpacingMm: 4,
      fillMode: state.textTool.fillMode,
      fillPattern: state.textTool.fillPattern,
    });

    state = editorReducer(state, { type: 'CONVERT_TO_EDITABLE' });
    state = editorReducer(state, {
      type: 'MOVE_STONES',
      moves: [{ id: state.editableTemplate.stones[0]!.id, toX: state.editableTemplate.stones[0]!.center.x + 6, toY: state.editableTemplate.stones[0]!.center.y + 4 }],
    });

    const project = buildProjectFileFromEditorState(state)!;
    const beforeTemplate = buildEffectiveTemplate(state)!;
    const beforeSvg = createBasicSvgExport(beforeTemplate, { includeGuideBox: true, includeLabels: false, paddingMm: 5, decimalPlaces: 3 });

    const parsed = parseRhinestoneProject(serializeRhinestoneProject(project));
    expect(parsed.generatorState.generatorId).toBe('outline-text');
    if (parsed.generatorState.generatorId !== 'outline-text') {
      throw new Error('Expected outline-text project state');
    }
    expect(parsed.generatorState.fontId).toBe('archivo-black');

    const regenerated = await createOutlineTextTemplateAsync({
      id: 'text-outline-preview',
      name: parsed.projectName,
      text: parsed.generatorState.text,
      stoneSize: parsed.generatorState.stoneSize,
      fontId: parsed.generatorState.fontId,
      fontSizeMm: parsed.generatorState.fontSizeMm,
      align: parsed.generatorState.align,
      letterSpacingMm: parsed.generatorState.letterSpacingMm,
      lineSpacingMm: parsed.generatorState.lineSpacingMm,
      targetWidthMm: parsed.generatorState.targetWidthMm ?? undefined,
      targetHeightMm: parsed.generatorState.targetHeightMm ?? undefined,
      preserveAspectRatio: parsed.generatorState.preserveAspectRatio,
      densityPreset: parsed.generatorState.densityPreset,
      customSpacingMm: parsed.generatorState.customSpacingMm,
      fillMode: parsed.generatorState.fillMode,
      fillPattern: parsed.generatorState.fillPattern,
    });

    const restoredTemplate = parsed.editableState
      ? {
          ...regenerated,
          stones: parsed.editableState.stones.map((stone) => ({
            id: stone.id,
            center: { x: stone.x, y: stone.y },
            stoneSize: stone.stoneSize,
            holeDiameterMm: stone.holeDiameterMm,
          })),
        }
      : regenerated;

    const afterSvg = createBasicSvgExport(restoredTemplate, { includeGuideBox: true, includeLabels: false, paddingMm: 5, decimalPlaces: 3 });
    expect(afterSvg).toBe(beforeSvg);
  });
});
