/**
 * Outline-text rhinestone template generator.
 *
 * Converts text → vector glyph polylines → rhinestone template.
 *
 * Font Outline Foundation v1 — all glyph outlines come from the built-in
 * vector font. Real TTF/OTF parsing is deferred to a future phase.
 *
 * Pipeline:
 *   text input
 *   → character → VectorGlyph (font units)
 *   → lay out glyphs line-by-line (mm)
 *   → apply alignment offset per line
 *   → optional scalePolylinesToFit (targetWidthMm / targetHeightMm)
 *   → createPolylineRhinestoneTemplate (samples stones along outlines)
 *   → RhinestoneTemplate with metadata
 */

import type { StoneSizeId, RhinestoneTemplate, Stone } from '../types/index';
import type { DensityPreset } from '../spacing/density';
import type { Polyline } from '../path/polyline';
import { scalePolylinesToFit } from '../sizing/scalePolylines';
import { createPolylineRhinestoneTemplate } from '../path/pathTemplate';
import { getVectorGlyph, BUILT_IN_VECTOR_FONT } from './vectorFont';
import { createRhinestoneTemplate } from '../template/createTemplate';
import { getRecommendedHoleDiameter, getRecommendedCenterDistance } from '../profiles/materialProfiles';
import { getDensitySpacing } from '../spacing/density';
import type { TemplateFillMode } from '../fill/fillTemplate';
import type { FillPattern, PolygonFillOptions } from '../fill/polygonFill';
import { generateFillPointsForClosedPolylines } from '../fill/polygonFill';
import { DEFAULT_OUTLINE_FONT_ID, getOutlineFontDefinition, isKnownOutlineFontId, LEGACY_OUTLINE_FONT_ID } from './fontRegistry';
import { loadOutlineFont } from './fontLoader';
import { layoutTextToOpenTypePolylines } from './openTypeGeometry';

// ─── Options ──────────────────────────────────────────────────────────────────

export type OutlineTextAlign = 'left' | 'center' | 'right';

export interface CreateOutlineTextTemplateOptions {
  id: string;
  name: string;
  /** Text to render. Use '\n' for multiline. */
  text: string;
  stoneSize: StoneSizeId;
  /** Defaults to the legacy built-in vector font for backward compatibility. */
  fontId?: string;
  /**
   * Desired character height in mm.
   * Scales glyphs from font units: scale = fontSizeMm / unitsPerEm.
   * Default: 25.
   */
  fontSizeMm?: number;
  /** Scale all polylines to this width after layout (mm). */
  targetWidthMm?: number;
  /** Scale all polylines to this height after layout (mm). */
  targetHeightMm?: number;
  /** Default: true. */
  preserveAspectRatio?: boolean;
  /** Horizontal alignment for multiline text. Default: 'left'. */
  align?: OutlineTextAlign;
  /**
   * Extra horizontal gap between adjacent glyphs (mm).
   * Added after each character advance width except the last character in a line.
   * Default: 2.
   */
  letterSpacingMm?: number;
  /**
   * Vertical gap between the bottom of one text line and the top of the next (mm).
   * Total line advance = fontSizeMm + lineSpacingMm.
   * Default: 8.
   */
  lineSpacingMm?: number;
  /** Density preset for stone spacing. */
  densityPreset?: DensityPreset;
  /** Required when densityPreset is 'custom'. */
  customSpacingMm?: number;
  /**
   * Explicit centre-to-centre spacing in mm.
   * Overrides densityPreset when set.
   */
  spacingMm?: number;
  materialProfileId?: string;
  /**
   * Fill mode for closed glyph shapes (e.g. the oval in 'O').
   * Default: 'outline'.
   */
  fillMode?: TemplateFillMode;
  /** Fill grid pattern. Default: 'offset-grid'. */
  fillPattern?: FillPattern;
}

interface NormalizedOutlineTextTemplateOptions extends CreateOutlineTextTemplateOptions {
  fontId: string;
}

function normalizeOutlineOptions(
  options: CreateOutlineTextTemplateOptions,
): NormalizedOutlineTextTemplateOptions {
  return {
    ...options,
    fontId: options.fontId ?? DEFAULT_OUTLINE_FONT_ID,
  };
}

