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
  const textTool = withValues(state.textTool, { stoneSize: defaultStoneSize, densityPreset: defaultDensityPreset });
  const gridTool = withValues(state.gridTool, { stoneSize: defaultStoneSize, densityPreset: defaultDensityPreset });
  const svgTool = withValues(state.svgTool, {
    stoneSize: defaultStoneSize,
    densityPreset: defaultDensityPreset,
    uploadLongestSideMm: defaultArtworkLongestSideMm,
  });
  const manualTool = withValues(state.manualTool, { addStoneSize: defaultStoneSize });
  const rhinestoneFontTool = withValues(state.rhinestoneFontTool, { stoneSize: defaultStoneSize });
  const svgAlphabetTool = withValues(state.svgAlphabetTool, { stoneSize: defaultStoneSize });
  const letterStencilTool = withValues(state.letterStencilTool, { stoneSize: defaultStoneSize });
  const templateImportTool = withValues(state.templateImportTool, { defaultStoneSize });

  // Nothing to change: hand back the same object so memoised consumers do not re-run.
  if (
    textTool === state.textTool && gridTool === state.gridTool && svgTool === state.svgTool
    && manualTool === state.manualTool && rhinestoneFontTool === state.rhinestoneFontTool
    && svgAlphabetTool === state.svgAlphabetTool && letterStencilTool === state.letterStencilTool
    && templateImportTool === state.templateImportTool
  ) {
    return state;
  }

  return {
    ...state,
    textTool,
    gridTool,
    svgTool,
    manualTool,
    rhinestoneFontTool,
    svgAlphabetTool,
    letterStencilTool,
    templateImportTool,
  };
}

/** `slice` with `values` applied, or `slice` itself when it already has them. */
function withValues<T extends object>(slice: T, values: Partial<T>): T {
  const changed = (Object.keys(values) as (keyof T)[]).some((key) => slice[key] !== values[key]);
  return changed ? { ...slice, ...values } : slice;
}
