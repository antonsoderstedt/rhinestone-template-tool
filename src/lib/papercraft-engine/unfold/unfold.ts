import type { Solid, Vec2 } from '../types';
import { planarCoordinates } from '../mesh/build';
import { boundsOf, convexHull, convexOverlap, fitsInBox, triangulate } from '../geometry/polygon';
import { dot3 } from '../geometry/vec';

export interface UnfoldOptions {
  /** Largest allowed part, faces only (no tabs). Joins that would make a bigger part are not made. */
  maxPartSize?: { widthMm: number; heightMm: number };
  forceCutEdges?: readonly number[];
  forceJoinEdges?: readonly number[];
  /** Which rule orders the edges (see `weightOf`); 0 is the default. Different rules give different nets of the same model. */
  weightVariant?: number;
}

export interface UnfoldResult {
  /** 2D corners of every face in its part's frame, in the order of the solid's face vertices. */
  placed: Vec2[][];
  /** Local triangulation of every face (indices into the face's corners). */
  triangles: [number, number, number][][];
  /** Parts as lists of face ids, largest first. */
  islands: number[][];
  islandOf: number[];
  /**
   * Edge ids that are folded (joined) rather than cut: the edges that joined the parts, and the edges between two faces that already lie
   * edge to edge in the same part (see `unfold`). So a part is a tree of faces, plus a few extra folds where the surface is flat all around a corner.
   */
  joined: Set<number>;
  /** Forced joins that were dropped because the part would overlap itself or get too big. */
  rejectedForcedJoins: number[];
  /** Edges shared by more than two faces: always cut. */
  nonManifoldEdges: number[];
}

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

const boundsDisjoint = (a: Bounds, b: Bounds, eps: number) =>
  a.maxX < b.minX + eps || b.maxX < a.minX + eps || a.maxY < b.minY + eps || b.maxY < a.minY + eps;

/**
 * Unfolds a solid into flat parts. Faces start as separate parts. Edges are visited from the one that is most
 * worth keeping joined (long, nearly flat) to the least; two parts are joined across an edge when the joined
 * part has no overlap and fits the size limit. That gives a spanning forest of the faces with no overlap by
 * construction. The result is deterministic: same solid and options give the same parts.
 *
 * Then one more fold is added wherever it costs nothing: a cut edge whose two faces already lie edge to edge in the same part. That happens
 * at a corner where the faces around it add up to 360 degrees (a leg of a box meeting a flat underside): going round the corner through the
 * other faces brings the two faces back to the same place. Joining them changes nothing in the net, and saves a glue tab that would not fit
 * anyway, because the neighbour is where the tab would go.
 */
