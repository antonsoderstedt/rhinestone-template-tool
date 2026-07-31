/**
 * Letter Stencil Template Generator
 *
 * Produces per-letter stencil cards from a curated SVG alphabet. Each card is
 * a small rectangular tile (Cricut-cut) containing one letter's rhinestone
 * holes. Cards are laid out so that placing them edge-to-edge yields
 * typographically correct spacing — I gets a narrow card, W gets a wide one,
 * every card shares the same height.
 *
 * This is the pattern used by the Etsy Rhinestone Stencil Letters product
 * (see docs / project notes): one reusable stencil card per letter, arranged
 * to compose any word or name.
 *
 * All operations are pure and deterministic.
 */

import type { RhinestoneTemplate, Stone, StoneSizeId, CutShape } from '../types/index';
import { importRhinestoneTemplate, type ImportedStone } from '../templateImport/templateImport';
import { createRhinestoneTemplate } from '../template/createTemplate';
import {
  getSvgAlphabetDefinition,
  isKnownSvgAlphabetId,
  DEFAULT_SVG_ALPHABET_ID,
  type SvgAlphabetDefinition,
  type SvgAlphabetId,
} from '../svgAlphabet/svgAlphabetRegistry';
import type { SvgAlphabetGlyphLoader } from '../svgAlphabet/svgAlphabetTemplate';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StencilLayoutMode = 'preview' | 'cut-sheet';

export interface CreateLetterStencilOptions {
  text: string;
  alphabetId: string;
  targetStoneSizeId: StoneSizeId;
  targetStoneSizeMm: number;
  glyphLoader: SvgAlphabetGlyphLoader;

  /** Space between the glyph and the card edge on all sides (mm). Default 3. */
  cardPaddingMm?: number;
  /** Rounded-corner radius on card frames (mm). Default 2. */
  cardCornerRadiusMm?: number;
  /** Minimum card width so single-stroke letters (I, 1) don't collapse (mm). Default 12. */
  minCardWidthMm?: number;

  /** How cards are arranged on the sheet. Default 'preview'. */
  layoutMode?: StencilLayoutMode;
  /** For 'cut-sheet' mode: gap between adjacent cards (mm). Default 3. */
  cutSheetGapMm?: number;
  /** For 'cut-sheet' mode: sheet width used to wrap cards (mm). Default 305 (12"). */
  cutSheetWidthMm?: number;
}

export interface LetterStencilCardMetadata {
  character: string;
  cardIndex: number;
  cardId: string;
  widthMm: number;
  heightMm: number;
}

export interface LetterStencilResult {
  template: RhinestoneTemplate;
  cards: LetterStencilCardMetadata[];
  unsupportedCharacters: string[];
  warnings: string[];
}

// ─── Internals ────────────────────────────────────────────────────────────────

interface RawGlyph {
  stones: Array<{ x: number; y: number; diameterMm: number }>;
  widthMm: number;
  heightMm: number;
}

function sanitizeCurationSvg(svgText: string): string {
  // Same boilerplate stripping as svgAlphabetTemplate — CorelDRAW exports have
  // a <style> block that would otherwise be flagged as unsafe by the importer.
  return svgText
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
}

function normalizeGlyph(rawStones: ImportedStone[]): RawGlyph {
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
  return {
    stones: rawStones.map((s) => ({
      x: s.center.x - minX,
      y: s.center.y - minY,
      diameterMm: s.diameterMm,
    })),
    widthMm: maxX - minX,
    heightMm: maxY - minY,
  };
}

