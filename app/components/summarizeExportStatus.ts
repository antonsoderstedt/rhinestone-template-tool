import type { ExportReadinessIssue, ExportReadinessResult } from '@/src/lib/rhinestone-engine/index';

const CALIBRATION_CODES = new Set(['REQUIRES_APPROVED_CALIBRATION_PROFILE', 'REQUIRES_CALIBRATION']);

function isCalibrationIssue(issue: ExportReadinessIssue): boolean {
  return CALIBRATION_CODES.has(issue.code);
}

export interface ExportStatusSummary {
  designErrors: ExportReadinessIssue[];
  designWarnings: ExportReadinessIssue[];
  otherWarnings: ExportReadinessIssue[];
  needsCalibration: boolean;
  calibrationIssue: ExportReadinessIssue | null;
  exportBlocked: boolean;
  ready: boolean;
}

export function dedupeExportIssues(issues: readonly ExportReadinessIssue[]): ExportReadinessIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    if (seen.has(issue.code)) return false;
    seen.add(issue.code);
    return true;
  });
}

export function summarizeExportStatus(result: ExportReadinessResult | null): ExportStatusSummary {
  if (!result) {
    return {
      designErrors: [],
      designWarnings: [],
      otherWarnings: [],
      needsCalibration: false,
      calibrationIssue: null,
      exportBlocked: false,
      ready: false,
    };
  }

  const designErrors = dedupeExportIssues(result.issues.filter(
    (issue) => issue.severity === 'error' && !isCalibrationIssue(issue),
  ));
  const designWarnings = dedupeExportIssues(result.issues.filter(
    (issue) => issue.severity === 'warning' && !isCalibrationIssue(issue),
  ));
  const otherWarnings = result.issues.filter(
    (issue) => issue.severity === 'warning' && isCalibrationIssue(issue),
  );
  // Only the missing-approval error means "needs calibration". The engine also emits a
  // generic REQUIRES_CALIBRATION *warning* for every calibration-requiring material, even
  // when an approved profile exists, so it must not flip the state on its own.
  const calibrationIssue = result.issues.find((issue) => issue.code === 'REQUIRES_APPROVED_CALIBRATION_PROFILE') ?? null;
  const needsCalibration = calibrationIssue !== null;
  const exportBlocked = designErrors.length > 0 || needsCalibration;
  const ready = !exportBlocked && result.ready;

  return {
    designErrors,
    designWarnings,
    otherWarnings,
    needsCalibration,
    calibrationIssue,
    exportBlocked,
    ready,
  };
}

export type ExportGate =
  | 'no-design'
  | 'blocked-design-errors'
  | 'needs-calibration'
  | 'warnings'
  | 'ready';

/**
 * Decides what the Export action should do. Real design errors (overlaps,
 * invalid holes, ...) always block and can never be overridden. A missing
 * calibration approval is the only blocker the user may knowingly override
 * ("Export anyway (uncalibrated)").
 */
export function getExportGate(hasTemplate: boolean, summary: ExportStatusSummary): ExportGate {
  if (!hasTemplate) return 'no-design';
  if (summary.designErrors.length > 0) return 'blocked-design-errors';
  if (summary.needsCalibration) return 'needs-calibration';
  if (!summary.ready) return 'warnings';
  return 'ready';
}

export function getExportFilename(projectName: string, uncalibratedOverride: boolean): string {
  const base = projectName.trim().toLowerCase().replace(/\s+/g, '-') || 'rhinestone-design';
  return `${base}${uncalibratedOverride ? '-uncalibrated' : ''}.svg`;
}

export type ExportConfidenceTone = 'success' | 'warning' | 'danger';

export interface ExportConfidence {
  label: string;
  headline: string;
  tone: ExportConfidenceTone;
}

/**
 * Honest confidence labels. The software can only verify geometry (spacing,
 * overlaps, sizes) — it cannot verify that the material was physically
 * calibrated — so it never claims "high confidence" for the physical cut.
 */
export function getExportConfidence(summary: ExportStatusSummary): ExportConfidence {
  if (summary.designErrors.length > 0) {
    return { label: 'Blocked', headline: 'Fix errors before cutting', tone: 'danger' };
  }
  if (summary.needsCalibration) {
    return { label: 'Uncalibrated defaults', headline: 'Calibration needed before a production cut', tone: 'warning' };
  }
  if (summary.ready) {
    return { label: 'Design checks passed', headline: 'Ready for Cricut SVG export', tone: 'success' };
  }
  return { label: 'Needs review', headline: 'Review warnings before cutting', tone: 'warning' };
}
