'use client';

/**
 * Renders one HTV layer's filled vector shape. Shared between the design
 * canvas and the garment preview so both always show the same geometry.
 */

import type { HtvLayer } from './HtvState';
import { useHtvTextGeometry } from './useHtvTextGeometry';
import { polylinesToPathD } from './htvGeometry';
import { getHtvColor } from './htvMaterialCatalog';

export default function HtvLayerShape({ layer }: { layer: HtvLayer }) {
  if (layer.type === 'text') return <HtvTextLayerShape layer={layer} />;
  const excluded = new Set(layer.excludedContours);
  const visiblePolylines = excluded.size === 0 ? layer.polylines : layer.polylines.filter((_, i) => !excluded.has(i));
  return <path d={polylinesToPathD(visiblePolylines)} fill={getHtvColor(layer.colorId).hex} fillRule="nonzero" />;
}

function HtvTextLayerShape({ layer }: { layer: Extract<HtvLayer, { type: 'text' }> }) {
  const polylines = useHtvTextGeometry(layer);
  if (!polylines || polylines.length === 0) return null;
  return <path d={polylinesToPathD(polylines)} fill={getHtvColor(layer.colorId).hex} fillRule="nonzero" />;
}
