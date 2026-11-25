import { describe, expect, it } from 'vitest';
import { applyMat4, buildFoldTree, buildPattern, buildSolid, faceTriangles, foldPoses, IDENTITY, shapes, unfold } from '../src/lib/papercraft-engine';
import type { RawMesh, Solid, Vec2 } from '../src/lib/papercraft-engine';
import { convexOverlap, triangulate } from '../src/lib/papercraft-engine/geometry/polygon';

const sphere = (): RawMesh => shapes.lathe([[0, -20], [10, -17], [17, -9], [20, 0], [17, 9], [10, 17], [0, 20]], 12);

const MODELS: [string, RawMesh][] = [
  ['cube', shapes.cube(50)],
  ['tetrahedron', shapes.tetrahedron(60)],
  ['octahedron', shapes.octahedron(50)],
  ['icosahedron', shapes.icosahedron(40)],
  ['dodecahedron', shapes.dodecahedron(30)],
  ['prism', shapes.prism(6, 20, 40)],
  ['pyramid', shapes.pyramid(5, 20, 40)],
  ['gem', shapes.gem(25)],
  ['L block (non-convex)', shapes.lBlock(60)],
  ['sphere (96 faces)', sphere()],
];

const dist3 = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function triangles(points: readonly Vec2[]): Vec2[][] {
  return triangulate(points).map((t) => t.map((i) => points[i]));
}

describe.each(MODELS)('unfolding %s', (_name, mesh) => {
  const solid = buildSolid(mesh);
  const result = unfold(solid);

  it('keeps every face exactly as big as in 3D (lengths of all corner pairs)', () => {
    solid.faces.forEach((face, f) => {
      const pts = result.placed[f];
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const flat = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
          expect(flat).toBeCloseTo(dist3(solid.vertices[face.vertices[i]], solid.vertices[face.vertices[j]]), 6);
        }
      }
    });
  });

  it('puts joined faces side by side along their shared edge, on opposite sides', () => {
    for (const eid of result.joined) {
      const e = solid.edges[eid];
      const [fa, fb] = e.faces;
      expect(result.islandOf[fa]).toBe(result.islandOf[fb]);
      const pos = (f: number, v: number) => result.placed[f][solid.faces[f].vertices.indexOf(v)];
      for (const v of [e.a, e.b]) {
        expect(pos(fa, v)[0]).toBeCloseTo(pos(fb, v)[0], 6);
        expect(pos(fa, v)[1]).toBeCloseTo(pos(fb, v)[1], 6);
      }
      // A face's third corner lies left of the edge for both (counter-clockwise), so the two faces are on opposite sides.
      const side = (f: number) => {
        const face = solid.faces[f];
        const k = face.edgeIds.indexOf(eid);
        const P = result.placed[f][k];
        const Q = result.placed[f][(k + 1) % face.vertices.length];
        const c = result.placed[f].reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0]).map((v) => v / face.vertices.length);
        return Math.sign((Q[0] - P[0]) * (c[1] - P[1]) - (Q[1] - P[1]) * (c[0] - P[0]));
      };
      const sa = side(fa);
      const sb = side(fb);
      // Seen along the shared edge in one direction, one face is to the left and the other to the right.
      const dirA = solid.faces[fa].vertices[(solid.faces[fa].edgeIds.indexOf(eid) + 1) % solid.faces[fa].vertices.length] === e.b ? 1 : -1;
      const dirB = solid.faces[fb].vertices[(solid.faces[fb].edgeIds.indexOf(eid) + 1) % solid.faces[fb].vertices.length] === e.b ? 1 : -1;
      expect(sa * dirA).not.toBe(sb * dirB);
    }
  });

  it('has no overlap inside any part', () => {
    for (const island of result.islands) {
      for (let i = 0; i < island.length; i++) {
        for (let j = i + 1; j < island.length; j++) {
          for (const a of triangles(result.placed[island[i]])) {
            for (const b of triangles(result.placed[island[j]])) {
              expect(convexOverlap(a, b)).toBe(false);
            }
          }
        }
      }
    }
  });

  it('joins faces into a forest: joined edges = faces - parts', () => {
    expect(result.joined.size).toBe(solid.faces.length - result.islands.length);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(unfold(solid).placed)).toBe(JSON.stringify(result.placed));
  });
});

