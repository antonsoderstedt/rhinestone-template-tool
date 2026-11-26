import type { MeshWarning, RawMesh, Solid, SolidEdge, SolidFace, Vec2, Vec3 } from '../types';
import { cross3, dot3, len3, norm3, sub3 } from '../geometry/vec';
import { triangulate } from '../geometry/polygon';

export interface BuildOptions {
  /** Merge connected, coplanar triangles/polygons into one face (default true). */
  mergeCoplanar?: boolean;
  /** Largest angle between normals for two faces to count as one flat face (default 0.5 degrees). */
  coplanarAngleDeg?: number;
}

export function newell(vertices: readonly Vec3[], ids: readonly number[]): Vec3 {
  // Twice the area, as a vector. Measured from the first corner to keep precision for far-from-origin models.
  const o = vertices[ids[0]];
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 1; i + 1 < ids.length; i++) {
    const c = cross3(sub3(vertices[ids[i]], o), sub3(vertices[ids[i + 1]], o));
    nx += c[0];
    ny += c[1];
    nz += c[2];
  }
  return [nx / 2, ny / 2, nz / 2];
}

export function weldVertices(positions: readonly Vec3[], tol: number): { map: number[]; vertices: Vec3[] } {
  const cell = tol * 2;
  const grid = new Map<string, number[]>();
  const vertices: Vec3[] = [];
  const map: number[] = [];
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  for (const p of positions) {
    const cx = Math.floor(p[0] / cell);
    const cy = Math.floor(p[1] / cell);
    const cz = Math.floor(p[2] / cell);
    let found = -1;
    for (let dx = -1; dx <= 1 && found < 0; dx++) {
      for (let dy = -1; dy <= 1 && found < 0; dy++) {
        for (let dz = -1; dz <= 1 && found < 0; dz++) {
          const list = grid.get(key(cx + dx, cy + dy, cz + dz));
          if (!list) continue;
          for (const id of list) {
            if (len3(sub3(vertices[id], p)) <= tol) {
              found = id;
              break;
            }
          }
        }
      }
    }
    if (found < 0) {
      found = vertices.length;
      vertices.push(p);
      const k = key(cx, cy, cz);
      const list = grid.get(k);
      if (list) list.push(found);
      else grid.set(k, [found]);
    }
    map.push(found);
  }
  return { map, vertices };
}

const edgeKey = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);

function* faceEdges(face: readonly number[]): Generator<[number, number]> {
  for (let k = 0; k < face.length; k++) yield [face[k], face[(k + 1) % face.length]];
}

/** Local 2D coordinates of a planar 3D polygon (counter-clockwise seen from its normal). */
export function planarCoordinates(vertices: readonly Vec3[], ids: readonly number[], normal: Vec3): Vec2[] {
  const o = vertices[ids[0]];
  let u: Vec3 = [1, 0, 0];
  for (let k = 1; k < ids.length; k++) {
    const e = sub3(vertices[ids[k]], o);
    if (len3(e) > 1e-12) {
      u = norm3(e);
      break;
    }
  }
  const w = cross3(normal, u);
  return ids.map((id): Vec2 => {
    const d = sub3(vertices[id], o);
    return [dot3(d, u), dot3(d, w)];
  });
}

/**
 * Cleans a mesh into a solid for unfolding: welds vertices, drops degenerate and duplicate faces, splits
 * non-planar polygons, makes the winding consistent and outward, merges coplanar neighbours into one face
 * (a cube from 12 triangles becomes 6 squares) and builds the edge table. Warnings explain what was found.
 */
