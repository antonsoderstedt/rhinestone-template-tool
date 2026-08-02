import { describe, it, expect } from 'vitest';
import {
  createPolylineFilledRhinestoneTemplate,
  validateRhinestoneTemplate,
  checkExportReadiness,
  createBasicSvgExport,
} from '../src/lib/rhinestone-engine/index.js';
import type { Polyline } from '../src/lib/rhinestone-engine/index.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** 40×30mm closed rectangle — large enough for reliable fill coverage. */
const CLOSED_RECT: Polyline = {
  points: [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 30 },
    { x: 0, y: 30 },
  ],
  closed: true,
};

/** Same rectangle but not closed (open path). */
const OPEN_RECT: Polyline = {
  points: [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 40, y: 30 },
    { x: 0, y: 30 },
  ],
  closed: false,
};

const BASE_OPTS = {
  id: 'fill-test',
  name: 'Fill Test',
  stoneSize: 'SS10' as const,
};

// ─── Outline mode ─────────────────────────────────────────────────────────────

describe('createPolylineFilledRhinestoneTemplate — outline mode', () => {
  it('creates stones along the outline path', () => {
    const t = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [CLOSED_RECT],
      fillMode: 'outline',
    });
    expect(t.stones.length).toBeGreaterThan(0);
    expect(t.metadata?.['fillMode']).toBe('outline');
  });

  it('outline mode metadata includes generatedBy', () => {
    const t = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [CLOSED_RECT],
      fillMode: 'outline',
    });
    expect(t.metadata?.['generatedBy']).toBe('createPolylineFilledRhinestoneTemplate');
  });
});

// ─── Fill mode ────────────────────────────────────────────────────────────────

describe('createPolylineFilledRhinestoneTemplate — fill mode', () => {
  it('creates fill stones inside a closed rectangle', () => {
    const t = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [CLOSED_RECT],
      fillMode: 'fill',
    });
    expect(t.stones.length).toBeGreaterThan(0);
    expect(t.metadata?.['fillMode']).toBe('fill');
  });

  it('fill mode ignores open polylines — empty template when all open', () => {
    const t = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [OPEN_RECT],
      fillMode: 'fill',
    });
    // Open shapes produce no fill points
    expect(t.stones.length).toBe(0);
  });

  it('fill mode uses SS10 recommended hole diameter', () => {
    const t = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [CLOSED_RECT],
      fillMode: 'fill',
    });
    for (const stone of t.stones) {
      expect(stone.holeDiameterMm).toBeGreaterThan(0);
    }
  });

  it('fill mode supports densityPreset', () => {
    const dense = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [CLOSED_RECT],
      fillMode: 'fill',
      densityPreset: 'dense',
    });
    const loose = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [CLOSED_RECT],
      fillMode: 'fill',
      densityPreset: 'loose',
    });
    expect(dense.stones.length).toBeGreaterThanOrEqual(loose.stones.length);
  });

  it('fill mode supports zero edge inset for artwork-like coverage', () => {
    const defaultInset = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [CLOSED_RECT],
      fillMode: 'fill',
      placementPattern: 'hexagonal',
      densityPreset: 'dense',
    });
    const zeroInset = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [CLOSED_RECT],
      fillMode: 'fill',
      placementPattern: 'hexagonal',
      densityPreset: 'dense',
      fillEdgeInsetMm: 0,
    });
    expect(zeroInset.stones.length).toBeGreaterThanOrEqual(defaultInset.stones.length);
    expect(zeroInset.metadata?.['fillEdgeInsetMm']).toBe(0);
  });

  it('fill mode supports targetWidthMm', () => {
    const t = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [CLOSED_RECT],
      fillMode: 'fill',
      targetWidthMm: 60,
    });
    expect(t.stones.length).toBeGreaterThan(0);
    expect(t.metadata?.['targetWidthMm']).toBe(60);
  });

  it('fill mode metadata includes expected fields', () => {
    const t = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [CLOSED_RECT],
      fillMode: 'fill',
      fillPattern: 'offset-grid',
    });
    expect(t.metadata?.['generatedBy']).toBe('createPolylineFilledRhinestoneTemplate');
    expect(t.metadata?.['fillMode']).toBe('fill');
    expect(t.metadata?.['fillPattern']).toBe('offset-grid');
  });

  it('fill mode passes validateRhinestoneTemplate', () => {
    const t = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [CLOSED_RECT],
      fillMode: 'fill',
    });
    const r = validateRhinestoneTemplate(t);
    const errors = r.issues.filter(i => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('fill mode passes checkExportReadiness', () => {
    const t = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [CLOSED_RECT],
      fillMode: 'fill',
    });
    const r = checkExportReadiness(t);
    expect(r.ready).toBe(true);
  });

  it('fill mode exports through createBasicSvgExport', () => {
    const t = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [CLOSED_RECT],
      fillMode: 'fill',
    });
    const svg = createBasicSvgExport(t, { includeGuideBox: false });
    expect(typeof svg).toBe('string');
    expect(svg).toContain('<svg');
  });

  it('exported SVG contains real circle elements', () => {
    const t = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [CLOSED_RECT],
      fillMode: 'fill',
    });
    const svg = createBasicSvgExport(t, { includeGuideBox: false });
    expect(svg).toContain('<circle');
  });

  it('exported SVG does not contain image tags', () => {
    const t = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [CLOSED_RECT],
      fillMode: 'fill',
    });
    const svg = createBasicSvgExport(t, { includeGuideBox: false });
    expect(svg.toLowerCase()).not.toContain('<image');
  });

  it('fill output is deterministic', () => {
    const opts = { ...BASE_OPTS, polylines: [CLOSED_RECT], fillMode: 'fill' as const };
    const t1 = createPolylineFilledRhinestoneTemplate(opts);
    const t2 = createPolylineFilledRhinestoneTemplate(opts);
    expect(t1.stones.length).toBe(t2.stones.length);
    for (let i = 0; i < t1.stones.length; i++) {
      expect(t1.stones[i]!.center.x).toBe(t2.stones[i]!.center.x);
      expect(t1.stones[i]!.center.y).toBe(t2.stones[i]!.center.y);
    }
  });
});

