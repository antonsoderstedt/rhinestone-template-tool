/**
 * How big the user's words come out in a stone font at each stone size the font is made for.
 *
 * A stone font has its stones already placed, so the words cannot be scaled: the stone size is the only thing that changes
 * how big they are. This measures every size with the same generator the canvas uses, so the numbers are what the design
 * will be, and picks the largest stones that still fit a mat (bigger stones sparkle more, so bigger is better when it fits).
 */

import {
  TRW_STONE_SIZE_CALIBRATION,
  createRhinestoneFontTemplate,
  getMatFit,
  getRhinestoneFontDefinition,
  getSupportedRhinestoneFontStoneSizes,
  type MatFit,
  type StoneSizeId,
} from '@/src/lib/rhinestone-engine/index';

export interface StoneFontSizeOption {
  size: StoneSizeId;
  diameterMm: number;
  /** Null when the words cannot be set in this font at this size (none of the letters exist, or the font will not load). */
  widthMm: number | null;
  heightMm: number | null;
  fit: MatFit['status'] | null;
}

export interface StoneFontSizeQuery {
  fontId: string;
  text: string;
  letterSpacingMm: number;
  lineSpacingMm: number;
}

const diameterOf = (size: StoneSizeId): number =>
  size in TRW_STONE_SIZE_CALIBRATION ? TRW_STONE_SIZE_CALIBRATION[size as keyof typeof TRW_STONE_SIZE_CALIBRATION].diameterMm : 3.429;

/** The spacing the editor uses when the user has not typed one. */
export function defaultStoneFontSpacing(fontId: string): { letterSpacingMm: number; lineSpacingMm: number } {
  const style = getRhinestoneFontDefinition(fontId as never).style;
  return { letterSpacingMm: style === 'Line' || style === 'Digits' ? 0 : 1, lineSpacingMm: 0 };
}

const cache = new Map<string, Promise<StoneFontSizeOption[]>>();

export function measureStoneFontSizes(query: StoneFontSizeQuery): Promise<StoneFontSizeOption[]> {
  const key = JSON.stringify(query);
  let cached = cache.get(key);
  if (!cached) {
    cached = Promise.all(
      getSupportedRhinestoneFontStoneSizes(query.fontId).map(async (size): Promise<StoneFontSizeOption> => {
        const base = { size, diameterMm: diameterOf(size) };
        try {
          const result = await createRhinestoneFontTemplate({
            text: query.text,
            rhinestoneFontId: query.fontId,
            targetStoneSizeId: size,
            targetStoneSizeMm: base.diameterMm,
            letterSpacingMm: query.letterSpacingMm,
            lineSpacingMm: query.lineSpacingMm,
          });
          const { widthMm, heightMm } = result.template;
          if (result.template.stones.length === 0 || !widthMm || !heightMm) return { ...base, widthMm: null, heightMm: null, fit: null };
          return { ...base, widthMm, heightMm, fit: getMatFit(widthMm, heightMm).status };
        } catch {
          return { ...base, widthMm: null, heightMm: null, fit: null };
        }
      }),
    );
    cache.set(key, cached);
  }
  return cached;
}

/** 2 fits the small mat, 1 the big one, 0 neither. */
export const fitRank = (fit: StoneFontSizeOption['fit']): number => (fit === 'fits-12x12' ? 2 : fit === 'fits-12x24' ? 1 : 0);

/** The size worth suggesting instead of the current one: only when it makes the words fit a smaller mat. */
export function stoneFontSizeSuggestion(options: readonly StoneFontSizeOption[], current: StoneSizeId): StoneFontSizeOption | null {
  const best = bestStoneFontSize(options);
  const now = options.find((option) => option.size === current);
  if (!best || !now || best.size === current || best.widthMm === null) return null;
  return fitRank(best.fit) > fitRank(now.fit) ? best : null;
}

/**
 * The size to suggest: the largest stones that fit the smaller mat; failing that, the largest that fit the bigger mat;
 * failing that, the smallest stones (closest to fitting). Null when nothing could be measured.
 */
export function bestStoneFontSize(options: readonly StoneFontSizeOption[]): StoneFontSizeOption | null {
  const measured = options.filter((option) => option.widthMm !== null);
  if (measured.length === 0) return null;
  const bestRank = Math.max(...measured.map((option) => fitRank(option.fit)));
  const candidates = measured.filter((option) => fitRank(option.fit) === bestRank);
  return bestRank > 0
    ? candidates.reduce((a, b) => (b.diameterMm > a.diameterMm ? b : a))
    : candidates.reduce((a, b) => (b.diameterMm < a.diameterMm ? b : a));
}

export function describeFit(fit: StoneFontSizeOption['fit']): string {
  switch (fit) {
    case 'fits-12x12':
      return 'fits a 12 × 12 in mat';
    case 'fits-12x24':
      return 'needs a 12 × 24 in mat';
    case 'too-large':
      return 'too big for a mat, export in parts';
    default:
      return 'size unknown';
  }
}
