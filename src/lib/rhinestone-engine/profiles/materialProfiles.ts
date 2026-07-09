/**
 * Material profiles describing cutter + material combinations.
 *
 * ⚠️  ALL PROFILES START WITH kerfCompensationMm = 0 AND
 * scaleCompensationPercent = 0.
 *
 * These values MUST be derived from a physical calibration cut before
 * any profile is used in a production run. See docs/CALIBRATION_PLAN.md.
 */

import type { MaterialProfile, StoneSizeId } from '../types/index.js';
import { getStoneSizeProfile } from './stoneSizes.js';

// ─── Magic Flock + Cricut Maker ────────────────────────────────────────────────

/**
 * Default profile for Magic Flock cut on a Cricut Maker.
 *
 * ⚠️  kerfCompensationMm and scaleCompensationPercent are 0 (uncalibrated).
 * Cut a calibration sheet (docs/CALIBRATION_PLAN.md) and update these values
 * before production use. Incorrect compensation leads to stones that don't
 * seat properly or holes that tear the flock.
 */
export const MAGIC_FLOCK_CRICUT_MAKER_PROFILE: MaterialProfile = {
  id: 'magic-flock-cricut-maker',
  name: 'Magic Flock',
  cutter: 'Cricut Maker',
  supportedStoneSizes: ['SS6', 'SS8', 'SS10', 'SS12'],
  defaultStoneSize: 'SS10',
  spacingSafetyMarginMm: 0.25,
  // Uncalibrated — set from a physical calibration cut
  kerfCompensationMm: 0,
  // Uncalibrated — set from a physical calibration cut
  scaleCompensationPercent: 0,
  notes:
    'Magic Flock rhinestone template material cut on a Cricut Maker. ' +
    'kerfCompensationMm and scaleCompensationPercent are provisional (0). ' +
    'Run the calibration workflow in docs/CALIBRATION_PLAN.md to determine ' +
    'the correct values for your specific machine, blade, and flock batch. ' +
    'Blade wear, mat condition, and ambient humidity all affect cut accuracy.',
  requiresCalibration: true,
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
 * Returns the default material profile (Magic Flock + Cricut Maker).
 */
export function getDefaultMaterialProfile(): MaterialProfile {
  return MAGIC_FLOCK_CRICUT_MAKER_PROFILE;
}

/**
 * Returns the recommended hole diameter (mm) for a given stone size and
 * optional material profile. Applies kerfCompensation from the material
 * profile if provided.
 *
 * Falls back to the default material profile when `materialProfileId` is
 * omitted.
 */
export function getRecommendedHoleDiameter(
  stoneSizeId: StoneSizeId,
  materialProfileId?: string,
): number {
  const stoneProfile = getStoneSizeProfile(stoneSizeId);
  const materialProfile = materialProfileId
    ? getMaterialProfile(materialProfileId)
    : getDefaultMaterialProfile();
  return stoneProfile.recommendedHoleDiameterMm + materialProfile.kerfCompensationMm;
}

/**
 * Returns the recommended center-to-center distance (mm) between stones for
 * a given stone size and optional material profile. Applies the material
 * profile's spacingSafetyMarginMm on top of the stone's minCenterDistanceMm.
 *
 * Falls back to the default material profile when `materialProfileId` is
 * omitted.
 */
export function getRecommendedCenterDistance(
  stoneSizeId: StoneSizeId,
  materialProfileId?: string,
): number {
  const stoneProfile = getStoneSizeProfile(stoneSizeId);
  const materialProfile = materialProfileId
    ? getMaterialProfile(materialProfileId)
    : getDefaultMaterialProfile();
  return stoneProfile.minCenterDistanceMm + materialProfile.spacingSafetyMarginMm;
}
