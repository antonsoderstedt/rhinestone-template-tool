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
    const excluded = new Set(layer.excludedContours ?? []);
    const polylines = excluded.size === 0 ? layer.polylines : layer.polylines.filter((_, i) => !excluded.has(i));
    return { layer, polylines };
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
  const scaled = { x: point.x * layer.scale * (layer.flipX ? -1 : 1), y: point.y * layer.scale * (layer.flipY ? -1 : 1) };
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
  /** Full canvas width in mm (design + weed margin + registration band). */
  widthMm: number;
  /** Full canvas height in mm (design + weed margin + registration band). */
  heightMm: number;
  /** Width of the artwork itself in mm, without margins or marks. */
  designWidthMm: number;
  /** Height of the artwork itself in mm, without margins or marks. */
  designHeightMm: number;
  layerCount: number;
  mirrored: boolean;
}

export interface HtvExportOptions {
  /**
   * Flip the artwork horizontally (about the vertical centre axis of the file),
   * as iron-on vinyl is cut on its reverse side. Default: false for the pure
   * function; the HTV studio export dialog turns it on by default.
   */
  mirror?: boolean;
  /** Draw a rectangular cut line around the design so it can be weeded as a block. Default: false. */
  weedBorder?: boolean;
  /** Add four corner registration crosses outside the weed area. Default: false. */
  registrationMarks?: boolean;
  /** Space between the artwork and the file edge / weed border in mm. Default: 6. */
  marginMm?: number;
}

export const DEFAULT_HTV_EXPORT_MARGIN_MM = 6;
/** Extra band outside the weed area that holds the registration marks (mm). */
export const HTV_REGISTRATION_BAND_MM = 8;
const REGISTRATION_ARM_MM = 2.5;

function fmt(value: number): string {
  return Number(value.toFixed(3)).toString();
}

/**
 * Per-layer transform. When `mirrorWidthMm` is set, the whole file is mirrored
 * about its vertical centre axis. Mirroring is baked into each layer
 * (translate(W - tx) · rotate(-θ) · scale(-sx, sy)) instead of wrapping the art
 * in an extra group, so every layer stays a plain, inspectable <g> + <path>.
 */
function buildLayerTransform(layer: HtvLayer, originX: number, originY: number, mirrorWidthMm: number | null): string {
  const tx = layer.x - originX;
  const ty = layer.y - originY;
  const sx = layer.scale * (layer.flipX ? -1 : 1);
  const sy = layer.scale * (layer.flipY ? -1 : 1);
  if (mirrorWidthMm === null) {
    return `translate(${fmt(tx)} ${fmt(ty)}) rotate(${layer.rotationDeg}) scale(${sx} ${sy})`;
  }
  return `translate(${fmt(mirrorWidthMm - tx)} ${fmt(ty)}) rotate(${-layer.rotationDeg}) scale(${-sx} ${sy})`;
}

function buildRegistrationMark(cx: number, cy: number): string {
  const a = REGISTRATION_ARM_MM;
  return `<path d="M${fmt(cx - a)} ${fmt(cy)} H${fmt(cx + a)} M${fmt(cx)} ${fmt(cy - a)} V${fmt(cy + a)}" fill="none" stroke="#000000" stroke-width="0.2" data-registration-mark="true"/>`;
}

/**
 * @throws if there are no visible layers with drawable geometry.
 */
export async function createHtvSvgExport(
  layers: readonly HtvLayer[],
  projectName: string,
  options: HtvExportOptions = {},
): Promise<HtvExportResult> {
  const mirror = options.mirror ?? false;
  const weedBorder = options.weedBorder ?? false;
  const registrationMarks = options.registrationMarks ?? false;
  const marginMm = Number.isFinite(options.marginMm) && (options.marginMm as number) >= 0
    ? (options.marginMm as number)
    : DEFAULT_HTV_EXPORT_MARGIN_MM;

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

  const bandMm = registrationMarks ? HTV_REGISTRATION_BAND_MM : 0;
  const designWidthMm = maxX - minX;
  const designHeightMm = maxY - minY;
  const originX = minX - marginMm - bandMm;
  const originY = minY - marginMm - bandMm;
  const widthMm = designWidthMm + marginMm * 2 + bandMm * 2;
  const heightMm = designHeightMm + marginMm * 2 + bandMm * 2;

  const pathElements = drawable
    .map(({ layer, polylines }) => {
      const color = getHtvColor(layer.colorId).hex;
      const transform = buildLayerTransform(layer, originX, originY, mirror ? widthMm : null);
      return `<g transform="${transform}"><path d="${polylinesToPathD(polylines)}" fill="${color}" fill-rule="nonzero"/></g>`;
    })
    .join('\n  ');

  const extras: string[] = [];
  if (weedBorder) {
    extras.push(
      `<rect x="${fmt(bandMm)}" y="${fmt(bandMm)}" width="${fmt(widthMm - bandMm * 2)}" height="${fmt(heightMm - bandMm * 2)}" fill="none" stroke="#000000" stroke-width="0.1" data-weed-border="true"/>`,
    );
  }
  if (registrationMarks) {
    const inset = bandMm / 2;
    extras.push(
      buildRegistrationMark(inset, inset),
      buildRegistrationMark(widthMm - inset, inset),
      buildRegistrationMark(inset, heightMm - inset),
      buildRegistrationMark(widthMm - inset, heightMm - inset),
    );
  }

  const safeName = projectName.replace(/[^\w\- ]+/g, '').trim() || 'HTV Design';
  const w = fmt(widthMm);
  const h = fmt(heightMm);
  const mirrorAttr = mirror ? ' data-mirrored="true"' : '';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}"${mirrorAttr}>
  <title>${safeName}</title>
  ${pathElements}${extras.length > 0 ? `\n  ${extras.join('\n  ')}` : ''}
</svg>
`;

  return {
    svg,
    widthMm,
    heightMm,
    designWidthMm,
    designHeightMm,
    layerCount: drawable.length,
    mirrored: mirror,
  };
}
