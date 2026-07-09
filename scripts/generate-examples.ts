/**
 * Generates example SVG exports from the rhinestone engine.
 *
 * Run with: npm run generate:examples
 *
 * Output files:
 *   examples/exports/ss10-basic-template.svg
 *   examples/exports/magic-flock-calibration-sheet.svg
 *
 * All output is produced by the same engine functions used in production.
 * No manual SVG editing. No rasterization.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  createBasicSvgExport,
  createDefaultMagicFlockCalibrationSheet,
  getRecommendedHoleDiameter,
  getRecommendedCenterDistance,
  roundMm,
} from '../src/lib/rhinestone-engine/index.js';
import type { RhinestoneTemplate, Stone } from '../src/lib/rhinestone-engine/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXPORTS_DIR = join(__dirname, '..', 'examples', 'exports');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function writeExample(filename: string, svg: string): void {
  ensureDir(EXPORTS_DIR);
  const outPath = join(EXPORTS_DIR, filename);
  writeFileSync(outPath, svg, 'utf8');
  console.log(`  ✓ Written: examples/exports/${filename}`);
}

// ─── Example 1: SS10 basic 5×3 grid template ─────────────────────────────────

function buildSS10BasicTemplate(): RhinestoneTemplate {
  const stoneSize = 'SS10' as const;
  const holeDiameterMm = getRecommendedHoleDiameter(stoneSize);
  const spacing = getRecommendedCenterDistance(stoneSize);

  const COLS = 5;
  const ROWS = 3;
  const START_X = 10;
  const START_Y = 10;
  const dp = 3;

  const stones: Stone[] = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cx = roundMm(START_X + col * spacing, dp);
      const cy = roundMm(START_Y + row * spacing, dp);
      // 1-based row/col labels for readability
      const id = `ss10-r${row + 1}-c${col + 1}`;

      stones.push({
        id,
        center: { x: cx, y: cy },
        stoneSize,
        holeDiameterMm,
        metadata: {
          example: true,
          layout: 'grid',
        },
      });
    }
  }

  return {
    id: 'ss10-basic-template',
    name: 'SS10 Basic Template',
    unit: 'mm',
    stones,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const EXPORT_OPTIONS = {
  includeGuideBox: true,
  includeLabels: true,
  paddingMm: 5,
  decimalPlaces: 3,
} as const;

console.log('Generating example SVG exports...\n');

// Example 1 — SS10 basic grid
const ss10Template = buildSS10BasicTemplate();
writeExample(
  'ss10-basic-template.svg',
  createBasicSvgExport(ss10Template, EXPORT_OPTIONS),
);

// Example 2 — Magic Flock calibration sheet
const calibrationSheet = createDefaultMagicFlockCalibrationSheet();
writeExample(
  'magic-flock-calibration-sheet.svg',
  createBasicSvgExport(calibrationSheet, EXPORT_OPTIONS),
);

console.log('\nDone.');
