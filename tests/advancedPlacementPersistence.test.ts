import { describe, expect, it } from 'vitest';
import {
  LEGACY_OUTLINE_FONT_ID,
  createBasicSvgExport,
  createOutlineTextTemplateAsync,
  parseRhinestoneProject,
  serializeRhinestoneProject,
} from '../src/lib/rhinestone-engine/index';
import { DEFAULT_EDITOR_STATE, editorReducer } from '../app/editor/EditorState';
import { buildProjectFileFromEditorState, buildEffectiveTemplate } from '../app/editor/projectPersistence';

function cloneState() {
  return structuredClone(DEFAULT_EDITOR_STATE);
}

describe('advanced placement persistence', () => {
  it('legacy projects without coverage or placement pattern preserve previous default behavior', () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      savedAt: '2026-07-30T12:00:00.000Z',
      projectName: 'Legacy default',
      generatorState: {
        generatorId: 'outline-text',
        text: 'SMOOCH',
        stoneSize: 'SS10',
        fontSizeMm: 25,
        targetWidthMm: null,
        targetHeightMm: null,
        preserveAspectRatio: true,
        align: 'left',
        letterSpacingMm: 2,
        lineSpacingMm: 8,
        fillMode: 'outline',
        fillPattern: 'offset-grid',
        densityPreset: 'standard',
        customSpacingMm: 4,
        includeGuideBox: true,
        includeLabels: false,
        paddingMm: 5,
      },
    });
    const parsed = parseRhinestoneProject(json);
    expect(parsed.generatorState.generatorId).toBe('outline-text');
    if (parsed.generatorState.generatorId === 'outline-text') {
      expect(parsed.generatorState.fontId).toBe(LEGACY_OUTLINE_FONT_ID);
      expect(parsed.generatorState.coverageMode).toBe('outline');
      expect(parsed.generatorState.placementPattern).toBe('default');
    }
  });

  it('preserves contour settings through save/open and keeps export stable', async () => {
    const state = cloneState();
    state.activeTool = 'text';
    state.textTool.mode = 'outline';
    state.textTool.fontId = 'archivo-black';
    state.textTool.text = 'B8O ÅÄÖ';
    state.projectName = 'Contour Preview';
    state.textTool.coverageMode = 'contour';
    state.textTool.contourSettings = { rowCount: 4, rowSpacingMm: 3.5, direction: 'inward' };
    state.template = await createOutlineTextTemplateAsync({
      id: 'text-outline-preview',
      name: 'Contour Preview',
      text: state.textTool.text,
      stoneSize: state.textTool.stoneSize,
      fontId: state.textTool.fontId,
      coverageMode: state.textTool.coverageMode,
      contourSettings: state.textTool.contourSettings,
      fillMode: state.textTool.fillMode,
      fillPattern: state.textTool.fillPattern,
    });
    const beforeSvg = createBasicSvgExport(buildEffectiveTemplate(state)!, { includeGuideBox: true, includeLabels: false, paddingMm: 5, decimalPlaces: 3 });
    const project = buildProjectFileFromEditorState(state)!;
    const parsed = parseRhinestoneProject(serializeRhinestoneProject(project));
    expect(parsed.generatorState.generatorId).toBe('outline-text');
    if (parsed.generatorState.generatorId === 'outline-text') {
      expect(parsed.generatorState.coverageMode).toBe('contour');
      expect(parsed.generatorState.contourSettings).toEqual({ rowCount: 4, rowSpacingMm: 3.5, direction: 'inward' });
    }
    const regenerated = await createOutlineTextTemplateAsync({
      id: 'text-outline-preview',
      name: parsed.projectName,
      text: parsed.generatorState.generatorId === 'outline-text' ? parsed.generatorState.text : 'X',
      stoneSize: parsed.generatorState.generatorId === 'outline-text' ? parsed.generatorState.stoneSize : 'SS10',
      fontId: parsed.generatorState.generatorId === 'outline-text' ? parsed.generatorState.fontId : LEGACY_OUTLINE_FONT_ID,
      coverageMode: parsed.generatorState.generatorId === 'outline-text' ? parsed.generatorState.coverageMode : 'outline',
      contourSettings: parsed.generatorState.generatorId === 'outline-text' ? parsed.generatorState.contourSettings : undefined,
      fillMode: parsed.generatorState.generatorId === 'outline-text' ? parsed.generatorState.fillMode : 'outline',
      fillPattern: parsed.generatorState.generatorId === 'outline-text' ? parsed.generatorState.fillPattern : 'offset-grid',
    });
    const afterSvg = createBasicSvgExport(regenerated, { includeGuideBox: true, includeLabels: false, paddingMm: 5, decimalPlaces: 3 });
    expect(afterSvg).toBe(beforeSvg);
  });

  it('preserves placement pattern and radial settings through save/open and editable conversion', async () => {
    let state = cloneState();
    state.activeTool = 'text';
    state.textTool.mode = 'outline';
    state.textTool.fontId = 'archivo-black';
    state.textTool.text = 'BOO 2026';
    state.textTool.coverageMode = 'fill';
    state.textTool.fillMode = 'fill';
    state.textTool.placementPattern = 'radial';
    state.textTool.radialSettings = { ringSpacingMm: 5, centerOffsetXmm: 3, centerOffsetYmm: -2, includeCenterStone: false };
    state.template = await createOutlineTextTemplateAsync({
      id: 'text-outline-preview',
      name: 'Radial Preview',
      text: state.textTool.text,
      stoneSize: state.textTool.stoneSize,
      fontId: state.textTool.fontId,
      coverageMode: state.textTool.coverageMode,
      placementPattern: state.textTool.placementPattern,
      radialSettings: state.textTool.radialSettings,
      fillMode: state.textTool.fillMode,
      fillPattern: state.textTool.fillPattern,
    });
    state = editorReducer(state, { type: 'CONVERT_TO_EDITABLE' });
    const project = buildProjectFileFromEditorState(state)!;
    const parsed = parseRhinestoneProject(serializeRhinestoneProject(project));
    expect(parsed.editableState?.isEditable).toBe(true);
    if (parsed.generatorState.generatorId === 'outline-text') {
      expect(parsed.generatorState.placementPattern).toBe('radial');
      expect(parsed.generatorState.radialSettings).toEqual({ ringSpacingMm: 5, centerOffsetXmm: 3, centerOffsetYmm: -2, includeCenterStone: false });
    }
  });
});
