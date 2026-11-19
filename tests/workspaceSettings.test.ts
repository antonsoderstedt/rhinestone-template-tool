import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKSPACE_SETTINGS,
  WORKSPACE_SETTING_LIMITS,
  sanitizeWorkspaceSettings,
} from '../app/lib/workspaceSettings';
import { applyWorkspaceDefaults } from '../app/editor/newProjectDefaults';
import { DEFAULT_EDITOR_STATE, editorReducer } from '../app/editor/EditorState';

describe('sanitizeWorkspaceSettings', () => {
  it('returns the defaults for missing or non-object input', () => {
    expect(sanitizeWorkspaceSettings(undefined)).toEqual(DEFAULT_WORKSPACE_SETTINGS);
    expect(sanitizeWorkspaceSettings('nope')).toEqual(DEFAULT_WORKSPACE_SETTINGS);
    expect(sanitizeWorkspaceSettings(null)).toEqual(DEFAULT_WORKSPACE_SETTINGS);
  });

  it('keeps valid values', () => {
    expect(
      sanitizeWorkspaceSettings({ defaultStoneSize: 'SS16', defaultDensityPreset: 'dense', defaultArtworkLongestSideMm: 150, htvWeedMarginMm: 10 }),
    ).toEqual({ defaultStoneSize: 'SS16', defaultDensityPreset: 'dense', defaultArtworkLongestSideMm: 150, htvWeedMarginMm: 10 });
  });

  it('replaces invalid values and clamps numbers into their limits', () => {
    const result = sanitizeWorkspaceSettings({
      defaultStoneSize: 'SS99',
      defaultDensityPreset: 'custom',
      defaultArtworkLongestSideMm: 99999,
      htvWeedMarginMm: -5,
    });
    expect(result.defaultStoneSize).toBe('SS10');
    expect(result.defaultDensityPreset).toBe('standard');
    expect(result.defaultArtworkLongestSideMm).toBe(WORKSPACE_SETTING_LIMITS.defaultArtworkLongestSideMm.max);
    expect(result.htvWeedMarginMm).toBe(WORKSPACE_SETTING_LIMITS.htvWeedMarginMm.min);
    expect(sanitizeWorkspaceSettings({ htvWeedMarginMm: Number.NaN }).htvWeedMarginMm).toBe(DEFAULT_WORKSPACE_SETTINGS.htvWeedMarginMm);
  });

  it('drops settings that no longer exist (machine, mat, spacing in mm, …)', () => {
    const result = sanitizeWorkspaceSettings({
      machineModel: 'Cricut Maker 3',
      cuttingMat: 'StandardGrip',
      defaultRhinestoneSpacingMm: 4,
      qualityChecklist: 'x',
      defaultStoneSize: 'SS8',
    });
    expect(Object.keys(result).sort()).toEqual(['defaultArtworkLongestSideMm', 'defaultDensityPreset', 'defaultStoneSize', 'htvWeedMarginMm']);
    expect(result.defaultStoneSize).toBe('SS8');
  });
});

