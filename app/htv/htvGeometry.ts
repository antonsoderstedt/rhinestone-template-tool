/**
 * Pure geometry helpers for rendering/exporting HTV layers — SVG path
 * string building and bounds/centering math. HTV-local (not the rhinestone
 * engine) since it's presentational path-building, not stone placement.
 */

import type { Polyline, PolylinePoint } from '@/src/lib/rhinestone-engine/index';
import type { HtvLayer } from './HtvState';

/** Square design surface, mm — shared by the canvas view and alignment tools. */
export const HTV_WORKSPACE_SIZE_MM = 320;

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export function computePolylinesBounds(polylines: readonly Polyline[]): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const polyline of polylines) {
    for (const point of polyline.points) {
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/** Translates every point so the bounding-box center sits at (0,0) — layers store geometry this way so `layer.x`/`layer.y` means "where this shape's center is on the canvas." */
export function centerPolylines(polylines: readonly Polyline[]): { polylines: Polyline[]; widthMm: number; heightMm: number } {
  const bounds = computePolylinesBounds(polylines);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const centered = polylines.map((polyline) => ({
    points: polyline.points.map((p) => ({ x: p.x - cx, y: p.y - cy })),
    closed: polyline.closed,
  }));
  return { polylines: centered, widthMm: bounds.width, heightMm: bounds.height };
}

/**
 * Bends a set of (already centered) polylines along a circular arc, the
 * same technique as a text "Curve"/"Arc" warp: each point's x becomes an
 * angle around a circle whose radius is derived from curveAmount, and its
 * y becomes the radial offset from that circle. curveAmount runs -100
 * (frown) to 100 (smile); 0 leaves the geometry untouched.
 */
export function applyArcCurve(polylines: readonly Polyline[], curveAmount: number): Polyline[] {
  if (curveAmount === 0) return [...polylines];
  const bounds = computePolylinesBounds(polylines);
  const halfWidth = Math.max(bounds.width / 2, 1);
  const strength = Math.min(Math.abs(curveAmount), 100) / 100;
  const direction = curveAmount > 0 ? 1 : -1;
  const radius = (halfWidth / Math.max(strength, 0.02)) * direction;

  return polylines.map((polyline) => ({
    closed: polyline.closed,
    points: polyline.points.map((p) => {
      const angle = p.x / radius;
      const r = radius - p.y;
      return {
        x: r * Math.sin(angle),
        y: radius - r * Math.cos(angle),
      };
    }),
  }));
}

function pointToStr(p: PolylinePoint): string {
  return `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
}

export function polylineToPathD(polyline: Polyline): string {
  if (polyline.points.length === 0) return '';
  const [first, ...rest] = polyline.points;
  const commands = [`M ${pointToStr(first!)}`, ...rest.map((p) => `L ${pointToStr(p)}`)];
  if (polyline.closed) commands.push('Z');
  return commands.join(' ');
}

/** Combines multiple closed subpaths into one `d` string — used so a multi-contour shape (a letter with a hole, a silhouette with an inner cutout) renders as a single filled path with the default nonzero fill rule handling holes correctly. */
export function polylinesToPathD(polylines: readonly Polyline[]): string {
  return polylines.map(polylineToPathD).join(' ');
}

/**
 * Approximate local (pre-transform) width/height for a layer. Vector
 * layers know their real size; text layers' real geometry loads async, so
 * this uses a font-size/character-count heuristic for immediate feedback
 * (selection outlines, garment-preview scaling) before the real outline
 * has loaded.
 */
export function approximateLayerBounds(layer: HtvLayer): { width: number; height: number } {
  if (layer.type === 'text') {
    return { width: Math.max(layer.text.length, 1) * layer.fontSizeMm * 0.6, height: layer.fontSizeMm * 1.2 };
  }
  return { width: layer.naturalWidthMm, height: layer.naturalHeightMm };
}

/**
 * Axis-aligned bounding box of a single layer after its rotation/scale/
 * position transform is applied — used to fit the whole design (all
 * layers) into a garment print area or placement zone.
 */
export function transformedLayerBounds(layer: HtvLayer): Bounds {
  const { width, height } = approximateLayerBounds(layer);
  const hw = (width / 2) * layer.scale;
  const hh = (height / 2) * layer.scale;
  const theta = (layer.rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(theta));
  const sin = Math.abs(Math.sin(theta));
  const extentX = hw * cos + hh * sin;
  const extentY = hw * sin + hh * cos;
  return {
    minX: layer.x - extentX,
    maxX: layer.x + extentX,
    minY: layer.y - extentY,
    maxY: layer.y + extentY,
    width: extentX * 2,
    height: extentY * 2,
  };
}

export function computeBoundsForLayers(layers: readonly HtvLayer[]): Bounds | null {
  if (layers.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const layer of layers) {
    const b = transformedLayerBounds(layer);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function computeDesignBounds(layers: readonly HtvLayer[]): Bounds | null {
  return computeBoundsForLayers(layers.filter((l) => l.visible));
}
