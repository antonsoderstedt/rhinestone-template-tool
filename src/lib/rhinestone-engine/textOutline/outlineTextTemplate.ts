/**
 * Outline-text rhinestone template generator.
 *
 * Converts text → vector glyph polylines → rhinestone template.
 *
 * Font Outline Foundation v1 — legacy glyph outlines come from the built-in
 * vector font, while bundled OpenType fonts use parsed font outlines.
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
import { createPolylineRhinestoneTemplate } from '../path/pathTemplate';
import { scalePolylinesToFit } from '../sizing/scalePolylines';
import { getVectorGlyph, isVectorGlyphSupported, BUILT_IN_VECTOR_FONT } from './vectorFont';
import { createRhinestoneTemplate } from '../template/createTemplate';
import type { TemplateFillMode } from '../fill/fillTemplate';
import type { FillPattern } from '../fill/polygonFill';
import { DEFAULT_OUTLINE_FONT_ID, getOutlineFontDefinition, getSupportedTextCoverageModes, isAvailableOutlineFontId, LEGACY_OUTLINE_FONT_ID } from './fontRegistry';
import { loadOutlineFont } from './fontLoader';
import { layoutTextToOpenTypePolylines } from './openTypeGeometry';
import type { TemplateCoverageMode, ContourCoverageSettings } from '../fill/fillTemplate';
import { createPolylineFilledRhinestoneTemplate } from '../fill/fillTemplate';
import type { FillPlacementPattern, RadialPlacementSettings } from '../fill/placementPatterns';
import { createGlyphScanlineFillTemplate } from './glyphScanlineFill';

// ─── Options ──────────────────────────────────────────────────────────────────

export type OutlineTextAlign = 'left' | 'center' | 'right';
export type OutlineTextStyle = 'outline' | 'filled-typography';

export interface CreateOutlineTextTemplateOptions {
  id: string;
  name: string;
  /** Text to render. Use '\n' for multiline. */
  text: string;
  stoneSize: StoneSizeId;
  /** High-level text intent used when low-level coverage settings are omitted. */
  outlineTextStyle?: OutlineTextStyle;
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
  /** Coverage mode for the generated text. Defaults to outline for legacy and fill for bundled fonts. */
  coverageMode?: TemplateCoverageMode;
  /**
   * Fill mode for closed glyph shapes (e.g. the oval in 'O').
   * Defaults to outline for legacy and fill for bundled fonts.
   */
  fillMode?: TemplateFillMode;
  /** Fill grid pattern. Default: 'offset-grid'. */
  fillPattern?: FillPattern;
  /** Fill placement pattern. Only relevant when coverage includes fill. */
  placementPattern?: FillPlacementPattern;
  /**
   * Minimum edge clearance for fill stones. Bundled text fonts default to
   * centre-inside placement so narrow strokes still receive stones.
   */
  fillEdgeInsetMm?: number;
  contourSettings?: Partial<ContourCoverageSettings>;
  radialSettings?: Partial<RadialPlacementSettings>;
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
  if (options.fillEdgeInsetMm !== undefined && (!isFinite(options.fillEdgeInsetMm) || options.fillEdgeInsetMm < 0)) {
    throw new Error(`createOutlineTextTemplate: "fillEdgeInsetMm" must be a non-negative finite number, got ${options.fillEdgeInsetMm}.`);
  }
  if (options.fontId !== LEGACY_OUTLINE_FONT_ID && !isAvailableOutlineFontId(options.fontId)) {
    throw new Error(`Unknown outline fontId: ${options.fontId}`);
  }
}

function defaultFillModeForOutlineFont(fontId: string): TemplateFillMode {
  return getOutlineFontDefinition(fontId).preferredTextCoverageMode;
}

function coverageModeFromOutlineTextStyle(style: OutlineTextStyle | undefined): TemplateFillMode | undefined {
  if (style === 'outline') return 'outline';
  if (style === 'filled-typography') return 'outline-fill';
  return undefined;
}

function inferOutlineTextStyle(
  coverageMode: TemplateCoverageMode,
  fillMode: TemplateFillMode,
): OutlineTextStyle {
  if (coverageMode === 'fill' || coverageMode === 'outline-fill' || fillMode === 'fill' || fillMode === 'outline-fill') {
    return 'filled-typography';
  }
  return 'outline';
}

