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

/**
 * How far along a line a ray points, in the units of the line's direction: the place on the line (a point and a direction of length 1) that
 * is closest to the ray, measured from the point. This is how far a resize handle has been dragged along its axis. Null when the ray runs
 * parallel to the line (nothing to measure).
 */
export function axisParameter(origin: V3, direction: V3, axisPoint: V3, axisDirection: V3): number | null {
  const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const w: V3 = [axisPoint[0] - origin[0], axisPoint[1] - origin[1], axisPoint[2] - origin[2]];
  const b = dot(axisDirection, direction);
  const c = dot(direction, direction);
  const denominator = dot(axisDirection, axisDirection) * c - b * b;
  if (Math.abs(denominator) < 1e-9 * Math.max(1, c)) return null;
  return (b * dot(direction, w) - c * dot(axisDirection, w)) / denominator;
}

/**
 * The angle, in degrees, of a point round an axis through `centre` (the axis has length 1): 0 along an arbitrary but fixed direction across the axis, growing
 * counter-clockwise seen from where the axis points. Only differences between two angles are used (how far a turn handle was dragged).
 */
export function angleAround(point: V3, centre: V3, axis: V3): number {
  const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // A direction across the axis: from the helper axis that is least along it.
  const helper: V3 = Math.abs(axis[0]) <= Math.abs(axis[1]) && Math.abs(axis[0]) <= Math.abs(axis[2]) ? [1, 0, 0] : Math.abs(axis[1]) <= Math.abs(axis[2]) ? [0, 1, 0] : [0, 0, 1];
  const u0 = cross(axis, helper);
  const ul = Math.hypot(u0[0], u0[1], u0[2]);
  const u: V3 = [u0[0] / ul, u0[1] / ul, u0[2] / ul];
  const v = cross(axis, u);
  const d: V3 = [point[0] - centre[0], point[1] - centre[1], point[2] - centre[2]];
  return (Math.atan2(dot(d, v), dot(d, u)) * 180) / Math.PI;
}

/** The difference between two angles in degrees, brought between -180 and 180 (so a drag across the seam does not jump). */
export function angleDifference(to: number, from: number): number {
  return ((((to - from + 180) % 360) + 360) % 360) - 180;
}
