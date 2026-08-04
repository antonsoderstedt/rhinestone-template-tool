/**
 * Tests for generated example SVG files.
 *
 * These tests verify that the example generation script produces
 * well-formed, Cricut-safe SVG output from the engine.
 *
 * The tests read the already-generated files from examples/exports/.
 * Run `npm run generate:examples` before running this test suite if the
 * files are missing.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const EXPORTS_DIR = join(process.cwd(), 'examples', 'exports');
const SS10_PATH = join(EXPORTS_DIR, 'ss10-basic-template.svg');
const CALIBRATION_PATH = join(EXPORTS_DIR, 'magic-flock-calibration-sheet.svg');
const PACKAGE_JSON_PATH = join(process.cwd(), 'package.json');

// ─── package.json script ──────────────────────────────────────────────────────

describe('package.json scripts', () => {
  it('generate:examples script is defined', () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['generate:examples']).toBeDefined();
    expect(pkg.scripts['generate:examples']).toContain('generate-examples');
  });
});

// ─── File existence ───────────────────────────────────────────────────────────

describe('generate:examples — file creation', () => {
  it('generates examples/exports/ss10-basic-template.svg', () => {
    execSync('npm run generate:examples', { cwd: process.cwd(), stdio: 'pipe' });
    expect(existsSync(SS10_PATH)).toBe(true);
  });

  it('generates examples/exports/magic-flock-calibration-sheet.svg', () => {
    // Already generated in previous test; check existence
    expect(existsSync(CALIBRATION_PATH)).toBe(true);
  });
});

// ─── ss10-basic-template.svg ──────────────────────────────────────────────────

describe('ss10-basic-template.svg — SVG structure', () => {
  function svg(): string {
    return readFileSync(SS10_PATH, 'utf8');
  }

  it('contains <svg', () => {
    expect(svg()).toContain('<svg');
  });

  it('contains <circle', () => {
    expect(svg()).toContain('<circle');
  });

  it('contains data-stone-size="SS10"', () => {
    expect(svg()).toContain('data-stone-size="SS10"');
  });

  it('contains width in mm', () => {
    expect(svg()).toMatch(/width="[\d.]+mm"/);
  });

  it('contains height in mm', () => {
    expect(svg()).toMatch(/height="[\d.]+mm"/);
  });

  it('does not contain <image', () => {
    expect(svg()).not.toContain('<image');
  });

  it('does not use px for width', () => {
    expect(svg()).not.toMatch(/width="[\d.]+px"/);
  });

  it('does not use px for height', () => {
    expect(svg()).not.toMatch(/height="[\d.]+px"/);
  });

  it('has exactly 15 circles (5 columns × 3 rows)', () => {
    const matches = svg().match(/<circle/g);
    expect(matches).toHaveLength(15);
  });

  it('contains xmlns="http://www.w3.org/2000/svg"', () => {
    expect(svg()).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('contains viewBox', () => {
    expect(svg()).toContain('viewBox=');
  });

  it('contains data-unit="mm"', () => {
    expect(svg()).toContain('data-unit="mm"');
  });
});

// ─── magic-flock-calibration-sheet.svg ────────────────────────────────────────

describe('magic-flock-calibration-sheet.svg — SVG content', () => {
  function svg(): string {
    return readFileSync(CALIBRATION_PATH, 'utf8');
  }

  it('contains data-stone-size="SS6"', () => {
    expect(svg()).toContain('data-stone-size="SS6"');
  });

  it('contains data-stone-size="SS8"', () => {
    expect(svg()).toContain('data-stone-size="SS8"');
  });

  it('contains data-stone-size="SS10"', () => {
    expect(svg()).toContain('data-stone-size="SS10"');
  });

  it('contains data-stone-size="SS12"', () => {
    expect(svg()).toContain('data-stone-size="SS12"');
  });

  it('contains data-hole-diameter-mm', () => {
    expect(svg()).toContain('data-hole-diameter-mm=');
  });

  it('does not contain <image', () => {
    expect(svg()).not.toContain('<image');
  });

  it('has 30 circles (6 sizes × 5 variants)', () => {
    const matches = svg().match(/<circle/g);
    expect(matches).toHaveLength(30);
  });

  it('contains width in mm', () => {
    expect(svg()).toMatch(/width="[\d.]+mm"/);
  });

  it('contains height in mm', () => {
    expect(svg()).toMatch(/height="[\d.]+mm"/);
  });

  it('contains data-unit="mm"', () => {
    expect(svg()).toContain('data-unit="mm"');
  });
});
