/**
 * "Fit to the print area": shrinks a design that is bigger than its placement area, or too big for a mat, so that it fits.
 * The design keeps its shape and its centre; every layer is scaled about the middle of the whole design.
 *
 * Pure. Lengths in mm.
 */

import { getFitToMatScale } from '@/src/lib/rhinestone-engine/index';
import type { HtvLayer } from './HtvState';
import { computeDesignBounds } from './htvGeometry';
import { DEFAULT_HTV_EXPORT_MARGIN_MM } from './htvExport';

/** A little under the limit so rounding never leaves it just over. */
const MARGIN_FRACTION = 0.02;

export interface FitToPlacementPlan {
  /** Fraction of the current size (below 1). */
  scale: number;
  updates: Array<{ id: string; updates: Pick<HtvLayer, 'x' | 'y' | 'scale'> }>;
  /** What limited it. */
  limitedBy: 'placement' | 'mat';
}

export function planFitToPlacement(
  layers: readonly HtvLayer[],
  zoneSizeMm: { widthMm: number; heightMm: number },
  measuredTextSizes: ReadonlyMap<string, { width: number; height: number }> = new Map(),
  weedMarginMm: number = DEFAULT_HTV_EXPORT_MARGIN_MM,
): FitToPlacementPlan | null {
  const visible = layers.filter((layer) => layer.visible);
  if (visible.length === 0 || visible.some((layer) => layer.locked)) return null;
  const bounds = computeDesignBounds(visible, measuredTextSizes);
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;

  const byPlacement = Math.min(zoneSizeMm.widthMm / bounds.width, zoneSizeMm.heightMm / bounds.height) * (1 - MARGIN_FRACTION);
  const cut = { w: bounds.width + weedMarginMm * 2, h: bounds.height + weedMarginMm * 2 };
  // The cut file includes the weeding border, which does not shrink with the design, so solve for the design size.
  const matScale = getFitToMatScale(cut.w, cut.h, '12x24', MARGIN_FRACTION).scale;
  const byMat = matScale >= 1 ? 1 : Math.max(0, (cut.w * matScale - weedMarginMm * 2) / bounds.width);
  const byMatHeight = matScale >= 1 ? 1 : Math.max(0, (cut.h * matScale - weedMarginMm * 2) / bounds.height);
  const mat = Math.min(byMat, byMatHeight);

  const scale = Math.min(byPlacement, mat, 1);
  if (!(scale < 1) || !(scale > 0)) return null;

  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return {
    scale,
    limitedBy: mat < byPlacement ? 'mat' : 'placement',
    updates: visible.map((layer) => ({
      id: layer.id,
      updates: { x: round(cx + (layer.x - cx) * scale), y: round(cy + (layer.y - cy) * scale), scale: round(layer.scale * scale) },
    })),
  };
}
