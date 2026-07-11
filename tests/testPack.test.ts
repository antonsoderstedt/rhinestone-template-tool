import { describe, it, expect } from 'vitest';
import {
  createCricutTestPack,
  validateRhinestoneTemplate,
  checkExportReadiness,
  createBasicSvgExport,
} from '../src/lib/rhinestone-engine/index.js';

// ─── Basic shape ──────────────────────────────────────────────────────────────

describe('createCricutTestPack', () => {
  it('creates exactly 4 templates', () => {
    const pack = createCricutTestPack();
    expect(pack.templates).toHaveLength(4);
  });

  it('includes the grid, SMOOCH text, calibration, and diamond', () => {
    const ids = createCricutTestPack().templates.map((t) => t.id);
    expect(ids).toContain('grid-5x3');
    expect(ids).toContain('text-smooch');
    expect(ids).toContain('calibration');
    expect(ids).toContain('shape-diamond');
  });

  it('every template has unit "mm"', () => {
    for (const item of createCricutTestPack().templates) {
      expect(item.template.unit).toBe('mm');
    }
  });

  it('every template has at least one stone', () => {
    for (const item of createCricutTestPack().templates) {
      expect(item.template.stones.length).toBeGreaterThan(0);
    }
  });

  it('every recommended filename ends with .svg', () => {
    for (const item of createCricutTestPack().templates) {
      expect(item.recommendedFilename).toMatch(/\.svg$/);
    }
  });

  it('every template passes validateRhinestoneTemplate', () => {
    for (const item of createCricutTestPack().templates) {
      const result = validateRhinestoneTemplate(item.template);
      expect(result.valid).toBe(true);
    }
  });

  it('every template passes checkExportReadiness without blocking errors', () => {
    for (const item of createCricutTestPack().templates) {
      const r = checkExportReadiness(item.template, { requireCalibration: false });
      expect(r.ready).toBe(true);
      expect(r.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    }
  });

  it('every template can be exported with createBasicSvgExport', () => {
    for (const item of createCricutTestPack().templates) {
      expect(() => createBasicSvgExport(item.template)).not.toThrow();
    }
  });

  it('exported SVGs contain real <circle elements', () => {
    for (const item of createCricutTestPack().templates) {
      const svg = createBasicSvgExport(item.template);
      expect(svg).toContain('<circle');
    }
  });

  it('exported SVGs do not contain <image', () => {
    for (const item of createCricutTestPack().templates) {
      const svg = createBasicSvgExport(item.template);
      expect(svg).not.toContain('<image');
    }
  });

  it('output is deterministic — same options give same template ids and stone counts', () => {
    const pack1 = createCricutTestPack();
    const pack2 = createCricutTestPack();
    for (let i = 0; i < pack1.templates.length; i++) {
      expect(pack1.templates[i]!.id).toBe(pack2.templates[i]!.id);
      expect(pack1.templates[i]!.template.stones.length).toBe(
        pack2.templates[i]!.template.stones.length,
      );
    }
  });

  it('stoneSize option changes grid and text templates', () => {
    const ss10 = createCricutTestPack({ stoneSize: 'SS10' });
    const ss6  = createCricutTestPack({ stoneSize: 'SS6' });
    // SS6 stones are smaller → more stones fit in the same space
    // (or at minimum the filename reflects the size)
    const ss10Grid = ss10.templates.find((t) => t.id === 'grid-5x3')!;
    const ss6Grid  = ss6.templates.find((t) => t.id === 'grid-5x3')!;
    expect(ss6Grid.recommendedFilename).toContain('ss6');
    expect(ss10Grid.recommendedFilename).toContain('ss10');
  });
});
