import { describe, it, expect } from 'vitest';
import {
  checkExportReadiness,
  createStoneGridTemplate,
  createDotMatrixTextTemplate,
  createPolylineRhinestoneTemplate,
  createRhinestoneTemplate,
} from '../src/lib/rhinestone-engine/index.js';
import type {
  RhinestoneTemplate,
  Stone,
  Polyline,
} from '../src/lib/rhinestone-engine/index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_GRID = createStoneGridTemplate({
  id: 'qa-test',
  name: 'QA Test Grid',
  stoneSize: 'SS10',
  columns: 4,
  rows: 2,
});

function makeOverlappingTemplate(): RhinestoneTemplate {
  const s1: Stone = { id: 's1', center: { x: 0, y: 0 }, stoneSize: 'SS10', holeDiameterMm: 3.0 };
  const s2: Stone = { id: 's2', center: { x: 0.5, y: 0 }, stoneSize: 'SS10', holeDiameterMm: 3.0 };
  return createRhinestoneTemplate({ id: 't', name: 'T', stones: [s1, s2] });
}

// ─── Basic readiness ──────────────────────────────────────────────────────────

describe('checkExportReadiness — clean template', () => {
  it('a clean grid template is ready', () => {
    const r = checkExportReadiness(VALID_GRID);
    expect(r.ready).toBe(true);
    expect(r.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('result is deterministic — calling twice gives identical ready/issue codes', () => {
    const r1 = checkExportReadiness(VALID_GRID);
    const r2 = checkExportReadiness(VALID_GRID);
    expect(r1.ready).toBe(r2.ready);
    expect(r1.issues.map((i) => i.code)).toEqual(r2.issues.map((i) => i.code));
  });
});

// ─── Error conditions ─────────────────────────────────────────────────────────

describe('checkExportReadiness — errors', () => {
  it('empty template (no stones) is not ready', () => {
    const empty = createRhinestoneTemplate({ id: 't', name: 'T', stones: [], widthMm: 50, heightMm: 50 });
    const r = checkExportReadiness(empty);
    expect(r.ready).toBe(false);
    expect(r.issues.some((i) => i.code === 'NO_STONES')).toBe(true);
  });

  it('template with invalid unit is not ready', () => {
    // Cast to bypass type check — simulates runtime misuse
    const bad = { ...VALID_GRID, unit: 'in' } as unknown as RhinestoneTemplate;
    const r = checkExportReadiness(bad);
    expect(r.ready).toBe(false);
    expect(r.issues.some((i) => i.code === 'INVALID_UNIT')).toBe(true);
  });

  it('template with overlapping stones is not ready', () => {
    const r = checkExportReadiness(makeOverlappingTemplate());
    expect(r.ready).toBe(false);
    expect(r.issues.some((i) => i.code === 'STONE_COLLISION')).toBe(true);
    expect(r.summary.hasCollisions).toBe(true);
  });

  it('minStoneCount produces error when count is too low', () => {
    const small = createStoneGridTemplate({
      id: 't', name: 'T', stoneSize: 'SS10', columns: 1, rows: 1,
    }); // 1 stone
    const r = checkExportReadiness(small, { minStoneCount: 5 });
    expect(r.ready).toBe(false);
    expect(r.issues.some((i) => i.code === 'INSUFFICIENT_STONES')).toBe(true);
  });
});

// ─── Warning conditions ───────────────────────────────────────────────────────

describe('checkExportReadiness — warnings', () => {
  it('material calibration warning is a warning (not an error) — template stays ready', () => {
    const r = checkExportReadiness(VALID_GRID, { requireCalibration: true });
    expect(r.ready).toBe(true); // warnings do not block export
    expect(r.summary.hasCalibrationWarning).toBe(true);
    expect(r.issues.some((i) => i.code === 'REQUIRES_CALIBRATION' && i.severity === 'warning')).toBe(true);
  });

  it('requireCalibration: false suppresses calibration warning', () => {
    const r = checkExportReadiness(VALID_GRID, { requireCalibration: false });
    expect(r.issues.every((i) => i.code !== 'REQUIRES_CALIBRATION')).toBe(true);
    expect(r.summary.hasCalibrationWarning).toBe(false);
  });

  it('warnings do not block ready — template with only warnings is ready', () => {
    // Only calibration warning expected
    const r = checkExportReadiness(VALID_GRID, { requireCalibration: true });
    expect(r.ready).toBe(true);
    expect(r.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('maxWidthMm exceeded produces a warning (not error)', () => {
    const r = checkExportReadiness(VALID_GRID, { maxWidthMm: 5, requireCalibration: false });
    expect(r.issues.some((i) => i.code === 'EXCEEDS_MAX_WIDTH' && i.severity === 'warning')).toBe(true);
    expect(r.ready).toBe(true); // still ready
  });

  it('minWidthMm not met produces a warning', () => {
    const r = checkExportReadiness(VALID_GRID, { minWidthMm: 999, requireCalibration: false });
    expect(r.issues.some((i) => i.code === 'BELOW_MIN_WIDTH' && i.severity === 'warning')).toBe(true);
  });

  it('maxHeightMm exceeded produces a warning', () => {
    const r = checkExportReadiness(VALID_GRID, { maxHeightMm: 1, requireCalibration: false });
    expect(r.issues.some((i) => i.code === 'EXCEEDS_MAX_HEIGHT' && i.severity === 'warning')).toBe(true);
  });

  it('minHeightMm not met produces a warning', () => {
    const r = checkExportReadiness(VALID_GRID, { minHeightMm: 999, requireCalibration: false });
    expect(r.issues.some((i) => i.code === 'BELOW_MIN_HEIGHT' && i.severity === 'warning')).toBe(true);
  });

  it('SS12 (provisional Magic Flock preset) produces a PROVISIONAL_HOLE_PRESET warning, not an error', () => {
    const ss12Grid = createStoneGridTemplate({
      id: 'ss12-grid', name: 'SS12 Grid', stoneSize: 'SS12', columns: 2, rows: 2,
    });
    const r = checkExportReadiness(ss12Grid, { requireCalibration: false });
    expect(r.ready).toBe(true); // provisional preset does not block export
    expect(r.issues.some((i) => i.code === 'PROVISIONAL_HOLE_PRESET' && i.severity === 'warning')).toBe(true);
  });

  it('verified stone sizes (e.g. SS10) do not produce PROVISIONAL_HOLE_PRESET', () => {
    const r = checkExportReadiness(VALID_GRID, { requireCalibration: false });
    expect(r.issues.some((i) => i.code === 'PROVISIONAL_HOLE_PRESET')).toBe(false);
  });
});

// ─── Summary ──────────────────────────────────────────────────────────────────

describe('checkExportReadiness — summary', () => {
  it('summary includes stoneCount', () => {
    const r = checkExportReadiness(VALID_GRID);
    expect(r.summary.stoneCount).toBe(VALID_GRID.stones.length);
  });

  it('summary includes widthMm and heightMm > 0 for a non-empty template', () => {
    const r = checkExportReadiness(VALID_GRID);
    expect(r.summary.widthMm).toBeGreaterThan(0);
    expect(r.summary.heightMm).toBeGreaterThan(0);
  });

  it('summary includes the stone sizes used', () => {
    const r = checkExportReadiness(VALID_GRID);
    expect(r.summary.stoneSizes).toContain('SS10');
    expect(r.summary.stoneSizes.length).toBeGreaterThan(0);
  });

  it('summary includes materialProfileId and cutter', () => {
    const r = checkExportReadiness(VALID_GRID);
    expect(typeof r.summary.materialProfileId).toBe('string');
    expect(typeof r.summary.cutter).toBe('string');
    expect(r.summary.cutter.length).toBeGreaterThan(0);
  });

  it('hasCollisions is false for clean template', () => {
    const r = checkExportReadiness(VALID_GRID);
    expect(r.summary.hasCollisions).toBe(false);
  });

  it('hasCollisions is true for overlapping template', () => {
    const r = checkExportReadiness(makeOverlappingTemplate());
    expect(r.summary.hasCollisions).toBe(true);
  });

  it('PHYSICAL_SIZE info issue is always present', () => {
    const r = checkExportReadiness(VALID_GRID);
    expect(r.issues.some((i) => i.code === 'PHYSICAL_SIZE' && i.severity === 'info')).toBe(true);
  });
});

// ─── Integration with generator templates ────────────────────────────────────

describe('checkExportReadiness — generator integration', () => {
  it('generated dot matrix text template passes readiness', () => {
    const t = createDotMatrixTextTemplate({
      id: 'qa', name: 'QA', text: 'HI', stoneSize: 'SS10',
    });
    const r = checkExportReadiness(t, { requireCalibration: false });
    expect(r.ready).toBe(true);
    expect(r.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('generated polyline template passes readiness', () => {
    const line: Polyline = { points: [{ x: 0, y: 0 }, { x: 50, y: 0 }] };
    const t = createPolylineRhinestoneTemplate({
      id: 'qa', name: 'QA', polylines: [line], stoneSize: 'SS10',
    });
    const r = checkExportReadiness(t, { requireCalibration: false });
    expect(r.ready).toBe(true);
  });
});
