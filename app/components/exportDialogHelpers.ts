/**
 * Pure helpers for the shared export dialog (both studios).
 * All measurements are in millimetres.
 */

import {
  CRICUT_MAT_12X12_USABLE_MM,
  CRICUT_MAT_12X24_USABLE_MM,
  getMatFit,
  type MatFit,
  type MatFitStatus,
} from '@/src/lib/rhinestone-engine/index';

// The mat definitions live in the engine so the readiness check and this dialog agree.
export { CRICUT_MAT_12X12_USABLE_MM, CRICUT_MAT_12X24_USABLE_MM, getMatFit };
export type { MatFit, MatFitStatus };

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
