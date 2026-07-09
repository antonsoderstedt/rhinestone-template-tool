/**
 * Text-to-Rhinestones v1 — Dot Matrix Template Generator
 *
 * Converts text to a RhinestoneTemplate using the built-in 5×7 dot-matrix
 * font. Each "1" in a glyph row becomes a stone (cut hole) in the template.
 *
 * Text v1 scope:
 * - Only the built-in dot-matrix alphabet (A–Z, 0–9, basic punctuation)
 * - Multiline text supported via "\n"
 * - Font-outline vector rendering is deferred to a future phase
 */

import type { StoneSizeId, Stone, RhinestoneTemplate } from '../types/index';
import {
  getRecommendedHoleDiameter,
  getRecommendedCenterDistance,
} from '../profiles/materialProfiles';
import { getStoneSizeProfile } from '../profiles/stoneSizes';
import { roundMm } from '../geometry/rounding';
import { createRhinestoneTemplate } from '../template/createTemplate';
import { getDotMatrixGlyph } from './dotMatrixFont';

// ─── Options ──────────────────────────────────────────────────────────────────

export interface CreateDotMatrixTextTemplateOptions {
  id: string;
  name: string;
  text: string;
  stoneSize: StoneSizeId;
  /** X coordinate of the top-left stone centre (mm). Default: 10. */
  startXmm?: number;
  /** Y coordinate of the top-left stone centre (mm). Default: 10. */
  startYmm?: number;
  /**
   * Centre-to-centre spacing between adjacent stones in the grid (mm).
   * Defaults to getRecommendedCenterDistance(stoneSize, materialProfileId).
   * Must not be smaller than the recommended centre distance.
   */
  spacingMm?: number;
  /**
   * Number of empty dot columns inserted between characters. Default: 1.
   * Total character advance = (5 + characterSpacingColumns) * spacingMm.
   */
  characterSpacingColumns?: number;
  /**
   * Number of empty dot rows inserted between lines. Default: 2.
   * Total line advance = (7 + lineSpacingRows) * spacingMm.
   */
  lineSpacingRows?: number;
  /**
   * Material profile id used to look up recommended dimensions.
   * Defaults to the default Magic Flock profile.
   */
  materialProfileId?: string;
  /**
   * Convert text to uppercase before rendering. Default: true.
   * The dot-matrix font only contains uppercase letters; lowercase input
   * with uppercase:false will fall back to the "?" glyph.
   */
  uppercase?: boolean;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a RhinestoneTemplate from text using the built-in 5×7 dot-matrix
 * font. Every "1" pixel in a glyph becomes a stone hole in the template.
 *
 * Supports multiline text via "\n".
 *
 * @throws if id, name, or text is empty.
 * @throws if spacingMm is smaller than the recommended centre distance.
 */
export function createDotMatrixTextTemplate(
  options: CreateDotMatrixTextTemplateOptions,
): RhinestoneTemplate {
  const {
    id,
    name,
    text: inputText,
    stoneSize,
    startXmm = 10,
    startYmm = 10,
    characterSpacingColumns = 1,
    lineSpacingRows = 2,
    materialProfileId,
    uppercase = true,
  } = options;

  // ── Guard ────────────────────────────────────────────────────────────────
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('createDotMatrixTextTemplate: "id" must be a non-empty string.');
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('createDotMatrixTextTemplate: "name" must be a non-empty string.');
  }
  if (typeof inputText !== 'string' || inputText.trim().length === 0) {
    throw new Error('createDotMatrixTextTemplate: "text" must be a non-empty string.');
  }

  // ── Spacing ──────────────────────────────────────────────────────────────
  const minSpacing = getRecommendedCenterDistance(stoneSize, materialProfileId);
  const spacingMm = options.spacingMm ?? minSpacing;

  if (options.spacingMm !== undefined && options.spacingMm < minSpacing) {
    const sizeProfile = getStoneSizeProfile(stoneSize);
    throw new Error(
      `createDotMatrixTextTemplate: spacingMm (${options.spacingMm} mm) is smaller ` +
        `than the recommended centre distance for ${stoneSize} ` +
        `(${minSpacing} mm = minCenterDistanceMm ${sizeProfile.minCenterDistanceMm} + ` +
        `spacingSafetyMarginMm). Stones would overlap or tear the material.`,
    );
  }

  const holeDiameterMm = getRecommendedHoleDiameter(stoneSize, materialProfileId);
  const dp = 3;

  // ── Process text ─────────────────────────────────────────────────────────
  const processedText = uppercase ? inputText.toUpperCase() : inputText;
  const lines = processedText.split('\n');

  // ── Place stones ─────────────────────────────────────────────────────────
  const stones: Stone[] = [];

  lines.forEach((line, li) => {
    [...line].forEach((char, ci) => {
      const glyph = getDotMatrixGlyph(char);

      for (let ri = 0; ri < 7; ri++) {
        const row = glyph[ri];
        for (let col = 0; col < 5; col++) {
          if (row[col] === '1') {
            const cx = roundMm(
              startXmm + (ci * (5 + characterSpacingColumns) + col) * spacingMm,
              dp,
            );
            const cy = roundMm(
              startYmm + (li * (7 + lineSpacingRows) + ri) * spacingMm,
              dp,
            );
            // IDs are deterministic: line/char/row/col are all 1-based
            const stoneId = `${stoneSize.toLowerCase()}-line${li + 1}-char${ci + 1}-r${ri + 1}-c${col + 1}`;

            stones.push({
              id: stoneId,
              center: { x: cx, y: cy },
              stoneSize,
              holeDiameterMm,
            });
          }
        }
      }
    });
  });

  // ── Assemble ─────────────────────────────────────────────────────────────
  return createRhinestoneTemplate({
    id,
    name,
    stones,
    metadata: {
      generatedBy: 'createDotMatrixTextTemplate',
      text: inputText,
      stoneSize,
      materialProfileId: materialProfileId ?? 'magic-flock-cricut-maker',
      fontMode: 'dot-matrix-5x7',
      spacingMm,
    },
  });
}
