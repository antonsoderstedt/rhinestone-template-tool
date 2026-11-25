import type { Vec2 } from '../types';
import { cross2, sub2 } from './vec';

/** Distances below this (mm) count as touching, not overlapping. */
export const TOUCH_EPS = 1e-4;

/** Signed area: positive when the points run counter-clockwise. */
export function signedArea(points: readonly Vec2[]): number {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    s += p[0] * q[1] - q[0] * p[1];
  }
  return s / 2;
}

export function boundsOf(points: readonly Vec2[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

function pointInTriangle(p: Vec2, a: Vec2, b: Vec2, c: Vec2, eps: number): boolean {
  return cross2(sub2(b, a), sub2(p, a)) >= -eps && cross2(sub2(c, b), sub2(p, b)) >= -eps && cross2(sub2(a, c), sub2(p, c)) >= -eps;
}

/**
 * Ear clipping. Returns index triples into `points`, each counter-clockwise. Works for simple polygons in
 * either winding, including non-convex ones. Collinear corners are dropped.
 */
export function triangulate(points: readonly Vec2[]): [number, number, number][] {
  const n = points.length;
  if (n < 3) return [];
  const idx = points.map((_, i) => i);
  if (signedArea(points) < 0) idx.reverse();
  const out: [number, number, number][] = [];
  const eps = 1e-9;
  let guard = 0;
  while (idx.length > 3 && guard++ < n * n) {
    let clipped = false;
    for (let i = 0; i < idx.length; i++) {
      const ia = idx[(i + idx.length - 1) % idx.length];
      const ib = idx[i];
      const ic = idx[(i + 1) % idx.length];
      const a = points[ia];
      const b = points[ib];
      const c = points[ic];
      const cr = cross2(sub2(b, a), sub2(c, b));
      if (Math.abs(cr) <= eps) {
        idx.splice(i, 1);
        clipped = true;
        break;
      }
      if (cr < 0) continue;
      let inside = false;
      for (const j of idx) {
        if (j === ia || j === ib || j === ic) continue;
        const p = points[j];
        if ((p[0] === a[0] && p[1] === a[1]) || (p[0] === b[0] && p[1] === b[1]) || (p[0] === c[0] && p[1] === c[1])) continue;
        if (pointInTriangle(p, a, b, c, eps)) {
          inside = true;
          break;
        }
      }
      if (!inside) {
        out.push([ia, ib, ic]);
        idx.splice(i, 1);
        clipped = true;
        break;
      }
    }
    if (!clipped) break;
  }
  if (idx.length === 3) {
    const [a, b, c] = idx.map((i) => points[i]);
    if (Math.abs(cross2(sub2(b, a), sub2(c, b))) > eps) out.push([idx[0], idx[1], idx[2]]);
  }
  return out;
}

/** Do two convex polygons share interior area (more than `eps` deep)? Touching edges or corners do not count. */
export function convexOverlap(a: readonly Vec2[], b: readonly Vec2[], eps = TOUCH_EPS): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      let nx = q[1] - p[1];
      let ny = -(q[0] - p[0]);
      const l = Math.hypot(nx, ny);
      if (l === 0) continue;
      nx /= l;
      ny /= l;
      let minA = Infinity;
      let maxA = -Infinity;
      for (const v of a) {
        const d = v[0] * nx + v[1] * ny;
        if (d < minA) minA = d;
        if (d > maxA) maxA = d;
      }
      let minB = Infinity;
      let maxB = -Infinity;
      for (const v of b) {
        const d = v[0] * nx + v[1] * ny;
        if (d < minB) minB = d;
        if (d > maxB) maxB = d;
      }
      if (Math.min(maxA, maxB) - Math.max(minA, minB) <= eps) return false;
    }
  }
  return true;
}

export function convexHull(points: readonly Vec2[]): Vec2[] {
  const pts = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  if (pts.length < 3) return pts;
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Vec2[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Vec2[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

export interface RotatedBox {
  /** Rotate the points by this angle (radians) to get the box. */
  angle: number;
  width: number;
  height: number;
}

export function rotatePoint(p: Vec2, angle: number): Vec2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

/** Rotations that align each hull edge with the x axis, plus 0; the first is the smallest box. */
export function candidateBoxes(hull: readonly Vec2[]): RotatedBox[] {
  const angles = [0];
  for (let i = 0; i < hull.length; i++) {
    const p = hull[i];
    const q = hull[(i + 1) % hull.length];
    angles.push(-Math.atan2(q[1] - p[1], q[0] - p[0]));
  }
  const boxes = angles.map((angle) => {
    const b = boundsOf(hull.map((p) => rotatePoint(p, angle)));
    return { angle, width: b.maxX - b.minX, height: b.maxY - b.minY };
  });
  // Smallest area first; the unrotated box wins near-ties so parts keep their orientation when it does not matter.
  const weight = (box: RotatedBox, i: number) => box.width * box.height * (i === 0 ? 0.999999 : 1);
  return boxes
    .map((box, i) => ({ box, i }))
    .sort((u, v) => weight(u.box, u.i) - weight(v.box, v.i) || u.i - v.i)
    .map((e) => e.box);
}

/** Can the hull fit in a w x h box in some rotation? */
export function fitsInBox(hull: readonly Vec2[], w: number, h: number): boolean {
  const eps = 1e-6;
  return candidateBoxes(hull).some(
    (b) => (b.width <= w + eps && b.height <= h + eps) || (b.width <= h + eps && b.height <= w + eps),
  );
}
