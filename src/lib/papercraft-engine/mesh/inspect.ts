import type { RawMesh, Solid, Vec3 } from '../types';
import { len3, sub3 } from '../geometry/vec';

export interface SolidReport {
  vertexCount: number;
  faceCount: number;
  edgeCount: number;
  /** Width (x), depth (y), height (z). */
  size: Vec3;
  minEdgeMm: number;
  minFaceAreaMm2: number;
  surfaceAreaMm2: number;
}

export function reportSolid(solid: Solid): SolidReport {
  let min: Vec3 = [Infinity, Infinity, Infinity];
  let max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of solid.vertices) {
    min = [Math.min(min[0], p[0]), Math.min(min[1], p[1]), Math.min(min[2], p[2])];
    max = [Math.max(max[0], p[0]), Math.max(max[1], p[1]), Math.max(max[2], p[2])];
  }
  const size: Vec3 = solid.vertices.length ? sub3(max, min) : [0, 0, 0];
  return {
    vertexCount: solid.vertices.length,
    faceCount: solid.faces.length,
    edgeCount: solid.edges.length,
    size,
    minEdgeMm: solid.edges.reduce((m, e) => Math.min(m, e.length), Infinity),
    minFaceAreaMm2: solid.faces.reduce((m, f) => Math.min(m, f.area), Infinity),
    surfaceAreaMm2: solid.faces.reduce((s, f) => s + f.area, 0),
  };
}

export type ScaleTarget = { by: 'width' | 'depth' | 'height' | 'largest'; mm: number } | { by: 'factor'; factor: number };

/** Scale a mesh (before or after cleaning) so the chosen dimension is the given size in millimetres. */
export function scaleMesh<T extends RawMesh>(mesh: T, target: ScaleTarget): T {
  let factor: number;
  if (target.by === 'factor') factor = target.factor;
  else {
    let min: Vec3 = [Infinity, Infinity, Infinity];
    let max: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const p of mesh.positions) {
      min = [Math.min(min[0], p[0]), Math.min(min[1], p[1]), Math.min(min[2], p[2])];
      max = [Math.max(max[0], p[0]), Math.max(max[1], p[1]), Math.max(max[2], p[2])];
    }
    const size = sub3(max, min);
    const current = target.by === 'width' ? size[0] : target.by === 'depth' ? size[1] : target.by === 'height' ? size[2] : Math.max(...size);
    factor = current > 0 ? target.mm / current : 1;
  }
  return { ...mesh, positions: mesh.positions.map(([x, y, z]): Vec3 => [x * factor, y * factor, z * factor]) };
}

export function edgeLengthOf(solid: Solid, edgeId: number): number {
  const e = solid.edges[edgeId];
  return len3(sub3(solid.vertices[e.a], solid.vertices[e.b]));
}

/** Edges shorter than `minEdgeMm` are hard to cut, fold and glue; the studio warns about them. */
export function findTinyEdges(solid: Solid, minEdgeMm: number): number[] {
  return solid.edges.filter((e) => e.length < minEdgeMm).map((e) => e.id);
}