function resolveTextCoverageModes(
  options: NormalizedOutlineTextTemplateOptions,
): { coverageMode: TemplateCoverageMode; fillMode: TemplateFillMode } {
  const supportedCoverageModes = getSupportedTextCoverageModes(options.fontId);
  const preferredFillMode = defaultFillModeForOutlineFont(options.fontId);
  const requestedStyleMode = coverageModeFromOutlineTextStyle(options.outlineTextStyle);

  if (options.coverageMode !== undefined) {
    const coverageMode = supportedCoverageModes.includes(options.coverageMode)
      ? options.coverageMode
      : preferredFillMode;
    const requestedFillMode = coverageMode === 'contour'
      ? options.fillMode ?? preferredFillMode
      : coverageMode;
    const fillMode = coverageMode === 'contour'
      ? (supportedCoverageModes.includes(requestedFillMode) ? requestedFillMode : preferredFillMode)
      : requestedFillMode;

    return {
      coverageMode,
      fillMode,
    };
  }

  const requestedFillMode = options.fillMode ?? requestedStyleMode ?? preferredFillMode;
  const fillMode = supportedCoverageModes.includes(requestedFillMode)
    ? requestedFillMode
    : preferredFillMode;
  return {
    coverageMode: fillMode,
    fillMode,
  };
}

function resolveTextFillEdgeInsetMm(
  options: NormalizedOutlineTextTemplateOptions,
  coverageMode: TemplateCoverageMode,
): number | undefined {
  if (options.fillEdgeInsetMm !== undefined) return options.fillEdgeInsetMm;
  if (coverageMode !== 'fill' && coverageMode !== 'outline-fill') return undefined;
  if (options.fontId === LEGACY_OUTLINE_FONT_ID) return undefined;
  return 0;
}

interface LegacyVectorTextLayoutResult {
  polylines: Polyline[];
  /** Characters that had no real glyph and silently fell back to '?'. */
  unsupportedCharacters: string[];
}

