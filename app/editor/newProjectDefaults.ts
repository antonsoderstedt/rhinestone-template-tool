import type { EditorState } from './EditorState';
import type { WorkspaceSettings } from '../lib/workspaceSettings';

/**
 * Pure: returns `state` with the workspace defaults (Settings page) applied to
 * every tool that starts a new design. Only fields a user would expect Settings
 * to control are touched; everything else keeps the state's value.
 *
 * Call this for a brand-new project (first visit, "New project", "Start fresh").
 * Never call it for a loaded or restored project — those carry their own values.
 */
export function applyWorkspaceDefaults(state: EditorState, settings: WorkspaceSettings): EditorState {
  const { defaultStoneSize, defaultDensityPreset, defaultArtworkLongestSideMm } = settings;
  return {
    ...state,
    textTool: { ...state.textTool, stoneSize: defaultStoneSize, densityPreset: defaultDensityPreset },
    gridTool: { ...state.gridTool, stoneSize: defaultStoneSize, densityPreset: defaultDensityPreset },
    svgTool: {
      ...state.svgTool,
      stoneSize: defaultStoneSize,
      densityPreset: defaultDensityPreset,
      uploadLongestSideMm: defaultArtworkLongestSideMm,
    },
    manualTool: { ...state.manualTool, addStoneSize: defaultStoneSize },
    rhinestoneFontTool: { ...state.rhinestoneFontTool, stoneSize: defaultStoneSize },
    svgAlphabetTool: { ...state.svgAlphabetTool, stoneSize: defaultStoneSize },
    letterStencilTool: { ...state.letterStencilTool, stoneSize: defaultStoneSize },
    templateImportTool: { ...state.templateImportTool, defaultStoneSize },
  };
}

/** The tool slices `applyWorkspaceDefaults` changes, for dispatching as a `LOAD_PROJECT_STATE` patch. */
export function workspaceDefaultsPatch(state: EditorState, settings: WorkspaceSettings): Partial<EditorState> {
  const next = applyWorkspaceDefaults(state, settings);
  return {
    textTool: next.textTool,
    gridTool: next.gridTool,
    svgTool: next.svgTool,
    manualTool: next.manualTool,
    rhinestoneFontTool: next.rhinestoneFontTool,
    svgAlphabetTool: next.svgAlphabetTool,
    letterStencilTool: next.letterStencilTool,
    templateImportTool: next.templateImportTool,
  };
}
