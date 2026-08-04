/**
 * Material profiles describing cutter + material combinations.
 *
 * Magic Flock hole diameters (holePresets below) are sourced from vendor
 * (TRW) physical stone measurements for SS6, SS8, SS10, SS16, and SS20.
 * SS12 has no verified official value and is marked `status: 'provisional'` —
 * it MUST be treated as a starting point only and calibrated before
 * production use. See each HolePreset's `note`.
 *
 * ⚠️  kerfCompensationMm and scaleCompensationPercent still start at 0 and
 * must be refined from a physical calibration cut. See docs/CALIBRATION_PLAN.md.
 */

import type { HolePreset, MachineRecommendation, MaterialProfile, StoneSizeId } from '../types/index';
import { getStoneSizeProfile } from './stoneSizes';

// ─── Magic Flock hole presets (central source of truth) ────────────────────────

/**
 * Magic Flock hole diameter + calibration series, per stone size.
 *
 * `holeDiameterMm` is the default/starting hole diameter. `calibrationValuesMm`
 * is the 5-value test series used to generate a physical calibration sheet —
 * the middle value always equals `holeDiameterMm`.
 */
export const MAGIC_FLOCK_HOLE_PRESETS: readonly HolePreset[] = [
  {
    stoneSize: 'SS6',
    holeDiameterMm: 2.54,
    calibrationValuesMm: [2.44, 2.49, 2.54, 2.59, 2.64],
    status: 'verified',
  },
  {
    stoneSize: 'SS8',
    holeDiameterMm: 3.00,
    calibrationValuesMm: [2.90, 2.95, 3.00, 3.05, 3.10],
    status: 'verified',
  },
  {
    stoneSize: 'SS10',
    holeDiameterMm: 3.43,
    calibrationValuesMm: [3.33, 3.38, 3.43, 3.48, 3.53],
    status: 'verified',
  },
  {
    stoneSize: 'SS12',
    holeDiameterMm: 3.80,
    calibrationValuesMm: [3.60, 3.70, 3.80, 3.90, 4.00],
    status: 'provisional',
    note:
      'No verified official TRW value exists for SS12 yet. This is a preliminary starting ' +
      'point only — calibrate before production. Cut the calibration sheet and choose the ' +
      'smallest hole where the stone brushes in easily and seats/turns correctly.',
  },
  {
    stoneSize: 'SS16',
    holeDiameterMm: 4.39,
    calibrationValuesMm: [4.29, 4.34, 4.39, 4.44, 4.49],
    status: 'verified',
  },
  {
    stoneSize: 'SS20',
    holeDiameterMm: 5.28,
    calibrationValuesMm: [5.18, 5.23, 5.28, 5.33, 5.38],
    status: 'verified',
  },
];

// ─── Magic Flock + Cricut Maker 3 machine recommendation ───────────────────────

export const MAGIC_FLOCK_CRICUT_MAKER_3_RECOMMENDATION: MachineRecommendation = {
  machine: 'Cricut Maker 3',
  material: 'Magic Flock',
  blade: 'Deep-Point Blade',
  customPressure: 350,
  pressureSetting: 'More',
  passes: 1,
  multiCut: false,
  mirror: false,
  linerHandling: 'Remove the backing/liner before cutting.',
  mat: 'StrongGrip mat (or another high-tack mat).',
  testCutRequired: true,
  helpText:
    'This is a starting setting. Blade condition, material batch, and mat grip can all affect ' +
    "the result. If holes don't release cleanly: check the blade first, and if needed run a " +
    'second pass without unloading the mat.',
  alternativePressure: {
    customPressure: 340,
    label: 'Alternative for older/thinner Magic Flock — test cut required.',
  },
};

// ─── Magic Flock + Cricut Maker 3 ───────────────────────────────────────────────

/**
 * Default profile for Magic Flock cut on a Cricut Maker 3.
 *
 * ⚠️  kerfCompensationMm and scaleCompensationPercent are 0 (uncalibrated).
 * Cut a calibration sheet (docs/CALIBRATION_PLAN.md) and update these values
 * before production use. Incorrect compensation leads to stones that don't
 * seat properly or holes that tear the flock.
 */
