import { describe, it, expect } from 'vitest';
import {
  createCalibrationSheet,
  createDefaultMagicFlockCalibrationSheet,
  createBasicSvgExport,
  MAGIC_FLOCK_CRICUT_MAKER_PROFILE,
} from '../src/lib/rhinestone-engine/index.js';

// ─── Basic shape ──────────────────────────────────────────────────────────────

describe('createCalibrationSheet — return shape', () => {
  it('returns a RhinestoneTemplate', () => {
    const sheet = createCalibrationSheet(MAGIC_FLOCK_CRICUT_MAKER_PROFILE);
    expect(sheet).toBeDefined();
    expect(typeof sheet.id).toBe('string');
    expect(Array.isArray(sheet.stones)).toBe(true);
  });

  it('template.unit is "mm"', () => {
    const sheet = createCalibrationSheet(MAGIC_FLOCK_CRICUT_MAKER_PROFILE);
    expect(sheet.unit).toBe('mm');
  });
});

// ─── Stone counts ─────────────────────────────────────────────────────────────

describe('createCalibrationSheet — stone counts', () => {
  it('includes stones for all four supported sizes (SS6, SS8, SS10, SS12)', () => {
    const sheet = createCalibrationSheet(MAGIC_FLOCK_CRICUT_MAKER_PROFILE);
    const sizes = new Set(sheet.stones.map((s) => s.stoneSize));
    expect(sizes.has('SS6')).toBe(true);
    expect(sizes.has('SS8')).toBe(true);
    expect(sizes.has('SS10')).toBe(true);
    expect(sizes.has('SS12')).toBe(true);
  });

  it('creates 4 diameter variants per stone size when includeDiameterVariants is true (default)', () => {
    const sheet = createCalibrationSheet(MAGIC_FLOCK_CRICUT_MAKER_PROFILE);
    const bySizeId = new Map<string, number>();
    for (const stone of sheet.stones) {
      bySizeId.set(stone.stoneSize, (bySizeId.get(stone.stoneSize) ?? 0) + 1);
    }
    for (const [, count] of bySizeId) {
      expect(count).toBe(4);
    }
    // 4 sizes × 4 variants = 16 total stones
    expect(sheet.stones.length).toBe(16);
  });

  it('creates 1 stone per size when includeDiameterVariants is false', () => {
    const sheet = createCalibrationSheet(MAGIC_FLOCK_CRICUT_MAKER_PROFILE, {
      includeDiameterVariants: false,
    });
    const bySizeId = new Map<string, number>();
    for (const stone of sheet.stones) {
      bySizeId.set(stone.stoneSize, (bySizeId.get(stone.stoneSize) ?? 0) + 1);
    }
    for (const [, count] of bySizeId) {
      expect(count).toBe(1);
    }
    // 4 sizes × 1 variant = 4 total stones
    expect(sheet.stones.length).toBe(4);
  });
});

// ─── Metadata ─────────────────────────────────────────────────────────────────

describe('createCalibrationSheet — stone metadata', () => {
  it('all stones have calibration: true in metadata', () => {
    const sheet = createCalibrationSheet(MAGIC_FLOCK_CRICUT_MAKER_PROFILE);
    for (const stone of sheet.stones) {
      expect(stone.metadata?.calibration).toBe(true);
    }
  });

  it('all stones have materialProfileId in metadata', () => {
    const sheet = createCalibrationSheet(MAGIC_FLOCK_CRICUT_MAKER_PROFILE);
    for (const stone of sheet.stones) {
      expect(stone.metadata?.materialProfileId).toBe('magic-flock-cricut-maker');
    }
  });

  it('all stones have testedHoleDiameterMm in metadata matching holeDiameterMm', () => {
    const sheet = createCalibrationSheet(MAGIC_FLOCK_CRICUT_MAKER_PROFILE);
    for (const stone of sheet.stones) {
      expect(stone.metadata?.testedHoleDiameterMm).toBe(stone.holeDiameterMm);
    }
  });

  it('all stones have recommendedHoleDiameterMm in metadata', () => {
    const sheet = createCalibrationSheet(MAGIC_FLOCK_CRICUT_MAKER_PROFILE);
    for (const stone of sheet.stones) {
      expect(typeof stone.metadata?.recommendedHoleDiameterMm).toBe('number');
    }
  });

  it('all stones have a variantLabel', () => {
    const sheet = createCalibrationSheet(MAGIC_FLOCK_CRICUT_MAKER_PROFILE);
    for (const stone of sheet.stones) {
      expect(typeof stone.metadata?.variantLabel).toBe('string');
    }
  });

  it('all stones have cutter in metadata', () => {
    const sheet = createCalibrationSheet(MAGIC_FLOCK_CRICUT_MAKER_PROFILE);
    for (const stone of sheet.stones) {
      expect(stone.metadata?.cutter).toBe('Cricut Maker');
    }
  });
});

