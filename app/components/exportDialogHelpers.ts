/**
 * Pure helpers for the shared export dialog (both studios).
 * All measurements are in millimetres.
 */

/**
 * Usable cutting areas of the standard Cricut mats. A mat is 12 in wide but the
 * machine only cuts ~11.5 in across it; 12x24 mats cut ~11.5 x 23.5 in.
 */
export const CRICUT_MAT_12X12_USABLE_MM = { shortSide: 292.1, longSide: 292.1 } as const;
export const CRICUT_MAT_12X24_USABLE_MM = { shortSide: 292.1, longSide: 596.9 } as const;

export type MatFitStatus = 'fits-12x12' | 'fits-12x24' | 'too-large' | 'unknown';

export interface MatFit {
  status: MatFitStatus;
  /** True when the design only fits after turning it 90 degrees. */
  needsRotation: boolean;
  message: string;
}

function fitsWithin(widthMm: number, heightMm: number, area: { shortSide: number; longSide: number }) {
  if (widthMm <= area.shortSide && heightMm <= area.longSide) return { fits: true, rotated: false };
  if (heightMm <= area.shortSide && widthMm <= area.longSide) return { fits: true, rotated: true };
  return { fits: false, rotated: false };
}

export function getMatFit(widthMm: number, heightMm: number): MatFit {
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
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

const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|\u0000-\u001f]+/g;

/**
 * Turns whatever the user typed into a safe `.svg` file name. Never returns an
 * empty name and never produces a double extension.
 */
export function sanitizeExportFilename(input: string, fallbackBase = 'design'): string {
  const withoutExtension = input.trim().replace(/\.svg$/i, '');
  const cleaned = withoutExtension
    .replace(ILLEGAL_FILENAME_CHARS, '')
    .replace(/\s+/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 120);
  const base = cleaned.length > 0 ? cleaned : fallbackBase;
  return `${base}.svg`;
}

/** Reads the root `width`/`height` (in mm) from an exported SVG string. */
export function readSvgSizeMm(svg: string): { widthMm: number; heightMm: number } | null {
  const rootMatch = svg.match(/<svg\b[^>]*>/);
  if (!rootMatch) return null;
  const width = rootMatch[0].match(/\swidth="([\d.]+)mm"/);
  const height = rootMatch[0].match(/\sheight="([\d.]+)mm"/);
  if (!width || !height) return null;
  const widthMm = Number.parseFloat(width[1]!);
  const heightMm = Number.parseFloat(height[1]!);
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) return null;
  return { widthMm, heightMm };
}
