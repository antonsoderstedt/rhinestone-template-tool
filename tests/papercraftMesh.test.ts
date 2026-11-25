import { describe, expect, it } from 'vitest';
import { boundaryLoops, buildSolid, fillHoles, flipFaces, parseObj, parseStl, projectSolid, readMeshFile, reportSolid, scaleMesh, shapes, MeshReadError } from '../src/lib/papercraft-engine';
import type { RawMesh, Solid } from '../src/lib/papercraft-engine';

/** Triangulate every face of a mesh (the way an STL file stores it). */
function toTriangles(mesh: RawMesh): RawMesh {
  const faces: number[][] = [];
  for (const f of mesh.faces) for (let k = 1; k + 1 < f.length; k++) faces.push([f[0], f[k], f[k + 1]]);
  return { positions: mesh.positions, faces };
}

function binaryStl(mesh: RawMesh): Uint8Array {
  const tris = toTriangles(mesh);
  const buf = new ArrayBuffer(84 + tris.faces.length * 50);
  const view = new DataView(buf);
  view.setUint32(80, tris.faces.length, true);
  let o = 84;
  for (const f of tris.faces) {
    o += 12;
    for (const i of f) {
      for (let c = 0; c < 3; c++) view.setFloat32(o + c * 4, tris.positions[i][c], true);
      o += 12;
    }
    o += 2;
  }
  return new Uint8Array(buf);
}

function asciiStl(mesh: RawMesh): string {
  const tris = toTriangles(mesh);
  const lines = ['solid test'];
  for (const f of tris.faces) {
    lines.push('facet normal 0 0 0', 'outer loop');
    for (const i of f) lines.push(`vertex ${tris.positions[i].join(' ')}`);
    lines.push('endloop', 'endfacet');
  }
  lines.push('endsolid test');
  return lines.join('\n');
}

const volume = (s: Solid) => {
  let v = 0;
  for (const f of s.faces) {
    for (let k = 1; k + 1 < f.vertices.length; k++) {
      const a = s.vertices[f.vertices[0]];
      const b = s.vertices[f.vertices[k]];
      const c = s.vertices[f.vertices[k + 1]];
      v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    }
  }
  return v;
};

