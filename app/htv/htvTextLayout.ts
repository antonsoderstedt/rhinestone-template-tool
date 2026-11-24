/**
 * Real letterform geometry for an HTV text layer: loads the bundled font,
 * lays the text out, applies the arc curve and centres the result. Shared by
 * the live preview (`useHtvTextGeometry`) and by size measurement.
 */

import { layoutTextToOpenTypePolylines, loadOutlineFont, type Polyline } from '@/src/lib/rhinestone-engine/index';
import { applyArcCurve, centerPolylines, computePolylinesBounds } from './htvGeometry';
import type { HtvTextLayer } from './HtvState';

type TextLayoutInput = Pick<HtvTextLayer, 'fontId' | 'text' | 'fontSizeMm' | 'align' | 'letterSpacingMm' | 'curveAmount'>;

/** Everything that changes a text layer's outline; equal keys mean equal geometry. */
export function textLayoutKey(layer: TextLayoutInput): string {
  return [layer.fontId, layer.text, layer.fontSizeMm, layer.align, layer.letterSpacingMm, layer.curveAmount].join('|');
}

/** Centred, curved outline polylines, `[]` for empty text, or null when the font could not be loaded. */
export async function layoutHtvTextLayer(layer: TextLayoutInput): Promise<Polyline[] | null> {
  if (!layer.fontId || !layer.text.trim()) return [];
  const loaded = await loadOutlineFont(layer.fontId);
  if (!loaded.font) return null;
  const raw = layoutTextToOpenTypePolylines({
    text: layer.text,
    font: loaded.font,
    fontSizeMm: layer.fontSizeMm,
    align: layer.align,
    letterSpacingMm: layer.letterSpacingMm,
  });
  const centered = centerPolylines(raw).polylines;
  const curved = applyArcCurve(centered, layer.curveAmount);
  return centerPolylines(curved).polylines;
}

/** Real width/height of a text layer before its own scale/rotation, or null when it cannot be measured. */
export async function measureHtvTextLayer(layer: TextLayoutInput): Promise<{ width: number; height: number } | null> {
  const polylines = await layoutHtvTextLayer(layer);
  if (!polylines) return null;
  const bounds = computePolylinesBounds(polylines);
  return { width: bounds.width, height: bounds.height };
}
