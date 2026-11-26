import type { RawMesh, Vec3 } from '../types';
import { cross3, dot3, len3, norm3, sub3 } from '../geometry/vec';
import { triangulate } from '../geometry/polygon';
import { newell, planarCoordinates, weldVertices } from './build';

export interface SimplifyOptions {
  /** Stop when this many faces are left (never fewer than 4). */
  targetFaces: number;
  /**
   * Smallest cosine between the normal of a face before and after a collapse. A collapse that turns a face over or folds it
   * sharply is refused (default 0.2: about 78 degrees).
   */
  minNormalCosine?: number;
}

export interface SimplifyResult {
  /** Triangles. The same winding as the input; clean it with `buildSolid` as usual. */
  mesh: RawMesh;
  inputFaces: number;
  outputFaces: number;
  /** False when the mesh could not be reduced all the way to the target (the rest of the collapses would break the model). */
  reached: boolean;
}

/** Quadric of a plane (a, b, c, d) as ten numbers: the upper triangle of the 4 x 4 matrix. */
const Q = 10;
/** Boundary edges are held in place with a plane through the edge; this is how much it counts compared with a face. */
const BOUNDARY_WEIGHT = 1;
/** Breaks ties between collapses that cost nothing (flat areas): short edges go first, so the triangles stay even. */
const LENGTH_TIE = 1e-9;

class EdgeHeap {
  size = 0;
  private cap = 1024;
  private cost = new Float64Array(this.cap);
  private ea = new Int32Array(this.cap);
  private eb = new Int32Array(this.cap);
  private va = new Int32Array(this.cap);
  private vb = new Int32Array(this.cap);

  private grow() {
    this.cap *= 2;
    const f = (old: Float64Array) => {
      const n = new Float64Array(this.cap);
      n.set(old);
      return n;
    };
    const g = (old: Int32Array) => {
      const n = new Int32Array(this.cap);
      n.set(old);
      return n;
    };
    this.cost = f(this.cost);
    this.ea = g(this.ea);
    this.eb = g(this.eb);
    this.va = g(this.va);
    this.vb = g(this.vb);
  }

  private less(i: number, j: number): boolean {
    if (this.cost[i] !== this.cost[j]) return this.cost[i] < this.cost[j];
    if (this.ea[i] !== this.ea[j]) return this.ea[i] < this.ea[j];
    return this.eb[i] < this.eb[j];
  }

  private swap(i: number, j: number) {
    const c = this.cost[i];
    this.cost[i] = this.cost[j];
    this.cost[j] = c;
    for (const arr of [this.ea, this.eb, this.va, this.vb]) {
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
  }

  private up(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  private down(i: number) {
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < this.size && this.less(l, m)) m = l;
      if (r < this.size && this.less(r, m)) m = r;
      if (m === i) return;
      this.swap(i, m);
      i = m;
    }
  }

  push(cost: number, a: number, b: number, va: number, vb: number) {
    if (this.size === this.cap) this.grow();
    const i = this.size++;
    this.cost[i] = cost;
    this.ea[i] = a;
    this.eb[i] = b;
    this.va[i] = va;
    this.vb[i] = vb;
    this.up(i);
  }

  /** Removes the cheapest entry; its fields are in `top` afterwards. */
  top = { a: 0, b: 0, va: 0, vb: 0 };
  pop(): boolean {
    if (this.size === 0) return false;
    this.top = { a: this.ea[0], b: this.eb[0], va: this.va[0], vb: this.vb[0] };
    this.size--;
    if (this.size > 0) {
      this.swap(0, this.size);
      this.down(0);
    }
    return true;
  }

  clear() {
    this.size = 0;
  }
}

interface Candidate {
  cost: number;
  x: number;
  y: number;
  z: number;
}

/**
 * Reduces a triangle mesh to about `targetFaces` triangles by collapsing edges, cheapest first, where the cost is how far the new
 * corner is from the planes of the faces it replaces (quadric error metrics, Garland and Heckbert 1997). The model keeps its look;
 * flat areas lose the most faces and edges and corners that matter lose the least. A collapse is refused when it would break
 * the surface (pinch it, join two sheets, turn a face over), so a closed model stays closed and an open one keeps its border.
 *
 * Pure and deterministic: the same mesh and target give the same result.
 */