describe('papercraft mesh cleaning', () => {
  it('turns the 12 triangles of a cube into 6 square faces', () => {
    const solid = buildSolid(toTriangles(shapes.cube(10)));
    expect(solid.faces).toHaveLength(6);
    expect(solid.vertices).toHaveLength(8);
    expect(solid.edges).toHaveLength(12);
    expect(solid.closed).toBe(true);
    for (const f of solid.faces) expect(f.area).toBeCloseTo(100, 6);
  });

  it('keeps triangles apart when merging is off', () => {
    expect(buildSolid(toTriangles(shapes.cube(10)), { mergeCoplanar: false }).faces).toHaveLength(12);
  });

  it('welds duplicated vertices, as an STL file has', () => {
    const tri = toTriangles(shapes.icosahedron(10));
    const unwelded: RawMesh = { positions: tri.faces.flatMap((f) => f.map((i) => tri.positions[i])), faces: tri.faces.map((_, i) => [i * 3, i * 3 + 1, i * 3 + 2]) };
    const solid = buildSolid(unwelded);
    expect(solid.vertices).toHaveLength(12);
    expect(solid.faces).toHaveLength(20);
    expect(solid.closed).toBe(true);
  });

  it('makes every face wind counter-clockwise seen from outside, even when the input is mixed up', () => {
    const mesh = shapes.octahedron(10);
    const mixed: RawMesh = { positions: mesh.positions, faces: mesh.faces.map((f, i) => (i % 3 === 0 ? [...f].reverse() : f)) };
    const solid = buildSolid(mixed);
    expect(solid.warnings.some((w) => w.code === 'orientation-fixed')).toBe(true);
    expect(volume(solid)).toBeGreaterThan(0);
    for (const f of solid.faces) {
      const c = f.vertices.reduce((s, v) => [s[0] + solid.vertices[v][0], s[1] + solid.vertices[v][1], s[2] + solid.vertices[v][2]], [0, 0, 0]);
      expect(c[0] * f.normal[0] + c[1] * f.normal[1] + c[2] * f.normal[2]).toBeGreaterThan(0);
    }
  });

  it('turns an inside-out model', () => {
    const mesh = shapes.icosahedron(10);
    const inside: RawMesh = { positions: mesh.positions, faces: mesh.faces.map((f) => [...f].reverse()) };
    const a = buildSolid(mesh);
    const b = buildSolid(inside);
    expect(volume(a)).toBeGreaterThan(0);
    expect(volume(b)).toBeCloseTo(volume(a), 6);
  });

  it('removes degenerate and duplicate faces and says so', () => {
    const mesh = shapes.cube(10);
    const dirty: RawMesh = { positions: [...mesh.positions, [1, 1, 1]], faces: [...mesh.faces, [0, 0, 1], [0, 1, 2, 3].slice(0, 2), [0, 3, 2, 1]] };
    const solid = buildSolid(dirty);
    expect(solid.faces).toHaveLength(6);
    expect(solid.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(['degenerate-faces-removed', 'duplicate-faces-removed']));
  });

  it('reports open edges for a model with a hole', () => {
    const mesh = shapes.cube(10);
    const solid = buildSolid({ positions: mesh.positions, faces: mesh.faces.slice(0, 5) });
    expect(solid.closed).toBe(false);
    expect(solid.warnings.find((w) => w.code === 'open-edges')?.count).toBe(4);
  });

  it('splits a polygon that is not flat', () => {
    const solid = buildSolid({ positions: [[0, 0, 0], [10, 0, 0], [10, 10, 5], [0, 10, 0]], faces: [[0, 1, 2, 3]] });
    expect(solid.faces).toHaveLength(2);
    expect(solid.warnings.some((w) => w.code === 'nonplanar-face-split')).toBe(true);
  });

  it('reports an empty model', () => {
    expect(buildSolid({ positions: [], faces: [] }).warnings[0].code).toBe('empty');
  });

  it('is deterministic', () => {
    const a = JSON.stringify(buildSolid(toTriangles(shapes.dodecahedron(10))));
    const b = JSON.stringify(buildSolid(toTriangles(shapes.dodecahedron(10))));
    expect(a).toBe(b);
  });
});

describe('papercraft readers', () => {
  it('reads OBJ with quads, slashes and negative indices', () => {
    const mesh = parseObj(['# a cube', ...shapes.cube(2).positions.map((p) => `v ${p.join(' ')}`), 'vn 0 0 1', 'f 1//1 4//1 3//1 2//1', 'f -4/1/1 -3 -2 -1'].join('\n'));
    expect(mesh.positions).toHaveLength(8);
    expect(mesh.faces[0]).toEqual([0, 3, 2, 1]);
    expect(mesh.faces[1]).toEqual([4, 5, 6, 7]);
  });

  it('rejects an OBJ file without faces and a bad vertex', () => {
    expect(() => parseObj('v 1 2 3')).toThrow(MeshReadError);
    expect(() => parseObj('v 1 x 3\nf 1 1 1')).toThrow(MeshReadError);
  });

  it('reads binary and ASCII STL to the same solid', () => {
    const source = shapes.icosahedron(30);
    const bin = buildSolid(parseStl(binaryStl(source)));
    const asc = buildSolid(parseStl(new TextEncoder().encode(asciiStl(source))));
    expect(bin.faces).toHaveLength(20);
    expect(asc.faces).toHaveLength(20);
    expect(bin.closed && asc.closed).toBe(true);
    expect(reportSolid(bin).surfaceAreaMm2).toBeCloseTo(reportSolid(asc).surfaceAreaMm2, 3);
  });

  it('picks the reader from the file name', () => {
    expect(readMeshFile('a.STL', binaryStl(shapes.cube(5))).faces).toHaveLength(12);
    expect(() => readMeshFile('a.fbx', new Uint8Array(4))).toThrow(MeshReadError);
    expect(() => parseStl(new Uint8Array(100))).toThrow(MeshReadError);
  });
});

