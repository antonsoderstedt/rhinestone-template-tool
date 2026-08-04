/**
 * Cricut Test Pack — a curated set of starter templates for physical testing
 * with Cricut Maker 3 + Magic Flock.
 *
 * Recommended first-use sequence:
 * 1. Cut the calibration sheet to find the correct hole diameter for your setup.
 * 2. Cut the SS10 grid to verify spacing and stone seating.
 * 3. Cut the SMOOCH text to test dot-matrix density.
 * 4. Cut the diamond shape to test outline path accuracy.
 *
 * All templates use provisional stone sizes — values must be validated against
 * a real cut before use in production.
 */

import type { StoneSizeId, RhinestoneTemplate } from '../types/index';
import { createStoneGridTemplate } from '../template/gridTemplate';
import { createDotMatrixTextTemplate } from '../text/textTemplate';
import { createDefaultMagicFlockCalibrationSheet } from '../calibration/calibrationSheet';
import { createPolylineRhinestoneTemplate } from '../path/pathTemplate';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CricutTestPackOptions {
  /** Stone size for grid, text, and diamond templates. Default: SS10. */
  stoneSize?: StoneSizeId;
  /** Material profile for recommended hole/spacing lookups. Default: Magic Flock. */
  materialProfileId?: string;
}

export interface CricutTestPackItem {
  /** Stable identifier for this item in the pack. */
  id: string;
  /** Short display name. */
  name: string;
  /** One-sentence description of what this template tests. */
  description: string;
  /** The generated RhinestoneTemplate. Unit is always "mm". */
  template: RhinestoneTemplate;
  /** Suggested download filename (always ends in .svg). */
  recommendedFilename: string;
}

export interface CricutTestPack {
  templates: CricutTestPackItem[];
}

// ─── Diamond polyline ─────────────────────────────────────────────────────────

/** Unit-coordinate diamond — scaled to targetWidthMm by the path generator. */
const DIAMOND_POLYLINE = {
  points: [
    { x: 20, y: 0 },
    { x: 40, y: 15 },
    { x: 20, y: 30 },
    { x: 0, y: 15 },
  ],
  closed: true,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a curated set of test templates for physical Cricut Maker 3 + Magic
 * Flock validation. All templates are export-ready (unit: "mm", no collisions).
 *
 * The returned pack is deterministic: same options → same templates every time.
 */
export function createCricutTestPack(
  options: CricutTestPackOptions = {},
): CricutTestPack {
  const stoneSize = options.stoneSize ?? 'SS10';
  const materialProfileId = options.materialProfileId;
  const ss = stoneSize.toLowerCase();

  const templates: CricutTestPackItem[] = [
    // ── 1. Grid ──────────────────────────────────────────────────────────────
    {
      id: 'grid-5x3',
      name: `${stoneSize} Grid 5×3`,
      description: `A 5-column × 3-row grid. Tests stone hole size and spacing for ${stoneSize} on Magic Flock.`,
      template: createStoneGridTemplate({
        id: `test-pack-grid-${ss}`,
        name: `Test Pack ${stoneSize} Grid 5×3`,
        stoneSize,
        columns: 5,
        rows: 3,
        materialProfileId,
      }),
      recommendedFilename: `rhinestone-grid-${ss}-5x3.svg`,
    },

    // ── 2. SMOOCH text ────────────────────────────────────────────────────────
    {
      id: 'text-smooch',
      name: 'Dot Matrix — SMOOCH',
      description: `Dot-matrix "SMOOCH" text in ${stoneSize}. Tests stone density across a word design.`,
      template: createDotMatrixTextTemplate({
        id: `test-pack-smooch-${ss}`,
        name: 'SMOOCH',
        text: 'SMOOCH',
        stoneSize,
        materialProfileId,
      }),
      recommendedFilename: `rhinestone-text-smooch-${ss}.svg`,
    },

    // ── 3. Calibration sheet ─────────────────────────────────────────────────
    {
      id: 'calibration',
      name: 'Calibration Sheet',
      description: 'Hole diameter variants for SS6–SS20. Cut first and place stones to find the correct size for your machine.',
      template: createDefaultMagicFlockCalibrationSheet(),
      recommendedFilename: 'magic-flock-calibration-sheet.svg',
    },

    // ── 4. Diamond shape ──────────────────────────────────────────────────────
    {
      id: 'shape-diamond',
      name: `Diamond Outline — ${stoneSize}`,
      description: `A diamond outline scaled to ~60 mm wide. Tests outline path accuracy and stone placement at corners.`,
      template: createPolylineRhinestoneTemplate({
        id: `test-pack-diamond-${ss}`,
        name: `Test Pack Diamond ${stoneSize}`,
        polylines: [DIAMOND_POLYLINE],
        stoneSize,
        targetWidthMm: 60,
        materialProfileId,
      }),
      recommendedFilename: `rhinestone-polyline-diamond-${ss}.svg`,
    },
  ];

  return { templates };
}