function validateOutlineOptions(options: NormalizedOutlineTextTemplateOptions) {
  const {
    id,
    name,
    text,
    fontSizeMm = 25,
    letterSpacingMm = 2,
    lineSpacingMm = 8,
    targetWidthMm,
    targetHeightMm,
  } = options;

  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('createOutlineTextTemplate: "id" must be a non-empty string.');
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('createOutlineTextTemplate: "name" must be a non-empty string.');
  }
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('createOutlineTextTemplate: "text" must be a non-empty string.');
  }
  if (!isFinite(fontSizeMm) || fontSizeMm <= 0) {
    throw new Error(`createOutlineTextTemplate: "fontSizeMm" must be a positive finite number, got ${fontSizeMm}.`);
  }
  if (!isFinite(letterSpacingMm) || letterSpacingMm < 0) {
    throw new Error(`createOutlineTextTemplate: "letterSpacingMm" must be >= 0, got ${letterSpacingMm}.`);
  }
  if (!isFinite(lineSpacingMm) || lineSpacingMm < 0) {
    throw new Error(`createOutlineTextTemplate: "lineSpacingMm" must be >= 0, got ${lineSpacingMm}.`);
  }
  if (targetWidthMm !== undefined && (!isFinite(targetWidthMm) || targetWidthMm <= 0)) {
    throw new Error(`createOutlineTextTemplate: "targetWidthMm" must be a positive finite number, got ${targetWidthMm}.`);
  }
  if (targetHeightMm !== undefined && (!isFinite(targetHeightMm) || targetHeightMm <= 0)) {
    throw new Error(`createOutlineTextTemplate: "targetHeightMm" must be a positive finite number, got ${targetHeightMm}.`);
  }
  if (options.fontId !== LEGACY_OUTLINE_FONT_ID && !isKnownOutlineFontId(options.fontId)) {
    throw new Error(`Unknown outline fontId: ${options.fontId}`);
  }
}

function layoutLegacyVectorTextPolylines(options: NormalizedOutlineTextTemplateOptions): Polyline[] {
  const {
    text,
    fontSizeMm = 25,
    align = 'left',
    letterSpacingMm = 2,
    lineSpacingMm = 8,
  } = options;

  const font = BUILT_IN_VECTOR_FONT;
  const scale = fontSizeMm / font.unitsPerEm;
  const lines = text.split('\n');
  const lineAdvanceMm = fontSizeMm + lineSpacingMm;

  interface LineGroup {
    polylines: Polyline[];
    widthMm: number;
  }

  const lineGroups: LineGroup[] = [];

  for (const line of lines) {
    let curX = 0;
    const linePolylines: Polyline[] = [];
    const chars = [...line];

    for (let ci = 0; ci < chars.length; ci++) {
      const glyph = getVectorGlyph(chars[ci]);

      for (const pl of glyph.polylines) {
        linePolylines.push({
          points: pl.points.map((pt) => ({
            x: pt.x * scale + curX,
            y: pt.y * scale,
          })),
          closed: pl.closed,
        });
      }

      curX += glyph.advanceWidth * scale;
      if (ci < chars.length - 1) {
        curX += letterSpacingMm;
      }
    }

    lineGroups.push({ polylines: linePolylines, widthMm: curX });
  }

  const maxWidthMm = Math.max(...lineGroups.map((group) => group.widthMm), 0);
  const allPolylines: Polyline[] = [];

  for (let li = 0; li < lineGroups.length; li++) {
    const group = lineGroups[li]!;
    const lineOffsetY = li * lineAdvanceMm;
    let offsetX = 0;
    if (align === 'center') {
      offsetX = (maxWidthMm - group.widthMm) / 2;
    } else if (align === 'right') {
      offsetX = maxWidthMm - group.widthMm;
    }

    for (const pl of group.polylines) {
      allPolylines.push({
        points: pl.points.map((pt) => ({
          x: pt.x + offsetX,
          y: pt.y + lineOffsetY,
        })),
        closed: pl.closed,
      });
    }
  }

  return allPolylines.filter((pl) => pl.points.length >= 2);
}

