/**
 * Stone spacing / density presets.
 *
 * Provides safe, deterministic spacing values for a given stone size and
 * material profile. All values are in millimeters.
 *
 * Why density controls matter:
 * - Placing stones too close tears the flock material (holes merge or bridges break).
 * - Placing stones too loosely wastes material and looks gapped.
 * - The presets express common trade-offs: safe for beginners, dense for maximum
 *   coverage when calibrated, loose for decorative open designs.
 * - Dense mode is clamped to the physical minimum so it is always safe to cut.
 * - Custom spacing must be validated before use in production.
 */

import type { StoneSizeId } from '../types/index';
import { getMinimumCenterDistance, getRecommendedCenterDistance, getRecommendedHoleDiameter } from '../profiles/materialProfiles';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Named density preset.
 *
 * - `safe`:     recommended + 0.25 mm extra gap
 * - `standard`: exactly the recommended center distance
 * - `dense`:    recommended − 0.15 mm, clamped to stone minCenterDistanceMm
 * - `loose`:    recommended + 0.5 mm extra gap
 * - `custom`:   caller-supplied value (validated against minCenterDistanceMm)
 */
export type DensityPreset = 'safe' | 'standard' | 'dense' | 'loose' | 'custom';

export interface GetDensitySpacingOptions {
  stoneSize: StoneSizeId;
  materialProfileId?: string;
  preset: DensityPreset;
  /** Required when preset is "custom". */
  customSpacingMm?: number;
}

export interface DensitySpacingResult {
  preset: DensityPreset;
  stoneSize: StoneSizeId;
  /** From getRecommendedCenterDistance (includes safety margin). */
  recommendedCenterDistanceMm: number;
  /** Actual spacing to use for stone placement (mm). */
  spacingMm: number;
  /**
   * Absolute physical minimum center distance for this stone size + material
   * (from getMinimumCenterDistance — holeDiameterMm + minimumEdgeSpacingMm).
   */
  minAllowedSpacingMm: number;
  /** Present if dense spacing was clamped to the minimum. */
  warning?: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the spacing (mm) for the given density preset.
 *
 * @throws if preset is "custom" and customSpacingMm is missing or invalid.
 * @throws if customSpacingMm is below the stone's minCenterDistanceMm.
 */
export function getDensitySpacing(
  options: GetDensitySpacingOptions,
): DensitySpacingResult {
  const { stoneSize, materialProfileId, preset } = options;

  const recommended = getRecommendedCenterDistance(stoneSize, materialProfileId);
  const holeDiameterMm = getRecommendedHoleDiameter(stoneSize, materialProfileId);
  const minAllowed = getMinimumCenterDistance(holeDiameterMm / 2, holeDiameterMm / 2, materialProfileId);

  let spacingMm: number;
  let warning: string | undefined;

  switch (preset) {
    case 'safe':
      spacingMm = recommended + 0.25;
      break;

    case 'standard':
      spacingMm = recommended;
      break;

    case 'dense': {
      const target = recommended - 0.15;
      if (target < minAllowed) {
        spacingMm = minAllowed;
        warning =
          `Dense spacing (${target.toFixed(3)} mm) would be below the minimum allowed ` +
          `center distance (${minAllowed} mm) for ${stoneSize}. ` +
          `Clamped to ${minAllowed} mm.`;
      } else {
        spacingMm = target;
      }
      break;
    }

    case 'loose':
      spacingMm = recommended + 0.5;
      break;

    case 'custom': {
      const { customSpacingMm } = options;
      if (customSpacingMm === undefined) {
        throw new Error(
          `getDensitySpacing: preset "custom" requires customSpacingMm.`,
        );
      }
      if (!isFinite(customSpacingMm) || customSpacingMm <= 0) {
        throw new Error(
          `getDensitySpacing: customSpacingMm must be a finite positive number, got ${customSpacingMm}.`,
        );
      }
      if (customSpacingMm < minAllowed) {
        throw new Error(
          `getDensitySpacing: customSpacingMm (${customSpacingMm} mm) is below the ` +
            `minimum allowed center distance (${minAllowed} mm) for ${stoneSize}. ` +
            `Stones would overlap or tear the material.`,
        );
      }
      spacingMm = customSpacingMm;
      break;
    }

    default:
      throw new Error(
        `getDensitySpacing: unknown preset "${String(preset)}". ` +
          `Valid presets: safe, standard, dense, loose, custom.`,
      );
  }

  return {
    preset,
    stoneSize,
    recommendedCenterDistanceMm: recommended,
    spacingMm,
    minAllowedSpacingMm: minAllowed,
    warning,
  };
}

/**
 * Returns a labelled list of all density presets — useful for rendering
 * a select/dropdown in the UI.
 */
export function getDensityPresetOptions(): Array<{
  value: DensityPreset;
  label: string;
  description: string;
}> {
  return [
    { value: 'safe',     label: 'Safe',     description: '+0.25 mm gap — conservative' },
    { value: 'standard', label: 'Standard', description: 'Recommended center distance' },
    { value: 'dense',    label: 'Dense',    description: '−0.15 mm, clamped to minimum' },
    { value: 'loose',    label: 'Loose',    description: '+0.5 mm gap — open spacing' },
    { value: 'custom',   label: 'Custom',   description: 'Enter a specific value in mm' },
  ];
}
