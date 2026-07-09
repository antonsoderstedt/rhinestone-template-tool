/**
 * Calibration sheet generator for rhinestone templates.
 *
 * A calibration sheet is a RhinestoneTemplate containing rows of holes at
 * varying diameters. Cutting it on your actual machine and material lets you
 * find the hole size that snaps stones in cleanly without tearing the flock.
 *
 * ⚠️  All diameter values are PROVISIONAL. The recommended values in stone size
 * profiles are starting estimates only. You must cut a calibration sheet and
 * measure the results before using any diameter in a production run.
 *
 * Usage:
 * 1. Generate a calibration sheet with createCalibrationSheet().
 * 2. Export it to SVG with createBasicSvgExport() — same pipeline as production.
 * 3. Cut it on your Cricut Maker with your actual Magic Flock and blade.
 * 4. Place stones in each hole. Note which variant seats correctly.
 * 5. Update the material profile's kerfCompensationMm accordingly.
 */

import type { MaterialProfile, RhinestoneTemplate, Stone } from '../types/index.js';
import { getStoneSizeProfile } from '../profiles/stoneSizes.js';
import { getDefaultMaterialProfile } from '../profiles/materialProfiles.js';
import { roundMm } from '../geometry/rounding.js';

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
   * When true (default), each stone size produces four variants:
   *   recommendedHoleDiameterMm - 0.1 mm
   *   recommendedHoleDiameterMm
   *   recommendedHoleDiameterMm + 0.1 mm
   *   recommendedHoleDiameterMm + 0.2 mm
   *
   * When false, only the recommended diameter is included.
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
  /** Offset from recommended diameter (mm), e.g. -0.1, 0, 0.1, 0.2 */
  offsetMm: number;
  /** Human-readable label shown in stone metadata. */
  label: string;
}

const DIAMETER_VARIANTS: DiameterVariant[] = [
  { offsetMm: -0.1, label: 'recommended-0.1mm' },
  { offsetMm:  0.0, label: 'recommended'        },
  { offsetMm:  0.1, label: 'recommended+0.1mm'  },
  { offsetMm:  0.2, label: 'recommended+0.2mm'  },
];

const RECOMMENDED_ONLY_VARIANT: DiameterVariant[] = [
  { offsetMm: 0.0, label: 'recommended' },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a calibration sheet as a RhinestoneTemplate.
 *
 * The sheet contains one row per supported stone size. Each row contains
 * hole diameter variants so you can identify the correct cut size for your
 * specific machine and material batch.
 *
 * The returned template can be exported directly via createBasicSvgExport —
 * the same SVG export pipeline used for production templates.
 */
export function createCalibrationSheet(
  profile: MaterialProfile,
  options: CalibrationSheetOptions = {},
): RhinestoneTemplate {
  const opts = resolveOptions(options);
  const variants = opts.includeDiameterVariants ? DIAMETER_VARIANTS : RECOMMENDED_ONLY_VARIANT;

  const stones: Stone[] = [];
  const dp = 3;

  profile.supportedStoneSizes.forEach((sizeId, rowIndex) => {
    const sizeProfile = getStoneSizeProfile(sizeId);
    const recommended = sizeProfile.recommendedHoleDiameterMm;
    const cy = roundMm(opts.startYmm + rowIndex * opts.rowSpacingMm, dp);

    variants.forEach((variant, colIndex) => {
      const holeDiameter = roundMm(
        Math.max(0.1, recommended + variant.offsetMm),
        dp,
      );
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
          recommendedHoleDiameterMm: recommended,
          testedHoleDiameterMm: holeDiameter,
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
 * Magic Flock + Cricut Maker material profile with all defaults applied.
 */
export function createDefaultMagicFlockCalibrationSheet(): RhinestoneTemplate {
  return createCalibrationSheet(getDefaultMaterialProfile());
}