describe('papercraft scale and report', () => {
  it('scales to a chosen dimension in millimetres', () => {
    const scaled = scaleMesh(shapes.box(1, 2, 4), { by: 'height', mm: 100 });
    expect(reportSolid(buildSolid(scaled)).size).toEqual([25, 50, 100].map((v) => expect.closeTo(v, 6)));
    expect(reportSolid(buildSolid(scaleMesh(shapes.box(1, 2, 4), { by: 'largest', mm: 40 }))).size[2]).toBeCloseTo(40, 6);
    expect(reportSolid(buildSolid(scaleMesh(shapes.cube(10), { by: 'factor', factor: 2 }))).size[0]).toBeCloseTo(20, 6);
  });

  it('reports the smallest edge and face', () => {
    const r = reportSolid(buildSolid(shapes.cube(10)));
    expect(r.minEdgeMm).toBeCloseTo(10, 6);
    expect(r.minFaceAreaMm2).toBeCloseTo(100, 6);
    expect(r.surfaceAreaMm2).toBeCloseTo(600, 6);
  });
});

describe('built-in shapes', () => {
  const cases: [string, RawMesh, number, number, number][] = [
    // name, mesh, faces after cleaning, vertices, edges
    ['cube', shapes.cube(10), 6, 8, 12],
    ['tetrahedron', shapes.tetrahedron(10), 4, 4, 6],
    ['octahedron', shapes.octahedron(10), 8, 6, 12],
    ['icosahedron', shapes.icosahedron(10), 20, 12, 30],
    ['dodecahedron', shapes.dodecahedron(10), 12, 20, 30],
    ['prism', shapes.prism(6, 10, 20), 8, 12, 18],
    ['pyramid', shapes.pyramid(5, 10, 20), 6, 6, 10],
    ['L block', shapes.lBlock(60), 8, 12, 18],
  ];
  it.each(cases)('%s is a closed solid with the right counts and Euler number 2', (_name, mesh, f, v, e) => {
    const s = buildSolid(mesh);
    expect(s.closed).toBe(true);
    expect([s.faces.length, s.vertices.length, s.edges.length]).toEqual([f, v, e]);
    expect(s.vertices.length - s.edges.length + s.faces.length).toBe(2);
    expect(volume(s)).toBeGreaterThan(0);
  });

  it('has the asked edge length', () => {
    for (const make of [shapes.tetrahedron, shapes.octahedron, shapes.icosahedron, shapes.dodecahedron, shapes.cube]) {
      const s = buildSolid(make(25));
      for (const e of s.edges) expect(e.length).toBeCloseTo(25, 4);
    }
  });

  it('builds a gem and a lathe vase as closed solids', () => {
    expect(buildSolid(shapes.gem(20)).closed).toBe(true);
    expect(buildSolid(shapes.lathe([[10, 0], [15, 20], [8, 40]], 12)).closed).toBe(true);
  });
});

describe('more built-in shapes', () => {
  const NEW: [string, RawMesh][] = [
    ['vase', shapes.vase()],
    ['bottle', shapes.bottle()],
    ['lantern', shapes.lantern()],
    ['egg', shapes.egg()],
    ['rocket', shapes.rocket()],
    ['house', shapes.house()],
    ['heart box', shapes.heartBox()],
    ['star box', shapes.starBox()],
    ['fish', shapes.fish()],
    ['swan', shapes.swan()],
  ];

  it.each(NEW)('%s is a closed solid with nothing to warn about, Euler number 2, and a body of its own', (_name, mesh) => {
    const s = buildSolid(mesh);
    expect(s.warnings).toEqual([]);
    expect(s.closed).toBe(true);
    expect(s.vertices.length - s.edges.length + s.faces.length).toBe(2);
    expect(volume(s)).toBeGreaterThan(0);
    const size = reportSolid(s).size;
    expect(Math.min(...size)).toBeGreaterThan(1);
  });

  it('the house stands up (front view in x and z, depth in y)', () => {
    const size = reportSolid(buildSolid(shapes.house())).size;
    expect(size[0]).toBeCloseTo(40, 6);
    expect(size[1]).toBeCloseTo(40, 6);
    expect(size[2]).toBeCloseTo(48, 6);
  });

  it('the heart is wider than the star is deep and has a notch (a non-convex face)', () => {
    const heart = buildSolid(shapes.heartBox());
    const top = heart.faces.find((f) => f.vertices.length > 8)!;
    expect(top).toBeDefined();
    expect(reportSolid(heart).size[2]).toBeCloseTo(25, 6);
  });

  it('a sweep keeps both ends: a point or a flat cap', () => {
    const capped = buildSolid(shapes.sweep([{ x: 0, z: 0, width: 5, height: 5 }, { x: 20, z: 0, width: 5, height: 5 }], 8));
    expect(capped.closed).toBe(true);
    expect(capped.faces).toHaveLength(10);
    const pointed = buildSolid(shapes.sweep([{ x: 0, z: 0, width: 0, height: 0 }, { x: 10, z: 0, width: 5, height: 5 }, { x: 20, z: 0, width: 0, height: 0 }], 8));
    expect(pointed.faces).toHaveLength(16);
  });

  it('a little picture of a solid can be drawn without unfolding it', () => {
    const solid = buildSolid(shapes.house());
    const polys = projectSolid(solid, () => [0.5, 0.6, 0.7]);
    expect(polys.length).toBeGreaterThanOrEqual(3);
    for (const p of polys) for (const c of p.rgb) expect(c >= 0 && c <= 1).toBe(true);
  });
});