export function unfold(solid: Solid, options: UnfoldOptions = {}): UnfoldResult {
  const faceCount = solid.faces.length;
  const local = solid.faces.map((f) => planarCoordinates(solid.vertices, f.vertices, f.normal));
  const triangles = local.map((l) => triangulate(l));
  const placed: Vec2[][] = local.map((l) => l.map((p): Vec2 => [p[0], p[1]]));
  const bounds: Bounds[] = placed.map((p) => boundsOf(p));
  const islandOf = solid.faces.map((_, i) => i);
  const members: number[][] = solid.faces.map((_, i) => [i]);
  const joined = new Set<number>();
  const rejectedForcedJoins: number[] = [];
  const nonManifoldEdges = solid.edges.filter((e) => e.faces.length > 2).map((e) => e.id);

  const forceCut = new Set(options.forceCutEdges ?? []);
  const forceJoin = new Set(options.forceJoinEdges ?? []);
  const max = options.maxPartSize;

  const trisOf = (f: number, pts: readonly Vec2[]): Vec2[][] => triangles[f].map((t) => t.map((i) => pts[i]));

  const candidates = solid.edges.filter((e) => e.faces.length === 2 && !forceCut.has(e.id));
  const variant = options.weightVariant ?? 0;
  const weight = (e: (typeof candidates)[number]) => {
    const flat = Math.max(0, dot3(solid.faces[e.faces[0]].normal, solid.faces[e.faces[1]].normal));
    switch (variant) {
      case 1:
        return e.length;
      case 2:
        return 1000 * flat + e.length;
      case 3:
        return e.length * (1 + 2 * flat);
      case 4:
        return e.length * (1 + flat) ** 3;
      case 5:
        return -e.id;
      case 6:
        return e.id;
      case 7:
        return -e.length;
      case 8:
        return e.length * (1 - 0.5 * flat);
      case 9:
        return 1000 * (1 - flat) + e.length;
      case 10:
        return Math.sin(e.id * 12.9898) * 43758.5453 % 1;
      case 11:
        return Math.sin(e.id * 78.233 + 1) * 12345.6789 % 1;
      default:
        return e.length * (1 + 0.5 * flat);
    }
  };
  const ordered = [...candidates].sort((p, q) => {
    const fp = forceJoin.has(p.id) ? 1 : 0;
    const fq = forceJoin.has(q.id) ? 1 : 0;
    if (fp !== fq) return fq - fp;
    return weight(q) - weight(p) || p.id - q.id;
  });

  for (const edge of ordered) {
    const [fa, fb] = edge.faces;
    if (islandOf[fa] === islandOf[fb]) continue;
    // The bigger part stays where it is; the smaller one moves.
    const baseFace = members[islandOf[fa]].length >= members[islandOf[fb]].length ? fa : fb;
    const moveFace = baseFace === fa ? fb : fa;
    const baseIsland = islandOf[baseFace];
    const moveIsland = islandOf[moveFace];

    const bv = solid.faces[baseFace].vertices;
    const mv = solid.faces[moveFace].vertices;
    // Directed edge s -> t in the base face; the other face runs t -> s.
    let k = -1;
    for (let i = 0; i < bv.length; i++) if (solid.faces[baseFace].edgeIds[i] === edge.id) k = i;
    const s = bv[k];
    const t = bv[(k + 1) % bv.length];
    let m = -1;
    for (let i = 0; i < mv.length; i++) if (solid.faces[moveFace].edgeIds[i] === edge.id) m = i;
    if (!(mv[m] === t && mv[(m + 1) % mv.length] === s)) {
      // Neighbouring faces disagree on direction (a twisted surface): do not join.
      if (forceJoin.has(edge.id)) rejectedForcedJoins.push(edge.id);
      continue;
    }
    const PS = placed[baseFace][k];
    const PT = placed[baseFace][(k + 1) % bv.length];
    const QT = placed[moveFace][m];
    const QS = placed[moveFace][(m + 1) % mv.length];
    const theta = Math.atan2(PT[1] - PS[1], PT[0] - PS[0]) - Math.atan2(QT[1] - QS[1], QT[0] - QS[0]);
    const c = Math.cos(theta);
    const sn = Math.sin(theta);
    const tx = PS[0] - (c * QS[0] - sn * QS[1]);
    const ty = PS[1] - (sn * QS[0] + c * QS[1]);
    const move = (p: Vec2): Vec2 => [c * p[0] - sn * p[1] + tx, sn * p[0] + c * p[1] + ty];

    const moved = new Map<number, Vec2[]>();
    for (const f of members[moveIsland]) moved.set(f, placed[f].map(move));

    // Overlap between the moved faces and the faces that stay.
    let overlaps = false;
    const baseTriCache = new Map<number, Vec2[][]>();
    outer: for (const [mf, pts] of moved) {
      const mb = boundsOf(pts);
      const mt = trisOf(mf, pts);
      for (const bf of members[baseIsland]) {
        if (boundsDisjoint(mb, bounds[bf], 1e-4)) continue;
        let bt = baseTriCache.get(bf);
        if (!bt) {
          bt = trisOf(bf, placed[bf]);
          baseTriCache.set(bf, bt);
        }
        for (const x of mt) {
          for (const y of bt) {
            if (convexOverlap(x, y)) {
              overlaps = true;
              break outer;
            }
          }
        }
      }
    }
    let tooBig = false;
    if (!overlaps && max) {
      const pts: Vec2[] = [];
      for (const f of members[baseIsland]) pts.push(...placed[f]);
      for (const p of moved.values()) pts.push(...p);
      tooBig = !fitsInBox(convexHull(pts), max.widthMm, max.heightMm);
    }
    if (overlaps || tooBig) {
      if (forceJoin.has(edge.id)) rejectedForcedJoins.push(edge.id);
      continue;
    }

    for (const [mf, pts] of moved) {
      placed[mf] = pts;
      bounds[mf] = boundsOf(pts);
      islandOf[mf] = baseIsland;
      members[baseIsland].push(mf);
    }
    members[moveIsland] = [];
    joined.add(edge.id);
  }

  // A corner that is flat all around closes by itself: the two faces are already edge to edge, so the edge is a fold, not a seam.
  const FLUSH = 1e-6;
  for (const edge of candidates) {
    if (joined.has(edge.id)) continue;
    const [fa, fb] = edge.faces;
    if (islandOf[fa] !== islandOf[fb]) continue;
    const at = (f: number, v: number): Vec2 => placed[f][solid.faces[f].vertices.indexOf(v)];
    if ([edge.a, edge.b].every((v) => Math.hypot(at(fa, v)[0] - at(fb, v)[0], at(fa, v)[1] - at(fb, v)[1]) < FLUSH)) joined.add(edge.id);
  }

  const islands = members
    .filter((l) => l.length > 0)
    .map((l) => [...l].sort((a, b) => a - b))
    .sort((a, b) => {
      const area = (l: number[]) => l.reduce((sum, f) => sum + solid.faces[f].area, 0);
      return area(b) - area(a) || a[0] - b[0];
    });
  const finalIsland = new Array<number>(faceCount).fill(0);
  islands.forEach((l, i) => l.forEach((f) => (finalIsland[f] = i)));

  return { placed, triangles, islands, islandOf: finalIsland, joined, rejectedForcedJoins, nonManifoldEdges };
}