// ─── Outline-fill mode ────────────────────────────────────────────────────────

describe('createPolylineFilledRhinestoneTemplate — outline-fill mode', () => {
  it('creates at least as many stones as outline-only', () => {
    const outline = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [CLOSED_RECT],
      fillMode: 'outline',
    });
    const outlineFill = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [CLOSED_RECT],
      fillMode: 'outline-fill',
    });
    expect(outlineFill.stones.length).toBeGreaterThanOrEqual(outline.stones.length);
  });

  it('outline-fill passes validateRhinestoneTemplate', () => {
    const t = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [CLOSED_RECT],
      fillMode: 'outline-fill',
    });
    const r = validateRhinestoneTemplate(t);
    const errors = r.issues.filter(i => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('outline-fill passes checkExportReadiness', () => {
    const t = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [CLOSED_RECT],
      fillMode: 'outline-fill',
    });
    const r = checkExportReadiness(t);
    expect(r.ready).toBe(true);
  });

  it('outline-fill output is deterministic', () => {
    const opts = { ...BASE_OPTS, polylines: [CLOSED_RECT], fillMode: 'outline-fill' as const };
    const t1 = createPolylineFilledRhinestoneTemplate(opts);
    const t2 = createPolylineFilledRhinestoneTemplate(opts);
    expect(t1.stones.length).toBe(t2.stones.length);
  });

  it('annotates outline-fill stones with collision source metadata', () => {
    const template = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [CLOSED_RECT],
      fillMode: 'outline-fill',
    });
    const sources = new Set(template.stones.map((stone) => stone.metadata?.collisionSource));
    expect(sources.has('outline') || sources.has('fill')).toBe(true);
  });

  it('outline-fill returns stones in stable geometric order (y then x)', () => {
    const template = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [CLOSED_RECT],
      fillMode: 'outline-fill',
    });
    for (let i = 1; i < template.stones.length; i++) {
      const previous = template.stones[i - 1]!;
      const current = template.stones[i]!;
      const sameRow = Math.abs(previous.center.y - current.center.y) <= 0.0001;
      if (sameRow) {
        expect(previous.center.x).toBeLessThanOrEqual(current.center.x);
      } else {
        expect(previous.center.y).toBeLessThanOrEqual(current.center.y);
      }
    }
  });

  it('grid pattern works for outline-fill', () => {
    const t = createPolylineFilledRhinestoneTemplate({
      ...BASE_OPTS,
      polylines: [CLOSED_RECT],
      fillMode: 'outline-fill',
      fillPattern: 'grid',
    });
    expect(t.stones.length).toBeGreaterThan(0);
    expect(t.metadata?.['fillPattern']).toBe('grid');
  });
});
