import { describe, expect, it } from 'vitest';
import { applyMat4, buildFoldTree, buildPattern, buildSolid, extrudeFaces, foldPoses, ringSweep, scaleMesh, shapes, unfold } from '../src/lib/papercraft-engine';
import type { RawMesh, Solid, Vec2, Vec3 } from '../src/lib/papercraft-engine';
import { convexOverlap, triangulate } from '../src/lib/papercraft-engine/geometry/polygon';
import { BUILT_IN_MODELS } from '../app/papercraft/papercraftModels';

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
const euler = (s: Solid) => s.vertices.length - s.edges.length + s.faces.length;
const PAGE = { widthMm: 190, heightMm: 277 };

// shapes.cube(10): face 1 is the top, [4, 5, 6, 7].
const TOP = 1;

describe('growing a limb out of a face', () => {
  it('replaces a face with a tube: one closed solid, the face gone, a wall per side and a cap', () => {
    const mesh = extrudeFaces(shapes.cube(10), [{ face: TOP, steps: [{ by: [0, 0, 10], scale: 0.5 }] }]);
    expect(mesh.faces).toHaveLength(6 - 1 + 4 + 1);
    const solid = buildSolid(mesh);
    expect(solid.warnings).toEqual([]);
    expect(solid.closed).toBe(true);
    expect(euler(solid)).toBe(2);
    // A cube of 10 with a frustum on top: height 10, base 10 x 10, top 5 x 5.
    expect(volume(solid)).toBeCloseTo(1000 + (10 / 3) * (100 + 25 + 50), 6);
  });

  it('puts the new ring where it is asked: moved from the centre of the ring before it, and scaled about its own centre', () => {
    const mesh = extrudeFaces(shapes.cube(10), [{ face: TOP, steps: [{ by: [2, 0, 6], scale: 0.4 }] }]);
    const added = mesh.positions.slice(8);
    expect(added).toHaveLength(4);
    for (const [x, y, z] of added) {
      expect(z).toBeCloseTo(5 + 6, 9);
      expect(Math.abs(x - 2)).toBeCloseTo(2, 9);
      expect(Math.abs(y)).toBeCloseTo(2, 9);
    }
  });

  it('keeps every wall flat (no face has to be split) even with several steps that bend and shrink', () => {
    const mesh = extrudeFaces(shapes.cube(10), [
      { face: TOP, steps: [{ by: [3, 0, 5], scale: 0.8 }, { by: [-4, 2, 5], scale: 0.7 }, { by: [0, 0, 4], scale: 0.5 }] },
    ]);
    const solid = buildSolid(mesh);
    expect(solid.warnings).toEqual([]);
    expect(solid.closed).toBe(true);
    expect(euler(solid)).toBe(2);
  });

  it('grows several limbs at once from faces that do not touch (two opposite faces of a cube)', () => {
    const mesh = extrudeFaces(shapes.cube(10), [
      { face: 0, steps: [{ by: [0, 0, -6], scale: 0.5 }] },
      { face: TOP, steps: [{ by: [0, 0, 6], scale: 0.5 }] },
    ]);
    const solid = buildSolid(mesh);
    expect(solid.closed).toBe(true);
    expect(euler(solid)).toBe(2);
    expect(solid.faces).toHaveLength(4 + 2 * 5);
  });

  it('does not change the mesh it is given and is deterministic', () => {
    const cube = shapes.cube(10);
    const before = JSON.stringify(cube);
    const ops = [{ face: TOP, steps: [{ by: [1, 2, 3] as Vec3, scale: 0.7 }] }];
    const a = extrudeFaces(cube, ops);
    expect(JSON.stringify(cube)).toBe(before);
    expect(JSON.stringify(extrudeFaces(cube, ops))).toBe(JSON.stringify(a));
  });

  it('refuses what cannot be built: a missing face, no steps, a scale of 0, one face twice, two faces that touch', () => {
    const cube = shapes.cube(10);
    expect(() => extrudeFaces(cube, [{ face: 6, steps: [{ by: [0, 0, 1] }] }])).toThrow(RangeError);
    expect(() => extrudeFaces(cube, [{ face: -1, steps: [{ by: [0, 0, 1] }] }])).toThrow(RangeError);
    expect(() => extrudeFaces(cube, [{ face: TOP, steps: [] }])).toThrow(RangeError);
    expect(() => extrudeFaces(cube, [{ face: TOP, steps: [{ by: [0, 0, 1], scale: 0 }] }])).toThrow(RangeError);
    expect(() => extrudeFaces(cube, [{ face: TOP, steps: [{ by: [0, 0, 1] }] }, { face: TOP, steps: [{ by: [0, 0, 1] }] }])).toThrow(RangeError);
    // The top and a side share an edge.
    expect(() => extrudeFaces(cube, [{ face: TOP, steps: [{ by: [0, 0, 1] }] }, { face: 2, steps: [{ by: [0, -1, 0] }] }])).toThrow(/touch/);
  });
});

