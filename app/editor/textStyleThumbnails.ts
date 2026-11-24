/**
 * Small pictures of the user's own words in a stone look, for the style gallery.
 * They are made by the same generators the canvas uses, so what the picture shows is what the stones will be.
 *
 * Fonts are fetched once and kept, so opening the gallery again costs nothing.
 */

import {
  TRW_STONE_SIZE_CALIBRATION,
  createDotMatrixTextTemplate,
  createOutlineTextTemplateAsync,
  createRhinestoneFontTemplate,
  createSvgAlphabetTemplate,
  defaultSvgAlphabetGlyphLoader,
  getSvgAlphabetDefinition,
  getPreferredRhinestoneFontStoneSize,
  getRhinestoneFontDefinition,
  type RhinestoneTemplate,
  type StoneSizeId,
} from '@/src/lib/rhinestone-engine/index';

export interface ThumbnailDot {
  x: number;
  y: number;
  r: number;
}

export interface TextThumbnail {
  dots: ThumbnailDot[];
  /** The drawing area (mm), with a margin. */
  viewBox: { x: number; y: number; width: number; height: number };
  /** True when the font has none of the user's letters, so the font's own sample is shown instead. */
  isSample: boolean;
}

/** One short line is enough to judge a look; long text only makes the picture tiny. */
export function thumbnailText(text: string, fallback: string): string {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? '';
  const trimmed = firstLine.trim().slice(0, 10);
  return trimmed.length > 0 ? trimmed : fallback;
}