describe('applyWorkspaceDefaults', () => {
  const settings = { ...DEFAULT_WORKSPACE_SETTINGS, defaultStoneSize: 'SS16' as const, defaultDensityPreset: 'safe' as const, defaultArtworkLongestSideMm: 60 };

  it('changing the default stone size changes the next new project in every tool', () => {
    const next = applyWorkspaceDefaults(DEFAULT_EDITOR_STATE, settings);
    expect(next.textTool.stoneSize).toBe('SS16');
    expect(next.gridTool.stoneSize).toBe('SS16');
    expect(next.svgTool.stoneSize).toBe('SS16');
    expect(next.manualTool.addStoneSize).toBe('SS16');
    expect(next.rhinestoneFontTool.stoneSize).toBe('SS16');
    expect(next.svgAlphabetTool.stoneSize).toBe('SS16');
    expect(next.letterStencilTool.stoneSize).toBe('SS16');
    expect(next.templateImportTool.defaultStoneSize).toBe('SS16');
  });

  it('applies the density preset to the tools that use one', () => {
    const next = applyWorkspaceDefaults(DEFAULT_EDITOR_STATE, settings);
    expect(next.textTool.densityPreset).toBe('safe');
    expect(next.gridTool.densityPreset).toBe('safe');
    expect(next.svgTool.densityPreset).toBe('safe');
  });

  it('does not mutate its input and leaves unrelated state alone', () => {
    const before = JSON.stringify([DEFAULT_EDITOR_STATE.textTool, DEFAULT_EDITOR_STATE.svgTool]);
    const next = applyWorkspaceDefaults(DEFAULT_EDITOR_STATE, settings);
    expect(JSON.stringify([DEFAULT_EDITOR_STATE.textTool, DEFAULT_EDITOR_STATE.svgTool])).toBe(before);
    expect(next.projectName).toBe(DEFAULT_EDITOR_STATE.projectName);
    expect(next.textTool.text).toBe(DEFAULT_EDITOR_STATE.textTool.text);
    expect(next.history).toBe(DEFAULT_EDITOR_STATE.history);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(applyWorkspaceDefaults(DEFAULT_EDITOR_STATE, settings))).toBe(
      JSON.stringify(applyWorkspaceDefaults(DEFAULT_EDITOR_STATE, settings)),
    );
  });

  it('the reducer action keeps a launched font and text (new-project defaults never overwrite them)', () => {
    const launched = editorReducer(DEFAULT_EDITOR_STATE, {
      type: 'UPDATE_TEXT_TOOL',
      updates: { text: 'Go Team 7', fontId: 'fredoka-one' },
    });
    const state = editorReducer(launched, { type: 'APPLY_WORKSPACE_DEFAULTS', settings });
    expect(state.textTool.text).toBe('Go Team 7');
    expect(state.textTool.fontId).toBe('fredoka-one');
    expect(state.textTool.stoneSize).toBe('SS16');
    expect(state.textTool.densityPreset).toBe('safe');
    expect(state.template).toBeNull();
  });

  it('uploaded SVGs are scaled to the default artwork size from Settings', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><path d="M0 0 L200 0 L200 100 L0 100 Z"/></svg>';
    const start = applyWorkspaceDefaults(DEFAULT_EDITOR_STATE, settings);
    const after = editorReducer(start, { type: 'UPDATE_SVG_TOOL', updates: { uploadedSvgText: svg, svgFileName: 'box.svg' } });
    expect(Math.max(Number(after.svgTool.targetWidthMm), Number(after.svgTool.targetHeightMm))).toBe(60);

    const withoutSetting = editorReducer(DEFAULT_EDITOR_STATE, { type: 'UPDATE_SVG_TOOL', updates: { uploadedSvgText: svg, svgFileName: 'box.svg' } });
    expect(Math.max(Number(withoutSetting.svgTool.targetWidthMm), Number(withoutSetting.svgTool.targetHeightMm))).toBe(100);
  });
});

describe('applyWorkspaceDefaults is idempotent', () => {
  it('returns the very same state object when the defaults are already applied', () => {
    const once = applyWorkspaceDefaults(DEFAULT_EDITOR_STATE, { ...DEFAULT_WORKSPACE_SETTINGS, defaultStoneSize: 'SS12' });
    const twice = applyWorkspaceDefaults(once, { ...DEFAULT_WORKSPACE_SETTINGS, defaultStoneSize: 'SS12' });
    expect(twice).toBe(once);
    expect(twice.textTool).toBe(once.textTool);
  });

  it('leaves state untouched when the defaults equal what it already has', () => {
    const same = applyWorkspaceDefaults(
      { ...DEFAULT_EDITOR_STATE, svgTool: { ...DEFAULT_EDITOR_STATE.svgTool, uploadLongestSideMm: 100 } },
      DEFAULT_WORKSPACE_SETTINGS,
    );
    expect(same.textTool).toBe(DEFAULT_EDITOR_STATE.textTool);
    expect(same.gridTool).toBe(DEFAULT_EDITOR_STATE.gridTool);
  });
});
