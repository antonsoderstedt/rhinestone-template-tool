/**
 * The maths of moving a part with the mouse in the 3D view. The model is z up; the scene is y up, with the model turned a quarter turn about x
 * (model (x, y, z) is scene (x, z, -y)). A drag on the ground moves the part in x and y on the horizontal plane at the height of the part; a drag with
 * Shift lifts it along z on a plane that faces the camera.
 */

export type V3 = readonly [number, number, number];

export const modelToScene = ([x, y, z]: V3): V3 => [x, z, -y];
export const sceneToModel = ([x, y, z]: V3): V3 => [x, -z, y];

export type DragMode = 'ground' | 'lift';

export interface DragPlane {
  /** A point on the plane and its normal, in the scene. */
  point: V3;
  normal: V3;
}

/** The plane a drag moves on. `cameraDirection` is where the camera looks, in the scene. A camera that looks straight down cannot lift (no plane is returned). */
export function dragPlane(mode: DragMode, partBase: V3, cameraDirection: V3): DragPlane | null {
  const point = modelToScene(partBase);
  if (mode === 'ground') return { point, normal: [0, 1, 0] };
  // Lifting: a vertical plane facing the camera, so the pointer's height is the part's height.
  const h = Math.hypot(cameraDirection[0], cameraDirection[2]);
  if (h < 1e-3) return null;
  return { point, normal: [-cameraDirection[0] / h, 0, -cameraDirection[2] / h] };
}

/** Where a ray meets a plane, or null when it is parallel to it or the plane is behind the ray. */
export function rayPlaneHit(origin: V3, direction: V3, plane: DragPlane): V3 | null {
  const denominator = direction[0] * plane.normal[0] + direction[1] * plane.normal[1] + direction[2] * plane.normal[2];
  if (Math.abs(denominator) < 1e-9) return null;
  const t = ((plane.point[0] - origin[0]) * plane.normal[0] + (plane.point[1] - origin[1]) * plane.normal[1] + (plane.point[2] - origin[2]) * plane.normal[2]) / denominator;
  if (!(t > 0)) return null;
  return [origin[0] + direction[0] * t, origin[1] + direction[1] * t, origin[2] + direction[2] * t];
}

/** How far the part has moved in the model, in millimetres, between where the drag began and where the pointer is now. */
export function dragDelta(mode: DragMode, startHit: V3, hit: V3): { dx: number; dy: number; dz: number } {
  const a = sceneToModel(startHit);
  const b = sceneToModel(hit);
  return mode === 'ground' ? { dx: b[0] - a[0], dy: b[1] - a[1], dz: 0 } : { dx: 0, dy: 0, dz: b[2] - a[2] };
}
