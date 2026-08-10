/**
 * HTV Studio SVG export — a single vector cut file, one filled path per
 * layer. Never rasterized: text is real letterform outlines (via the
 * OpenType font-outline engine), images only ever contribute through their
 * already-traced silhouette vector layer. Matches the rest of this app's
 * "no <image>, no raster embed in the export" rule even though HTV isn't
 * the rhinestone engine.
 */

import { layoutTextToOpenTypePolylines, loadOutlineFont, type Polyline, type PolylinePoint } from '@/src/lib/rhinestone-engine/index';
import { centerPolylines, polylinesToPathD } from './htvGeometry';
import { getHtvColor } from './htvMaterialCatalog';
import type { HtvLayer } from './HtvState';

interface ResolvedLayer {
  layer: HtvLayer;
  polylines: Polyline[];
}

async function resolveLayerGeometry(layer: HtvLayer): Promise<ResolvedLayer> {
  if (layer.type === 'vector') {
    return { layer, polylines: layer.polylines };
  }
  if (!layer.fontId || !layer.text.trim()) {
    return { layer, polylines: [] };
  }
  const loaded = await loadOutlineFont(layer.fontId);
  if (!loaded.font) {
    return { layer, polylines: [] };
  }
  const raw = layoutTextToOpenTypePolylines({
    text: layer.text,
    font: loaded.font,
    fontSizeMm: layer.fontSizeMm,
    align: layer.align,
    letterSpacingMm: layer.letterSpacingMm,
  });
  return { layer, polylines: centerPolylines(raw).polylines };
}

function transformPoint(point: PolylinePoint, layer: HtvLayer): PolylinePoint {
  const scaled = { x: point.x * layer.scale, y: point.y * layer.scale };
  const theta = (layer.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const rotated = {
    x: scaled.x * cos - scaled.y * sin,
    y: scaled.x * sin + scaled.y * cos,
  };
  return { x: rotated.x + layer.x, y: rotated.y + layer.y };
}

export interface HtvExportResult {
  svg: string;
  widthMm: number;
  heightMm: number;
  layerCount: number;
}

const EXPORT_PADDING_MM = 6;

/**
 * @throws if there are no visible layers with drawable geometry.
 */
export async function createHtvSvgExport(layers: readonly HtvLayer[], projectName: string): Promise<HtvExportResult> {
  const resolved = await Promise.all(layers.filter((l) => l.visible).map(resolveLayerGeometry));
  const drawable = resolved.filter((r) => r.polylines.length > 0);

  if (drawable.length === 0) {
    throw new Error('createHtvSvgExport: no visible layers have drawable geometry to export.');
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { layer, polylines } of drawable) {
    for (const polyline of polylines) {
      for (const point of polyline.points) {
        const world = transformPoint(point, layer);
        minX = Math.min(minX, world.x);
        minY = Math.min(minY, world.y);
        maxX = Math.max(maxX, world.x);
        maxY = Math.max(maxY, world.y);
      }
    }
  }

  const originX = minX - EXPORT_PADDING_MM;
  const originY = minY - EXPORT_PADDING_MM;
  const widthMm = maxX - minX + EXPORT_PADDING_MM * 2;
  const heightMm = maxY - minY + EXPORT_PADDING_MM * 2;

  const pathElements = drawable
    .map(({ layer, polylines }) => {
      const color = getHtvColor(layer.colorId).hex;
      const transform = `translate(${(layer.x - originX).toFixed(3)} ${(layer.y - originY).toFixed(3)}) rotate(${layer.rotationDeg}) scale(${layer.scale})`;
      return `<g transform="${transform}"><path d="${polylinesToPathD(polylines)}" fill="${color}" fill-rule="nonzero"/></g>`;
    })
    .join('\n  ');

  const safeName = projectName.replace(/[^\w\- ]+/g, '').trim() || 'HTV Design';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${widthMm} ${heightMm}">
  <title>${safeName}</title>
  ${pathElements}
</svg>
`;

  return { svg, widthMm, heightMm, layerCount: drawable.length };
}
