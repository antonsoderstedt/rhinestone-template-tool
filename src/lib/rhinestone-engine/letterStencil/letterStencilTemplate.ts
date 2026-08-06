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
import { loadRhinestoneFont } from '../rhinestoneFont/rhinestoneFontLoader';
import { extractStonesFromGlyph } from '../rhinestoneFont/glyphExtraction';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StencilLayoutMode = 'preview' | 'cut-sheet';

/**
 * Where each letter's glyph comes from. Two sources are supported:
 *
 * - `svg-alphabet`: per-letter SVG files from the curated alphabet library.
 *   Uses the same glyph loader as the SVG Alphabet source.
 * - `rhinestone-font`: OpenType rhinestone fonts (e.g. Blessed, Real, Atletico).
 *   Uses the rhinestone font loader + glyph extraction.
 */
export type LetterStencilSource =
  | {
      type: 'svg-alphabet';
      alphabetId: string;
      glyphLoader: SvgAlphabetGlyphLoader;
    }
  | {
      type: 'rhinestone-font';
      rhinestoneFontId: string;
    };

export interface CreateLetterStencilOptions {
  text: string;
  source: LetterStencilSource;
  targetStoneSizeId: StoneSizeId;
  targetStoneSizeMm: number;

  /** Space between the glyph and the card edge on all sides (mm). Default 3. */
  cardPaddingMm?: number;
  /** Rounded-corner radius on card frames (mm). Default 2. */
  cardCornerRadiusMm?: number;
  /** Minimum card width so single-stroke letters (I, 1) don't collapse (mm). Default 12. */
  minCardWidthMm?: number;

  /** How cards are arranged on the sheet. Default 'cut-sheet'. */
  layoutMode?: StencilLayoutMode;
  /** For 'cut-sheet' mode: gap between adjacent cards (mm). Default 3. */
  cutSheetGapMm?: number;
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

// Latin-script lowercase letters that conventionally extend below the
// baseline (a descender). Used only to refine SVG Alphabet vertical
// alignment — see the xHeightMm/anchorHeightMm comment near glyphOffsetY.
const DESCENDER_CHARS = new Set(['g', 'j', 'p', 'q', 'y']);

interface RawGlyph {
  stones: Array<{ x: number; y: number; diameterMm: number }>;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  widthMm: number;
  heightMm: number;
  advanceWidthMm: number;
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
    return {
      stones: [],
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      widthMm: 0,
      heightMm: 0,
      advanceWidthMm: 0,
    };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const stone of rawStones) {
    const r = stone.diameterMm / 2;
    minX = Math.min(minX, stone.center.x - r);
    minY = Math.min(minY, stone.center.y - r);
    maxX = Math.max(maxX, stone.center.x + r);
    maxY = Math.max(maxY, stone.center.y + r);
  }
  const widthMm = maxX - minX;
  const heightMm = maxY - minY;
  return {
    stones: rawStones.map((s) => ({
      x: s.center.x - minX,
      y: s.center.y - minY,
      diameterMm: s.diameterMm,
    })),
    minX: 0,
    minY: 0,
    maxX: widthMm,
    maxY: heightMm,
    widthMm,
    heightMm,
    advanceWidthMm: widthMm,
  };
}

