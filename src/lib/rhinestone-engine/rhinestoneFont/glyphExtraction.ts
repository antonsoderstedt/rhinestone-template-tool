/**
 * Rhinestone Font — Glyph-to-Stones Extraction
 *
 * Extracts pre-placed rhinestone shapes from font glyphs.
 * Each glyph contains discrete circular contours representing stones.
 * This is NOT a font rendering system — we extract geometry, not rasterize.
 *
 * Algorithm:
 * 1. Load glyph path from OpenType font
 * 2. Separate closed subpaths (each represents a potential stone)
 * 3. Validate each subpath as circular (within tolerance)
 * 4. Calculate center and diameter
 * 5. Apply font scale, advance, letter spacing, line spacing
 * 6. Generate deterministic stone IDs
 *
 * All operations are pure and deterministic.
 */

import type * as opentype from 'opentype.js';
import type { Point, StoneSizeId } from '../types/index';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GlyphStone {
  /** Normalized center in glyph coordinate space */
  localX: number;
  localY: number;
  /** Estimated diameter in font units */
  diameterFontUnits: number;
}

export interface ExtractedGlyphStones {
  character: string;
  stones: GlyphStone[];
  advanceWidth: number;
  warnings: string[];
}

export interface RhinestoneFontTextLayout {
  stones: Array<{
    x: number;
    y: number;
    diameterMm: number;
    character: string;
    glyphIndex: number;
    stoneIndex: number;
  }>;
  widthMm: number;
  heightMm: number;
  unsupportedCharacters: string[];
}

// ─── Configuration ────────────────────────────────────────────────────────────

const CIRCULARITY_TOLERANCE = 0.15; // Max deviation from 1.0 aspect ratio
const RADIAL_VARIATION_TOLERANCE = 0.20; // Max deviation from mean radius
const MIN_STONE_AREA_RATIO = 0.5; // Min area / bounding box area
const SAMPLE_POINTS = 16; // Points to sample around contour for circularity check

// ─── TRW Clean Stone Calibration ──────────────────────────────────────────────

/**
 * Official TRW Clean Stone size calibration from vendor product page.
 * Based on physical rhinestone diameters, not Cricut point sizes.
 */
export const TRW_STONE_SIZE_CALIBRATION = {
  SS6: { diameterMm: 2.54, diameterInches: 0.100 },
  SS10: { diameterMm: 3.429, diameterInches: 0.135 },
  SS16: { diameterMm: 4.394, diameterInches: 0.173 },
  SS20: { diameterMm: 5.283, diameterInches: 0.208 },
} as const;

/**
 * TRW Clean Stone uses approximately 72 font units per stone.
 * Used only as a fallback when a font's own stone diameter cannot be measured.
 * Per-font scale is auto-detected from actual glyph contours in layout.
 */
const FALLBACK_STONE_DIAMETER_FONT_UNITS = 72;

// ─── Glyph Stone Extraction ───────────────────────────────────────────────────

function isClosed(commands: opentype.PathCommand[]): boolean {
  if (commands.length === 0) return false;
  
  // Explicit close
  const last = commands[commands.length - 1];
  if (last?.type === 'Z') return true;
  
  // Implicit close: last point returns to first point
  const first = commands[0];
  if (!first || first.type !== 'M') return false;
  
  const firstX = first.x;
  const firstY = first.y;
  
  // Get last endpoint
  let lastX = firstX;
  let lastY = firstY;
  
  for (const cmd of commands) {
    switch (cmd.type) {
      case 'M':
      case 'L':
        lastX = cmd.x;
        lastY = cmd.y;
        break;
      case 'Q':
      case 'C':
        lastX = cmd.x;
        lastY = cmd.y;
        break;
    }
  }
  
  // Check if last point is close to first point
  const tolerance = 0.5; // font units
  return Math.abs(lastX - firstX) < tolerance && Math.abs(lastY - firstY) < tolerance;
}

