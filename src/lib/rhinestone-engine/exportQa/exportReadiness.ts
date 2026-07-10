/**
 * Export Readiness / Cricut QA v1
 *
 * Validates whether a RhinestoneTemplate is safe and ready for
 * Cricut/Magic Flock SVG export. All logic lives in the engine —
 * React components only render the result.
 */

import type { RhinestoneTemplate, StoneSizeId } from '../types/index';
import { validateRhinestoneTemplate } from '../validation/templateValidation';
import { getMaterialProfile, getDefaultMaterialProfile } from '../profiles/materialProfiles';
import { getTemplatePhysicalSize } from '../sizing/templateSizing';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExportReadinessSeverity = 'error' | 'warning' | 'info';

export interface ExportReadinessIssue {
  severity: ExportReadinessSeverity;
  /** Short machine-readable code. */
  code: string;
  message: string;
  /** Stone IDs involved (for collision or hole-diameter issues). */
  stoneIds?: string[];
}

export interface ExportReadinessSummary {
  stoneCount: number;
  /** Physical output width including hole radii (mm). */
  widthMm: number;
  /** Physical output height including hole radii (mm). */
  heightMm: number;
  materialProfileId: string;
  cutter: string;
  /** Unique stone sizes used in the template. */
  stoneSizes: StoneSizeId[];
  /** True if any two stone circles overlap. */
  hasCollisions: boolean;
  /** True if the material profile's calibration warning was emitted. */
  hasCalibrationWarning: boolean;
}

export interface ExportReadinessResult {
  /** True when there are no issues with severity "error". */
  ready: boolean;
  issues: ExportReadinessIssue[];
  summary: ExportReadinessSummary;
}

