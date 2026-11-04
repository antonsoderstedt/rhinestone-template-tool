/**
 * Export Readiness / Cricut QA v1
 *
 * Validates whether a RhinestoneTemplate is safe and ready for
 * Cricut/Magic Flock SVG export. All logic lives in the engine —
 * React components only render the result.
 */

import type { RhinestoneTemplate, StoneSizeId } from '../types/index';
import { validateRhinestoneTemplate } from '../validation/templateValidation';
import { getMaterialProfile, getDefaultMaterialProfile, isHolePresetProvisional } from '../profiles/materialProfiles';
import { getTemplatePhysicalSize } from '../sizing/templateSizing';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExportReadinessSeverity = 'error' | 'warning' | 'info';

export interface ExportReadinessIssue {
  severity: ExportReadinessSeverity;
  /** Short machine-readable code. */
  code: string;
  message: string;
  /** Concrete next action to help the user resolve the issue. */
  suggestion?: string;
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

const EXPORT_ISSUE_SUGGESTIONS: Record<string, string> = {
  INVALID_UNIT: 'Convert the template to millimeter coordinates before exporting.',
  NO_STONES: 'Create a design from a generator or add at least one stone to the template.',
  INVALID_HOLE_DIAMETER: 'Give each stone a valid positive hole diameter in millimeters.',
  EMPTY_ID: 'Give the template a non-empty id before exporting.',
  EMPTY_NAME: 'Give the template a non-empty name before exporting.',
  STONE_COLLISION: 'Separate overlapping stones or increase the spacing between them.',
  DUPLICATE_STONE_ID: 'Ensure every stone has a unique id before export.',
  INSUFFICIENT_STONES: 'Add more stones or lower the minimum threshold for this export check.',
  EXCEEDS_MAX_WIDTH: 'Reduce the design width or increase the allowed export limit for this material.',
  BELOW_MIN_WIDTH: 'Increase the width or lower the minimum threshold for this material.',
  EXCEEDS_MAX_HEIGHT: 'Reduce the design height or use a larger material area.',
  BELOW_MIN_HEIGHT: 'Increase the height or lower the minimum threshold for this material.',
  REQUIRES_CALIBRATION: 'Cut a calibration sheet and confirm the stone-to-hole fit before production use.',
  UNSUPPORTED_STONE_SIZE: 'Switch to a material-supported stone size or validate the fit with a test cut.',
  PROVISIONAL_HOLE_PRESET: 'Run a calibration sheet and confirm the actual hole size before moving into production.',
  TEXT_LABELS_NOT_CRICUT_SAFE: 'Turn labels off or verify that the exported SVG opens correctly in Cricut Design Space before cutting.',
};

export interface ExportReadinessOptions {
  /** Material profile to check against. Defaults to the Magic Flock profile. */
  materialProfileId?: string;
  /**
   * When true (default), emit a warning if the material profile requires
   * physical calibration before production use.
   */
  requireCalibration?: boolean;
  /**
   * The currently active calibration profile. When an active profile is present
   * but not approved for production, export is blocked for calibration-required
   * materials until it is approved.
   */
  approvedCalibrationProfile?: { approvedAt?: string } | null;
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
  /**
   * Whether the export will include `<text>` labels (the editor's
   * "Include labels" option). Cricut Design Space is not guaranteed to
   * import raw SVG `<text>` reliably, so this surfaces a warning rather
   * than silently reporting `ready: true` for a template that isn't
   * actually Cricut-safe with labels on.
   */
  includeLabels?: boolean;
}

/** Shared with the UI so the warning shown next to the "Include labels" checkbox can never drift from the one `checkExportReadiness` emits. */
export const TEXT_LABELS_NOT_CRICUT_SAFE_MESSAGE =
  'Text labels are not guaranteed to import reliably in Cricut Design Space. ' +
  'Verify the exported SVG opens correctly before cutting, or turn labels off for the safest result.';

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
      suggestion: 'Convert the template to millimeter coordinates before exporting.',
    });
  }

  // ── Stone count ───────────────────────────────────────────────────────────
  if (template.stones.length === 0) {
    issues.push({
      severity: 'error',
      code: 'NO_STONES',
      message: 'Template has no stones. At least one stone is required before exporting.',
      suggestion: 'Create a design from a generator or add at least one stone to the template.',
    });
  }

  if (minStoneCount !== undefined && template.stones.length < minStoneCount) {
    issues.push({
      severity: 'error',
      code: 'INSUFFICIENT_STONES',
      message:
        `Template has ${template.stones.length} stone(s) but minimum required is ${minStoneCount}.`,
      suggestion: 'Add more stones or lower the minimum threshold for this export check.',
    });
  }

  // ── Template validation (duplicates, invalid holes, collisions) ───────────
  // minGapMm enforces the material's minimum edge-to-edge spacing, not just
  // raw geometric overlap — see MaterialProfile.minimumEdgeSpacingMm.
  const validationResult = validateRhinestoneTemplate(template, {
    minGapMm: materialProfile.minimumEdgeSpacingMm,
  });
  for (const issue of validationResult.issues) {
    issues.push({
      severity: 'error',
      code: issue.code,
      message: issue.message,
      suggestion: EXPORT_ISSUE_SUGGESTIONS[issue.code],
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
      suggestion: 'Reduce the design width or increase the allowed export limit for this material.',
    });
  }
  if (minWidthMm !== undefined && physicalSize.widthMm < minWidthMm) {
    issues.push({
      severity: 'warning',
      code: 'BELOW_MIN_WIDTH',
      message:
        `Template width (${physicalSize.widthMm.toFixed(1)} mm) is below minimum (${minWidthMm} mm).`,
      suggestion: 'Increase the width or lower the minimum threshold for this material.',
    });
  }
  if (maxHeightMm !== undefined && physicalSize.heightMm > maxHeightMm) {
    issues.push({
      severity: 'warning',
      code: 'EXCEEDS_MAX_HEIGHT',
      message:
        `Template height (${physicalSize.heightMm.toFixed(1)} mm) exceeds maximum allowed (${maxHeightMm} mm).`,
      suggestion: 'Reduce the design height or use a larger material area.',
    });
  }
  if (minHeightMm !== undefined && physicalSize.heightMm < minHeightMm) {
    issues.push({
      severity: 'warning',
      code: 'BELOW_MIN_HEIGHT',
      message:
        `Template height (${physicalSize.heightMm.toFixed(1)} mm) is below minimum (${minHeightMm} mm).`,
      suggestion: 'Increase the height or lower the minimum threshold for this material.',
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
      suggestion: 'Cut a calibration sheet and confirm the stone-to-hole fit before production use.',
    });
  }

  if (
    options.approvedCalibrationProfile !== undefined
    && materialProfile.requiresCalibration
    && !options.approvedCalibrationProfile?.approvedAt
  ) {
    issues.push({
      severity: 'error',
      code: 'REQUIRES_APPROVED_CALIBRATION_PROFILE',
      message:
        `${materialProfile.name} requires an approved calibration profile before production export.`,
      suggestion: 'Open the setup workflow, approve the active calibration profile, and then export again.',
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
        suggestion: 'Switch to a material-supported stone size or validate the fit with a test cut.',
      });
    }
  }

  // ── Provisional hole presets (e.g. SS12 on Magic Flock) ──────────────────
  // Surfaces on any template using a stone size whose hole diameter has no
  // verified vendor source yet — not just on calibration sheets.
  for (const size of stoneSizes) {
    if (isHolePresetProvisional(size, materialProfile.id)) {
      issues.push({
        severity: 'warning',
        code: 'PROVISIONAL_HOLE_PRESET',
        message:
          `${size}'s hole diameter for ${materialProfile.name} has no verified vendor source ` +
          `yet and is a preliminary starting point only. Cut a calibration sheet and confirm the ` +
          `hole size before production use.`,
        suggestion: 'Run a calibration sheet and confirm the actual hole size before moving into production.',
      });
    }
  }

  // ── Text labels (Cricut Design Space compatibility) ──────────────────────
  if (options.includeLabels) {
    issues.push({
      severity: 'warning',
      code: 'TEXT_LABELS_NOT_CRICUT_SAFE',
      message: TEXT_LABELS_NOT_CRICUT_SAFE_MESSAGE,
      suggestion: 'Turn labels off or verify that the exported SVG opens correctly in Cricut Design Space before cutting.',
    });
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