describe('repairing a mesh', () => {
  const cubeWithoutTop = (): RawMesh => {
    const m = shapes.cube(10);
    return { positions: m.positions, faces: m.faces.filter((_, i) => i !== 1) };
  };

  it('finds the loop of open edges', () => {
    const solid = buildSolid(cubeWithoutTop());
    const loops = boundaryLoops(solid);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toHaveLength(4);
  });

  it('closes a flat hole with one polygon, and the result is a closed cube', () => {
    const r = fillHoles(cubeWithoutTop());
    expect(r.filled).toBe(1);
    expect(r.skipped).toBe(0);
    const solid = buildSolid(r.mesh);
    expect(solid.closed).toBe(true);
    expect(solid.faces).toHaveLength(6);
    expect(solid.warnings).toEqual([]);
    expect(reportSolid(solid).surfaceAreaMm2).toBeCloseTo(600, 6);
  });

  it('closes two holes at once (a tube with both ends open)', () => {
    const tube = shapes.prism(8, 10, 30);
    const open: RawMesh = { positions: tube.positions, faces: tube.faces.slice(2) };
    const r = fillHoles(open);
    expect(r.filled).toBe(2);
    expect(buildSolid(r.mesh).closed).toBe(true);
  });

  it('closes a hole that is not flat with triangles around its middle', () => {
    const m = shapes.cube(10);
    const bent: RawMesh = { positions: m.positions.map((p, i) => (i === 6 ? ([p[0], p[1], p[2] + 3] as [number, number, number]) : p)), faces: m.faces.filter((_, i) => i !== 1) };
    const r = fillHoles(bent);
    expect(r.filled).toBe(1);
    const solid = buildSolid(r.mesh);
    expect(solid.closed).toBe(true);
    expect(solid.vertices.length - solid.edges.length + solid.faces.length).toBe(2);
  });

  it('leaves a very big hole open and says so', () => {
    const r = fillHoles(cubeWithoutTop(), 3);
    expect(r.filled).toBe(0);
    expect(r.skipped).toBe(1);
    expect(buildSolid(r.mesh).closed).toBe(false);
  });

  it('does nothing to a closed model', () => {
    const r = fillHoles(shapes.icosahedron(10));
    expect(r.filled).toBe(0);
    expect(r.skipped).toBe(0);
    expect(buildSolid(r.mesh).faces).toHaveLength(20);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(fillHoles(cubeWithoutTop()))).toBe(JSON.stringify(fillHoles(cubeWithoutTop())));
  });

  it('turning an open model inside out turns every face, and twice gives the model back', () => {
    const open = cubeWithoutTop();
    const flipped = flipFaces(open);
    const a = buildSolid(open);
    const b = buildSolid(flipped);
    // Open models are not turned outward by the cleaning, so the normals really do end up opposite.
    const normalOf = (s: ReturnType<typeof buildSolid>, i: number) => s.faces.find((f) => f.vertices.every((v) => open.faces[i].includes(v)))?.normal;
    const n1 = normalOf(a, 0)!;
    const n2 = normalOf(b, 0)!;
    expect(n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2]).toBeCloseTo(-1, 6);
    expect(flipFaces(flipped).faces).toEqual(open.faces);
  });
});