export const MAGIC_FLOCK_CRICUT_MAKER_PROFILE: MaterialProfile = {
  id: 'magic-flock-cricut-maker',
  name: 'Magic Flock',
  cutter: 'Cricut Maker 3',
  supportedStoneSizes: ['SS6', 'SS8', 'SS10', 'SS12', 'SS16', 'SS20'],
  defaultStoneSize: 'SS10',
  spacingSafetyMarginMm: 0.25,
  // Minimum material left between any two hole edges (mm), not center-to-center.
  minimumEdgeSpacingMm: 0.508,
  // Uncalibrated — set from a physical calibration cut
  kerfCompensationMm: 0,
  // Uncalibrated — set from a physical calibration cut
  scaleCompensationPercent: 0,
  notes:
    'Magic Flock rhinestone template material cut on a Cricut Maker 3. ' +
    'kerfCompensationMm and scaleCompensationPercent are provisional (0). ' +
    'Run the calibration workflow in docs/CALIBRATION_PLAN.md to determine ' +
    'the correct values for your specific machine, blade, and flock batch. ' +
    'Blade wear, mat condition, and ambient humidity all affect cut accuracy. ' +
    'SS12 has no verified vendor value and must be calibrated before production use.',
  requiresCalibration: true,
  holePresets: MAGIC_FLOCK_HOLE_PRESETS,
  machineRecommendations: [MAGIC_FLOCK_CRICUT_MAKER_3_RECOMMENDATION],
};

// ─── Registry ─────────────────────────────────────────────────────────────────

/** All registered material profiles, indexed by id. */
export const MATERIAL_PROFILES: Readonly<Record<string, MaterialProfile>> = {
  [MAGIC_FLOCK_CRICUT_MAKER_PROFILE.id]: MAGIC_FLOCK_CRICUT_MAKER_PROFILE,
};

// ─── Accessors ────────────────────────────────────────────────────────────────

/**
 * Returns the material profile for the given id, or throws if not found.
 */
export function getMaterialProfile(id: string): MaterialProfile {
  const profile = MATERIAL_PROFILES[id];
  if (!profile) {
    throw new Error(
      `Unknown material profile id: "${id}". Valid ids are: ${Object.keys(MATERIAL_PROFILES).join(', ')}.`,
    );
  }
  return profile;
}

/**
 * Returns the default material profile (Magic Flock + Cricut Maker 3).
 */
export function getDefaultMaterialProfile(): MaterialProfile {
  return MAGIC_FLOCK_CRICUT_MAKER_PROFILE;
}

function resolveMaterialProfile(materialProfileId?: string): MaterialProfile {
  return materialProfileId ? getMaterialProfile(materialProfileId) : getDefaultMaterialProfile();
}

/**
 * Returns the hole preset for a stone size on a material profile, or
 * `undefined` if that profile doesn't define one (falls back to the generic
 * StoneSizeProfile estimate in that case — see getRecommendedHoleDiameter).
 */
export function getHolePreset(
  stoneSizeId: StoneSizeId,
  materialProfileId?: string,
): HolePreset | undefined {
  const materialProfile = resolveMaterialProfile(materialProfileId);
  return materialProfile.holePresets?.find((preset) => preset.stoneSize === stoneSizeId);
}

/**
 * Returns the recommended hole diameter (mm) for a given stone size and
 * optional material profile.
 *
 * Resolution order:
 * 1. The material profile's own HolePreset for this stone size, if defined
 *    (authoritative — e.g. Magic Flock's vendor-verified diameters).
 * 2. Otherwise, the generic StoneSizeProfile.recommendedHoleDiameterMm.
 *
 * In both cases, the material profile's kerfCompensationMm is added on top.
 *
 * Falls back to the default material profile when `materialProfileId` is
 * omitted.
 */