export interface ExportReadinessOptions {
  /** Material profile to check against. Defaults to the Magic Flock profile. */
  materialProfileId?: string;
  /**
   * When true (default), emit a warning if the material profile requires
   * physical calibration before production use.
   */
  requireCalibration?: boolean;
  /** Warn if template width exceeds this value (mm). */
  maxWidthMm?: number;
  /** Warn if template width is below this value (mm). */
  minWidthMm?: number;
  /** Warn if template height exceeds this value (mm). */
  maxHeightMm?: number;
  /** Warn if template height is below this value (mm). */
  minHeightMm?: number;
  /** Error if template has fewer than this many stones. */
  minStoneCount?: number;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Checks whether a RhinestoneTemplate is ready for Cricut SVG export.
 *
 * Returns a structured result with:
 * - `ready`: true only when no "error" issues exist.
 * - `issues`: list of errors, warnings, and info messages.
 * - `summary`: physical size, stone count, material, cutter.
 *
 * This is the single source of truth for export readiness.
 * React components must call this function — not duplicate its logic.
 */
export function checkExportReadiness(
  template: RhinestoneTemplate,
  options: ExportReadinessOptions = {},
): ExportReadinessResult {
  const issues: ExportReadinessIssue[] = [];

  const {
    requireCalibration = true,
    maxWidthMm,
    minWidthMm,
    maxHeightMm,
    minHeightMm,
    minStoneCount,
  } = options;

  // ── Material profile ─────────────────────────────────────────────────────
  const materialProfile = options.materialProfileId
    ? getMaterialProfile(options.materialProfileId)
    : getDefaultMaterialProfile();

  // ── Unit check ────────────────────────────────────────────────────────────
  if (template.unit !== 'mm') {
    issues.push({
      severity: 'error',
      code: 'INVALID_UNIT',
      message: `template.unit must be "mm", got "${template.unit}". All internal coordinates must be in millimeters.`,
    });
  }

  // ── Stone count ───────────────────────────────────────────────────────────
  if (template.stones.length === 0) {
    issues.push({
      severity: 'error',
      code: 'NO_STONES',
      message: 'Template has no stones. At least one stone is required before exporting.',
    });
  }

  if (minStoneCount !== undefined && template.stones.length < minStoneCount) {
    issues.push({
      severity: 'error',
      code: 'INSUFFICIENT_STONES',
      message:
        `Template has ${template.stones.length} stone(s) but minimum required is ${minStoneCount}.`,
    });
  }

  // ── Template validation (duplicates, invalid holes, collisions) ───────────
  const validationResult = validateRhinestoneTemplate(template);
  for (const issue of validationResult.issues) {
    issues.push({
      severity: 'error',
      code: issue.code,
      message: issue.message,
      stoneIds: issue.stoneIds,
    });
  }

  // Derive collision flag from validation issues
  const hasCollisions = validationResult.issues.some((i) => i.code === 'STONE_COLLISION');

  // ── Physical size ─────────────────────────────────────────────────────────
  const physicalSize = getTemplatePhysicalSize(template);

  if (maxWidthMm !== undefined && physicalSize.widthMm > maxWidthMm) {
    issues.push({
      severity: 'warning',
      code: 'EXCEEDS_MAX_WIDTH',
      message:
        `Template width (${physicalSize.widthMm.toFixed(1)} mm) exceeds maximum allowed (${maxWidthMm} mm).`,
    });
  }
  if (minWidthMm !== undefined && physicalSize.widthMm < minWidthMm) {
    issues.push({
      severity: 'warning',
      code: 'BELOW_MIN_WIDTH',
      message:
        `Template width (${physicalSize.widthMm.toFixed(1)} mm) is below minimum (${minWidthMm} mm).`,
    });
  }
  if (maxHeightMm !== undefined && physicalSize.heightMm > maxHeightMm) {
    issues.push({
      severity: 'warning',
      code: 'EXCEEDS_MAX_HEIGHT',
      message:
        `Template height (${physicalSize.heightMm.toFixed(1)} mm) exceeds maximum allowed (${maxHeightMm} mm).`,
    });
  }
  if (minHeightMm !== undefined && physicalSize.heightMm < minHeightMm) {
    issues.push({
      severity: 'warning',
      code: 'BELOW_MIN_HEIGHT',
      message:
        `Template height (${physicalSize.heightMm.toFixed(1)} mm) is below minimum (${minHeightMm} mm).`,
    });
  }

  // ── Calibration warning ───────────────────────────────────────────────────
  let hasCalibrationWarning = false;
  if (requireCalibration && materialProfile.requiresCalibration) {
    hasCalibrationWarning = true;
    issues.push({
      severity: 'warning',
      code: 'REQUIRES_CALIBRATION',
      message:
        `${materialProfile.name} (${materialProfile.cutter}) requires physical calibration ` +
        `before production use. Cut a calibration sheet first.`,
    });
  }

  // ── Unsupported stone sizes ───────────────────────────────────────────────
  const stoneSizes = [...new Set(template.stones.map((s) => s.stoneSize))] as StoneSizeId[];
  for (const size of stoneSizes) {
    if (!materialProfile.supportedStoneSizes.includes(size)) {
      issues.push({
        severity: 'warning',
        code: 'UNSUPPORTED_STONE_SIZE',
        message:
          `Stone size ${size} is not listed as supported by ${materialProfile.name}. ` +
          `Verify compatibility before cutting.`,
      });
    }
  }

  // ── Info: physical size ───────────────────────────────────────────────────
  issues.push({
    severity: 'info',
    code: 'PHYSICAL_SIZE',
    message:
      `Estimated output: ${physicalSize.widthMm.toFixed(1)} × ${physicalSize.heightMm.toFixed(1)} mm, ` +
      `${template.stones.length} stone(s). Values are provisional until calibrated.`,
  });

  // ── Result ────────────────────────────────────────────────────────────────
  const ready = issues.every((i) => i.severity !== 'error');

  const summary: ExportReadinessSummary = {
    stoneCount: template.stones.length,
    widthMm: physicalSize.widthMm,
    heightMm: physicalSize.heightMm,
    materialProfileId: materialProfile.id,
    cutter: materialProfile.cutter,
    stoneSizes,
    hasCollisions,
    hasCalibrationWarning,
  };

  return { ready, issues, summary };
}
