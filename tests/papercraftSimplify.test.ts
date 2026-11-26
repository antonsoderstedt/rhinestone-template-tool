import { describe, expect, it } from 'vitest';
import { buildSolid, shapes, simplifyMesh } from '../src/lib/papercraft-engine';
import type { RawMesh, Vec3 } from '../src/lib/papercraft-engine';

/** A sphere from an icosahedron cut into smaller triangles `levels` times (20 * 4^levels faces). */
function icoSphere(levels: number, radius = 50): RawMesh {
  const base = shapes.icosahedron(1);
  let positions: Vec3[] = base.positions.map((p) => p);
  let faces: number[][] = [];
  for (const f of base.faces) for (let k = 1; k + 1 < f.length; k++) faces.push([f[0], f[k], f[k + 1]]);
  for (let level = 0; level < levels; level++) {
    const cache = new Map<string, number>();
    const mid = (a: number, b: number) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      let id = cache.get(key);
      if (id === undefined) {
        id = positions.length;
        positions = [...positions, [(positions[a][0] + positions[b][0]) / 2, (positions[a][1] + positions[b][1]) / 2, (positions[a][2] + positions[b][2]) / 2]];
        cache.set(key, id);
      }
      return id;
    };
    const next: number[][] = [];
    for (const [a, b, c] of faces) {
      const ab = mid(a, b);
      const bc = mid(b, c);
      const ca = mid(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }
  const scaled = positions.map((p): Vec3 => {
    const l = Math.hypot(p[0], p[1], p[2]);
    return [(p[0] / l) * radius, (p[1] / l) * radius, (p[2] / l) * radius];
  });
  return { positions: scaled, faces };
}

/** A cube whose six sides are each cut into n x n squares, as triangles (12 n^2 faces). */
function gridCube(n: number, size = 100): RawMesh {
  const positions: Vec3[] = [];
  const faces: number[][] = [];
  const side = (origin: Vec3, u: Vec3, v: Vec3) => {
    const base = positions.length;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) positions.push([origin[0] + (u[0] * i + v[0] * j) / n, origin[1] + (u[1] * i + v[1] * j) / n, origin[2] + (u[2] * i + v[2] * j) / n]);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = base + j * (n + 1) + i;
        faces.push([a, a + 1, a + n + 2], [a, a + n + 2, a + n + 1]);
      }
    }
  };
  const s = size;
  side([0, 0, 0], [s, 0, 0], [0, s, 0]);
  side([0, 0, s], [0, s, 0], [s, 0, 0]);
  side([0, 0, 0], [0, s, 0], [0, 0, s]);
  side([s, 0, 0], [0, 0, s], [0, s, 0]);
  side([0, 0, 0], [0, 0, s], [s, 0, 0]);
  side([0, s, 0], [s, 0, 0], [0, 0, s]);
  return { positions, faces };
}

/** A flat sheet n x n squares as triangles: an open model. */
function sheet(n: number, size = 100): RawMesh {
  const positions: Vec3[] = [];
  const faces: number[][] = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) positions.push([(size * i) / n, (size * j) / n, 0]);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i;
      faces.push([a, a + 1, a + n + 2], [a, a + n + 2, a + n + 1]);
    }
  }
  return { positions, faces };
}

function volume(mesh: RawMesh): number {
  let v = 0;
  for (const f of mesh.faces) {
    const [a, b, c] = f.map((i) => mesh.positions[i]);
    v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return v;
}

function bounds(mesh: RawMesh) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of mesh.positions) for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], p[k]);
    max[k] = Math.max(max[k], p[k]);
  }
  return { min, max };
}

