/**
 * Calibration sheet generator for rhinestone templates.
 *
 * A calibration sheet is a RhinestoneTemplate containing rows of holes at
 * varying diameters. Cutting it on your actual machine and material lets you
 * find the hole size that snaps stones in cleanly without tearing the flock.
 *
 * Each stone size's test series comes from the material profile's own
 * HolePreset.calibrationValuesMm when defined (e.g. Magic Flock's 5-value,
 * vendor-derived series). Materials without an explicit preset for a size
 * fall back to a generic 4-value series around the resolved recommended
 * diameter.
 *
 * ⚠️  Provisional presets (HolePreset.status === 'provisional', e.g. SS12 on
 * Magic Flock) have no verified vendor source. The sheet is self-documenting:
 * every stone's metadata records its preset status and any calibration note.
 *
 * Usage:
 * 1. Generate a calibration sheet with createCalibrationSheet().
 * 2. Export it to SVG with createBasicSvgExport() — same pipeline as production.
 * 3. Cut it on your Cricut Maker 3 with your actual Magic Flock and blade.
 * 4. Place stones in each hole. Note which variant seats correctly.
 * 5. Update the material profile's kerfCompensationMm accordingly.
 */

import type { MaterialProfile, RhinestoneTemplate, Stone, StoneSizeId } from '../types/index';
import {
  getCalibrationSeries,
  getDefaultMaterialProfile,
  getHolePreset,
  getRecommendedHoleDiameter,
} from '../profiles/materialProfiles';
import { roundMm } from '../geometry/rounding';

// ─── Options ──────────────────────────────────────────────────────────────────

export interface CalibrationSheetOptions {
  /** id for the resulting RhinestoneTemplate. */
  id?: string;
  /** Display name for the resulting RhinestoneTemplate. */
  name?: string;
  /** X coordinate of the first stone in the sheet (mm). Default: 10. */
  startXmm?: number;
  /** Y coordinate of the first stone in the sheet (mm). Default: 10. */
  startYmm?: number;
  /**
   * Vertical distance between rows (centre-to-centre, mm). Default: 12.
   * Should be large enough to clearly separate rows for visual inspection.
   */
  rowSpacingMm?: number;
  /**
   * Horizontal distance between stones within a row (centre-to-centre, mm).
   * Default: 12. Should be large enough to clearly separate columns.
   */
  columnSpacingMm?: number;
  /**
   * When true (default), each stone size produces its full calibration test
   * series (5 values for a material with an explicit HolePreset, e.g. Magic
   * Flock; 4 generic values otherwise).
   *
   * When false, only the recommended/default diameter is included.
   */
  includeDiameterVariants?: boolean;
}

/** Resolved, fully-populated options after defaults are applied. */
interface ResolvedCalibrationOptions {
  id: string;
  name: string;
  startXmm: number;
  startYmm: number;
  rowSpacingMm: number;
  columnSpacingMm: number;
  includeDiameterVariants: boolean;
}

function resolveOptions(options: CalibrationSheetOptions = {}): ResolvedCalibrationOptions {
  return {
    id: options.id ?? 'magic-flock-calibration-sheet',
    name: options.name ?? 'Magic Flock Calibration Sheet',
    startXmm: options.startXmm ?? 10,
    startYmm: options.startYmm ?? 10,
    rowSpacingMm: options.rowSpacingMm ?? 12,
    columnSpacingMm: options.columnSpacingMm ?? 12,
    includeDiameterVariants: options.includeDiameterVariants ?? true,
  };
}

// ─── Diameter variants ────────────────────────────────────────────────────────

interface DiameterVariant {
  /** The test hole diameter (mm). */
  holeDiameterMm: number;
  /** Human-readable label shown in stone metadata. */
  label: string;
  /** True for the row's default/recommended value. */
  isDefault: boolean;
}

/**
 * Builds the ordered list of diameter variants to test for one stone size,
 * from the material's own calibration series when available.
 */
function buildVariantsForSize(
  profile: MaterialProfile,
  stoneSizeId: StoneSizeId,
): DiameterVariant[] {
  const series = getCalibrationSeries(stoneSizeId, profile.id).map((v) => roundMm(v, 3));
  const recommended = roundMm(getRecommendedHoleDiameter(stoneSizeId, profile.id), 3);

  return series.map((holeDiameterMm, index) => ({
    holeDiameterMm,
    label: holeDiameterMm === recommended ? 'recommended' : `test-${index + 1}`,
    isDefault: holeDiameterMm === recommended,
  }));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a calibration sheet as a RhinestoneTemplate.
 *
 * The sheet contains one row per supported stone size. Each row contains
 * hole diameter variants from the material's calibration series so you can
 * identify the correct cut size for your specific machine and material batch.
 *
 * The returned template can be exported directly via createBasicSvgExport —
 * the same SVG export pipeline used for production templates.
 */
export function createCalibrationSheet(
  profile: MaterialProfile,
  options: CalibrationSheetOptions = {},
): RhinestoneTemplate {
  const opts = resolveOptions(options);

  const stones: Stone[] = [];
  const dp = 3;

  profile.supportedStoneSizes.forEach((sizeId, rowIndex) => {
    const preset = getHolePreset(sizeId, profile.id);
    const recommended = roundMm(getRecommendedHoleDiameter(sizeId, profile.id), dp);
    const allVariants = buildVariantsForSize(profile, sizeId);
    const variants = opts.includeDiameterVariants
      ? allVariants
      : allVariants.filter((v) => v.isDefault);
    const cy = roundMm(opts.startYmm + rowIndex * opts.rowSpacingMm, dp);

    variants.forEach((variant, colIndex) => {
      const holeDiameter = roundMm(Math.max(0.1, variant.holeDiameterMm), dp);
      const cx = roundMm(opts.startXmm + colIndex * opts.columnSpacingMm, dp);

      // IDs are deterministic: built from fixed inputs only
      const id = `${sizeId}-${variant.label}-row${rowIndex}-col${colIndex}`;

      const stone: Stone = {
        id,
        center: { x: cx, y: cy },
        stoneSize: sizeId,
        holeDiameterMm: holeDiameter,
        metadata: {
          calibration: true,
          materialProfileId: profile.id,
          materialName: profile.name,
          cutter: profile.cutter,
          variantLabel: variant.label,
          isDefaultVariant: variant.isDefault,
          recommendedHoleDiameterMm: recommended,
          testedHoleDiameterMm: holeDiameter,
          presetStatus: preset?.status ?? 'provisional',
          ...(preset?.note ? { presetNote: preset.note } : {}),
        },
      };

      stones.push(stone);
    });
  });

  return {
    id: opts.id,
    name: opts.name,
    unit: 'mm',
    stones,
  };
}

/**
 * Convenience function: creates a calibration sheet using the default
 * Magic Flock + Cricut Maker 3 material profile with all defaults applied.
 */
export function createDefaultMagicFlockCalibrationSheet(): RhinestoneTemplate {
  return createCalibrationSheet(getDefaultMaterialProfile());
}