describe('unfolding results for known shapes', () => {
  it('a cube is one part of six squares', () => {
    const r = unfold(buildSolid(shapes.cube(50)));
    expect(r.islands).toHaveLength(1);
    expect(r.joined.size).toBe(5);
  });

  it('a tetrahedron and an octahedron are one part each', () => {
    expect(unfold(buildSolid(shapes.tetrahedron(60))).islands).toHaveLength(1);
    expect(unfold(buildSolid(shapes.octahedron(50))).islands).toHaveLength(1);
  });

  it('respects forced cuts and joins', () => {
    const solid = buildSolid(shapes.cube(50));
    const all = unfold(solid);
    const joinedId = [...all.joined][0];
    expect(unfold(solid, { forceCutEdges: [joinedId] }).joined.has(joinedId)).toBe(false);
    const cutId = solid.edges.find((e) => !all.joined.has(e.id))!.id;
    expect(unfold(solid, { forceJoinEdges: [cutId] }).joined.has(cutId) || unfold(solid, { forceJoinEdges: [cutId] }).rejectedForcedJoins.includes(cutId)).toBe(true);
  });

  it('splits a part that is bigger than the limit', () => {
    const solid = buildSolid(shapes.cube(50));
    const split = unfold(solid, { maxPartSize: { widthMm: 160, heightMm: 120 } });
    expect(split.islands.length).toBeGreaterThan(1);
    expect(split.joined.size).toBe(solid.faces.length - split.islands.length);
  });

  it('cuts every edge that has no partner (open model)', () => {
    const mesh = shapes.cube(50);
    const solid = buildSolid({ positions: mesh.positions, faces: mesh.faces.slice(0, 5) });
    const r = unfold(solid);
    expect(r.joined.size).toBe(solid.faces.length - r.islands.length);
  });
});

function overlapsAny(poly: readonly Vec2[], others: readonly (readonly Vec2[])[]): boolean {
  return others.some((o) => convexOverlap(poly, o));
}