function scaleGlyph(g: RawGlyph, scale: number): RawGlyph {
  return {
    stones: g.stones.map((s) => ({ x: s.x * scale, y: s.y * scale, diameterMm: s.diameterMm * scale })),
    widthMm: g.widthMm * scale,
    heightMm: g.heightMm * scale,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function createLetterStencilTemplate(
  options: CreateLetterStencilOptions,
): Promise<LetterStencilResult> {
  const {
    text,
    alphabetId,
    targetStoneSizeId,
    targetStoneSizeMm,
    glyphLoader,
    cardPaddingMm = 3,
    cardCornerRadiusMm = 2,
    minCardWidthMm = 12,
    layoutMode = 'preview',
    cutSheetGapMm = 3,
    cutSheetWidthMm = 305,
  } = options;

  const resolvedAlphabetId: SvgAlphabetId = isKnownSvgAlphabetId(alphabetId)
    ? alphabetId
    : DEFAULT_SVG_ALPHABET_ID;
  const definition: SvgAlphabetDefinition = getSvgAlphabetDefinition(resolvedAlphabetId);

  if (!definition.supportedTargetStoneSizeIds.includes(targetStoneSizeId)) {
    throw new Error(
      `SVG alphabet ${definition.displayName} supports ${definition.supportedTargetStoneSizeIds.join(', ')}. ` +
      `Requested: ${targetStoneSizeId}.`,
    );
  }

  // Pre-extract every unique non-space character exactly once.
  const uniqueChars = new Set<string>();
  for (const ch of text) {
    if (ch === ' ' || ch === '\n') continue;
    uniqueChars.add(ch);
  }

  const rawByChar = new Map<string, RawGlyph>();
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
    rawByChar.set(ch, normalized);
    for (const stone of normalized.stones) allDiameters.push(stone.diameterMm);
  }

  // Auto-scale so extracted stones match the requested physical stone size.
  allDiameters.sort((a, b) => a - b);
  const medianDiameter = allDiameters.length > 0
    ? allDiameters[Math.floor(allDiameters.length / 2)]!
    : targetStoneSizeMm;
  const scale = medianDiameter > 0 ? targetStoneSizeMm / medianDiameter : 1;

  // Scale every glyph up front. Uniform card height = max scaled glyph height +
  // 2 * padding, so every letter card is the same height (typographic constant).
  const scaledByChar = new Map<string, RawGlyph>();
  let maxGlyphHeight = 0;
  for (const [ch, raw] of rawByChar) {
    const scaled = scaleGlyph(raw, scale);
    scaledByChar.set(ch, scaled);
    if (scaled.heightMm > maxGlyphHeight) maxGlyphHeight = scaled.heightMm;
  }
  const cardHeightMm = maxGlyphHeight + 2 * cardPaddingMm;

  // Emit cards in the order characters appear in text (respecting duplicates).
  const stones: Stone[] = [];
  const cutShapes: CutShape[] = [];
  const cards: LetterStencilCardMetadata[] = [];

  let cursorX = 0;
  let cursorY = 0;
  let rowMaxHeight = 0;
  let stoneCounter = 0;
  let cardCounter = 0;
  let firstCardOnRow = true;

  const advanceToNextRow = () => {
    cursorX = 0;
    cursorY += rowMaxHeight + cutSheetGapMm;
    rowMaxHeight = 0;
    firstCardOnRow = true;
  };

  for (const ch of text) {
    if (ch === '\n') {
      if (layoutMode === 'preview') {
        cursorX = 0;
        cursorY += cardHeightMm;
        firstCardOnRow = true;
      } else {
        advanceToNextRow();
      }
      continue;
    }

    if (ch === ' ') {
      // Space advances horizontally without emitting a card.
      // Space width defaults to average card width so it visually reads as a gap.
      const avgWidth = scaledByChar.size > 0
        ? Array.from(scaledByChar.values(), (g) => g.widthMm).reduce((a, b) => a + b, 0) / scaledByChar.size + 2 * cardPaddingMm
        : cardHeightMm;
      cursorX += avgWidth * 0.5;
      continue;
    }

    const scaled = scaledByChar.get(ch);
    if (!scaled) continue; // already reported as unsupported

    const glyphWidth = Math.max(scaled.widthMm, 0);
    const cardWidthMm = Math.max(glyphWidth + 2 * cardPaddingMm, minCardWidthMm);

    if (layoutMode === 'cut-sheet' && !firstCardOnRow && (cursorX + cardWidthMm) > cutSheetWidthMm) {
      advanceToNextRow();
    }

    const cardId = `card-${cardCounter}`;
    const cardX = cursorX;
    const cardY = cursorY;

    // Frame — one rounded rect per card.
    cutShapes.push({
      type: 'rect',
      x: cardX,
      y: cardY,
      widthMm: cardWidthMm,
      heightMm: cardHeightMm,
      cornerRadiusMm: cardCornerRadiusMm,
      id: cardId,
    });

    // Centre the glyph inside the card horizontally + vertically.
    const glyphOffsetX = cardX + (cardWidthMm - glyphWidth) / 2;
    const glyphOffsetY = cardY + (cardHeightMm - scaled.heightMm) / 2;

    for (const s of scaled.stones) {
      stones.push({
        id: `ls-${stoneCounter++}`,
        center: { x: glyphOffsetX + s.x, y: glyphOffsetY + s.y },
        stoneSize: targetStoneSizeId,
        holeDiameterMm: targetStoneSizeMm,
        metadata: {
          character: ch,
          cardId,
          svgAlphabetId: resolvedAlphabetId,
          presentationMode: 'stencil',
        },
      });
    }

    cards.push({
      character: ch,
      cardIndex: cardCounter,
      cardId,
      widthMm: cardWidthMm,
      heightMm: cardHeightMm,
    });

    // Advance cursor.
    if (layoutMode === 'preview') {
      cursorX += cardWidthMm;
    } else {
      cursorX += cardWidthMm + cutSheetGapMm;
    }
    if (cardHeightMm > rowMaxHeight) rowMaxHeight = cardHeightMm;
    firstCardOnRow = false;
    cardCounter += 1;
  }

  // Overall bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const shape of cutShapes) {
    minX = Math.min(minX, shape.x);
    minY = Math.min(minY, shape.y);
    maxX = Math.max(maxX, shape.x + shape.widthMm);
    maxY = Math.max(maxY, shape.y + shape.heightMm);
  }
  const widthMm = cards.length > 0 ? maxX - minX : 0;
  const heightMm = cards.length > 0 ? maxY - minY : 0;

  const template = createRhinestoneTemplate({
    id: 'letter-stencil-preview',
    name: `Letter Stencils: ${text.substring(0, 20)}${text.length > 20 ? '...' : ''}`,
    stones,
    widthMm,
    heightMm,
    metadata: {
      svgAlphabetId: resolvedAlphabetId,
      svgAlphabetStyle: definition.style,
      generatedBy: 'createLetterStencilTemplate',
      textPlacementStrategy: 'letter-stencil-cards-v1',
      layoutMode,
      cardHeightMm: Math.round(cardHeightMm * 100) / 100,
      cardPaddingMm,
      cardCornerRadiusMm,
      cardCount: cards.length,
    },
  });

  // Attach cutShapes on the returned template (createRhinestoneTemplate doesn't
  // know about cutShapes, so we set it here).
  const templateWithCuts: RhinestoneTemplate = { ...template, cutShapes };

  const warnings: string[] = [];
  if (unsupportedCharacters.length > 0) {
    warnings.push(
      `The following characters are not supported by ${definition.displayName}: ${unsupportedCharacters.join(', ')}`,
    );
  }

  return { template: templateWithCuts, cards, unsupportedCharacters, warnings };
}
