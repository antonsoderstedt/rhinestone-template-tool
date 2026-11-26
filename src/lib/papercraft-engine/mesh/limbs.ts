import type { RawMesh, Vec3 } from '../types';
import { cross3, dot3, len3, sub3 } from '../geometry/vec';

/**
 * Joining parts to a body. A leg, an ear, a tail or a trunk is not a separate body: it grows out of a face of the body (the face is
 * taken away and a tube takes its place), so the result is one closed solid that unfolds into one net. Pure and deterministic.
 */

export interface LimbStep {
  /** How far the new ring lies from the ring before it, in the same unit as the mesh. */
  by: Vec3;
  /** Size of the new ring compared with the ring before it, about its own centre: 1 is the same, 0.5 half. Above 0. Default 1. */
  scale?: number;
}

export interface LimbOp {
  /** Index of the face of the mesh that the limb grows out of. It must be flat. */
  face: number;
  /** One ring per step; the last ring is closed with a flat face (the foot, the tip of the ear). */
  steps: readonly LimbStep[];
}

const centreOf = (positions: readonly Vec3[], ids: readonly number[]): Vec3 => {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const id of ids) {
    x += positions[id][0];
    y += positions[id][1];
    z += positions[id][2];
  }
  return [x / ids.length, y / ids.length, z / ids.length];
};

/**
 * Grows a tube out of each of the given faces (like pulling a face out of a model). The face is removed. Every step adds a ring of
 * the same shape (moved, and scaled about its centre) and a wall of flat four-sided faces between it and the ring before it; the
 * last ring is closed. The walls are flat because a ring is always a copy of the ring before it, only moved and scaled.
 *
 * The faces must be flat, must exist, and must not touch each other (not even at a corner): two limbs that grow out of faces
 * that share a corner would pinch the model there.
 */
export function extrudeFaces(mesh: RawMesh, ops: readonly LimbOp[]): RawMesh {
  const used = new Set<number>();
  const corners = new Set<number>();
  for (const op of ops) {
    if (!Number.isInteger(op.face) || op.face < 0 || op.face >= mesh.faces.length) throw new RangeError(`Face ${op.face} does not exist.`);
    if (op.steps.length === 0) throw new RangeError('A limb needs at least one step.');
    if (op.steps.some((s) => !(s.scale === undefined || s.scale > 0))) throw new RangeError('The scale of a step must be above 0.');
    if (used.has(op.face)) throw new RangeError(`Face ${op.face} is used twice.`);
    used.add(op.face);
    for (const v of mesh.faces[op.face]) {
      if (corners.has(v)) throw new RangeError(`Two limbs would touch at corner ${v}.`);
      corners.add(v);
    }
  }

  const positions: Vec3[] = mesh.positions.slice();
  const faces: number[][] = mesh.faces.filter((_, i) => !used.has(i)).map((f) => f.slice());
  for (const op of ops) {
    let ring = mesh.faces[op.face].slice();
    let centre = centreOf(positions, ring);
    for (const step of op.steps) {
      const s = step.scale ?? 1;
      const next: Vec3 = [centre[0] + step.by[0], centre[1] + step.by[1], centre[2] + step.by[2]];
      const grown = ring.map((id) => {
        const p = positions[id];
        positions.push([next[0] + (p[0] - centre[0]) * s, next[1] + (p[1] - centre[1]) * s, next[2] + (p[2] - centre[2]) * s]);
        return positions.length - 1;
      });
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length;
        // The wall runs along the edge the same way the removed face did, so it joins the faces next to it.
        faces.push([ring[i], ring[j], grown[j], grown[i]]);
      }
      ring = grown;
      centre = next;
    }
    faces.push(ring);
  }
  return { positions, faces };
}

/** One section of a body: where it is on the centre line (in the x-z plane, x forward, z up) and how big. */
export interface RingSection {
  x: number;
  z: number;
  /** Half width (sideways, y) and half height. Both are above 0: the body is closed with a flat face at each end. */
  width: number;
  height: number;
  /**
   * The direction of the centre line here, in radians above the x axis. Left out, it follows the curve (from the section before to the
   * one after). Two sections next to each other that have the same width, height and tilt make flat side faces between them, which is
   * what an ear can grow out of.
   */
  tilt?: number;
  /** A cross-section of its own, with the same number of corners as the body's. Corners next to each other that are the same count as one. */
  profile?: RingProfile;
}