describe.each(MODELS)('pattern for %s', (_name, mesh) => {
  const solid: Solid = buildSolid(mesh);
  const pattern = buildPattern(solid);

  it('holds every face once and all of the surface', () => {
    const ids = pattern.parts.flatMap((p) => p.faces.map((f) => f.faceId)).sort((a, b) => a - b);
    expect(ids).toEqual(solid.faces.map((f) => f.id));
    expect(pattern.stats.surfaceAreaMm2).toBeCloseTo(solid.faces.reduce((s, f) => s + f.area, 0), 6);
  });

  it('glues every cut edge to exactly one partner, with one number', () => {
    const joined = pattern.stats.foldCount;
    expect(pattern.edgePairCount).toBe(solid.edges.length - joined);
    const labels = pattern.parts.flatMap((p) => p.labels.filter((l) => l.role === 'edge')).map((l) => l.text);
    const counts = new Map<string, number>();
    for (const t of labels) counts.set(t, (counts.get(t) ?? 0) + 1);
    expect([...counts.keys()].map(Number).sort((a, b) => a - b)).toEqual(Array.from({ length: pattern.edgePairCount }, (_, i) => i + 1));
    for (const c of counts.values()) expect(c).toBe(2);
  });

  it('gives each pair exactly one tab', () => {
    const missing = pattern.warnings.find((w) => w.code === 'tab-missing')?.count ?? 0;
    expect(pattern.stats.tabCount + missing).toBe(pattern.edgePairCount);
    const numbers = pattern.parts.flatMap((p) => p.tabs.map((t) => t.edgeNumber));
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('never lets a tab lie over a face or another tab', () => {
    for (const part of pattern.parts) {
      const faceTris = part.faces.flatMap((f) => triangles(f.points));
      const tabPolys = part.tabs.map((t) => t.points);
      part.tabs.forEach((t, i) => {
        const [P, Q, q1, p1] = t.points;
        for (const tri of [[P, Q, q1], [P, q1, p1]]) {
          expect(overlapsAny(tri, faceTris)).toBe(false);
          tabPolys.forEach((other, j) => {
            if (i === j) return;
            expect(overlapsAny(tri, [[other[0], other[1], other[2]], [other[0], other[2], other[3]]])).toBe(false);
          });
        }
      });
    }
  });

  it('has cut outlines that close and fold lines for every joined edge and tab', () => {
    for (const part of pattern.parts) {
      expect(part.cutPaths.length).toBeGreaterThan(0);
      for (const c of part.cutPaths) expect(c.closed).toBe(true);
    }
    const folds = pattern.parts.flatMap((p) => p.foldLines);
    expect(folds.filter((f) => f.kind !== 'tab')).toHaveLength(pattern.stats.foldCount);
    expect(folds.filter((f) => f.kind === 'tab')).toHaveLength(pattern.stats.tabCount);
  });

  it('keeps every part in the positive quarter starting at 0,0', () => {
    for (const part of pattern.parts) {
      const all = [...part.faces.flatMap((f) => f.points), ...part.tabs.flatMap((t) => t.points)];
      expect(Math.min(...all.map((p) => p[0]))).toBeCloseTo(0, 6);
      expect(Math.min(...all.map((p) => p[1]))).toBeCloseTo(0, 6);
      expect(Math.max(...all.map((p) => p[0]))).toBeCloseTo(part.widthMm, 6);
    }
  });

  it('is deterministic', () => {
    expect(JSON.stringify(buildPattern(solid))).toBe(JSON.stringify(pattern));
  });
});

describe('mountain and valley folds', () => {
  it('a cube has only mountain folds with the print outside, and only valley folds with the print inside', () => {
    const solid = buildSolid(shapes.cube(50));
    const kinds = (side: 'outside' | 'inside') =>
      new Set(buildPattern(solid, { printedSide: side }).parts.flatMap((p) => p.foldLines).filter((l) => l.kind !== 'tab').map((l) => l.kind));
    expect([...kinds('outside')]).toEqual(['mountain']);
    expect([...kinds('inside')]).toEqual(['valley']);
  });

  it('the inner corner of an L-shaped block is a valley fold, all the other folds are mountain folds', () => {
    const solid = buildSolid(shapes.lBlock(60));
    // The vertical edge at the inside of the L (x = y = 30).
    const inner = solid.edges.find((e) => [e.a, e.b].every((v) => solid.vertices[v][0] === 30 && solid.vertices[v][1] === 30))!;
    expect(inner).toBeDefined();
    const pattern = buildPattern(solid, { forceJoinEdges: [inner.id] });
    const kinds = pattern.parts.flatMap((p) => p.foldLines).filter((l) => l.kind !== 'tab').map((l) => l.kind);
    expect(kinds.filter((k) => k === 'valley')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'mountain').length).toBe(kinds.length - 1);
  });
});

describe('tab settings', () => {
  it('uses the asked width and narrows a tab only when needed', () => {
    const solid = buildSolid(shapes.cube(50));
    const p = buildPattern(solid, { tabWidthMm: 10 });
    expect(p.parts.flatMap((x) => x.tabs).every((t) => t.widthMm <= 10 + 1e-9 && t.widthMm >= 3 - 1e-9)).toBe(true);
    expect(Math.max(...p.parts.flatMap((x) => x.tabs).map((t) => t.widthMm))).toBeCloseTo(10, 6);
  });

  it('reports edges that are too short for a tab', () => {
    const solid = buildSolid(shapes.icosahedron(2));
    const p = buildPattern(solid, { tabWidthMm: 8, minTabWidthMm: 8 });
    expect(p.stats.tabCount + (p.warnings.find((w) => w.code === 'tab-missing')?.count ?? 0)).toBe(p.edgePairCount);
  });
});

describe('fold animation', () => {
  const MODEL_SET: [string, RawMesh][] = MODELS.filter(([name]) => ['cube', 'icosahedron', 'dodecahedron', 'L block (non-convex)', 'sphere (96 faces)'].includes(name));

  it.each(MODEL_SET)('%s: folded is the finished model, flat is the net', (_name, mesh) => {
    const solid = buildSolid(mesh);
    const pattern = buildPattern(solid);
    const parts = pattern.parts.map((p) => p.faces.map((f) => f.faceId));
    const tree = buildFoldTree(solid, pattern.joinedEdgeIds, parts);
    expect(tree.nodes).toHaveLength(solid.faces.length);

    const folded = foldPoses(tree, 1);
    for (const m of folded) expect(m).toEqual(IDENTITY);

    const flat = foldPoses(tree, 0);
    const pointsOf = (f: number) => solid.faces[f].vertices.map((v) => applyMat4(flat[f], solid.vertices[v]));
    pattern.parts.forEach((part, pi) => {
      const root = Math.min(...parts[pi]);
      const n = solid.faces[root].normal;
      const o = solid.vertices[solid.faces[root].vertices[0]];
      const net = new Map(part.faces.map((f) => [f.faceId, f.points]));
      for (const f of parts[pi]) {
        const pts = pointsOf(f);
        // Every corner lies in the plane of the first face...
        for (const p of pts) expect(Math.abs((p[0] - o[0]) * n[0] + (p[1] - o[1]) * n[1] + (p[2] - o[2]) * n[2])).toBeLessThan(1e-6);
        // ... facing the same way ...
        const fn = [0, 1, 2].map((i) => applyMat4(flat[f], [solid.vertices[solid.faces[f].vertices[0]][0] + solid.faces[f].normal[0], solid.vertices[solid.faces[f].vertices[0]][1] + solid.faces[f].normal[1], solid.vertices[solid.faces[f].vertices[0]][2] + solid.faces[f].normal[2]])[i] - pts[0][i]);
        expect(fn[0] * n[0] + fn[1] * n[1] + fn[2] * n[2]).toBeGreaterThan(0.999);
      }
      // ... and the distances between corners of different faces are the pattern's.
      const ids = parts[pi];
      for (let a = 0; a < ids.length; a++) {
        for (let b = a + 1; b < ids.length; b++) {
          const pa = pointsOf(ids[a]);
          const pb = pointsOf(ids[b]);
          const na = net.get(ids[a])!;
          const nb = net.get(ids[b])!;
          for (let i = 0; i < pa.length; i++) {
            for (let j = 0; j < pb.length; j++) {
              expect(dist3(pa[i], pb[j])).toBeCloseTo(Math.hypot(na[i][0] - nb[j][0], na[i][1] - nb[j][1]), 5);
            }
          }
        }
      }
    });
  });

  it('keeps every face rigid half way', () => {
    const solid = buildSolid(shapes.icosahedron(40));
    const pattern = buildPattern(solid);
    const tree = buildFoldTree(solid, pattern.joinedEdgeIds, pattern.parts.map((p) => p.faces.map((f) => f.faceId)));
    const half = foldPoses(tree, 0.5);
    solid.faces.forEach((face, f) => {
      const pts = face.vertices.map((v) => applyMat4(half[f], solid.vertices[v]));
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) expect(dist3(pts[i], pts[j])).toBeCloseTo(dist3(solid.vertices[face.vertices[i]], solid.vertices[face.vertices[j]]), 6);
    });
  });

  it('triangulates faces (also non-convex ones) with the full area', () => {
    const solid = buildSolid(shapes.lBlock(60));
    for (const face of solid.faces) {
      const area = faceTriangles(solid, face.id).reduce((s, [a, b, c]) => {
        const u = solid.vertices[b].map((v, i) => v - solid.vertices[a][i]);
        const w = solid.vertices[c].map((v, i) => v - solid.vertices[a][i]);
        return s + Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2;
      }, 0);
      expect(area).toBeCloseTo(face.area, 6);
    }
  });

  it('gives edge segments for every face edge, with the cut ones numbered', () => {
    const solid = buildSolid(shapes.cube(50));
    const pattern = buildPattern(solid);
    const segments = pattern.parts.flatMap((p) => p.edgeSegments);
    expect(segments.filter((s) => s.state === 'joined')).toHaveLength(pattern.stats.foldCount);
    expect(segments.filter((s) => s.state === 'cut')).toHaveLength(pattern.edgePairCount * 2);
    expect(segments.every((s) => s.state !== 'cut' || s.number !== undefined)).toBe(true);
  });
});