// ─── Determinism ─────────────────────────────────────────────────────────────

describe('createCalibrationSheet — determinism', () => {
  it('generates identical stone IDs on repeated calls', () => {
    const ids1 = createCalibrationSheet(MAGIC_FLOCK_CRICUT_MAKER_PROFILE).stones.map((s) => s.id);
    const ids2 = createCalibrationSheet(MAGIC_FLOCK_CRICUT_MAKER_PROFILE).stones.map((s) => s.id);
    expect(ids1).toEqual(ids2);
  });

  it('generates identical layout positions on repeated calls', () => {
    const pos1 = createCalibrationSheet(MAGIC_FLOCK_CRICUT_MAKER_PROFILE).stones.map(
      (s) => `${s.center.x},${s.center.y}`,
    );
    const pos2 = createCalibrationSheet(MAGIC_FLOCK_CRICUT_MAKER_PROFILE).stones.map(
      (s) => `${s.center.x},${s.center.y}`,
    );
    expect(pos1).toEqual(pos2);
  });
});

// ─── Layout ───────────────────────────────────────────────────────────────────

describe('createCalibrationSheet — layout', () => {
  it('first stone is at the configured startXmm, startYmm', () => {
    const sheet = createCalibrationSheet(MAGIC_FLOCK_CRICUT_MAKER_PROFILE, {
      startXmm: 15,
      startYmm: 20,
    });
    const first = sheet.stones[0]!;
    expect(first.center.x).toBe(15);
    expect(first.center.y).toBe(20);
  });
});

// ─── Convenience helper ───────────────────────────────────────────────────────

describe('createDefaultMagicFlockCalibrationSheet', () => {
  it('returns a template without throwing', () => {
    const sheet = createDefaultMagicFlockCalibrationSheet();
    expect(sheet).toBeDefined();
  });

  it('template.unit is "mm"', () => {
    expect(createDefaultMagicFlockCalibrationSheet().unit).toBe('mm');
  });

  it('has stones for all four sizes', () => {
    const sizes = new Set(
      createDefaultMagicFlockCalibrationSheet().stones.map((s) => s.stoneSize),
    );
    expect(sizes.size).toBe(4);
  });
});

// ─── SVG export integration ───────────────────────────────────────────────────

describe('createCalibrationSheet — SVG export', () => {
  it('can be exported using createBasicSvgExport without error', () => {
    const sheet = createCalibrationSheet(MAGIC_FLOCK_CRICUT_MAKER_PROFILE);
    expect(() => createBasicSvgExport(sheet)).not.toThrow();
  });

  it('exported SVG contains <circle', () => {
    const sheet = createCalibrationSheet(MAGIC_FLOCK_CRICUT_MAKER_PROFILE);
    const svg = createBasicSvgExport(sheet);
    expect(svg).toContain('<circle');
  });

  it('exported SVG contains data-stone-size', () => {
    const sheet = createCalibrationSheet(MAGIC_FLOCK_CRICUT_MAKER_PROFILE);
    const svg = createBasicSvgExport(sheet);
    expect(svg).toContain('data-stone-size=');
  });

  it('exported SVG contains data-hole-diameter-mm', () => {
    const sheet = createCalibrationSheet(MAGIC_FLOCK_CRICUT_MAKER_PROFILE);
    const svg = createBasicSvgExport(sheet);
    expect(svg).toContain('data-hole-diameter-mm=');
  });

  it('exported SVG does not contain <image', () => {
    const sheet = createCalibrationSheet(MAGIC_FLOCK_CRICUT_MAKER_PROFILE);
    const svg = createBasicSvgExport(sheet);
    expect(svg).not.toContain('<image');
  });

  it('exported SVG one <circle per stone', () => {
    const sheet = createCalibrationSheet(MAGIC_FLOCK_CRICUT_MAKER_PROFILE);
    const svg = createBasicSvgExport(sheet);
    const circleCount = (svg.match(/<circle/g) ?? []).length;
    expect(circleCount).toBe(sheet.stones.length);
  });
});