describe('a body along a curve (ringSweep)', () => {
  const PROFILE = [[1, -1], [1, 1], [-1, 1], [-1, -1]] as const;
  const LEVEL = [{ x: 0, z: 0, width: 5, height: 5 }, { x: 10, z: 0, width: 5, height: 5 }, { x: 20, z: 0, width: 5, height: 5 }];

  it('gives a closed body with a flat face at each end, and finds the flat face between two sections', () => {
    const body = ringSweep(LEVEL, PROFILE);
    const solid = buildSolid(body.mesh);
    expect(solid.warnings).toEqual([]);
    expect(solid.closed).toBe(true);
    expect(volume(solid)).toBeCloseTo(10 * 10 * 20, 6);
    expect(body.mesh.faces[body.startCap]).toHaveLength(4);
    expect(body.mesh.faces[body.endCap]).toHaveLength(4);
    for (let p = 0; p < 2; p++) for (let i = 0; i < 4; i++) expect(body.quad(p, i)).toBeDefined();
  });

  it('keeps a face that is not flat as two triangles (no quad to grow a limb out of)', () => {
    const diamond = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
    const body = ringSweep([{ x: 0, z: 0, width: 5, height: 5 }, { x: 10, z: 0, width: 8, height: 3 }], diamond);
    expect(body.quad(0, 0)).toBeUndefined();
    expect(buildSolid(body.mesh).closed).toBe(true);
    // A rectangle has flat faces whatever the sizes: its two edges are parallel.
    expect(ringSweep([{ x: 0, z: 0, width: 5, height: 5 }, { x: 10, z: 0, width: 8, height: 3 }], PROFILE).quad(0, 0)).toBeDefined();
  });

  it('lets a section be a box where the others have more corners: corners that are the same point count once', () => {
    const eight = [[0.9, -1], [1, 0.2], [0.55, 1], [-0.55, 1], [-1, 0.2], [-0.9, -1], [-0.3, -1], [0.3, -1]] as const;
    const box = [[1, -1], [1, 1], [1, 1], [-1, 1], [-1, 1], [-1, -1], [-1, -1], [1, -1]] as const;
    const body = ringSweep([{ x: 0, z: 0, width: 3, height: 4, profile: box }, { x: 10, z: 0, width: 8, height: 8 }, { x: 20, z: 0, width: 8, height: 8 }], eight);
    expect(body.mesh.faces[body.startCap]).toHaveLength(4);
    const solid = buildSolid(body.mesh);
    expect(solid.warnings).toEqual([]);
    expect(solid.closed).toBe(true);
    expect(euler(solid)).toBe(2);
  });

  it('follows the curve: sections that climb tilt, and a section given a tilt keeps it', () => {
    const climbing = ringSweep([{ x: 0, z: 0, width: 4, height: 4 }, { x: 10, z: 10, width: 4, height: 4 }, { x: 20, z: 20, width: 4, height: 4 }], PROFILE);
    // The middle ring stands across a line at 45 degrees: its corners are not at one x.
    const xs = climbing.rings[1].map((id) => climbing.mesh.positions[id][0]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(5);
    const level = ringSweep([{ x: 0, z: 0, width: 4, height: 4 }, { x: 10, z: 10, width: 4, height: 4, tilt: 0 }, { x: 20, z: 20, width: 4, height: 4 }], PROFILE);
    const xs2 = level.rings[1].map((id) => level.mesh.positions[id][0]);
    expect(Math.max(...xs2) - Math.min(...xs2)).toBeCloseTo(0, 9);
  });

  it('refuses a body it cannot build', () => {
    expect(() => ringSweep([LEVEL[0]], PROFILE)).toThrow(RangeError);
    expect(() => ringSweep(LEVEL, [[0, 0], [1, 0]])).toThrow(RangeError);
    expect(() => ringSweep([{ x: 0, z: 0, width: 0, height: 5 }, LEVEL[1]], PROFILE)).toThrow(RangeError);
  });
});

const FOUR_LEGGED = ['dog', 'cat', 'pig', 'horse', 'elephant', 'giraffe'] as const;
const BIRDS = ['duck', 'chicken', 'flamingo'] as const;
const UPRIGHT = ['penguin', 'owl'] as const;
const HORNED = ['unicorn', 'deer', 'lion', 'rhino', 'bull'] as const;
const ANIMALS = [...FOUR_LEGGED, ...BIRDS, ...UPRIGHT, ...HORNED] as const;
const meshOf = (id: (typeof ANIMALS)[number]): RawMesh => shapes[id]();
const atDefaultSize = (id: (typeof ANIMALS)[number]): Solid => {
  const model = BUILT_IN_MODELS.find((m) => m.id === id)!;
  return buildSolid(scaleMesh(model.mesh(), { by: 'largest', mm: model.defaultSizeMm }));
};

describe.each(ANIMALS)('the %s', (id) => {
  const solid = buildSolid(meshOf(id));

  it('is one closed solid with nothing to warn about: the legs, ears, tail and nose are joined to the body', () => {
    expect(solid.warnings).toEqual([]);
    expect(solid.closed).toBe(true);
    expect(euler(solid)).toBe(2);
    expect(volume(solid)).toBeGreaterThan(0);
  });

  it.skipIf((UPRIGHT as readonly string[]).includes(id))('stands on flat feet: the lowest points are the corners of the feet (four feet, or two for a bird), all on the ground', () => {
    const low = Math.min(...solid.vertices.map((v) => v[2]));
    expect(low).toBeCloseTo(0, 9);
    const feet = solid.vertices.filter((v) => Math.abs(v[2]) < 1e-6);
    const bird = (BIRDS as readonly string[]).includes(id);
    expect(feet).toHaveLength(bird ? 8 : 16);
    // One group in each corner under the body (a bird has one on each side).
    const middle = (Math.min(...feet.map((f) => f[0])) + Math.max(...feet.map((f) => f[0]))) / 2;
    const groups = new Set(feet.map((v) => `${bird ? true : v[0] < middle}${v[1] > 0}`));
    expect(groups.size).toBe(bird ? 2 : 4);
  });

  it.runIf((UPRIGHT as readonly string[]).includes(id))('stands upright on its flat base: the lowest points are on the ground, the middle of its weight is over the base, it has two feet at the front and is taller than it is deep', () => {
    expect(Math.min(...solid.vertices.map((v) => v[2]))).toBeCloseTo(0, 9);
    const ground = solid.vertices.filter((v) => Math.abs(v[2]) < 1e-6);
    // The base (eight corners) and the front of two feet.
    expect(ground.length).toBeGreaterThanOrEqual(12);
    const xs = ground.map((v) => v[0]);
    const ys = ground.map((v) => v[1]);
    const centre = solid.vertices.reduce((s, v) => [s[0] + v[0] / solid.vertices.length, s[1] + v[1] / solid.vertices.length], [0, 0]);
    expect(centre[0]).toBeGreaterThan(Math.min(...xs));
    expect(centre[0]).toBeLessThan(Math.max(...xs));
    expect(centre[1]).toBeGreaterThan(Math.min(...ys));
    expect(centre[1]).toBeLessThan(Math.max(...ys));
    const size = [0, 1, 2].map((a) => Math.max(...solid.vertices.map((v) => v[a])) - Math.min(...solid.vertices.map((v) => v[a])));
    expect(size[2]).toBeGreaterThan(size[0]);
    // The feet stick out in front of the base: the lowest points reach further forward than the body's front.
    expect(Math.max(...xs)).toBeGreaterThan(Math.max(...solid.vertices.filter((v) => v[2] > 20).map((v) => v[0])) - 1e-6);
  });

  it('is the same on the left and the right', () => {
    const key = (v: Vec3) => `${v[0].toFixed(6)}_${v[1].toFixed(6)}_${v[2].toFixed(6)}`;
    const have = new Set(solid.vertices.map(key));
    for (const v of solid.vertices) expect(have.has(key([v[0], -v[1], v[2]])), key(v)).toBe(true);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(meshOf(id))).toBe(JSON.stringify(meshOf(id)));
  });

  it('is in the list of models, among the animals, with a size that gives edges to glue (none under 2 mm)', () => {
    const model = BUILT_IN_MODELS.find((m) => m.id === id)!;
    expect(model.group).toBe('animals');
    expect(Math.min(...atDefaultSize(id).edges.map((e) => e.length))).toBeGreaterThan(2);
  });

  it('unfolds at its default size with at most one glued edge that has no room for a tab', () => {
    const pattern = buildPattern(atDefaultSize(id), { maxPartSize: PAGE });
    expect(pattern.warnings.find((w) => w.code === 'tab-missing')?.count ?? 0).toBeLessThanOrEqual(1);
    expect(pattern.warnings.find((w) => w.code === 'part-too-large')).toBeUndefined();
  });
});