export function getRecommendedHoleDiameter(
  stoneSizeId: StoneSizeId,
  materialProfileId?: string,
): number {
  const materialProfile = resolveMaterialProfile(materialProfileId);
  const preset = getHolePreset(stoneSizeId, materialProfileId);
  const baseDiameterMm = preset
    ? preset.holeDiameterMm
    : getStoneSizeProfile(stoneSizeId).recommendedHoleDiameterMm;
  return baseDiameterMm + materialProfile.kerfCompensationMm;
}

/**
 * Returns the 5-value calibration test series (mm) for a stone size on a
 * material profile.
 *
 * Falls back to a generic ±0.1/+0.2 mm 4-value series around the resolved
 * recommended hole diameter when the material profile doesn't define its
 * own calibration series for that stone size.
 */
export function getCalibrationSeries(
  stoneSizeId: StoneSizeId,
  materialProfileId?: string,
): number[] {
  const preset = getHolePreset(stoneSizeId, materialProfileId);
  if (preset) {
    return [...preset.calibrationValuesMm];
  }
  const recommended = getRecommendedHoleDiameter(stoneSizeId, materialProfileId);
  return [recommended - 0.1, recommended, recommended + 0.1, recommended + 0.2].map(
    (v) => Math.round(v * 1000) / 1000,
  );
}

/**
 * Returns whether the hole preset for a stone size on a material profile is
 * `provisional` (no verified vendor source — requires calibration before
 * production use). Returns `false` when the profile has no explicit preset
 * for that size (the generic StoneSizeProfile fallback is always provisional
 * in spirit, but this function only reports on explicit material presets).
 */
export function isHolePresetProvisional(
  stoneSizeId: StoneSizeId,
  materialProfileId?: string,
): boolean {
  return getHolePreset(stoneSizeId, materialProfileId)?.status === 'provisional';
}

/**
 * Returns the recommended center-to-center distance (mm) between stones for
 * a given stone size and optional material profile.
 *
 * Derived from the material's actual resolved hole diameter (via
 * getMinimumCenterDistance — the physical safety floor), plus the material
 * profile's spacingSafetyMarginMm as extra comfort margin on top. This keeps
 * "recommended" always consistent with "minimum": recommended is never
 * smaller than the physical floor, and both scale correctly with whichever
 * hole diameter is actually in effect (e.g. Magic Flock's verified presets).
 *
 * This is a COMFORTABLE DEFAULT for automatic layout density — for the hard
 * physical safety floor used by collision detection, see
 * getMinimumCenterDistance.
 *
 * Falls back to the default material profile when `materialProfileId` is
 * omitted.
 */
export function getRecommendedCenterDistance(
  stoneSizeId: StoneSizeId,
  materialProfileId?: string,
): number {
  const materialProfile = resolveMaterialProfile(materialProfileId);
  const holeDiameterMm = getRecommendedHoleDiameter(stoneSizeId, materialProfileId);
  const minimumCenterDistance = getMinimumCenterDistance(holeDiameterMm / 2, holeDiameterMm / 2, materialProfileId);
  return minimumCenterDistance + materialProfile.spacingSafetyMarginMm;
}

/**
 * Returns the material profile's minimum required material between two hole
 * EDGES (mm) — not center-to-center. Defaults to the default material
 * profile when `materialProfileId` is omitted.
 */
export function getMinimumEdgeSpacingMm(materialProfileId?: string): number {
  return resolveMaterialProfile(materialProfileId).minimumEdgeSpacingMm;
}

/**
 * Returns the HARD MINIMUM center-to-center distance (mm) between two holes
 * of the given radii, for a material profile:
 *
 *   minimumCenterDistance = holeRadiusAMm + holeRadiusBMm + minimumEdgeSpacingMm
 *
 * For two equal-size holes this is simply `holeDiameterMm + minimumEdgeSpacingMm`.
 *
 * This is the physical safety floor — use it in collision detection,
 * automatic placement, and validation. For a comfortable default spacing
 * suggestion instead, see getRecommendedCenterDistance.
 */
export function getMinimumCenterDistance(
  holeRadiusAMm: number,
  holeRadiusBMm: number,
  materialProfileId?: string,
): number {
  return holeRadiusAMm + holeRadiusBMm + getMinimumEdgeSpacingMm(materialProfileId);
}
