/**
 * Stone size profiles for SS6, SS8, SS10, SS12, SS16, and SS20 rhinestones.
 *
 * ⚠️  PROVISIONAL VALUES — ALL VALUES MUST BE PHYSICALLY VALIDATED.
 *
 * These are reasonable starting estimates. Actual dimensions will vary
 * depending on:
 *   - Rhinestone supplier and batch tolerances
 *   - Blade condition and depth setting
 *   - Cut pressure and speed settings
 *   - Flock material batch and ambient humidity
 *   - Mat tackiness and machine unit variation
 *
 * Run the calibration workflow in docs/CALIBRATION_PLAN.md before
 * using any of these values in a production cut.
 */

import type { StoneSizeId, StoneSizeProfile } from '../types/index';

// ─── Profiles ─────────────────────────────────────────────────────────────────

/**
 * SS6 — smallest supported size.
 *
 * ⚠️  PROVISIONAL: hole diameter and center distance have not been validated
 * by physical cut test. See docs/CALIBRATION_PLAN.md.
 */
const SS6_PROFILE: StoneSizeProfile = {
  id: 'SS6',
  label: 'SS6 (2.0 mm)',
  stoneDiameterMm: 2.0,
  // Provisional — must be validated by physical cut test
  recommendedHoleDiameterMm: 2.1,
  // Provisional — must be validated by physical cut test
  minCenterDistanceMm: 2.35,
  notes:
    'Smallest supported size. Very tight spacing — validate carefully before use. ' +
    'All values are provisional and require physical calibration.',
  requiresPhysicalValidation: true,
};

/**
 * SS8
 *
 * ⚠️  PROVISIONAL: hole diameter and center distance have not been validated
 * by physical cut test. See docs/CALIBRATION_PLAN.md.
 */
const SS8_PROFILE: StoneSizeProfile = {
  id: 'SS8',
  label: 'SS8 (2.4 mm)',
  stoneDiameterMm: 2.4,
  // Provisional — must be validated by physical cut test
  recommendedHoleDiameterMm: 2.6,
  // Provisional — must be validated by physical cut test
  minCenterDistanceMm: 2.9,
  notes:
    'Standard small size. All values are provisional and require physical calibration.',
  requiresPhysicalValidation: true,
};

/**
 * SS10 — default recommended size for Magic Flock.
 *
 * ⚠️  PROVISIONAL: hole diameter and center distance have not been validated
 * by physical cut test. See docs/CALIBRATION_PLAN.md.
 */
const SS10_PROFILE: StoneSizeProfile = {
  id: 'SS10',
  label: 'SS10 (2.8 mm)',
  stoneDiameterMm: 2.8,
  // Provisional — must be validated by physical cut test
  recommendedHoleDiameterMm: 3.0,
  // Provisional — must be validated by physical cut test
  minCenterDistanceMm: 3.35,
  notes:
    'Default size for Magic Flock + Cricut Maker. Good balance of coverage and ' +
    'structural integrity. All values are provisional and require physical calibration.',
  requiresPhysicalValidation: true,
};

/**
 * SS12 — largest supported size.
 *
 * ⚠️  PROVISIONAL: hole diameter and center distance have not been validated
 * by physical cut test. See docs/CALIBRATION_PLAN.md.
 */
const SS12_PROFILE: StoneSizeProfile = {
  id: 'SS12',
  label: 'SS12 (3.1 mm)',
  stoneDiameterMm: 3.1,
  // Provisional — must be validated by physical cut test
  recommendedHoleDiameterMm: 3.3,
  // Provisional — must be validated by physical cut test
  minCenterDistanceMm: 3.7,
  notes:
    'Largest supported size. Fewer stones per design — verify legibility at small ' +
    'sizes. All values are provisional and require physical calibration.',
  requiresPhysicalValidation: true,
};

/**
 * SS16 — TRW Clean Stone rhinestone font size.
 *
 * ⚠️  PROVISIONAL: These values are derived from TRW vendor specifications for
 * rhinestone fonts. Hole diameter and center distance are estimated and have not
 * been validated by physical cut test. See docs/CALIBRATION_PLAN.md.
 */
const SS16_PROFILE: StoneSizeProfile = {
  id: 'SS16',
  label: 'SS16 (4.394 mm)',
  stoneDiameterMm: 4.394, // TRW Clean Stone calibration
  // Provisional — must be validated by physical cut test
  recommendedHoleDiameterMm: 4.6,
  // Provisional — must be validated by physical cut test
  minCenterDistanceMm: 5.0,
  notes:
    'TRW rhinestone font size. Based on vendor specifications. ' +
    'All values are provisional and require physical calibration.',
  requiresPhysicalValidation: true,
};

/**
 * SS20 — TRW Clean Stone rhinestone font size (largest).
 *
 * ⚠️  PROVISIONAL: These values are derived from TRW vendor specifications for
 * rhinestone fonts. Hole diameter and center distance are estimated and have not
 * been validated by physical cut test. See docs/CALIBRATION_PLAN.md.
 */
const SS20_PROFILE: StoneSizeProfile = {
  id: 'SS20',
  label: 'SS20 (5.283 mm)',
  stoneDiameterMm: 5.283, // TRW Clean Stone calibration
  // Provisional — must be validated by physical cut test
  recommendedHoleDiameterMm: 5.5,
  // Provisional — must be validated by physical cut test
  minCenterDistanceMm: 6.0,
  notes:
    'TRW rhinestone font size (largest). Based on vendor specifications. ' +
    'All values are provisional and require physical calibration.',
  requiresPhysicalValidation: true,
};

// ─── Registry ─────────────────────────────────────────────────────────────────

/** Ordered map of all stone size profiles, indexed by StoneSizeId. */
export const STONE_SIZE_PROFILES: Readonly<Record<StoneSizeId, StoneSizeProfile>> = {
  SS6: SS6_PROFILE,
  SS8: SS8_PROFILE,
  SS10: SS10_PROFILE,
  SS12: SS12_PROFILE,
  SS16: SS16_PROFILE,
  SS20: SS20_PROFILE,
};

// ─── Accessors ────────────────────────────────────────────────────────────────

/**
 * Returns the profile for the given stone size, or throws if the id is not
 * in the registry.
 */
export function getStoneSizeProfile(id: StoneSizeId): StoneSizeProfile {
  return assertStoneSizeProfile(id);
}

/**
 * Returns the profile for the given stone size, or throws if the id is
 * not in the registry. Use this in contexts where a missing profile is a
 * programming error.
 */
export function assertStoneSizeProfile(id: StoneSizeId): StoneSizeProfile {
  const profile = STONE_SIZE_PROFILES[id];
  if (!profile) {
    throw new Error(
      `Unknown stone size id: "${id}". Valid ids are: ${Object.keys(STONE_SIZE_PROFILES).join(', ')}.`,
    );
  }
  return profile;
}