function layoutLegacyVectorTextPolylines(options: NormalizedOutlineTextTemplateOptions): LegacyVectorTextLayoutResult {
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
  const unsupportedCharacters = new Set<string>();

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
      if (!isVectorGlyphSupported(chars[ci]!)) {
        unsupportedCharacters.add(chars[ci]!);
      }
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

  return {
    polylines: allPolylines.filter((pl) => pl.points.length >= 2),
    unsupportedCharacters: Array.from(unsupportedCharacters),
  };
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
    coverageMode: requestedCoverageMode,
    fillMode: requestedFillMode,
    fillPattern = 'offset-grid',
    placementPattern = 'default',
    contourSettings,
    radialSettings,
  } = options;
  const { coverageMode, fillMode } = resolveTextCoverageModes({
    ...options,
    coverageMode: requestedCoverageMode,
    fillMode: requestedFillMode,
  });
  const fillEdgeInsetMm = resolveTextFillEdgeInsetMm(options, coverageMode);

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
    outlineTextStyle: inferOutlineTextStyle(coverageMode, fillMode),
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
  metadata['coverageMode'] = coverageMode ?? fillMode;
  metadata['fillMode'] = fillMode;
  metadata['fillPattern'] = fillPattern;
  metadata['placementPattern'] = placementPattern;
  if (fillEdgeInsetMm !== undefined) metadata['fillEdgeInsetMm'] = fillEdgeInsetMm;

  const sortStonesForCollisionResolution = (stones: readonly Stone[]): Stone[] => [...stones].sort((left, right) => {
    const leftPriority = typeof left.metadata?.collisionPriority === 'number' ? left.metadata.collisionPriority : 0;
    const rightPriority = typeof right.metadata?.collisionPriority === 'number' ? right.metadata.collisionPriority : 0;
    const priorityDelta = rightPriority - leftPriority;
    if (priorityDelta !== 0) return priorityDelta;

    const yDelta = left.center.y - right.center.y;
    if (Math.abs(yDelta) > 0.0001) return yDelta;
    const xDelta = left.center.x - right.center.x;
    if (Math.abs(xDelta) > 0.0001) return xDelta;
    return left.id.localeCompare(right.id);
  });

  const sortStonesByGeometry = (stones: readonly Stone[]): Stone[] => [...stones].sort((left, right) => {
    const yDelta = left.center.y - right.center.y;
    if (Math.abs(yDelta) > 0.0001) return yDelta;
    const xDelta = left.center.x - right.center.x;
    if (Math.abs(xDelta) > 0.0001) return xDelta;
    return left.id.localeCompare(right.id);
  });

  const dedupeTemplateStones = (templateStones: readonly Stone[], templateMetadata: Record<string, string | number | boolean>): RhinestoneTemplate => {
    const sortedTemplateStones = sortStonesForCollisionResolution(templateStones);

    const withSourceCounts = (stones: readonly Stone[]) => {
      const outlineStoneCount = stones.filter((stone) => stone.metadata?.collisionSource === 'outline').length;
      const fillStoneCount = stones.filter((stone) => stone.metadata?.collisionSource === 'fill').length;
      return {
        ...templateMetadata,
        ...(outlineStoneCount > 0 && { outlineStoneCount }),
        ...(fillStoneCount > 0 && { fillStoneCount }),
      };
    };

    if (sortedTemplateStones.length < 2) {
      return createRhinestoneTemplate({
        id,
        name,
        stones: sortStonesByGeometry(sortedTemplateStones),
        metadata: withSourceCounts(sortStonesByGeometry(sortedTemplateStones)),
      });
    }

    const keptStones: Stone[] = [];
    for (const stone of sortedTemplateStones) {
      let tooClose = false;
      const minDist2 = stone.holeDiameterMm * stone.holeDiameterMm;
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

    return createRhinestoneTemplate({
      id,
      name,
      stones: sortStonesByGeometry(keptStones),
      metadata: withSourceCounts(sortStonesByGeometry(keptStones)),
    });
  };

  if (
    options.fontId !== LEGACY_OUTLINE_FONT_ID &&
    coverageMode === 'fill' &&
    placementPattern === 'default' &&
    fillPattern === 'offset-grid'
  ) {
    return createGlyphScanlineFillTemplate({
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
  }

  if (
    options.fontId !== LEGACY_OUTLINE_FONT_ID &&
    coverageMode === 'outline-fill' &&
    placementPattern === 'default' &&
    fillPattern === 'offset-grid'
  ) {
    const outlineTemplate = createPolylineRhinestoneTemplate({
      id: `${id}-outline-pass`,
      name: `${name} outline pass`,
      polylines: finalPolylines,
      stoneSize,
      spacingMm,
      densityPreset,
      customSpacingMm,
      materialProfileId,
    });
    const fillTemplate = createGlyphScanlineFillTemplate({
      id: `${id}-fill-pass`,
      name: `${name} fill pass`,
      polylines: finalPolylines,
      stoneSize,
      spacingMm,
      densityPreset,
      customSpacingMm,
      materialProfileId,
      existingStones: outlineTemplate.stones,
      metadata,
    });
    const combinedMetadata = {
      ...metadata,
      textPlacementStrategy: 'glyph-scanline-outline-fill-v1',
    };
    return dedupeTemplateStones([...outlineTemplate.stones, ...fillTemplate.stones], combinedMetadata);
  }

  const template = createPolylineFilledRhinestoneTemplate({
    id,
    name,
    polylines: finalPolylines,
    stoneSize,
    coverageMode,
    fillMode,
    fillPattern,
    placementPattern,
    fillEdgeInsetMm,
    contourSettings,
    radialSettings,
    spacingMm,
    densityPreset,
    customSpacingMm,
    materialProfileId,
    metadata,
  });

  return dedupeTemplateStones(template.stones, template.metadata ?? metadata);
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

  const layout = layoutLegacyVectorTextPolylines(normalized);

  return createOutlineTemplateFromPolylines(normalized, layout.polylines, {
    fontMode: 'built-in-vector-outline-v1',
    fontFamily: fontDefinition.fontFamily,
    fontDisplayName: fontDefinition.displayName,
    // Comma-joined because template metadata values are string|number|boolean only.
    unsupportedCharacters: layout.unsupportedCharacters.join(','),
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
