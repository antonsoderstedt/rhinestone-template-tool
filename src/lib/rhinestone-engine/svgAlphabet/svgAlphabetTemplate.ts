/**
 * SVG Alphabet Template Generator
 *
 * Composes rhinestone templates from per-letter SVG glyphs. Each glyph SVG is
 * parsed using the existing template importer (which extracts <circle> stones
 * in mm), then laid out horizontally with advance width equal to the glyph
 * bounding-box width plus letter spacing.
 *
 * This is NOT an OpenType text renderer. Each character is a discrete SVG file
 * that already contains its final stone geometry.
 *
 * All operations are pure and deterministic.
 */

import type { RhinestoneTemplate, Stone, StoneSizeId } from '../types/index';
import { importRhinestoneTemplate, type ImportedStone } from '../templateImport/templateImport';
import { createRhinestoneTemplate } from '../template/createTemplate';
import {
  getSvgAlphabetDefinition,
  isKnownSvgAlphabetId,
  DEFAULT_SVG_ALPHABET_ID,
  type SvgAlphabetDefinition,
  type SvgAlphabetId,
} from './svgAlphabetRegistry';

export interface SvgAlphabetGlyphLoader {
  /** Return the raw SVG text for one character, or null if unsupported. */
  loadGlyphSvg(alphabetId: SvgAlphabetId, character: string, targetStoneSizeId?: StoneSizeId): Promise<string | null>;
}

export interface CreateSvgAlphabetTemplateOptions {
  text: string;
  alphabetId: string;
  targetStoneSizeId: StoneSizeId;
  targetStoneSizeMm: number;
  letterSpacingMm: number;
  lineSpacingMm: number;
  glyphLoader: SvgAlphabetGlyphLoader;
}

export interface SvgAlphabetTemplateResult {
  template: RhinestoneTemplate;
  unsupportedCharacters: string[];
  warnings: string[];
}

interface NormalizedGlyph {
  stones: Array<{ x: number; y: number; diameterMm: number }>;
  widthMm: number;
  heightMm: number;
}

function normalizeGlyph(rawStones: ImportedStone[]): NormalizedGlyph {
  if (rawStones.length === 0) {
    return { stones: [], widthMm: 0, heightMm: 0 };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const stone of rawStones) {
    const r = stone.diameterMm / 2;
    minX = Math.min(minX, stone.center.x - r);
    minY = Math.min(minY, stone.center.y - r);
    maxX = Math.max(maxX, stone.center.x + r);
    maxY = Math.max(maxY, stone.center.y + r);
  }

  const stones = rawStones.map((stone) => ({
    x: stone.center.x - minX,
    y: stone.center.y - minY,
    diameterMm: stone.diameterMm,
  }));

  return {
    stones,
    widthMm: maxX - minX,
    heightMm: maxY - minY,
  };
}

function scaleGlyph(glyph: NormalizedGlyph, scale: number): NormalizedGlyph {
  return {
    stones: glyph.stones.map((s) => ({ x: s.x * scale, y: s.y * scale, diameterMm: s.diameterMm * scale })),
    widthMm: glyph.widthMm * scale,
    heightMm: glyph.heightMm * scale,
  };
}

function sanitizeCurationSvg(svgText: string): string {
  // CorelDRAW-exported alphabet glyphs ship a <style> block that the general
  // template importer flags as unsafe. We are the source of these files (local
  // curated library), so we strip harmless boilerplate before geometry parsing.
  return svgText
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
}

