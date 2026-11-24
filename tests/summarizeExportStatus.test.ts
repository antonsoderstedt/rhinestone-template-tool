import { describe, expect, it } from 'vitest';
import { checkExportReadiness } from '../src/lib/rhinestone-engine/index';
import type { ExportReadinessResult, RhinestoneTemplate } from '../src/lib/rhinestone-engine/index';
import { dedupeExportIssues, getExportConfidence, getExportFilename, getExportGate, summarizeExportStatus } from '../app/components/summarizeExportStatus';

function makeResult(issues: ExportReadinessResult['issues'], ready = false): ExportReadinessResult {
  return {
    ready,
    issues,
    summary: {
      stoneCount: 10,
      widthMm: 100,
      heightMm: 40,
      materialProfileId: 'magic-flock-cricut-maker',
      cutter: 'Cricut Maker',
      stoneSizes: ['SS10'],
      hasCollisions: false,
      hasCalibrationWarning: false,
    },
  };
}

describe('summarizeExportStatus', () => {
  it('reports no design errors and needs calibration when profile is unapproved', () => {
    const result = summarizeExportStatus(makeResult([
      {
        severity: 'error',
        code: 'REQUIRES_APPROVED_CALIBRATION_PROFILE',
        message: 'Open the setup workflow, approve the active calibration profile.',
      },
    ]));

    expect(result.designErrors).toHaveLength(0);
    expect(result.needsCalibration).toBe(true);
    expect(result.exportBlocked).toBe(true);
  });

  it('counts true overlaps as design errors even with approved calibration', () => {
    const result = summarizeExportStatus(makeResult([
      {
        severity: 'error',
        code: 'STONE_COLLISION',
        message: 'Stones overlap.',
      },
    ]));

    expect(result.designErrors.length).toBeGreaterThan(0);
    expect(result.needsCalibration).toBe(false);
    expect(result.exportBlocked).toBe(true);
  });

  it('reports ready when valid and approved', () => {
    const result = summarizeExportStatus(makeResult([], true));

    expect(result.designErrors).toHaveLength(0);
    expect(result.needsCalibration).toBe(false);
    expect(result.ready).toBe(true);
  });

  it('deduplicates export issues by code', () => {
    const issue = {
      severity: 'error' as const,
      code: 'STONE_COLLISION',
      message: 'Stones overlap.',
    };
    expect(dedupeExportIssues([issue, issue])).toEqual([issue]);
  });
});

describe('getExportGate', () => {
  const calibrationIssue = {
    severity: 'error' as const,
    code: 'REQUIRES_APPROVED_CALIBRATION_PROFILE',
    message: 'Needs approval.',
  };
  const overlapIssue = { severity: 'error' as const, code: 'STONE_COLLISION', message: 'Overlap.' };

  it('reports no-design when there is no template', () => {
    expect(getExportGate(false, summarizeExportStatus(null))).toBe('no-design');
  });

  it('only offers the calibration path when calibration is the sole blocker', () => {
    const summary = summarizeExportStatus(makeResult([calibrationIssue]));
    expect(getExportGate(true, summary)).toBe('needs-calibration');
  });

  it('never lets a true design error be overridden, even when calibration is also missing', () => {
    const summary = summarizeExportStatus(makeResult([calibrationIssue, overlapIssue]));
    expect(getExportGate(true, summary)).toBe('blocked-design-errors');
  });

  it('returns ready for a valid, approved design and warnings for a non-ready one', () => {
    expect(getExportGate(true, summarizeExportStatus(makeResult([], true)))).toBe('ready');
    expect(getExportGate(true, summarizeExportStatus(makeResult([], false)))).toBe('warnings');
  });
});

describe('getExportFilename', () => {
  it('slugifies the project name and marks uncalibrated overrides in the filename', () => {
    expect(getExportFilename('My Design', false)).toBe('my-design.svg');
    expect(getExportFilename('My Design', true)).toBe('my-design-uncalibrated.svg');
  });

  it('falls back to a default name for an empty project name', () => {
    expect(getExportFilename('   ', false)).toBe('rhinestone-design.svg');
  });
});

describe('getExportConfidence', () => {
  const calibrationIssue = {
    severity: 'error' as const,
    code: 'REQUIRES_APPROVED_CALIBRATION_PROFILE',
    message: 'Needs approval.',
  };

  it('labels an uncalibrated but valid design honestly, never as high confidence', () => {
    const confidence = getExportConfidence(summarizeExportStatus(makeResult([calibrationIssue])));
    expect(confidence.label).toBe('Uncalibrated defaults');
    expect(confidence.tone).toBe('warning');
    expect(confidence.label).not.toMatch(/high confidence/i);
  });

  it('labels real design errors as blocked and valid approved designs as checks passed', () => {
    const blocked = getExportConfidence(
      summarizeExportStatus(makeResult([{ severity: 'error', code: 'STONE_COLLISION', message: 'Overlap.' }])),
    );
    expect(blocked.label).toBe('Blocked');
    expect(blocked.tone).toBe('danger');

    const passed = getExportConfidence(summarizeExportStatus(makeResult([], true)));
    expect(passed.label).toBe('Design checks passed');
    expect(passed.tone).toBe('success');
  });
});

describe('summarizeExportStatus — against the real engine (approved vs unapproved profile)', () => {
  const template: RhinestoneTemplate = {
    id: 'engine-check',
    name: 'Engine check',
    unit: 'mm',
    stones: Array.from({ length: 6 }, (_, index) => ({
      id: `s${index}`,
      stoneSize: 'SS10' as const,
      holeDiameterMm: 3.0,
      center: { x: index * 8, y: 0 },
    })),
  };

  it('is ready (not "needs calibration") when an approved profile exists, even though the engine still emits the generic REQUIRES_CALIBRATION warning', () => {
    const result = checkExportReadiness(template, { approvedCalibrationProfile: { approvedAt: '2026-11-19T00:00:00.000Z' } });
    expect(result.issues.some((issue) => issue.code === 'REQUIRES_CALIBRATION')).toBe(true);

    const summary = summarizeExportStatus(result);
    expect(summary.needsCalibration).toBe(false);
    expect(summary.designErrors).toHaveLength(0);
    expect(summary.ready).toBe(true);
    expect(getExportGate(true, summary)).toBe('ready');
    expect(getExportConfidence(summary).label).toBe('Design checks passed');
  });

  it('needs calibration when no approved profile exists', () => {
    for (const profile of [null, {}] as const) {
      const summary = summarizeExportStatus(checkExportReadiness(template, { approvedCalibrationProfile: profile }));
      expect(summary.needsCalibration).toBe(true);
      expect(summary.designErrors).toHaveLength(0);
      expect(getExportGate(true, summary)).toBe('needs-calibration');
    }
  });
});