function createFontRawGlyph(rawStones: ImportedStone[], advanceWidthMm: number): RawGlyph {
  if (rawStones.length === 0) {
    return {
      stones: [],
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      widthMm: 0,
      heightMm: 0,
      advanceWidthMm,
    };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const stones = rawStones.map((s) => {
    const radius = s.diameterMm / 2;
    minX = Math.min(minX, s.center.x - radius);
    minY = Math.min(minY, s.center.y - radius);
    maxX = Math.max(maxX, s.center.x + radius);
    maxY = Math.max(maxY, s.center.y + radius);
    return {
      x: s.center.x,
      y: s.center.y,
      diameterMm: s.diameterMm,
    };
  });

  return {
    stones,
    minX,
    minY,
    maxX,
    maxY,
    widthMm: maxX - minX,
    heightMm: maxY - minY,
    advanceWidthMm,
  };
}

function scaleGlyph(g: RawGlyph, scale: number): RawGlyph {
  return {
    stones: g.stones.map((s) => ({ x: s.x * scale, y: s.y * scale, diameterMm: s.diameterMm * scale })),
    minX: g.minX * scale,
    minY: g.minY * scale,
    maxX: g.maxX * scale,
    maxY: g.maxY * scale,
    widthMm: g.widthMm * scale,
    heightMm: g.heightMm * scale,
    advanceWidthMm: g.advanceWidthMm * scale,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function createLetterStencilTemplate(
  options: CreateLetterStencilOptions,
): Promise<LetterStencilResult> {
  const {
    text,
    source,
    targetStoneSizeId,
    targetStoneSizeMm,
    cardPaddingMm = 3,
    cardCornerRadiusMm = 2,
    minCardWidthMm = 12,
    layoutMode = 'cut-sheet',
    cutSheetGapMm = 3,
  } = options;

  // Resolve source metadata (display name is used in warnings) and pre-extract
  // every unique non-space character.
  const uniqueChars = new Set<string>();
  for (const ch of text) {
    if (ch === ' ' || ch === '\n') continue;
    uniqueChars.add(ch);
  }

  const rawByChar = new Map<string, RawGlyph>();
  const unsupportedCharacters: string[] = [];
  const allDiameters: number[] = [];
  let sourceDisplayName: string;
  let sourceIdForMetadata: string;
  let sourceStyleForMetadata: string;
  const useFontMetrics = source.type === 'rhinestone-font';
  let baselineBelowFractionByChar: Readonly<Record<string, number>> | undefined;

  if (source.type === 'svg-alphabet') {
    const resolvedAlphabetId: SvgAlphabetId = isKnownSvgAlphabetId(source.alphabetId)
      ? source.alphabetId
      : DEFAULT_SVG_ALPHABET_ID;
    const definition: SvgAlphabetDefinition = getSvgAlphabetDefinition(resolvedAlphabetId);
    sourceDisplayName = definition.displayName;
    sourceIdForMetadata = resolvedAlphabetId;
    sourceStyleForMetadata = definition.style;
    baselineBelowFractionByChar = definition.baselineBelowFractionByChar;

    if (!definition.supportedTargetStoneSizeIds.includes(targetStoneSizeId)) {
      throw new Error(
        `SVG alphabet ${definition.displayName} supports ${definition.supportedTargetStoneSizeIds.join(', ')}. ` +
        `Requested: ${targetStoneSizeId}.`,
      );
    }

    for (const ch of uniqueChars) {
      const svg = await source.glyphLoader.loadGlyphSvg(resolvedAlphabetId, ch, targetStoneSizeId);
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
  } else {
    const loaded = await loadRhinestoneFont(source.rhinestoneFontId, targetStoneSizeId);
    sourceDisplayName = loaded.definition.displayName;
    sourceIdForMetadata = loaded.definition.fontId;
    sourceStyleForMetadata = loaded.definition.style;

    if (!loaded.definition.supportedTargetStoneSizeIds.includes(targetStoneSizeId)) {
      throw new Error(
        `Rhinestone font ${loaded.definition.displayName} supports ${loaded.definition.supportedTargetStoneSizeIds.join(', ')}. ` +
        `Requested: ${targetStoneSizeId}.`,
      );
    }

    for (const ch of uniqueChars) {
      const extracted = extractStonesFromGlyph(loaded.font, ch);
      if (extracted.stones.length === 0) {
        unsupportedCharacters.push(ch);
        continue;
      }
      // extractStonesFromGlyph returns positions in font units. Treat them as
      // pseudo-mm here — the median-diameter auto-scale below normalises to the
      // requested physical stone size regardless of source units.
      const asImported: ImportedStone[] = extracted.stones.map((s, idx) => ({
        center: { x: s.localX, y: s.localY },
        diameterMm: s.diameterFontUnits,
        fill: null,
        stroke: null,
        group: null,
        originalIndex: idx,
      }));
      const rawGlyph = createFontRawGlyph(asImported, extracted.advanceWidth);
      rawByChar.set(ch, rawGlyph);
      for (const stone of rawGlyph.stones) allDiameters.push(stone.diameterMm);
    }
  }

  // Auto-scale so extracted stones match the requested physical stone size.
  allDiameters.sort((a, b) => a - b);
  const medianDiameter = allDiameters.length > 0
    ? allDiameters[Math.floor(allDiameters.length / 2)]!
    : targetStoneSizeMm;
  const scale = medianDiameter > 0 ? targetStoneSizeMm / medianDiameter : 1;

  // Scale every glyph up front.
  const scaledByChar = new Map<string, RawGlyph>();
  let globalMinY = 0;
  let globalMaxY = 0;
  for (const [ch, raw] of rawByChar) {
    const scaled = scaleGlyph(raw, scale);
    scaledByChar.set(ch, scaled);
    if (useFontMetrics) {
      globalMinY = Math.min(globalMinY, scaled.minY);
      globalMaxY = Math.max(globalMaxY, scaled.maxY);
    }
  }

  // Reference "x-height" for SVG Alphabet descender correction: the shortest
  // lowercase, non-descender glyph actually present in this word/alphabet.
  // SVG Alphabet packages carry no font metrics, so there's no way to know
  // how much of a descender letter's height (g, j, p, q, y) is its main body
  // versus its tail below the baseline — bottom-aligning by full height (as
  // every other letter correctly is) would push descenders' whole body up,
  // out of proportion with their neighbors. Approximating the body height as
  // this word's own x-height reference lets most of the tail hang below the
  // shared baseline instead, which reads far closer to correct.
  let xHeightMm = Infinity;
  if (!useFontMetrics) {
    for (const [ch, glyph] of scaledByChar) {
      if (/^[a-z]$/.test(ch) && !DESCENDER_CHARS.has(ch)) {
        xHeightMm = Math.min(xHeightMm, glyph.heightMm);
      }
    }
  }

  // Decorative capitals (common in blackletter/Gothic alphabets — e.g. a
  // capital Y or J with a swash tail curling below the normal cap line) need
  // the same treatment, but there is no fixed "which capitals have a tail"
  // list the way DESCENDER_CHARS is for lowercase — it's font-specific.
  // Instead, treat any capital whose height clearly exceeds the shortest
  // capital present as carrying a tail: ordinary per-letter design variance
  // among capitals is modest (rarely more than ~8%), so an outlier well
  // beyond that is almost certainly a swash, not just a taller letterform.
  const CAP_HEIGHT_OUTLIER_RATIO = 1.08;
  let capHeightMm = Infinity;
  if (!useFontMetrics) {
    for (const [ch, glyph] of scaledByChar) {
      if (/^[A-Z]$/.test(ch)) {
        capHeightMm = Math.min(capHeightMm, glyph.heightMm);
      }
    }
  }

  /** The height actually used to anchor a glyph's bottom to the shared baseline. */
  function anchorHeightMmFor(ch: string, glyph: RawGlyph): number {
    if (useFontMetrics) return glyph.heightMm;
    // Alphabets that ship exact baseline metrics (measured from their source
    // typeface / combined strips) bypass the heuristics below entirely.
    if (baselineBelowFractionByChar) {
      const belowFraction = baselineBelowFractionByChar[ch] ?? 0;
      return glyph.heightMm * (1 - belowFraction);
    }
    if (DESCENDER_CHARS.has(ch) && isFinite(xHeightMm)) {
      return Math.min(glyph.heightMm, xHeightMm);
    }
    if (/^[A-Z]$/.test(ch) && isFinite(capHeightMm) && glyph.heightMm > capHeightMm * CAP_HEIGHT_OUTLIER_RATIO) {
      return capHeightMm;
    }
    return glyph.heightMm;
  }

  // Uniform card height must fit both the tallest content ABOVE the shared
  // baseline (spaceAboveMm — every letter's own anchor height, capped for
  // descenders per the x-height correction) AND the deepest content BELOW it
  // (spaceBelowMm — how far a descender's true bottom extends past its
  // anchor). Without spaceBelowMm, a descender's tail would render past the
  // bottom of its own card.
  let spaceAboveMm = 0;
  let spaceBelowMm = 0;
  for (const [ch, glyph] of scaledByChar) {
    const anchor = anchorHeightMmFor(ch, glyph);
    spaceAboveMm = Math.max(spaceAboveMm, anchor);
    spaceBelowMm = Math.max(spaceBelowMm, glyph.heightMm - anchor);
  }
  const naturalCardHeightMm = useFontMetrics ? globalMaxY - globalMinY : spaceAboveMm + spaceBelowMm;
  const cardHeightMm = naturalCardHeightMm + 2 * cardPaddingMm;

  // Emit cards in the order characters appear in text (respecting duplicates).
  const stones: Stone[] = [];
  const cutShapes: CutShape[] = [];
  const cards: LetterStencilCardMetadata[] = [];

  let cursorX = 0;
  let cursorY = 0;
  let rowMaxHeight = 0;
  let stoneCounter = 0;
  let cardCounter = 0;

  const advanceToNextRow = () => {
    cursorX = 0;
    cursorY += rowMaxHeight + cutSheetGapMm;
    rowMaxHeight = 0;
  };

  for (const ch of text) {
    if (ch === '\n') {
      if (layoutMode === 'preview') {
        cursorX = 0;
        cursorY += cardHeightMm;
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
    const leftOverflowMm = useFontMetrics ? Math.max(0, -scaled.minX) : 0;
    const rightEdgeMm = useFontMetrics ? Math.max(scaled.advanceWidthMm, scaled.maxX) : glyphWidth;
    const naturalCardWidthMm = useFontMetrics
      ? rightEdgeMm + leftOverflowMm + 2 * cardPaddingMm
      : glyphWidth + 2 * cardPaddingMm;
    const cardWidthMm = Math.max(naturalCardWidthMm, minCardWidthMm);
    const extraHorizontalInsetMm = (cardWidthMm - naturalCardWidthMm) / 2;

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

    const glyphOffsetX = useFontMetrics
      ? cardX + cardPaddingMm + leftOverflowMm + extraHorizontalInsetMm
      : cardX + (cardWidthMm - glyphWidth) / 2;
    // Rhinestone fonts preserve real font-space Y coordinates, so every glyph
    // can share one true baseline (globalMinY, from font ascender/descender
    // metrics). SVG Alphabet glyphs come from independently-imported files
    // that get re-zeroed to their own top-left per file (no cross-file
    // baseline survives), so instead every glyph's anchor height (see
    // spaceAboveMm/spaceBelowMm above) is pinned to one shared baseline line
    // (cardY + cardPaddingMm + spaceAboveMm) — letters without descenders sit
    // with their bottom exactly on it; known descender letters sit with only
    // their x-height-sized "body" reaching it, letting the actual tail hang
    // down into the spaceBelowMm allowance instead of dragging the whole
    // glyph upward or overflowing past the card's bottom edge.
    const glyphOffsetY = useFontMetrics
      ? cardY + cardPaddingMm - globalMinY
      : cardY + cardPaddingMm + spaceAboveMm - anchorHeightMmFor(ch, scaled);

    for (const s of scaled.stones) {
      stones.push({
        id: `ls-${stoneCounter++}`,
        center: { x: glyphOffsetX + s.x, y: glyphOffsetY + s.y },
        stoneSize: targetStoneSizeId,
        holeDiameterMm: targetStoneSizeMm,
        metadata: {
          character: ch,
          cardId,
          stencilSourceType: source.type,
          stencilSourceId: sourceIdForMetadata,
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
      stencilSourceType: source.type,
      stencilSourceId: sourceIdForMetadata,
      stencilSourceStyle: sourceStyleForMetadata,
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
      `The following characters are not supported by ${sourceDisplayName}: ${unsupportedCharacters.join(', ')}`,
    );
  }

  return { template: templateWithCuts, cards, unsupportedCharacters, warnings };
}