export function buildSolid(raw: RawMesh, options: BuildOptions = {}): Solid {
  const warnings: MeshWarning[] = [];
  const empty = (): Solid => ({ vertices: [], faces: [], edges: [], closed: false, warnings: [{ code: 'empty', message: 'The model has no faces.' }] });
  if (raw.positions.length === 0 || raw.faces.length === 0) return empty();

  // Size of the model decides the weld distance.
  let min: Vec3 = [Infinity, Infinity, Infinity];
  let max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of raw.positions) {
    min = [Math.min(min[0], p[0]), Math.min(min[1], p[1]), Math.min(min[2], p[2])];
    max = [Math.max(max[0], p[0]), Math.max(max[1], p[1]), Math.max(max[2], p[2])];
  }
  const diag = len3(sub3(max, min));
  if (!(diag > 0) || !Number.isFinite(diag)) return empty();
  const tol = Math.max(diag * 1e-6, 1e-12);

  const welded = weldVertices(raw.positions, tol);
  let vertices = welded.vertices;

  // 1. Remap, remove repeated corners, drop faces with fewer than three corners.
  let degenerate = 0;
  let faces: number[][] = [];
  for (const f of raw.faces) {
    if (f.some((i) => !Number.isInteger(i) || i < 0 || i >= raw.positions.length)) {
      degenerate++;
      continue;
    }
    const mapped: number[] = [];
    for (const i of f) {
      const m = welded.map[i];
      if (mapped.length === 0 || mapped[mapped.length - 1] !== m) mapped.push(m);
    }
    while (mapped.length > 1 && mapped[0] === mapped[mapped.length - 1]) mapped.pop();
    if (new Set(mapped).size < 3 || new Set(mapped).size !== mapped.length) {
      // Fewer than three distinct corners, or a corner used twice (a pinched polygon).
      degenerate++;
      continue;
    }
    faces.push(mapped);
  }

  // 2. Split polygons that are not flat; drop zero-area faces.
  let split = 0;
  const flat: number[][] = [];
  for (const f of faces) {
    const n = newell(vertices, f);
    const area = len3(n);
    if (area <= 1e-12 * diag * diag) {
      degenerate++;
      continue;
    }
    if (f.length > 3) {
      const nn = norm3(n);
      const o = vertices[f[0]];
      let dev = 0;
      for (const id of f) dev = Math.max(dev, Math.abs(dot3(nn, sub3(vertices[id], o))));
      if (dev > 0.01 * Math.sqrt(area)) {
        split++;
        const local = planarCoordinates(vertices, f, nn);
        for (const [a, b, c] of triangulate(local)) flat.push([f[a], f[b], f[c]]);
        continue;
      }
    }
    flat.push(f);
  }
  faces = flat;
  if (degenerate > 0) warnings.push({ code: 'degenerate-faces-removed', count: degenerate, message: `${degenerate} faces with no area were removed.` });
  if (split > 0) warnings.push({ code: 'nonplanar-face-split', count: split, message: `${split} faces that were not flat were split into triangles.` });

  // 3. Remove duplicate faces (same corners).
  const seen = new Set<string>();
  let duplicates = 0;
  faces = faces.filter((f) => {
    const k = [...f].sort((a, b) => a - b).join('_');
    if (seen.has(k)) {
      duplicates++;
      return false;
    }
    seen.add(k);
    return true;
  });
  if (duplicates > 0) warnings.push({ code: 'duplicate-faces-removed', count: duplicates, message: `${duplicates} duplicate faces were removed.` });
  if (faces.length === 0) return empty();

  // 4. Consistent winding: neighbouring faces must traverse their shared edge in opposite directions.
  const buildEdgeFaces = () => {
    const m = new Map<string, number[]>();
    faces.forEach((f, fi) => {
      for (const [a, b] of faceEdges(f)) {
        const k = edgeKey(a, b);
        const l = m.get(k);
        if (l) l.push(fi);
        else m.set(k, [fi]);
      }
    });
    return m;
  };
  let edgeFaces = buildEdgeFaces();
  const direction = (fi: number, a: number, b: number): number => {
    const f = faces[fi];
    for (let k = 0; k < f.length; k++) {
      if (f[k] === a && f[(k + 1) % f.length] === b) return 1;
      if (f[k] === b && f[(k + 1) % f.length] === a) return -1;
    }
    return 0;
  };
  const shellOf = new Array<number>(faces.length).fill(-1);
  const shells: number[][] = [];
  let flipped = 0;
  let conflicts = 0;
  for (let seed = 0; seed < faces.length; seed++) {
    if (shellOf[seed] >= 0) continue;
    const shell = [seed];
    shellOf[seed] = shells.length;
    for (let head = 0; head < shell.length; head++) {
      const fi = shell[head];
      for (const [a, b] of faceEdges(faces[fi])) {
        const others = edgeFaces.get(edgeKey(a, b))!;
        for (const gi of others) {
          if (gi === fi) continue;
          const manifold = others.length === 2;
          if (shellOf[gi] < 0) {
            shellOf[gi] = shells.length;
            if (manifold && direction(gi, a, b) === direction(fi, a, b)) {
              faces[gi] = [...faces[gi]].reverse();
              flipped++;
            }
            shell.push(gi);
          } else if (manifold && direction(gi, a, b) === direction(fi, a, b)) {
            conflicts++;
          }
        }
      }
    }
    shells.push(shell);
  }
  if (flipped > 0) warnings.push({ code: 'orientation-fixed', count: flipped, message: `${flipped} faces faced the wrong way compared to their neighbours and were turned.` });
  if (conflicts > 0) warnings.push({ code: 'non-orientable', count: conflicts, message: 'The surface cannot be given a consistent inside and outside (a twisted or self-touching surface). The pattern may be wrong.' });
  if (shells.length > 1) warnings.push({ code: 'multiple-shells', count: shells.length, message: `The model is ${shells.length} separate pieces.` });

  // 5. Outward normals for every closed shell (negative volume means inside out).
  edgeFaces = buildEdgeFaces();
  let inverted = 0;
  for (const shell of shells) {
    const closed = shell.every((fi) => [...faceEdges(faces[fi])].every(([a, b]) => edgeFaces.get(edgeKey(a, b))!.length === 2));
    if (!closed) continue;
    let volume = 0;
    for (const fi of shell) {
      const f = faces[fi];
      for (let k = 1; k + 1 < f.length; k++) volume += dot3(vertices[f[0]], cross3(vertices[f[k]], vertices[f[k + 1]])) / 6;
    }
    if (volume < 0) {
      for (const fi of shell) faces[fi] = [...faces[fi]].reverse();
      inverted += shell.length;
    }
  }
  if (inverted > 0) warnings.push({ code: 'inverted-normals-fixed', count: inverted, message: 'The model was inside out and has been turned.' });

  // 6. Merge connected coplanar faces into single polygons.
  if (options.mergeCoplanar !== false) {
    faces = mergeCoplanar(vertices, faces, buildEdgeFaces(), diag, options.coplanarAngleDeg ?? 0.5);
  }

  // 7. Drop unused vertices, build the table.
  const used = new Map<number, number>();
  const finalVertices: Vec3[] = [];
  faces = faces.map((f) =>
    f.map((v) => {
      let id = used.get(v);
      if (id === undefined) {
        id = finalVertices.length;
        finalVertices.push(vertices[v]);
        used.set(v, id);
      }
      return id;
    }),
  );
  vertices = finalVertices;

  const edges: SolidEdge[] = [];
  const edgeIndex = new Map<string, number>();
  const solidFaces: SolidFace[] = faces.map((f, id) => {
    const n = newell(vertices, f);
    const area = len3(n);
    const edgeIds = f.map((v, k) => {
      const w = f[(k + 1) % f.length];
      const key = edgeKey(v, w);
      let eid = edgeIndex.get(key);
      if (eid === undefined) {
        eid = edges.length;
        edgeIndex.set(key, eid);
        edges.push({ id: eid, a: Math.min(v, w), b: Math.max(v, w), faces: [], length: len3(sub3(vertices[v], vertices[w])) });
      }
      edges[eid].faces.push(id);
      return eid;
    });
    return { id, vertices: f, edgeIds, normal: norm3(n), area };
  });

  const open = edges.filter((e) => e.faces.length === 1).length;
  const nonManifold = edges.filter((e) => e.faces.length > 2).length;
  if (open > 0) warnings.push({ code: 'open-edges', count: open, message: `The model has ${open} open edges (holes). Open edges are cut, not glued.` });
  if (nonManifold > 0) warnings.push({ code: 'non-manifold-edges', count: nonManifold, message: `${nonManifold} edges are shared by more than two faces. They are always cut.` });

  return { vertices, faces: solidFaces, edges, closed: open === 0 && nonManifold === 0, warnings };
}