export async function createSvgAlphabetTemplate(
  options: CreateSvgAlphabetTemplateOptions,
): Promise<SvgAlphabetTemplateResult> {
  const { text, alphabetId, targetStoneSizeId, targetStoneSizeMm, letterSpacingMm, lineSpacingMm, glyphLoader } = options;

  const resolvedAlphabetId: SvgAlphabetId = isKnownSvgAlphabetId(alphabetId) ? alphabetId : DEFAULT_SVG_ALPHABET_ID;
  const definition: SvgAlphabetDefinition = getSvgAlphabetDefinition(resolvedAlphabetId);

  if (!definition.supportedTargetStoneSizeIds.includes(targetStoneSizeId)) {
    throw new Error(
      `SVG alphabet ${definition.displayName} supports ${definition.supportedTargetStoneSizeIds.join(', ')}. ` +
      `Requested: ${targetStoneSizeId}.`,
    );
  }

  // Pre-extract every unique non-space character once. Detect median stone
  // diameter so we can auto-scale the alphabet to the requested target size
  // even if the source SVG was authored at a different physical dimension.
  const uniqueChars = new Set<string>();
  for (const ch of text) {
    if (ch === ' ' || ch === '\n') continue;
    uniqueChars.add(ch);
  }

  const normalizedByChar = new Map<string, NormalizedGlyph>();
  const unsupportedCharacters: string[] = [];
  const allDiameters: number[] = [];

  for (const ch of uniqueChars) {
    const svg = await glyphLoader.loadGlyphSvg(resolvedAlphabetId, ch, targetStoneSizeId);
    if (!svg) {
      unsupportedCharacters.push(ch);
      continue;
    }
    const parsed = importRhinestoneTemplate({ svgText: sanitizeCurationSvg(svg) });
    if (parsed.stones.length === 0) {
      unsupportedCharacters.push(ch);
      continue;
    }
    const normalized = normalizeGlyph(parsed.stones);
    normalizedByChar.set(ch, normalized);
    for (const stone of normalized.stones) allDiameters.push(stone.diameterMm);
  }

  // Median stone diameter across all extracted glyph stones
  allDiameters.sort((a, b) => a - b);
  const medianDiameter = allDiameters.length > 0
    ? allDiameters[Math.floor(allDiameters.length / 2)]!
    : targetStoneSizeMm;
  const scale = medianDiameter > 0 ? targetStoneSizeMm / medianDiameter : 1;

  // Emit stones with layout
  const scaledWidths = Array.from(normalizedByChar.values(), (g) => g.widthMm * scale);
  const averageGlyphWidth = scaledWidths.length > 0
    ? scaledWidths.reduce((s, w) => s + w, 0) / scaledWidths.length
    : 0;
  const spaceGlyphWidthMm = averageGlyphWidth * 0.5;
  let currentY = 0;
  let stoneCounter = 0;
  const lines = text.split('\n');

  const emittedStones: Stone[] = [];

  // Alphabets with exact baseline metrics get true baseline alignment: each
  // glyph's below-baseline fraction decides how far it hangs under the shared
  // line. Alphabets without metrics keep the legacy top-aligned layout.
  const baselineByChar = definition.baselineBelowFractionByChar;
  const aboveBaselineMmFor = (char: string, heightMm: number): number =>
    heightMm * (1 - (baselineByChar?.[char] ?? 0));

  for (const line of lines) {
    let currentX = 0;
    let lineHeight = 0;

    let lineAscentMm = 0;
    let lineDescentMm = 0;
    if (baselineByChar) {
      for (const char of line) {
        const rawGlyph = normalizedByChar.get(char);
        if (!rawGlyph) continue;
        const heightMm = rawGlyph.heightMm * scale;
        const aboveMm = aboveBaselineMmFor(char, heightMm);
        lineAscentMm = Math.max(lineAscentMm, aboveMm);
        lineDescentMm = Math.max(lineDescentMm, heightMm - aboveMm);
      }
    }

    for (const char of line) {
      if (char === ' ') {
        currentX += spaceGlyphWidthMm + letterSpacingMm;
        continue;
      }

      const rawGlyph = normalizedByChar.get(char);
      if (!rawGlyph) continue; // Unsupported — already logged

      const scaledGlyph = scaleGlyph(rawGlyph, scale);
      const glyphOffsetY = baselineByChar
        ? currentY + lineAscentMm - aboveBaselineMmFor(char, scaledGlyph.heightMm)
        : currentY;
      for (const s of scaledGlyph.stones) {
        emittedStones.push({
          id: `sva-${stoneCounter++}`,
          center: { x: currentX + s.x, y: glyphOffsetY + s.y },
          stoneSize: targetStoneSizeId,
          holeDiameterMm: targetStoneSizeMm,
          metadata: {
            character: char,
            svgAlphabetId: resolvedAlphabetId,
            presentationMode: 'stones',
          },
        });
      }
      currentX += scaledGlyph.widthMm + letterSpacingMm;
      lineHeight = Math.max(lineHeight, scaledGlyph.heightMm);
    }

    currentY += (baselineByChar ? lineAscentMm + lineDescentMm : lineHeight) + lineSpacingMm;
  }

  // Bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const stone of emittedStones) {
    const r = stone.holeDiameterMm / 2;
    minX = Math.min(minX, stone.center.x - r);
    minY = Math.min(minY, stone.center.y - r);
    maxX = Math.max(maxX, stone.center.x + r);
    maxY = Math.max(maxY, stone.center.y + r);
  }
  const widthMm = emittedStones.length > 0 ? maxX - minX : 0;
  const heightMm = emittedStones.length > 0 ? maxY - minY : 0;

  const template = createRhinestoneTemplate({
    id: 'svg-alphabet-preview',
    name: `SVG Alphabet: ${text.substring(0, 20)}${text.length > 20 ? '...' : ''}`,
    stones: emittedStones,
    widthMm,
    heightMm,
    metadata: {
      svgAlphabetId: resolvedAlphabetId,
      svgAlphabetStyle: definition.style,
      generatedBy: 'createSvgAlphabetTemplate',
      textPlacementStrategy: 'svg-alphabet-glyph-compose-v1',
      supportedTargetStoneSizeIds: definition.supportedTargetStoneSizeIds.join(','),
    },
  });

  const warnings: string[] = [];
  if (unsupportedCharacters.length > 0) {
    warnings.push(
      `The following characters are not supported by ${definition.displayName}: ${unsupportedCharacters.join(', ')}`,
    );
  }

  return { template, unsupportedCharacters, warnings };
}