export function dotsOf(template: RhinestoneTemplate): Omit<TextThumbnail, 'isSample'> | null {
  if (template.stones.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const dots = template.stones.map((stone) => {
    const r = stone.holeDiameterMm / 2;
    minX = Math.min(minX, stone.center.x - r);
    minY = Math.min(minY, stone.center.y - r);
    maxX = Math.max(maxX, stone.center.x + r);
    maxY = Math.max(maxY, stone.center.y + r);
    return { x: stone.center.x, y: stone.center.y, r };
  });
  const margin = 1;
  return { dots, viewBox: { x: minX - margin, y: minY - margin, width: maxX - minX + margin * 2, height: maxY - minY + margin * 2 } };
}

export function dotMatrixThumbnail(text: string): TextThumbnail | null {
  const shown = thumbnailText(text, 'Abc');
  try {
    const template = createDotMatrixTextTemplate({ id: 'thumb', name: 'thumb', text: shown, stoneSize: 'SS10' });
    const drawn = dotsOf(template);
    return drawn ? { ...drawn, isSample: false } : null;
  } catch {
    return null;
  }
}

const stoneFontCache = new Map<string, Promise<TextThumbnail | null>>();

async function makeStoneFontThumbnail(fontId: string, shown: string, sample: string): Promise<TextThumbnail | null> {
  const stoneSize = getPreferredRhinestoneFontStoneSize(fontId);
  const diameter =
    stoneSize in TRW_STONE_SIZE_CALIBRATION
      ? TRW_STONE_SIZE_CALIBRATION[stoneSize as keyof typeof TRW_STONE_SIZE_CALIBRATION].diameterMm
      : 3.429;
  const definition = getRhinestoneFontDefinition(fontId as never);
  const attempt = async (text: string) => {
    const result = await createRhinestoneFontTemplate({
      text,
      rhinestoneFontId: fontId,
      targetStoneSizeId: stoneSize,
      targetStoneSizeMm: diameter,
      letterSpacingMm: definition.style === 'Line' || definition.style === 'Digits' ? 0 : 1,
      lineSpacingMm: 0,
    });
    return { result, drawn: dotsOf(result.template) };
  };
  const tryText = async (text: string) => {
    try {
      return (await attempt(text)).drawn;
    } catch {
      return null;
    }
  };
  // Only some of the letters missing is fine (the picture shows the rest); none at all means show the font's sample.
  // A digits-only alphabet has no letters to ask for: go straight to its sample instead of fetching letters that do not exist.
  const coverage = definition.characterCoverage;
  const hasLetters = coverage === undefined || coverage.uppercase || coverage.lowercase;
  const wantsLetters = /\p{L}/u.test(shown);
  const first = !hasLetters && wantsLetters ? null : await tryText(shown);
  if (first) return { ...first, isSample: false };
  if (shown === sample) return null;
  const second = await tryText(sample);
  return second ? { ...second, isSample: true } : null;
}

/** Resolves to null when the font cannot be loaded or has nothing to draw. Cached per font and text. */
export function stoneFontThumbnail(fontId: string, text: string): Promise<TextThumbnail | null> {
  const sample = getRhinestoneFontDefinition(fontId as never).suggestedText;
  const shown = thumbnailText(text, sample);
  const key = `${fontId}|${shown}`;
  let cached = stoneFontCache.get(key);
  if (!cached) {
    cached = makeStoneFontThumbnail(fontId, shown, sample);
    stoneFontCache.set(key, cached);
  }
  return cached;
}

const alphabetCache = new Map<string, Promise<TextThumbnail | null>>();

async function makeAlphabetThumbnail(alphabetId: string, shown: string, sample: string): Promise<TextThumbnail | null> {
  const definition = getSvgAlphabetDefinition(alphabetId as never);
  const stoneSize = definition.supportedTargetStoneSizeIds[0] ?? 'SS10';
  const diameter =
    stoneSize in TRW_STONE_SIZE_CALIBRATION
      ? TRW_STONE_SIZE_CALIBRATION[stoneSize as keyof typeof TRW_STONE_SIZE_CALIBRATION].diameterMm
      : 3.429;
  const tryText = async (text: string) => {
    try {
      const result = await createSvgAlphabetTemplate({
        text,
        alphabetId,
        targetStoneSizeId: stoneSize,
        targetStoneSizeMm: diameter,
        letterSpacingMm: 2,
        lineSpacingMm: 0,
        glyphLoader: defaultSvgAlphabetGlyphLoader,
      });
      return dotsOf(result.template);
    } catch {
      return null;
    }
  };
  const first = await tryText(shown);
  if (first) return { ...first, isSample: false };
  if (shown === sample) return null;
  const second = await tryText(sample);
  return second ? { ...second, isSample: true } : null;
}

/** Resolves to null when the alphabet's letter files cannot be loaded or none of the letters exist. Cached. */
export function alphabetThumbnail(alphabetId: string, text: string): Promise<TextThumbnail | null> {
  const sample = getSvgAlphabetDefinition(alphabetId as never).suggestedText;
  const shown = thumbnailText(text, sample);
  const key = `${alphabetId}|${shown}`;
  let cached = alphabetCache.get(key);
  if (!cached) {
    cached = makeAlphabetThumbnail(alphabetId, shown, sample);
    alphabetCache.set(key, cached);
  }
  return cached;
}


// ─── A traced font, as stones ─────────────────────────────────────────────────

export interface OutlineFontPreview {
  thumbnail: TextThumbnail | null;
  stoneCount: number;
  /** Letters of the text the font cannot draw (they are left out of the picture). */
  missing: string[];
}

const outlineCache = new Map<string, Promise<OutlineFontPreview>>();
const OUTLINE_CONCURRENCY = 2;
let outlineActive = 0;
const outlineWaiting: Array<() => void> = [];

/** At most a couple of fonts are traced at once, so a page full of cards does not freeze while it fills in. */
async function inTurn<T>(work: () => Promise<T>): Promise<T> {
  if (outlineActive >= OUTLINE_CONCURRENCY) await new Promise<void>((resolve) => outlineWaiting.push(resolve));
  outlineActive++;
  try {
    return await work();
  } finally {
    outlineActive--;
    outlineWaiting.shift()?.();
  }
}

async function makeOutlineFontPreview(fontId: string, shown: string, stoneSize: StoneSizeId): Promise<OutlineFontPreview> {
  const attempt = async (text: string) => {
    const template = await createOutlineTextTemplateAsync({ id: 'thumb', name: 'thumb', text, stoneSize, fontId, fontSizeMm: 25 });
    return { drawn: dotsOf(template), count: template.stones.length };
  };
  try {
    const { drawn, count } = await attempt(shown);
    return { thumbnail: drawn ? { ...drawn, isSample: false } : null, stoneCount: count, missing: [] };
  } catch (error) {
    // "Font X has no glyph for: Å Ä. Remove them ..." : draw the rest and say which letters are missing.
    const message = error instanceof Error ? error.message : '';
    const listed = /no glyph for: (.+?)\. Remove/.exec(message)?.[1]?.split(' ').filter(Boolean) ?? [];
    if (listed.length === 0) return { thumbnail: null, stoneCount: 0, missing: [] };
    const rest = [...shown].filter((character) => !listed.includes(character)).join('').trim();
    if (rest.length === 0) return { thumbnail: null, stoneCount: 0, missing: listed };
    try {
      const { drawn, count } = await attempt(rest);
      return { thumbnail: drawn ? { ...drawn, isSample: false } : null, stoneCount: count, missing: listed };
    } catch {
      return { thumbnail: null, stoneCount: 0, missing: listed };
    }
  }
}

/** The user's words traced in a font and turned into stones (25 mm letters), cached per font, text and stone size. */
export function outlineFontThumbnail(fontId: string, text: string, stoneSize: StoneSizeId = 'SS10'): Promise<OutlineFontPreview> {
  const shown = thumbnailText(text, 'Abc');
  const key = `${fontId}|${stoneSize}|${shown}`;
  let cached = outlineCache.get(key);
  if (!cached) {
    cached = inTurn(() => makeOutlineFontPreview(fontId, shown, stoneSize));
    outlineCache.set(key, cached);
  }
  return cached;
}