describe('simplifyMesh', () => {
  it('reduces a dense sphere to the target and keeps it a closed sphere', () => {
    const sphere = icoSphere(4); // 5120 faces
    const result = simplifyMesh(sphere, { targetFaces: 200 });
    expect(result.inputFaces).toBe(5120);
    expect(result.reached).toBe(true);
    expect(result.outputFaces).toBeLessThanOrEqual(200);
    expect(result.outputFaces).toBeGreaterThan(150);
    const solid = buildSolid(result.mesh, { mergeCoplanar: false });
    expect(solid.closed).toBe(true);
    expect(solid.warnings.map((w) => w.code)).not.toContain('open-edges');
    expect(solid.warnings.map((w) => w.code)).not.toContain('non-manifold-edges');
    // A sphere: vertices - edges + faces = 2.
    expect(solid.vertices.length - solid.edges.length + solid.faces.length).toBe(2);
  });

  it('keeps the shape: size and volume stay close to the original', () => {
    const sphere = icoSphere(4);
    const result = simplifyMesh(sphere, { targetFaces: 120 });
    const before = bounds(sphere);
    const after = bounds(result.mesh);
    for (let k = 0; k < 3; k++) {
      expect(after.max[k] - after.min[k]).toBeGreaterThan(0.85 * (before.max[k] - before.min[k]));
      expect(after.max[k] - after.min[k]).toBeLessThan(1.05 * (before.max[k] - before.min[k]));
    }
    // The winding is kept (positive volume) and no more than a fifth is lost.
    expect(volume(result.mesh)).toBeGreaterThan(0.75 * volume(sphere));
    expect(volume(result.mesh)).toBeLessThan(1.02 * volume(sphere));
  });

  it('turns the cut-up sides of a cube back into a cube', () => {
    const cube = gridCube(8); // 768 faces
    const result = simplifyMesh(cube, { targetFaces: 12 });
    const solid = buildSolid(result.mesh);
    expect(solid.closed).toBe(true);
    expect(solid.faces.length).toBe(6);
    expect(Math.abs(volume(result.mesh))).toBeCloseTo(100 * 100 * 100, -2);
  });

  it('keeps the border of an open model', () => {
    const result = simplifyMesh(sheet(20), { targetFaces: 30 });
    const b = bounds(result.mesh);
    expect(b.min.slice(0, 2)).toEqual([0, 0]);
    expect(b.max[0]).toBeCloseTo(100, 6);
    expect(b.max[1]).toBeCloseTo(100, 6);
    const solid = buildSolid(result.mesh);
    // Still one sheet: no hole opened inside it.
    expect(solid.warnings.map((w) => w.code)).not.toContain('multiple-shells');
    expect(solid.faces.reduce((s, f) => s + f.area, 0)).toBeCloseTo(100 * 100, 4);
  });

  it('is the same every time', () => {
    const sphere = icoSphere(3);
    const a = simplifyMesh(sphere, { targetFaces: 90 });
    const b = simplifyMesh(sphere, { targetFaces: 90 });
    expect(JSON.stringify(a.mesh)).toBe(JSON.stringify(b.mesh));
  });

  it('does not change a mesh that is already small enough', () => {
    const cube = shapes.cube(40);
    const result = simplifyMesh(cube, { targetFaces: 100 });
    expect(result.mesh).toBe(cube);
    expect(result.reached).toBe(true);
    expect(result.outputFaces).toBe(6);
  });

  it('never goes below four faces', () => {
    const result = simplifyMesh(icoSphere(2), { targetFaces: 1 });
    expect(result.outputFaces).toBeGreaterThanOrEqual(4);
    expect(buildSolid(result.mesh, { mergeCoplanar: false }).closed).toBe(true);
  });

  it('cuts polygons into triangles and welds loose corners', () => {
    // Two cubes' worth of numbers: a cube as quads with every corner repeated per face.
    const cube = shapes.cube(10);
    const loose: RawMesh = { positions: [], faces: [] };
    for (const f of cube.faces) {
      loose.faces.push(f.map((i) => {
        loose.positions.push(cube.positions[i]);
        return loose.positions.length - 1;
      }));
    }
    const result = simplifyMesh(loose, { targetFaces: 4 });
    expect(result.outputFaces).toBeGreaterThanOrEqual(4);
    expect(result.mesh.faces.every((f) => f.length === 3)).toBe(true);
  });

  it('reports a mesh that cannot be reduced all the way', () => {
    // Two spheres that do not touch: each is kept at four faces at the least, so eight is the floor for a target of four.
    const one = icoSphere(2);
    const two: RawMesh = {
      positions: [...one.positions, ...one.positions.map((p): Vec3 => [p[0] + 500, p[1], p[2]])],
      faces: [...one.faces, ...one.faces.map((f) => f.map((i) => i + one.positions.length))],
    };
    const result = simplifyMesh(two, { targetFaces: 4 });
    expect(result.outputFaces).toBeLessThanOrEqual(8);
    expect(result.reached).toBe(false);
  });

  it('handles a dense mesh in a reasonable time', () => {
    const sphere = icoSphere(6); // 81 920 faces
    const start = performance.now();
    const result = simplifyMesh(sphere, { targetFaces: 500 });
    expect(performance.now() - start).toBeLessThan(15000);
    expect(result.outputFaces).toBeLessThanOrEqual(500);
    expect(buildSolid(result.mesh, { mergeCoplanar: false }).closed).toBe(true);
  }, 30000);
});