describe('folds that close by themselves', () => {
  const triangles = (points: readonly Vec2[]): Vec2[][] => triangulate(points).map((t) => t.map((i) => points[i]));

  it('joins a cut edge when its two faces already lie edge to edge in the same part (a box leg on a flat underside)', () => {
    for (const id of ANIMALS) {
      const solid = atDefaultSize(id);
      const r = unfold(solid, { maxPartSize: { widthMm: 174, heightMm: 261 } });
      // Never fewer than a tree; where a box leg meets a flat underside, a few folds close a loop that is flat all the way round.
      expect(r.joined.size, id).toBeGreaterThanOrEqual(solid.faces.length - r.islands.length);
      if (id === 'elephant') expect(r.joined.size).toBeGreaterThan(solid.faces.length - r.islands.length);
      // And nothing that is left cut lies edge to edge in the same part.
      for (const e of solid.edges) {
        if (r.joined.has(e.id) || e.faces.length !== 2) continue;
        const [fa, fb] = e.faces;
        if (r.islandOf[fa] !== r.islandOf[fb]) continue;
        const at = (f: number, v: number) => r.placed[f][solid.faces[f].vertices.indexOf(v)];
        const together = [e.a, e.b].every((v) => Math.hypot(at(fa, v)[0] - at(fb, v)[0], at(fa, v)[1] - at(fb, v)[1]) < 1e-6);
        expect(together, `${id} edge ${e.id}`).toBe(false);
      }
    }
  });

  it('changes nothing for a model that has no such corner: the joined edges are still faces minus parts', () => {
    for (const mesh of [shapes.cube(50), shapes.icosahedron(40), shapes.bottle(), shapes.swan(), shapes.house()]) {
      const solid = buildSolid(mesh);
      const r = unfold(solid);
      expect(r.joined.size).toBe(solid.faces.length - r.islands.length);
    }
  });

  it('keeps every part free of overlaps after the extra folds', () => {
    const solid = atDefaultSize('elephant');
    const r = unfold(solid, { maxPartSize: { widthMm: 174, heightMm: 261 } });
    for (const island of r.islands) {
      for (let i = 0; i < island.length; i++) {
        for (let j = i + 1; j < island.length; j++) {
          for (const a of triangles(r.placed[island[i]])) for (const b of triangles(r.placed[island[j]])) expect(convexOverlap(a, b)).toBe(false);
        }
      }
    }
  });

  it('saves the glue tab: the extra folds are fold lines, with no number and no tab', () => {
    const solid = atDefaultSize('elephant');
    const pattern = buildPattern(solid, { maxPartSize: PAGE });
    expect(pattern.joinedEdgeIds.length).toBeGreaterThan(solid.faces.length - pattern.parts.length);
    expect(pattern.stats.foldCount).toBe(pattern.joinedEdgeIds.length);
    const joined = new Set(pattern.joinedEdgeIds);
    for (const part of pattern.parts) {
      for (const t of part.tabs) expect(joined.has(t.edgeId)).toBe(false);
      for (const e of part.edgeSegments) if (joined.has(e.edgeId)) expect(e.state).toBe('joined');
    }
    expect(pattern.edgePairCount).toBe(solid.edges.length - pattern.joinedEdgeIds.length);
  });

  it('can still be cut by hand: a cut the user asks for is kept', () => {
    const solid = atDefaultSize('elephant');
    const plain = unfold(solid, { maxPartSize: { widthMm: 174, heightMm: 261 } });
    const folded = [...plain.joined];
    // Cutting an edge that closed a loop (the last ones added) keeps it cut.
    const extra = folded.filter((id) => {
      const [fa, fb] = solid.edges[id].faces;
      return plain.islandOf[fa] === plain.islandOf[fb];
    });
    const target = extra[extra.length - 1];
    const cut = unfold(solid, { maxPartSize: { widthMm: 174, heightMm: 261 }, forceCutEdges: [target] });
    expect(cut.joined.has(target)).toBe(false);
  });

  it('lets the paper fold up: flat when unfolded (every face of a part has the same direction), and the finished model when folded', () => {
    const solid = atDefaultSize('dog');
    const pattern = buildPattern(solid, { maxPartSize: PAGE });
    const partFaces = pattern.parts.map((p) => p.faces.map((f) => f.faceId));
    const tree = buildFoldTree(solid, pattern.joinedEdgeIds, partFaces);
    const flat = foldPoses(tree, 0);
    const whole = foldPoses(tree, 1);
    // A pose is a rigid move: where it takes the direction of the face.
    const normalOf = (poses: ReturnType<typeof foldPoses>, f: number): Vec3 => {
      const n = solid.faces[f].normal;
      const to = applyMat4(poses[f], n);
      const from = applyMat4(poses[f], [0, 0, 0]);
      return [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
    };
    for (const faces of partFaces) {
      const first = normalOf(flat, faces[0]);
      for (const f of faces) {
        const n = normalOf(flat, f);
        expect(Math.abs(n[0] * first[0] + n[1] * first[1] + n[2] * first[2]), `face ${f}`).toBeCloseTo(1, 6);
      }
    }
    for (const f of solid.faces) {
      const n = normalOf(whole, f.id);
      expect(n[0] * f.normal[0] + n[1] * f.normal[1] + n[2] * f.normal[2]).toBeCloseTo(1, 6);
    }
  });
});

describe('horns, manes and tufts', () => {
  const base = { sections: [[0, 20, 4, 6, 0], [10, 20, 10, 10, 0], [20, 20, 10, 10, 0], [30, 20, 10, 10, 0], [40, 20, 10, 10, 0], [50, 20, 6, 6, 0]], boxRear: true, boxFront: true, legs: [{ pair: 1, steps: [{ fall: 1 }] }, { pair: 3, steps: [{ fall: 1 }] }] } as const;

  it('grows a horn from the flat top, and several limbs when a list is given', () => {
    // Counted before the mesh is cleaned (cleaning merges flat neighbours): a face is replaced by four walls and a cap.
    const plain = shapes.buildAnimal(base);
    const horn = shapes.buildAnimal({ ...base, crest: { pair: 2, steps: [{ by: [0, 0, 8], scale: 0.5 }] } });
    expect(horn.faces.length).toBe(plain.faces.length + 4);
    const two = shapes.buildAnimal({ ...base, crest: [{ pair: 0, steps: [{ by: [0, 0, 6] }] }, { pair: 2, steps: [{ by: [0, 0, 6] }] }] });
    expect(two.faces.length).toBe(plain.faces.length + 8);
    const solid = buildSolid(two);
    expect(solid.closed).toBe(true);
    expect(solid.warnings).toEqual([]);
  });

  it('refuses two limbs on neighbouring faces (they share a corner), and a limb on a face that is not there', () => {
    expect(() => shapes.buildAnimal({ ...base, crest: [{ pair: 1, steps: [{ by: [0, 0, 5] }] }, { pair: 2, steps: [{ by: [0, 0, 5] }] }] })).toThrow(/touch/);
    expect(() => shapes.buildAnimal({ ...base, crest: { pair: 9, steps: [{ by: [0, 0, 5] }] } })).toThrow(RangeError);
  });

  it('a tuft on a tail is a last step that is wider than the step before', () => {
    const lion = buildSolid(shapes.lion());
    const maxX = (s: Solid) => Math.min(...s.vertices.map((v) => v[0]));
    // The tip of the tail is the furthest back point, and it is wider than the tail before it.
    const tip = lion.vertices.filter((v) => v[0] < maxX(lion) + 1e-6);
    const width = Math.max(...tip.map((v) => v[1])) - Math.min(...tip.map((v) => v[1]));
    const before = lion.vertices.filter((v) => v[0] > maxX(lion) + 4 && v[0] < maxX(lion) + 9 && v[2] > 30);
    expect(width).toBeGreaterThan(Math.max(...before.map((v) => v[1])) - Math.min(...before.map((v) => v[1])));
  });
});
