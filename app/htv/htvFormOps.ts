/**
 * Vector form operations — Combine (merge several layers' outlines into
 * one) and Offset (mitered outline growth/shrink), analogous to Cricut's
 * Combine and Offset tools. Both operate on already-resolved Polyline
 * geometry, so they're scoped to vector layers — text layers resolve their
 * outlines asynchronously via the font loader (useHtvTextGeometry) and
 * aren't supported here yet.
 */

import type { Polyline, PolylinePoint } from '@/src/lib/rhinestone-engine/index';
import { centerPolylines } from './htvGeometry';
import type { HtvVectorLayer } from './HtvState';

function rotatePoint(x: number, y: number, thetaRad: number): PolylinePoint {
  return {
    x: x * Math.cos(thetaRad) - y * Math.sin(thetaRad),
    y: x * Math.sin(thetaRad) + y * Math.cos(thetaRad),
  };
}

/** World-space polylines for a vector layer: applies flip, scale, rotation, and position, honoring excluded (hidden) sub-paths. */
export function worldPolylinesForVectorLayer(layer: HtvVectorLayer): Polyline[] {
  const excluded = new Set(layer.excludedContours);
  const theta = (layer.rotationDeg * Math.PI) / 180;
  const sx = layer.scale * (layer.flipX ? -1 : 1);
  const sy = layer.scale * (layer.flipY ? -1 : 1);
  return layer.polylines
    .filter((_, i) => !excluded.has(i))
    .map((pl) => ({
      closed: pl.closed,
      points: pl.points.map((p) => {
        const rotated = rotatePoint(p.x * sx, p.y * sy, theta);
        return { x: rotated.x + layer.x, y: rotated.y + layer.y };
      }),
    }));
}

/** Merges multiple vector layers' world-space outlines into one centered set of polylines — the new layer moves and colors as a single unit. */
export function combineVectorLayers(layers: readonly HtvVectorLayer[]): { polylines: Polyline[]; widthMm: number; heightMm: number } {
  const merged = layers.flatMap((l) => worldPolylinesForVectorLayer(l));
  return centerPolylines(merged);
}

function polygonSignedArea(points: readonly PolylinePoint[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/**
 * Mitered polygon offset — pushes each vertex outward (or inward, for a
 * negative offset) along the bisector of its two adjacent edge normals.
 * Standard technique for growing/shrinking a closed polygon by a constant
 * distance. Works well for convex and mildly concave shapes; very sharp
 * concave corners or an offset large relative to the shape's own features
 * can self-intersect, same caveat as most non-clipping-library offsetters.
 */
function offsetClosedPolygon(points: readonly PolylinePoint[], offset: number): PolylinePoint[] {
  const n = points.length;
  if (n < 3) return [...points];
  const orientation = polygonSignedArea(points) >= 0 ? 1 : -1;

  const edgeNormals: PolylinePoint[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % n]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const len = Math.max(Math.hypot(ex, ey), 1e-6);
    edgeNormals.push({ x: (ey / len) * orientation, y: (-ex / len) * orientation });
  }

  return points.map((point, i) => {
    const prevNormal = edgeNormals[(i - 1 + n) % n]!;
    const normal = edgeNormals[i]!;
    let bx = prevNormal.x + normal.x;
    let by = prevNormal.y + normal.y;
    let blen = Math.hypot(bx, by);
    if (blen < 1e-6) {
      bx = normal.x;
      by = normal.y;
      blen = 1;
    }
    bx /= blen;
    by /= blen;
    const cosHalfAngle = Math.max(bx * normal.x + by * normal.y, 0.35); // clamp to keep sharp corners from spiking too far
    const push = offset / cosHalfAngle;
    return { x: point.x + bx * push, y: point.y + by * push };
  });
}

/** Offsets a vector layer's own (local, pre-transform) outline by offsetMm — positive grows, negative shrinks. */
export function offsetVectorLayerPolylines(layer: HtvVectorLayer, offsetMm: number): { polylines: Polyline[]; widthMm: number; heightMm: number } {
  const excluded = new Set(layer.excludedContours);
  const offset = layer.polylines
    .filter((_, i) => !excluded.has(i))
    .map((pl) => ({
      closed: pl.closed,
      points: pl.closed ? offsetClosedPolygon(pl.points, offsetMm) : pl.points,
    }));
  return centerPolylines(offset);
}
