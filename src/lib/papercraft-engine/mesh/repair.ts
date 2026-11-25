import type { RawMesh, Solid, Vec3 } from '../types';
import { buildSolid } from './build';
import { cross3, dot3, len3, norm3, sub3 } from '../geometry/vec';

export interface FillHolesResult {
  mesh: RawMesh;
  /** Holes that were closed. */
  filled: number;
  /** Holes left open (too big, or not a clean loop). */
  skipped: number;
}

/** The loops of open edges of a solid, as lists of vertex ids in the direction the faces run along them. */
export function boundaryLoops(solid: Solid): number[][] {
  const next = new Map<number, number[]>();
  for (const face of solid.faces) {
    face.vertices.forEach((v, k) => {
      if (solid.edges[face.edgeIds[k]].faces.length !== 1) return;
      const w = face.vertices[(k + 1) % face.vertices.length];
      const list = next.get(v);
      if (list) list.push(w);
      else next.set(v, [w]);
    });
  }
  const loops: number[][] = [];
  for (const start of [...next.keys()].sort((a, b) => a - b)) {
    while ((next.get(start)?.length ?? 0) > 0) {
      const loop = [start];
      let cur = start;
      let closed = false;
      for (let guard = 0; guard <= solid.edges.length; guard++) {
        const outs = next.get(cur);
        if (!outs || outs.length === 0) break;
        const to = outs.shift()!;
        if (to === start) {
          closed = true;
          break;
        }
        loop.push(to);
        cur = to;
      }
      if (closed && loop.length >= 3) loops.push(loop);
      else break;
    }
  }
  return loops;
}

/**
 * Closes the holes of a mesh (the loops of open edges). A hole that is flat becomes one polygon; a hole that is not flat becomes
 * triangles around a point in the middle. Holes with more than `maxLoopSize` corners are left open: they are more likely an open
 * side of the model than a hole. The result is a plain mesh to clean again with `buildSolid`.
 */
export function fillHoles(mesh: RawMesh, maxLoopSize = 400): FillHolesResult {
  const solid = buildSolid(mesh);
  const positions: Vec3[] = [...solid.vertices];
  const faces: number[][] = solid.faces.map((f) => [...f.vertices]);
  const loops = boundaryLoops(solid);
  let filled = 0;
  let skipped = 0;
  // Edges of open loops that did not close are not counted as loops here: they stay open.
  const openEdges = solid.edges.filter((e) => e.faces.length === 1).length;
  let loopEdges = 0;
  for (const loop of loops) {
    loopEdges += loop.length;
    if (loop.length > maxLoopSize) {
      skipped++;
      continue;
    }
    // The cap runs the other way round the loop, so it faces the same way as its neighbours.
    const cap = [...loop].reverse();
    const pts = cap.map((v) => positions[v]);
    const o = pts[0];
    let n: Vec3 = [0, 0, 0];
    for (let i = 1; i + 1 < pts.length; i++) {
      const c = cross3(sub3(pts[i], o), sub3(pts[i + 1], o));
      n = [n[0] + c[0], n[1] + c[1], n[2] + c[2]];
    }
    const area = len3(n) / 2;
    const nn = norm3(n);
    const deviation = Math.max(...pts.map((p) => Math.abs(dot3(nn, sub3(p, o)))));
    if (area > 1e-12 && deviation <= 0.02 * Math.sqrt(area)) {
      faces.push(cap);
    } else {
      const centre: Vec3 = [
        pts.reduce((s, p) => s + p[0], 0) / pts.length,
        pts.reduce((s, p) => s + p[1], 0) / pts.length,
        pts.reduce((s, p) => s + p[2], 0) / pts.length,
      ];
      const c = positions.length;
      positions.push(centre);
      for (let i = 0; i < cap.length; i++) faces.push([c, cap[i], cap[(i + 1) % cap.length]]);
    }
    filled++;
  }
  if (loopEdges < openEdges) skipped++;
  return { mesh: { positions, faces }, filled, skipped };
}

/** Turns every face over: what was the inside is the outside. For an open model, where the program cannot tell which side is out. */
export function flipFaces(mesh: RawMesh): RawMesh {
  return { positions: mesh.positions, faces: mesh.faces.map((f) => [...f].reverse()) };
}