function getBounds(commands: opentype.PathCommand[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let currentX = 0, currentY = 0;

  for (const cmd of commands) {
    switch (cmd.type) {
      case 'M':
      case 'L':
        currentX = cmd.x;
        currentY = cmd.y;
        break;
      case 'Q':
        currentX = cmd.x;
        currentY = cmd.y;
        minX = Math.min(minX, cmd.x1);
        minY = Math.min(minY, cmd.y1);
        maxX = Math.max(maxX, cmd.x1);
        maxY = Math.max(maxY, cmd.y1);
        break;
      case 'C':
        currentX = cmd.x;
        currentY = cmd.y;
        minX = Math.min(minX, cmd.x1, cmd.x2);
        minY = Math.min(minY, cmd.y1, cmd.y2);
        maxX = Math.max(maxX, cmd.x1, cmd.x2);
        maxY = Math.max(maxY, cmd.y1, cmd.y2);
        break;
      case 'Z':
        break;
    }
    minX = Math.min(minX, currentX);
    minY = Math.min(minY, currentY);
    maxX = Math.max(maxX, currentX);
    maxY = Math.max(maxY, currentY);
  }

  if (!isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

function samplePathPoints(commands: opentype.PathCommand[], numSamples: number): Point[] {
  const points: Point[] = [];
  let currentX = 0, currentY = 0;

  for (const cmd of commands) {
    switch (cmd.type) {
      case 'M':
        currentX = cmd.x;
        currentY = cmd.y;
        points.push({ x: currentX, y: currentY });
        break;
      case 'L':
        currentX = cmd.x;
        currentY = cmd.y;
        points.push({ x: currentX, y: currentY });
        break;
      case 'Q':
      case 'C':
        // For curves, sample the end point (simple approximation)
        currentX = cmd.x;
        currentY = cmd.y;
        points.push({ x: currentX, y: currentY });
        break;
    }
  }

  // Subsample to requested count
  if (points.length > numSamples) {
    const step = points.length / numSamples;
    const sampled: Point[] = [];
    for (let i = 0; i < numSamples; i++) {
      const idx = Math.floor(i * step);
      sampled.push(points[idx]!);
    }
    return sampled;
  }

  return points;
}

function isCircularContour(commands: opentype.PathCommand[]): boolean {
  const bounds = getBounds(commands);
  if (!bounds) return false;

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  if (width <= 0 || height <= 0) return false;

  // Check aspect ratio
  const aspectRatio = width / height;
  if (Math.abs(aspectRatio - 1.0) > CIRCULARITY_TOLERANCE) {
    return false;
  }

  // Check radial consistency
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const expectedRadius = width / 2;

  const points = samplePathPoints(commands, SAMPLE_POINTS);
  if (points.length < 4) return false;

  const radii = points.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const meanRadius = radii.reduce((a, b) => a + b, 0) / radii.length;
  
  for (const r of radii) {
    if (Math.abs(r - meanRadius) / meanRadius > RADIAL_VARIATION_TOLERANCE) {
      return false;
    }
  }

  // Check area ratio
  const boundingArea = width * height;
  const circleArea = Math.PI * (expectedRadius ** 2);
  const areaRatio = circleArea / boundingArea;

  return areaRatio >= MIN_STONE_AREA_RATIO;
}

function extractStoneFromContour(commands: opentype.PathCommand[]): GlyphStone | null {
  if (!isClosed(commands)) return null;
  if (!isCircularContour(commands)) return null;

  const bounds = getBounds(commands);
  if (!bounds) return null;

  const localX = (bounds.minX + bounds.maxX) / 2;
  const localY = (bounds.minY + bounds.maxY) / 2;
  const diameterFontUnits = (bounds.maxX - bounds.minX + bounds.maxY - bounds.minY) / 2;

  if (!isFinite(localX) || !isFinite(localY) || !isFinite(diameterFontUnits)) {
    return null;
  }

  return { localX, localY, diameterFontUnits };
}

export function extractStonesFromGlyph(
  font: opentype.Font,
  character: string
): ExtractedGlyphStones {
  const warnings: string[] = [];
  const glyph = font.charToGlyph(character);

  if (!glyph || glyph.index === 0) {
    warnings.push(`Character '${character}' not found in font`);
    return {
      character,
      stones: [],
      advanceWidth: 0,
      warnings,
    };
  }

  const path = glyph.getPath(0, 0, font.unitsPerEm);
  const allCommands = path.commands;

  // Split into subpaths (separated by 'M' commands)
  const subpaths: opentype.PathCommand[][] = [];
  let current: opentype.PathCommand[] = [];

  for (const cmd of allCommands) {
    if (cmd.type === 'M') {
      if (current.length > 0) {
        subpaths.push(current);
      }
      current = [cmd];
    } else {
      current.push(cmd);
    }
  }
  if (current.length > 0) {
    subpaths.push(current);
  }

  const stones: GlyphStone[] = [];
  for (const subpath of subpaths) {
    const stone = extractStoneFromContour(subpath);
    if (stone) {
      stones.push(stone);
    } else if (isClosed(subpath)) {
      warnings.push(`Non-circular closed contour ignored in '${character}'`);
    }
  }

  return {
    character,
    stones,
    advanceWidth: glyph.advanceWidth || 0,
    warnings,
  };
}

// ─── Text Layout with Rhinestone Fonts ────────────────────────────────────────

export interface RhinestoneFontTextOptions {
  text: string;
  font: opentype.Font;
  targetStoneSizeMm: number;
  targetStoneSizeId: StoneSizeId;
  letterSpacingMm: number;
  lineSpacingMm: number;
}

export function layoutRhinestoneFontText(options: RhinestoneFontTextOptions): RhinestoneFontTextLayout {
  const { text, font, targetStoneSizeMm, letterSpacingMm, lineSpacingMm } = options;

  // Pre-extract every unique non-space character exactly once so we can (a) measure
  // the font's actual stone diameter for a correct scale factor, and (b) avoid
  // repeating glyph extraction when the same character appears multiple times.
  const extractedCache = new Map<string, ExtractedGlyphStones>();
  const uniqueChars = new Set<string>();
  for (const ch of text) {
    if (ch === ' ' || ch === '\n') continue;
    uniqueChars.add(ch);
  }
  const measuredDiameters: number[] = [];
  for (const ch of uniqueChars) {
    const extracted = extractStonesFromGlyph(font, ch);
    extractedCache.set(ch, extracted);
    for (const stone of extracted.stones) {
      measuredDiameters.push(stone.diameterFontUnits);
    }
  }

  // Auto-detect stone diameter per font by taking the median of every stone we
  // just extracted. Falls back to the historical TRW constant if the text has no
  // supported characters — that only affects the empty-layout edge case.
  let stoneDiameterFontUnits = FALLBACK_STONE_DIAMETER_FONT_UNITS;
  if (measuredDiameters.length > 0) {
    measuredDiameters.sort((a, b) => a - b);
    stoneDiameterFontUnits = measuredDiameters[Math.floor(measuredDiameters.length / 2)]!;
  }
  const scaleFactor = targetStoneSizeMm / stoneDiameterFontUnits;

  const stones: RhinestoneFontTextLayout['stones'] = [];
  const unsupportedCharacters: string[] = [];
  const unsupportedSet = new Set<string>();

  const lines = text.split('\n');
  let currentY = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]!;
    let currentX = 0;

    for (let charIdx = 0; charIdx < line.length; charIdx++) {
      const char = line[charIdx]!;

      // Handle space
      if (char === ' ') {
        const spaceGlyph = font.charToGlyph(' ');
        const spaceWidth = spaceGlyph?.advanceWidth || font.unitsPerEm * 0.25;
        currentX += spaceWidth * scaleFactor;
        continue;
      }

      const extracted = extractedCache.get(char) ?? extractStonesFromGlyph(font, char);

      if (extracted.stones.length === 0 && !unsupportedSet.has(char)) {
        unsupportedCharacters.push(char);
        unsupportedSet.add(char);
        continue;
      }

      // Place stones from this glyph
      for (let stoneIdx = 0; stoneIdx < extracted.stones.length; stoneIdx++) {
        const stone = extracted.stones[stoneIdx]!;
        stones.push({
          x: currentX + stone.localX * scaleFactor,
          y: currentY + stone.localY * scaleFactor,
          diameterMm: targetStoneSizeMm,
          character: char,
          glyphIndex: charIdx,
          stoneIndex: stoneIdx,
        });
      }

      currentX += extracted.advanceWidth * scaleFactor + letterSpacingMm;
    }

    currentY += font.unitsPerEm * scaleFactor + lineSpacingMm;
  }

  // Calculate bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let minCenterX = Infinity, minCenterY = Infinity;
  
  for (const stone of stones) {
    const r = stone.diameterMm / 2;
    minX = Math.min(minX, stone.x - r);
    minY = Math.min(minY, stone.y - r);
    maxX = Math.max(maxX, stone.x + r);
    maxY = Math.max(maxY, stone.y + r);
    minCenterX = Math.min(minCenterX, stone.x);
    minCenterY = Math.min(minCenterY, stone.y);
  }

  const widthMm = stones.length > 0 ? maxX - minX : 0;
  const heightMm = stones.length > 0 ? maxY - minY : 0;

  // Normalize to origin (move leftmost stone center to x=0, topmost to y=0)
  for (const stone of stones) {
    stone.x -= minCenterX;
    stone.y -= minCenterY;
  }

  return {
    stones,
    widthMm,
    heightMm,
    unsupportedCharacters,
  };
}
