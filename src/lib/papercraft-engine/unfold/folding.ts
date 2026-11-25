import type { Solid, Vec3 } from '../types';
import { cross3, dot3, norm3, sub3 } from '../geometry/vec';
import { planarCoordinates } from '../mesh/build';
import { triangulate } from '../geometry/polygon';

/** A 4x4 matrix as 16 numbers, column by column (the layout three.js `Matrix4.fromArray` reads). */
export type Mat4 = number[];

export const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function multiplyMat4(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

/** Rotation by `angle` about the line through `point` with direction `axis` (unit length). */
export function rotationAboutLine(point: Vec3, axis: Vec3, angle: number): Mat4 {
  const [x, y, z] = axis;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const k = 1 - c;
  const r = [
    [c + x * x * k, x * y * k - z * s, x * z * k + y * s],
    [y * x * k + z * s, c + y * y * k, y * z * k - x * s],
    [z * x * k - y * s, z * y * k + x * s, c + z * z * k],
  ];
  const t = [0, 1, 2].map((i) => point[i] - (r[i][0] * point[0] + r[i][1] * point[1] + r[i][2] * point[2]));
  return [r[0][0], r[1][0], r[2][0], 0, r[0][1], r[1][1], r[2][1], 0, r[0][2], r[1][2], r[2][2], 0, t[0], t[1], t[2], 1];
}

export interface FoldNode {
  face: number;
  /** The face this one hangs from; null for the first face of a part. */
  parent: number | null;
  hingeA: Vec3;
  hingeAxis: Vec3;
  /** Turning the face by this angle about the hinge (in the folded model) lays it flat with its parent. */
  flatAngle: number;
  /** 0-based index of the part (in the order of `parts`). */
  part: number;
}

export interface FoldTree {
  /** Parents come before their children. */
  nodes: FoldNode[];
  /** Per face id: its index in `nodes`. */
  indexOfFace: number[];
  partCount: number;
}

/**
 * The hinge structure of a pattern: the faces of each part hang from the part's first face along the folded edges.
 * Needs the solid and the ids of the joined edges (`Pattern.joinedEdgeIds`). `parts` lists the face ids of each part.
 */
export function buildFoldTree(solid: Solid, joinedEdgeIds: readonly number[], parts: readonly (readonly number[])[]): FoldTree {
  const joined = new Set(joinedEdgeIds);
  const nodes: FoldNode[] = [];
  const indexOfFace = new Array<number>(solid.faces.length).fill(-1);
  parts.forEach((faces, part) => {
    const root = Math.min(...faces);
    const inPart = new Set(faces);
    indexOfFace[root] = nodes.length;
    nodes.push({ face: root, parent: null, hingeA: [0, 0, 0], hingeAxis: [0, 0, 1], flatAngle: 0, part });
    const queue = [root];
    for (let head = 0; head < queue.length; head++) {
      const f = queue[head];
      for (const eid of solid.faces[f].edgeIds) {
        if (!joined.has(eid)) continue;
        const edge = solid.edges[eid];
        const g = edge.faces[0] === f ? edge.faces[1] : edge.faces[0];
        if (!inPart.has(g) || indexOfFace[g] >= 0) continue;
        const a = solid.vertices[edge.a];
        const axis = norm3(sub3(solid.vertices[edge.b], a));
        const nf = solid.faces[f].normal;
        const ng = solid.faces[g].normal;
        // The signed angle from the child's normal to the parent's, about the hinge.
        const flatAngle = Math.atan2(dot3(axis, cross3(ng, nf)), dot3(ng, nf));
        indexOfFace[g] = nodes.length;
        nodes.push({ face: g, parent: f, hingeA: a, hingeAxis: axis, flatAngle, part });
        queue.push(g);
      }
    }
  });
  return { nodes, indexOfFace, partCount: parts.length };
}

/**
 * The pose of every face when the model is `folded` of the way folded: 1 is the finished model (identity for every face),
 * 0 is each part laid flat. Returns one matrix per face id; apply it to the face's corners in the folded model.
 */
export function foldPoses(tree: FoldTree, folded: number): Mat4[] {
  const amount = Math.min(1, Math.max(0, folded));
  const poses: Mat4[] = new Array(tree.indexOfFace.length);
  for (const node of tree.nodes) {
    if (node.parent === null) {
      poses[node.face] = IDENTITY;
      continue;
    }
    const hinge = rotationAboutLine(node.hingeA, node.hingeAxis, node.flatAngle * (1 - amount));
    poses[node.face] = multiplyMat4(poses[node.parent], hinge);
  }
  return poses;
}

/** The triangles of a face as triples of vertex ids (for drawing it in 3D). Works for non-convex faces. */
export function faceTriangles(solid: Solid, faceId: number): [number, number, number][] {
  const face = solid.faces[faceId];
  if (face.vertices.length === 3) return [[face.vertices[0], face.vertices[1], face.vertices[2]]];
  const local = planarCoordinates(solid.vertices, face.vertices, face.normal);
  return triangulate(local).map(([a, b, c]) => [face.vertices[a], face.vertices[b], face.vertices[c]]);
}

export function applyMat4(m: Mat4, p: Vec3): Vec3 {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}
