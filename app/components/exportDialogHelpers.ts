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

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Length of the side of the check square on the print sheet. */
export const PRINT_CHECK_SQUARE_MM = 50;

/**
 * A page that prints the design at its true size, to a printer or to a PDF.
 *
 * The page is the size of the design plus a margin, so "actual size" gives a 1:1 print. A square of
 * `PRINT_CHECK_SQUARE_MM` is drawn next to it: measure it with a ruler, and if it is not 50 mm the print was scaled.
 * The SVG is the one that is exported (nothing is rasterised); the page only places it.
 */
export function buildPrintSheetHtml(svg: string, size: { widthMm: number; heightMm: number }, title: string): string {
  const margin = 10;
  const squareArea = PRINT_CHECK_SQUARE_MM + margin;
  const pageWidth = Math.ceil(size.widthMm + margin * 2);
  // The check square goes below the design.
  const pageHeight = Math.ceil(size.heightMm + margin * 2 + squareArea);
  const safeTitle = escapeHtml(title);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${safeTitle}</title>
<style>
@page { size: ${pageWidth}mm ${pageHeight}mm; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
.sheet { position: relative; width: ${pageWidth}mm; height: ${pageHeight}mm; overflow: hidden; font: 3.2mm sans-serif; color: #000; }
.design { position: absolute; left: ${margin}mm; top: ${margin}mm; }
.design svg { display: block; }
.check { position: absolute; left: ${margin}mm; top: ${Math.ceil(size.heightMm + margin * 2)}mm; width: ${PRINT_CHECK_SQUARE_MM}mm; height: ${PRINT_CHECK_SQUARE_MM}mm; border: 0.3mm solid #000; box-sizing: border-box; }
.note { position: absolute; left: ${margin + PRINT_CHECK_SQUARE_MM + 5}mm; top: ${Math.ceil(size.heightMm + margin * 2)}mm; width: ${Math.max(40, pageWidth - margin * 2 - PRINT_CHECK_SQUARE_MM - 5)}mm; line-height: 1.35; }
@media screen { body { background: #eee; } .sheet { background: #fff; margin: 8mm auto; box-shadow: 0 0 4mm rgba(0,0,0,.25); } }
</style></head>
<body><div class="sheet">
<div class="design">${svg}</div>
<div class="check"></div>
<div class="note"><strong>${safeTitle}</strong><br>${Math.round(size.widthMm)} × ${Math.round(size.heightMm)} mm<br>Print at 100% (actual size). This square must measure ${PRINT_CHECK_SQUARE_MM} mm. If it does not, the print was scaled.</div>
</div>
<script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 250); });</script>
</body></html>`;
}