export function simplifyMesh(raw: RawMesh, options: SimplifyOptions): SimplifyResult {
  const target = Math.max(4, Math.floor(options.targetFaces));
  const minCos = options.minNormalCosine ?? 0.2;
  const unchanged = (): SimplifyResult => ({ mesh: raw, inputFaces: raw.faces.length, outputFaces: raw.faces.length, reached: true });
  if (raw.positions.length === 0 || raw.faces.length <= target) return unchanged();

  // 1. Size: everything is worked out with the model scaled to a diagonal of 1, so the limits below do not depend on units.
  let min: Vec3 = [Infinity, Infinity, Infinity];
  let max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of raw.positions) {
    min = [Math.min(min[0], p[0]), Math.min(min[1], p[1]), Math.min(min[2], p[2])];
    max = [Math.max(max[0], p[0]), Math.max(max[1], p[1]), Math.max(max[2], p[2])];
  }
  const diag = len3(sub3(max, min));
  if (!(diag > 0) || !Number.isFinite(diag)) return unchanged();
  const welded = weldVertices(raw.positions, Math.max(diag * 1e-6, 1e-12));
  const nv = welded.vertices.length;
  const pos = new Float64Array(nv * 3);
  welded.vertices.forEach((p, i) => {
    pos[i * 3] = (p[0] - min[0]) / diag;
    pos[i * 3 + 1] = (p[1] - min[1]) / diag;
    pos[i * 3 + 2] = (p[2] - min[2]) / diag;
  });

  // 2. Triangles: corners welded, pinched and flat faces dropped, polygons cut up, duplicates removed.
  const triList: number[] = [];
  const seen = new Set<string>();
  const addTriangle = (a: number, b: number, c: number) => {
    const cx = (pos[b * 3 + 1] - pos[a * 3 + 1]) * (pos[c * 3 + 2] - pos[a * 3 + 2]) - (pos[b * 3 + 2] - pos[a * 3 + 2]) * (pos[c * 3 + 1] - pos[a * 3 + 1]);
    const cy = (pos[b * 3 + 2] - pos[a * 3 + 2]) * (pos[c * 3] - pos[a * 3]) - (pos[b * 3] - pos[a * 3]) * (pos[c * 3 + 2] - pos[a * 3 + 2]);
    const cz = (pos[b * 3] - pos[a * 3]) * (pos[c * 3 + 1] - pos[a * 3 + 1]) - (pos[b * 3 + 1] - pos[a * 3 + 1]) * (pos[c * 3] - pos[a * 3]);
    if (Math.sqrt(cx * cx + cy * cy + cz * cz) / 2 <= 1e-14) return;
    const key = [a, b, c].sort((x, y) => x - y).join('_');
    if (seen.has(key)) return;
    seen.add(key);
    triList.push(a, b, c);
  };
  for (const f of raw.faces) {
    if (f.some((i) => !Number.isInteger(i) || i < 0 || i >= raw.positions.length)) continue;
    const mapped: number[] = [];
    for (const i of f) {
      const m = welded.map[i];
      if (mapped.length === 0 || mapped[mapped.length - 1] !== m) mapped.push(m);
    }
    while (mapped.length > 1 && mapped[0] === mapped[mapped.length - 1]) mapped.pop();
    if (new Set(mapped).size < 3 || new Set(mapped).size !== mapped.length) continue;
    if (mapped.length === 3) {
      addTriangle(mapped[0], mapped[1], mapped[2]);
      continue;
    }
    const vertices = welded.vertices;
    const n = newell(vertices, mapped);
    if (len3(n) <= 1e-12 * diag * diag) continue;
    for (const [a, b, c] of triangulate(planarCoordinates(vertices, mapped, norm3(n)))) addTriangle(mapped[a], mapped[b], mapped[c]);
  }
  const nf = triList.length / 3;
  const inputFaces = raw.faces.length;
  if (nf <= target) return finish(0);
  const tri = Int32Array.from(triList);
  const alive = new Uint8Array(nf).fill(1);
  let aliveFaces = nf;

  // 3. Which faces touch each corner, and which corners are on an open border or a non-manifold edge.
  const vFaces: number[][] = Array.from({ length: nv }, () => []);
  for (let f = 0; f < nf; f++) for (let k = 0; k < 3; k++) vFaces[tri[f * 3 + k]].push(f);
  const edgeKey = (a: number, b: number) => (a < b ? a * nv + b : b * nv + a);
  const edgeFaces = new Map<number, number>();
  for (let f = 0; f < nf; f++) {
    for (let k = 0; k < 3; k++) {
      const key = edgeKey(tri[f * 3 + k], tri[f * 3 + ((k + 1) % 3)]);
      edgeFaces.set(key, (edgeFaces.get(key) ?? 0) + 1);
    }
  }
  const locked = new Uint8Array(nv);
  const border = new Uint8Array(nv);
  for (const [key, count] of edgeFaces) {
    if (count === 1) {
      border[Math.floor(key / nv)] = 1;
      border[key % nv] = 1;
    } else if (count > 2) {
      locked[Math.floor(key / nv)] = 1;
      locked[key % nv] = 1;
    }
  }

  // Pieces of the model that are not connected: a collapse never joins them, and each keeps at least four faces.
  const root = Int32Array.from({ length: nv }, (_, i) => i);
  const find = (v: number): number => {
    while (root[v] !== v) {
      root[v] = root[root[v]];
      v = root[v];
    }
    return v;
  };
  for (let f = 0; f < nf; f++) {
    const r0 = find(tri[f * 3]);
    for (let k = 1; k < 3; k++) {
      const r = find(tri[f * 3 + k]);
      if (r !== r0) root[Math.max(r, find(r0))] = Math.min(r, find(r0));
    }
  }
  const pieceFaces = new Map<number, number>();
  for (let f = 0; f < nf; f++) {
    const r = find(tri[f * 3]);
    pieceFaces.set(r, (pieceFaces.get(r) ?? 0) + 1);
  }

  // 4. The error quadric of every corner: the planes of its faces (weighted by area) and, on a border, a plane that holds the border.
  const quad = new Float64Array(nv * Q);
  const addPlane = (v: number, a: number, b: number, c: number, d: number, w: number) => {
    const q = v * Q;
    quad[q] += w * a * a;
    quad[q + 1] += w * a * b;
    quad[q + 2] += w * a * c;
    quad[q + 3] += w * a * d;
    quad[q + 4] += w * b * b;
    quad[q + 5] += w * b * c;
    quad[q + 6] += w * b * d;
    quad[q + 7] += w * c * c;
    quad[q + 8] += w * c * d;
    quad[q + 9] += w * d * d;
  };
  for (let f = 0; f < nf; f++) {
    const ids = [tri[f * 3], tri[f * 3 + 1], tri[f * 3 + 2]];
    const p = ids.map((i): Vec3 => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]);
    const c = cross3(sub3(p[1], p[0]), sub3(p[2], p[0]));
    const twice = len3(c);
    const n = norm3(c);
    const d = -dot3(n, p[0]);
    const area = twice / 2;
    for (const i of ids) addPlane(i, n[0], n[1], n[2], d, area);
    for (let k = 0; k < 3; k++) {
      const u = ids[k];
      const v = ids[(k + 1) % 3];
      if (edgeFaces.get(edgeKey(u, v)) !== 1) continue;
      const e = sub3(p[(k + 1) % 3], p[k]);
      const m = norm3(cross3(e, n));
      const len = len3(e);
      const dm = -dot3(m, p[k]);
      const w = BOUNDARY_WEIGHT * len * len;
      addPlane(u, m[0], m[1], m[2], dm, w);
      addPlane(v, m[0], m[1], m[2], dm, w);
    }
  }

  // 5. The collapses.
  const version = new Int32Array(nv);
  const vAlive = new Uint8Array(nv).fill(1);
  const heap = new EdgeHeap();
  const tmp = new Float64Array(Q);

  const faceHas = (f: number, v: number) => tri[f * 3] === v || tri[f * 3 + 1] === v || tri[f * 3 + 2] === v;
  const liveFaces = (v: number): number[] => {
    const list = vFaces[v];
    let w = 0;
    for (let i = 0; i < list.length; i++) if (alive[list[i]]) list[w++] = list[i];
    list.length = w;
    return list;
  };
  const errorAt = (x: number, y: number, z: number) =>
    x * x * tmp[0] + 2 * x * y * tmp[1] + 2 * x * z * tmp[2] + 2 * x * tmp[3] + y * y * tmp[4] + 2 * y * z * tmp[5] + 2 * y * tmp[6] + z * z * tmp[7] + 2 * z * tmp[8] + tmp[9];

  /** Where the two corners would meet, and what it costs; null when they must not be collapsed. */
  const evaluate = (a: number, b: number): Candidate | null => {
    if (!vAlive[a] || !vAlive[b]) return null;
    if (locked[a] && locked[b]) return null;
    let shared = 0;
    for (const f of liveFaces(a)) if (faceHas(f, b)) shared++;
    if (shared === 0 || shared > 2) return null;
    if (border[a] && border[b] && shared !== 1) return null;
    for (let i = 0; i < Q; i++) tmp[i] = quad[a * Q + i] + quad[b * Q + i];
    const ax = pos[a * 3];
    const ay = pos[a * 3 + 1];
    const az = pos[a * 3 + 2];
    const bx = pos[b * 3];
    const by = pos[b * 3 + 1];
    const bz = pos[b * 3 + 2];
    const len2 = (ax - bx) * (ax - bx) + (ay - by) * (ay - by) + (az - bz) * (az - bz);
    const make = (x: number, y: number, z: number): Candidate => ({ cost: Math.max(0, errorAt(x, y, z)) + LENGTH_TIE * len2, x, y, z });
    // A corner that must stay where it is (locked, or on a border while the other one is not) fixes the place.
    if (locked[a] || (border[a] && !border[b])) return make(ax, ay, az);
    if (locked[b] || (border[b] && !border[a])) return make(bx, by, bz);
    const options: Candidate[] = [make(ax, ay, az), make(bx, by, bz), make((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)];
    if (!(border[a] && border[b])) {
      // The best place is where the three planes meet, when the quadric has one and it is near the edge.
      const a11 = tmp[0];
      const a12 = tmp[1];
      const a13 = tmp[2];
      const a22 = tmp[4];
      const a23 = tmp[5];
      const a33 = tmp[7];
      const det = a11 * (a22 * a33 - a23 * a23) - a12 * (a12 * a33 - a23 * a13) + a13 * (a12 * a23 - a22 * a13);
      const trace = a11 + a22 + a33;
      if (Math.abs(det) > 1e-9 * trace * trace * trace) {
        const r1 = -tmp[3];
        const r2 = -tmp[6];
        const r3 = -tmp[8];
        const x = (r1 * (a22 * a33 - a23 * a23) - a12 * (r2 * a33 - a23 * r3) + a13 * (r2 * a23 - a22 * r3)) / det;
        const y = (a11 * (r2 * a33 - a23 * r3) - r1 * (a12 * a33 - a23 * a13) + a13 * (a12 * r3 - r2 * a13)) / det;
        const z = (a11 * (a22 * r3 - r2 * a23) - a12 * (a12 * r3 - r2 * a13) + r1 * (a12 * a23 - a22 * a13)) / det;
        const dx = x - (ax + bx) / 2;
        const dy = y - (ay + by) / 2;
        const dz = z - (az + bz) / 2;
        if (Number.isFinite(x + y + z) && dx * dx + dy * dy + dz * dz <= 9 * len2) options.push(make(x, y, z));
      }
    }
    let best = options[0];
    for (const o of options) if (o.cost < best.cost) best = o;
    return best;
  };

  /** Would the collapse keep the surface a surface: no pinch, no turned-over face? */
  const allowed = (a: number, b: number, at: Candidate): boolean => {
    const fa = liveFaces(a);
    const fb = liveFaces(b);
    const shared = fa.filter((f) => faceHas(f, b));
    if ((pieceFaces.get(find(a)) ?? 0) - shared.length < 4) return false;
    // The corners the two share must be exactly the far corners of the faces on the edge, or the surface would pinch.
    const near = new Set<number>();
    for (const f of fa) for (let k = 0; k < 3; k++) if (tri[f * 3 + k] !== a) near.add(tri[f * 3 + k]);
    const common = new Set<number>();
    for (const f of fb) for (let k = 0; k < 3; k++) {
      const v = tri[f * 3 + k];
      if (v !== b && near.has(v)) common.add(v);
    }
    common.delete(a);
    common.delete(b);
    const far = new Set<number>();
    for (const f of shared) for (let k = 0; k < 3; k++) {
      const v = tri[f * 3 + k];
      if (v !== a && v !== b) far.add(v);
    }
    if (common.size !== far.size) return false;
    for (const v of common) if (!far.has(v)) return false;
    // No face may turn over or collapse to a sliver.
    const sharedSet = new Set(shared);
    for (const [list, from] of [[fa, a], [fb, b]] as const) {
      for (const f of list) {
        if (sharedSet.has(f)) continue;
        const ids = [tri[f * 3], tri[f * 3 + 1], tri[f * 3 + 2]];
        const old = ids.map((i): Vec3 => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]);
        const moved = ids.map((i, k): Vec3 => (i === from ? [at.x, at.y, at.z] : old[k]));
        const n0 = cross3(sub3(old[1], old[0]), sub3(old[2], old[0]));
        const n1 = cross3(sub3(moved[1], moved[0]), sub3(moved[2], moved[0]));
        const l0 = len3(n0);
        const l1 = len3(n1);
        if (l1 <= 1e-12 || l0 <= 0) return false;
        if (dot3(n0, n1) / (l0 * l1) < minCos) return false;
      }
    }
    return true;
  };

  const pushEdge = (a: number, b: number) => {
    const c = evaluate(a, b);
    if (c) heap.push(c.cost, Math.min(a, b), Math.max(a, b), version[Math.min(a, b)], version[Math.max(a, b)]);
  };

  const neighboursOf = (v: number): number[] => {
    const out = new Set<number>();
    for (const f of liveFaces(v)) for (let k = 0; k < 3; k++) if (tri[f * 3 + k] !== v) out.add(tri[f * 3 + k]);
    return [...out].sort((x, y) => x - y);
  };

  const fillHeap = () => {
    heap.clear();
    const done = new Set<number>();
    for (let f = 0; f < nf; f++) {
      if (!alive[f]) continue;
      for (let k = 0; k < 3; k++) {
        const u = tri[f * 3 + k];
        const v = tri[f * 3 + ((k + 1) % 3)];
        const key = edgeKey(u, v);
        if (done.has(key)) continue;
        done.add(key);
        pushEdge(u, v);
      }
    }
  };

  let collapsedTotal = 0;
  while (aliveFaces > target) {
    fillHeap();
    let collapsedThisPass = 0;
    while (aliveFaces > target && heap.pop()) {
      const { a, b, va, vb } = heap.top;
      if (version[a] !== va || version[b] !== vb) continue;
      const at = evaluate(a, b);
      if (!at || !allowed(a, b, at)) continue;
      // Merge b into a.
      const fb = liveFaces(b);
      for (const f of fb) {
        if (faceHas(f, a)) {
          alive[f] = 0;
          aliveFaces--;
          pieceFaces.set(find(a), (pieceFaces.get(find(a)) ?? 0) - 1);
        } else {
          for (let k = 0; k < 3; k++) if (tri[f * 3 + k] === b) tri[f * 3 + k] = a;
          vFaces[a].push(f);
        }
      }
      vFaces[b] = [];
      vAlive[b] = 0;
      pos[a * 3] = at.x;
      pos[a * 3 + 1] = at.y;
      pos[a * 3 + 2] = at.z;
      for (let i = 0; i < Q; i++) quad[a * Q + i] += quad[b * Q + i];
      locked[a] = locked[a] | locked[b];
      border[a] = border[a] | border[b];
      version[a]++;
      for (const n of neighboursOf(a)) pushEdge(a, n);
      collapsedThisPass++;
    }
    collapsedTotal += collapsedThisPass;
    if (collapsedThisPass === 0) break;
  }
  return finish(collapsedTotal);

  /** The mesh in the size of the original, with the corners that are still in use. */
  function finish(collapsed: number): SimplifyResult {
    if (collapsed === 0 && nf <= target) {
      // Only cleaned: the faces of the input as triangles.
      const ids = new Map<number, number>();
      const positions: Vec3[] = [];
      const faces: number[][] = [];
      for (let f = 0; f < nf; f++) {
        faces.push([0, 1, 2].map((k) => remap(triList[f * 3 + k], ids, positions, pos, min, diag)));
      }
      return { mesh: { positions, faces }, inputFaces, outputFaces: faces.length, reached: true };
    }
    const ids = new Map<number, number>();
    const positions: Vec3[] = [];
    const faces: number[][] = [];
    for (let f = 0; f < nf; f++) {
      if (!alive[f]) continue;
      faces.push([0, 1, 2].map((k) => remap(tri[f * 3 + k], ids, positions, pos, min, diag)));
    }
    return { mesh: { positions, faces }, inputFaces, outputFaces: faces.length, reached: faces.length <= target };
  }
}

function remap(v: number, ids: Map<number, number>, positions: Vec3[], pos: Float64Array, min: Vec3, diag: number): number {
  let id = ids.get(v);
  if (id === undefined) {
    id = positions.length;
    ids.set(v, id);
    positions.push([pos[v * 3] * diag + min[0], pos[v * 3 + 1] * diag + min[1], pos[v * 3 + 2] * diag + min[2]]);
  }
  return id;
}
