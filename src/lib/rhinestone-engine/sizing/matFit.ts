/**
 * Cricut mat fit helpers.
 *
 * Pure and deterministic; all measurements are millimetres. Lives in the engine so
 * both the export readiness check and the UI use one definition of "fits the mat".
 */

/**
 * Usable cutting areas of the standard Cricut mats. A mat is 12 in wide but the
 * machine only cuts ~11.5 in across it; 12x24 mats cut ~11.5 x 23.5 in.
 */
export const CRICUT_MAT_12X12_USABLE_MM = { shortSide: 292.1, longSide: 292.1 } as const;
export const CRICUT_MAT_12X24_USABLE_MM = { shortSide: 292.1, longSide: 596.9 } as const;

/** Above this many stones a template is slow to cut and tedious to weed; the readiness check warns. */
export const HIGH_STONE_COUNT_THRESHOLD = 1500;

export type MatFitStatus = 'fits-12x12' | 'fits-12x24' | 'too-large' | 'unknown';

export interface MatFit {
  status: MatFitStatus;
  /** True when the design only fits after turning it 90 degrees. */
  needsRotation: boolean;
  message: string;
}

export type MatId = '12x12' | '12x24';

export interface MatArea {
  shortSide: number;
  longSide: number;
}

export const MAT_AREAS: Record<MatId, MatArea> = {
  '12x12': CRICUT_MAT_12X12_USABLE_MM,
  '12x24': CRICUT_MAT_12X24_USABLE_MM,
};

export const MAT_LABELS: Record<MatId, string> = {
  '12x12': '12 × 12 in',
  '12x24': '12 × 24 in',
};

function isValidSize(widthMm: number, heightMm: number): boolean {
  return Number.isFinite(widthMm) && Number.isFinite(heightMm) && widthMm > 0 && heightMm > 0;
}

function fitsWithin(widthMm: number, heightMm: number, area: MatArea) {
  if (widthMm <= area.shortSide && heightMm <= area.longSide) return { fits: true, rotated: false };
  if (heightMm <= area.shortSide && widthMm <= area.longSide) return { fits: true, rotated: true };
  return { fits: false, rotated: false };
}

export function getMatFit(widthMm: number, heightMm: number): MatFit {
  if (!isValidSize(widthMm, heightMm)) {
    return { status: 'unknown', needsRotation: false, message: 'Size unknown.' };
  }

  const small = fitsWithin(widthMm, heightMm, CRICUT_MAT_12X12_USABLE_MM);
  if (small.fits) {
    return { status: 'fits-12x12', needsRotation: small.rotated, message: 'Fits a 12 × 12 in mat.' };
  }

  const large = fitsWithin(widthMm, heightMm, CRICUT_MAT_12X24_USABLE_MM);
  if (large.fits) {
    return {
      status: 'fits-12x24',
      needsRotation: large.rotated,
      message: large.rotated
        ? 'Too big for a 12 × 12 in mat. Fits a 12 × 24 in mat when turned 90°.'
        : 'Too big for a 12 × 12 in mat. Use a 12 × 24 in mat.',
    };
  }

  return {
    status: 'too-large',
    needsRotation: false,
    message: 'Larger than a 12 × 24 in mat (usable area about 292 × 597 mm). Make the design smaller or split it into parts.',
  };
}

export interface FitToMatResult {
  /** Multiply the design size by this (1 = already fits, never above 1). */
  scale: number;
  /** True when the design is turned 90 degrees to reach that scale. */
  rotated: boolean;
  alreadyFits: boolean;
}

/**
 * The largest uniform scale (never above 1) at which a design of the given size fits the
 * chosen mat, trying both orientations. `marginFraction` leaves a little room (for example
 * 0.03) because generated designs snap to whole stones and rarely land on the exact size.
 */
export function getFitToMatScale(
  widthMm: number,
  heightMm: number,
  mat: MatId,
  marginFraction = 0,
): FitToMatResult {
  if (!isValidSize(widthMm, heightMm)) return { scale: 1, rotated: false, alreadyFits: true };

  const area = MAT_AREAS[mat];
  if (fitsWithin(widthMm, heightMm, area).fits) {
    const fit = fitsWithin(widthMm, heightMm, area);
    return { scale: 1, rotated: fit.rotated, alreadyFits: true };
  }

  const upright = Math.min(area.shortSide / widthMm, area.longSide / heightMm);
  const turned = Math.min(area.shortSide / heightMm, area.longSide / widthMm);
  const rotated = turned > upright;
  const raw = Math.max(upright, turned);
  const margin = Math.min(Math.max(marginFraction, 0), 0.5);
  return { scale: Math.min(1, raw * (1 - margin)), rotated, alreadyFits: false };
}
