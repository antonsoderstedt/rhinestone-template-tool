/**
 * Small pictures of the user's own words in a stone look, for the style gallery.
 * They are made by the same generators the canvas uses, so what the picture shows is what the stones will be.
 *
 * Fonts are fetched once and kept, so opening the gallery again costs nothing.
 */

import {
  TRW_STONE_SIZE_CALIBRATION,
  createDotMatrixTextTemplate,
  createRhinestoneFontTemplate,
  getPreferredRhinestoneFontStoneSize,
  getRhinestoneFontDefinition,
  type RhinestoneTemplate,
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
  const first = await tryText(shown);
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
