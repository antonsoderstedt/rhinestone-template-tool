import type { Pattern, Solid, Vec2, Vec3 } from '../types';
import { cross3, dot3, norm3 } from '../geometry/vec';
import { partRgb } from './colors';

export interface PreviewPolygon {
  points: Vec2[];
  rgb: [number, number, number];
}

/**
 * A flat-shaded picture of the finished model seen from the front-right and above (z is up), as polygons from the back to the
 * front, for the cover page. Faces turned away from the viewer are left out. Coordinates are millimetres in the model, projected;
 * y points up.
 */
export function projectModel(solid: Solid, pattern: Pattern, azimuthDeg = 35, elevationDeg = 28): PreviewPolygon[] {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  // The direction from the model to the eye.
  const toEye: Vec3 = [Math.cos(el) * Math.sin(az), -Math.cos(el) * Math.cos(az), Math.sin(el)];
  const right = norm3(cross3([0, 0, 1], toEye));
  const up = cross3(toEye, right);
  const light = norm3([0.4, -0.5, 0.8]);

  const partOfFace = new Map<number, number>();
  for (const part of pattern.parts) for (const f of part.faces) partOfFace.set(f.faceId, part.id);

  const visible = solid.faces
    .filter((f) => dot3(f.normal, toEye) > 1e-9)
    .map((f) => {
      const pts = f.vertices.map((v) => solid.vertices[v]);
      const centre = pts.reduce<Vec3>((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length, s[2] + p[2] / pts.length], [0, 0, 0]);
      return { f, depth: dot3(centre, toEye) };
    })
    .sort((a, b) => a.depth - b.depth || a.f.id - b.f.id);

  return visible.map(({ f }) => {
    const shade = 0.55 + 0.45 * Math.max(0, dot3(f.normal, light));
    const base = partRgb(partOfFace.get(f.id) ?? 1, 70);
    return {
      points: f.vertices.map((v): Vec2 => {
        const p = solid.vertices[v];
        return [dot3(p, right), dot3(p, up)];
      }),
      rgb: [base[0] * shade, base[1] * shade, base[2] * shade],
    };
  });
}
