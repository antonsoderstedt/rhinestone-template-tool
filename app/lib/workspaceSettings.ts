/**
 * Workspace settings: the few defaults a new project starts from.
 *
 * Every field here is read by a studio (see `app/editor/newProjectDefaults.ts`
 * and the HTV export). Settings that nothing read were removed in Phase 5 —
 * add a field only together with the code that consumes it.
 */

import type { StoneSizeId } from '../../src/lib/rhinestone-engine/types/index';

export const SETTINGS_STONE_SIZES: readonly StoneSizeId[] = ['SS6', 'SS8', 'SS10', 'SS12', 'SS16', 'SS20'];

export const SETTINGS_DENSITY_PRESETS = ['safe', 'standard', 'dense', 'loose'] as const;
export type SettingsDensityPreset = (typeof SETTINGS_DENSITY_PRESETS)[number];

export interface WorkspaceSettings {
  /** Stone size a new rhinestone project starts with. */
  defaultStoneSize: StoneSizeId;
  /** Density preset (spacing is derived from stone size + material) a new project starts with. */
  defaultDensityPreset: SettingsDensityPreset;
  /** Longest side, in mm, that an uploaded SVG is scaled to on import. */
  defaultArtworkLongestSideMm: number;
  /** Margin around HTV artwork in the exported cut file, in mm. */
  htvWeedMarginMm: number;
}

export const WORKSPACE_SETTING_LIMITS = {
  defaultArtworkLongestSideMm: { min: 10, max: 280 },
  htvWeedMarginMm: { min: 0, max: 50 },
} as const;

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  defaultStoneSize: 'SS10',
  defaultDensityPreset: 'standard',
  defaultArtworkLongestSideMm: 100,
  htvWeedMarginMm: 6,
};

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/**
 * Turns anything read from storage (old versions, hand-edited JSON, bad types)
 * into a valid `WorkspaceSettings`. Unknown keys, including settings removed in
 * earlier versions (machine, mat, blade, …), are dropped.
 */
export function sanitizeWorkspaceSettings(raw: unknown): WorkspaceSettings {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const defaults = DEFAULT_WORKSPACE_SETTINGS;
  const limits = WORKSPACE_SETTING_LIMITS;

  return {
    defaultStoneSize: SETTINGS_STONE_SIZES.includes(source.defaultStoneSize as StoneSizeId)
      ? (source.defaultStoneSize as StoneSizeId)
      : defaults.defaultStoneSize,
    defaultDensityPreset: SETTINGS_DENSITY_PRESETS.includes(source.defaultDensityPreset as SettingsDensityPreset)
      ? (source.defaultDensityPreset as SettingsDensityPreset)
      : defaults.defaultDensityPreset,
    defaultArtworkLongestSideMm: clampNumber(
      source.defaultArtworkLongestSideMm,
      defaults.defaultArtworkLongestSideMm,
      limits.defaultArtworkLongestSideMm.min,
      limits.defaultArtworkLongestSideMm.max,
    ),
    htvWeedMarginMm: clampNumber(
      source.htvWeedMarginMm,
      defaults.htvWeedMarginMm,
      limits.htvWeedMarginMm.min,
      limits.htvWeedMarginMm.max,
    ),
  };
}