function mergeCoplanar(
  vertices: readonly Vec3[],
  faces: number[][],
  edgeFaces: Map<string, number[]>,
  diag: number,
  angleDeg: number,
): number[][] {
  const cosTol = Math.cos((angleDeg * Math.PI) / 180);
  const planeTol = 1e-4 * diag;
  const normals = faces.map((f) => norm3(newell(vertices, f)));
  const group = new Array<number>(faces.length).fill(-1);
  const groups: number[][] = [];
  for (let seed = 0; seed < faces.length; seed++) {
    if (group[seed] >= 0) continue;
    const gid = groups.length;
    const members = [seed];
    group[seed] = gid;
    const n0 = normals[seed];
    const o = vertices[faces[seed][0]];
    for (let head = 0; head < members.length; head++) {
      for (const [a, b] of faceEdges(faces[members[head]])) {
        const others = edgeFaces.get(edgeKey(a, b))!;
        if (others.length !== 2) continue;
        const gi = others[0] === members[head] ? others[1] : others[0];
        if (group[gi] >= 0) continue;
        if (dot3(normals[gi], n0) < cosTol) continue;
        if (faces[gi].some((v) => Math.abs(dot3(n0, sub3(vertices[v], o))) > planeTol)) continue;
        group[gi] = gid;
        members.push(gi);
      }
    }
    groups.push(members);
  }

  const result: number[][] = [];
  for (const members of groups) {
    if (members.length === 1) {
      result.push(faces[members[0]]);
      continue;
    }
    const inGroup = new Set(members);
    // Directed boundary edges: edges whose other face is outside the group (or missing).
    const next = new Map<number, number[]>();
    let count = 0;
    for (const fi of members) {
      for (const [a, b] of faceEdges(faces[fi])) {
        const others = edgeFaces.get(edgeKey(a, b))!;
        const interior = others.length === 2 && others.every((o) => inGroup.has(o));
        if (interior) continue;
        const list = next.get(a);
        if (list) list.push(b);
        else next.set(a, [b]);
        count++;
      }
    }
    const loop: number[] = [];
    let ok = [...next.values()].every((l) => l.length === 1);
    if (ok) {
      const start = [...next.keys()][0];
      let cur = start;
      do {
        loop.push(cur);
        cur = next.get(cur)![0];
      } while (cur !== start && loop.length <= count);
      ok = loop.length === count && cur === start;
    }
    if (ok) result.push(loop);
    else for (const fi of members) result.push(faces[fi]);
  }
  return result;
}
