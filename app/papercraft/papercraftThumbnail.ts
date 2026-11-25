import { buildSolid, partRgb, projectSolid, scaleMesh, type RawMesh } from '@/src/lib/papercraft-engine';
import { meshOfSource } from './papercraftCompute';
import { deserializePapercraft, type SerializedPapercraft } from './papercraftSnapshot';

export interface ThumbPolygon {
  points: string;
  fill: string;
}

/** A small picture of a mesh in a 48 x 48 box, as polygons (drawn from the model itself, so there is no image to keep). */
export function thumbnailPolygons(mesh: RawMesh, colourIndex: number, azimuthDeg = 35, elevationDeg = 24): ThumbPolygon[] {
  const solid = buildSolid(scaleMesh(mesh, { by: 'largest', mm: 100 }));
  if (solid.faces.length === 0) return [];
  const colour = partRgb(colourIndex + 1, 70);
  const polys = projectSolid(solid, () => colour, azimuthDeg, elevationDeg);
  const all = polys.flatMap((p) => p.points);
  if (all.length === 0) return [];
  const minX = Math.min(...all.map((p) => p[0]));
  const maxX = Math.max(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1]));
  const maxY = Math.max(...all.map((p) => p[1]));
  const scale = 40 / Math.max(maxX - minX, maxY - minY, 1e-6);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return polys.map((p) => ({
    points: p.points.map((q) => `${(24 + (q[0] - cx) * scale).toFixed(2)},${(24 - (q[1] - cy) * scale).toFixed(2)}`).join(' '),
    fill: `rgb(${p.rgb.map((c) => Math.round(c * 255)).join(',')})`,
  }));
}

/** The picture as an SVG image address (`data:image/svg+xml`), for places that show an <img>. */
export function thumbnailDataUri(polys: readonly ThumbPolygon[]): string | null {
  if (polys.length === 0) return null;
  const body = polys.map((p) => `<polygon points="${p.points}" fill="${p.fill}" stroke="#222" stroke-width="0.5" stroke-linejoin="round"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${body}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const cache = new Map<string, string | null>();

/** The picture of a saved design (kept by id and time, so a design is drawn once until it changes). */
export function savedDesignThumbnail(entry: { designId: string; updatedAt: string; snapshot: SerializedPapercraft }): string | null {
  const key = `${entry.designId}@${entry.updatedAt}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  let result: string | null = null;
  try {
    const state = deserializePapercraft(entry.snapshot);
    const mesh = state ? meshOfSource(state) : null;
    if (mesh) result = thumbnailDataUri(thumbnailPolygons(mesh, entry.designId.length));
  } catch {
    result = null;
  }
  cache.set(key, result);
  return result;
}