export interface RingSweep {
  mesh: RawMesh;
  /** The vertex ids of each section, in the order of the profile. */
  rings: number[][];
  /** The face between section `p` and `p + 1` at profile edge `i` (from corner i to corner i + 1), when it is one flat face. */
  quad: (p: number, i: number) => number | undefined;
  /** The flat face at the first and the last section. */
  startCap: number;
  endCap: number;
}

/** A cross-section: corners as [sideways, up], each between -1 and 1, counter-clockwise seen from the front with y to the right. */
export type RingProfile = readonly (readonly [number, number])[];

/**
 * A body along a curve in the x-z plane with any cross-section (`profile`) at every section. Unlike `sweep` the section can have flat
 * pads (the underside of a body where legs are joined), and a flat face between two sections is kept as one four-sided face so
 * that a limb can grow out of it. A face that would not be flat is two triangles.
 */
export function ringSweep(sections: readonly RingSection[], profile: RingProfile): RingSweep {
  const m = sections.length;
  const n = profile.length;
  if (m < 2) throw new RangeError('A body needs at least two sections.');
  if (n < 3) throw new RangeError('A cross-section needs at least three corners.');
  const positions: Vec3[] = [];
  const rings: number[][] = [];
  sections.forEach((s, k) => {
    if (!(s.width > 0 && s.height > 0)) throw new RangeError('A section must have a width and a height above 0.');
    const a = sections[Math.max(0, k - 1)];
    const b = sections[Math.min(m - 1, k + 1)];
    const tx = s.tilt === undefined ? b.x - a.x : Math.cos(s.tilt);
    const tz = s.tilt === undefined ? b.z - a.z : Math.sin(s.tilt);
    const length = Math.hypot(tx, tz) || 1;
    // "Up" across the centre line; sideways is always y.
    const vx = -tz / length;
    const vz = tx / length;
    const shape = s.profile ?? profile;
    if (shape.length !== n) throw new RangeError('A section must have as many corners as the body.');
    // Corners that are the same point share one vertex, so a section can have fewer corners than the others (a box where the rest are eight-sided).
    const same = (i: number, j: number) => shape[i][0] === shape[j][0] && shape[i][1] === shape[j][1];
    const ring: number[] = [];
    shape.forEach(([u, v], i) => {
      if (i > 0 && same(i, i - 1)) ring.push(ring[i - 1]);
      else if (i === n - 1 && same(i, 0)) ring.push(ring[0]);
      else {
        positions.push([s.x + vx * s.height * v, s.width * u, s.z + vz * s.height * v]);
        ring.push(positions.length - 1);
      }
    });
    rings.push(ring);
  });

  const faces: number[][] = [];
  const quads = new Map<string, number>();
  const flat = (a: Vec3, b: Vec3, c: Vec3, d: Vec3): boolean => {
    const ab = sub3(b, a);
    const ac = sub3(c, a);
    const ad = sub3(d, a);
    const volume = Math.abs(dot3(cross3(ab, ac), ad));
    return volume <= 1e-9 * (len3(ab) * len3(ac) * len3(ad) || 1);
  };
  // A cap has each corner once, however many corners the section was given.
  const cap = (ring: readonly number[]) => ring.filter((id, i) => id !== ring[(i + ring.length - 1) % ring.length]);
  faces.push(cap(rings[0]).reverse());
  const startCap = 0;
  for (let p = 0; p + 1 < m; p++) {
    const lo = rings[p];
    const hi = rings[p + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (lo[i] === lo[j] && hi[i] === hi[j]) continue;
      if (lo[i] === lo[j]) faces.push([lo[i], hi[j], hi[i]]);
      else if (hi[i] === hi[j]) faces.push([lo[i], lo[j], hi[j]]);
      else if (flat(positions[lo[i]], positions[lo[j]], positions[hi[j]], positions[hi[i]])) {
        quads.set(`${p}:${i}`, faces.length);
        faces.push([lo[i], lo[j], hi[j], hi[i]]);
      } else {
        faces.push([lo[i], lo[j], hi[j]], [lo[i], hi[j], hi[i]]);
      }
    }
  }
  const endCap = faces.length;
  faces.push(cap(rings[m - 1]));
  return { mesh: { positions, faces }, rings, quad: (p, i) => quads.get(`${p}:${i}`), startCap, endCap };
}