function createOutlineTemplateFromPolylines(
  options: NormalizedOutlineTextTemplateOptions,
  validPolylines: Polyline[],
  metadataOverrides: Record<string, string | number | boolean>,
): RhinestoneTemplate {
  const {
    id,
    name,
    stoneSize,
    targetWidthMm,
    targetHeightMm,
    preserveAspectRatio = true,
    densityPreset,
    customSpacingMm,
    spacingMm,
    materialProfileId,
    fillMode = 'outline',
    fillPattern = 'offset-grid',
  } = options;

  if (validPolylines.length === 0) {
    throw new Error(
      'createOutlineTextTemplate: text produced no drawable polylines. ' +
        'Ensure at least one character has visible strokes (not all whitespace).',
    );
  }

  let finalPolylines = validPolylines;
  if (targetWidthMm !== undefined || targetHeightMm !== undefined) {
    finalPolylines = scalePolylinesToFit(validPolylines, {
      targetWidthMm,
      targetHeightMm,
      preserveAspectRatio,
      originXmm: 10,
      originYmm: 10,
    });
  }

  const metadata: Record<string, string | number | boolean> = {
    generatedBy: 'createOutlineTextTemplate',
    text: options.text,
    fontSizeMm: options.fontSizeMm ?? 25,
    preserveAspectRatio,
    align: options.align ?? 'left',
    letterSpacingMm: options.letterSpacingMm ?? 2,
    lineSpacingMm: options.lineSpacingMm ?? 8,
    fontId: options.fontId,
    ...metadataOverrides,
  };
  if (targetWidthMm !== undefined) metadata['targetWidthMm'] = targetWidthMm;
  if (targetHeightMm !== undefined) metadata['targetHeightMm'] = targetHeightMm;
  if (densityPreset !== undefined) metadata['densityPreset'] = densityPreset;
  if (customSpacingMm !== undefined) metadata['customSpacingMm'] = customSpacingMm;
  metadata['fillMode'] = fillMode;
  metadata['fillPattern'] = fillPattern;

  const rawTemplate = createPolylineRhinestoneTemplate({
    id,
    name,
    polylines: finalPolylines,
    stoneSize,
    spacingMm,
    densityPreset,
    customSpacingMm,
    materialProfileId,
    metadata,
  });

  const holeDiameterMm = getRecommendedHoleDiameter(stoneSize, materialProfileId);
  const minDist2 = holeDiameterMm * holeDiameterMm;

  const keptStones: Stone[] = [];
  for (const stone of rawTemplate.stones) {
    let tooClose = false;
    for (const prev of keptStones) {
      const dx = stone.center.x - prev.center.x;
      const dy = stone.center.y - prev.center.y;
      if (dx * dx + dy * dy < minDist2) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) keptStones.push(stone);
  }

  if (fillMode === 'outline') {
    return createRhinestoneTemplate({ id, name, stones: keptStones, metadata });
  }

  const minSpacing = getRecommendedCenterDistance(stoneSize, materialProfileId);
  let resolvedFillSpacingMm: number;
  if (spacingMm !== undefined) {
    resolvedFillSpacingMm = spacingMm;
  } else if (densityPreset !== undefined) {
    resolvedFillSpacingMm = getDensitySpacing({
      stoneSize,
      materialProfileId,
      preset: densityPreset,
      customSpacingMm,
    }).spacingMm;
  } else {
    resolvedFillSpacingMm = minSpacing;
  }

  const fillOpts: PolygonFillOptions = {
    spacingMm: resolvedFillSpacingMm,
    pattern: fillPattern,
    insetMm: 0,
  };
  const fillPoints = generateFillPointsForClosedPolylines(finalPolylines, fillOpts);
  const fillStones: Stone[] = fillPoints.map((pt, i) => ({
    id: `fill-f${i + 1}`,
    center: pt,
    stoneSize,
    holeDiameterMm,
  }));

  const baseStones: Stone[] = fillMode === 'outline-fill' ? keptStones : [];
  const combined: Stone[] = [...baseStones, ...fillStones];

  if (combined.length === 0) {
    return createRhinestoneTemplate({ id, name, stones: [], metadata });
  }

  const allKept: Stone[] = [];
  for (const stone of combined) {
    let tooClose = false;
    for (const prev of allKept) {
      const dx = stone.center.x - prev.center.x;
      const dy = stone.center.y - prev.center.y;
      if (dx * dx + dy * dy < minDist2) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) allKept.push(stone);
  }

  return createRhinestoneTemplate({
    id,
    name,
    stones: allKept,
    metadata,
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Converts text to a rhinestone outline template using the built-in
 * vector font.
 *
 * @throws if id, name, or text is empty.
 * @throws if fontSizeMm, letterSpacingMm, lineSpacingMm, or target dimensions
 *   are invalid.
 * @throws if the text produces no drawable polylines (all whitespace).
 */
export function createOutlineTextTemplate(
  options: CreateOutlineTextTemplateOptions,
): RhinestoneTemplate {
  const normalized = normalizeOutlineOptions(options);
  validateOutlineOptions(normalized);

  const fontDefinition = getOutlineFontDefinition(normalized.fontId);
  if (!fontDefinition.isLegacy) {
    throw new Error(
      `createOutlineTextTemplate: fontId "${normalized.fontId}" requires the async outline font pipeline. ` +
        'Use createOutlineTextTemplateAsync for bundled OpenType fonts.',
    );
  }

  return createOutlineTemplateFromPolylines(normalized, layoutLegacyVectorTextPolylines(normalized), {
    fontMode: 'built-in-vector-outline-v1',
    fontFamily: fontDefinition.fontFamily,
    fontDisplayName: fontDefinition.displayName,
  });
}

export async function createOutlineTextTemplateAsync(
  options: CreateOutlineTextTemplateOptions,
): Promise<RhinestoneTemplate> {
  const normalized = normalizeOutlineOptions(options);
  validateOutlineOptions(normalized);

  const fontDefinition = getOutlineFontDefinition(normalized.fontId);
  if (fontDefinition.isLegacy) {
    return createOutlineTextTemplate(normalized);
  }

  const loadedFont = await loadOutlineFont(normalized.fontId);
  if (!loadedFont.font) {
    return createOutlineTextTemplate({ ...normalized, fontId: LEGACY_OUTLINE_FONT_ID });
  }

  const polylines = layoutTextToOpenTypePolylines({
    text: normalized.text,
    font: loadedFont.font,
    fontSizeMm: normalized.fontSizeMm ?? 25,
    align: normalized.align ?? 'left',
    letterSpacingMm: normalized.letterSpacingMm ?? 2,
    lineSpacingMm: normalized.lineSpacingMm ?? 8,
  });

  return createOutlineTemplateFromPolylines(normalized, polylines, {
    fontMode: 'bundled-opentype-outline-v1',
    fontFamily: fontDefinition.fontFamily,
    fontDisplayName: fontDefinition.displayName,
    fontLicense: fontDefinition.license,
  });
}
