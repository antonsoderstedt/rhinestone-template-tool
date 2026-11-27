import { describe, expect, it } from 'vitest';
import { PART_FACES, PART_LIMITS, defaultPart, moveBuildPart, partAxes, partFaceCentre, partMesh, resizeBuildPart, turnBuildPart, type BuildPart } from '../src/lib/papercraft-engine';
import { axisParameter, dragDelta, dragPlane, modelToScene, rayPlaneHit, sceneToModel } from '../app/papercraft/partsDrag';

const part = (over: Partial<BuildPart> = {}): BuildPart => ({ ...defaultPart('box'), ...over });

describe('moving and turning parts', () => {
  it('moves one part and leaves the others, rounding its place to the grid', () => {
    const parts = [part({ x: 1, y: 2, z: 3 }), part({ x: 50 })];
    const moved = moveBuildPart(parts, 0, { dx: 10.4, dy: -3.1, dz: 0.2 }, 5);
    expect(moved[0]).toMatchObject({ x: 10, y: 0, z: 5 });
    expect(moved[1]).toBe(parts[1]);
    expect(moveBuildPart(parts, 0, { dx: 10.4, dy: 0, dz: 0 }, 0)[0]!.x).toBeCloseTo(11.4, 9);
  });

  it('keeps a part in range and ignores a part that is not there or numbers that are not numbers', () => {
    const parts = [part()];
    expect(moveBuildPart(parts, 0, { dx: 1e9, dy: 0, dz: 0 })[0]!.x).toBe(2000);
    expect(moveBuildPart(parts, 3, { dx: 5, dy: 5, dz: 5 })).toBe(parts);
    expect(moveBuildPart(parts, 0, { dx: NaN, dy: Infinity, dz: 0 })[0]).toMatchObject({ x: 0, y: 0, z: 0 });
  });

  it('turns a part about an axis and keeps the angle between -180 and 180', () => {
    const parts = [part({ rotZ: 170 })];
    expect(turnBuildPart(parts, 0, 'z', 30)[0]!.rotZ).toBe(-160);
    expect(turnBuildPart(parts, 0, 'x', -15)[0]!.rotX).toBe(-15);
    expect(turnBuildPart(parts, 5, 'z', 30)).toBe(parts);
    expect(turnBuildPart(parts, 0, 'z', NaN)).toBe(parts);
  });
});

describe('dragging a part in the 3D view', () => {
  it('model and scene coordinates turn into each other', () => {
    expect(modelToScene([1, 2, 3])).toEqual([1, 3, -2]);
    expect(sceneToModel(modelToScene([4, -5, 6]))).toEqual([4, -5, 6]);
  });

  it('a ray from above meets the ground plane at the height of the part', () => {
    const plane = dragPlane('ground', [10, 20, 30], [0, -1, 0])!;
    const hit = rayPlaneHit([5, 100, -7], [0, -1, 0], plane)!;
    expect(hit).toEqual([5, 30, -7]);
    expect(rayPlaneHit([5, 100, -7], [1, 0, 0], plane)).toBeNull();
    expect(rayPlaneHit([5, 10, -7], [0, 1, 0], { ...plane, point: [0, 5, 0] })).toBeNull();
  });

  it('dragging on the ground gives a move in x and y only; the model y is the scene -z', () => {
    const plane = dragPlane('ground', [0, 0, 0], [0, -1, 0])!;
    const a = rayPlaneHit([0, 50, 0], [0, -1, 0], plane)!;
    const b = rayPlaneHit([12, 50, -7], [0, -1, 0], plane)!;
    expect(dragDelta('ground', a, b)).toEqual({ dx: 12, dy: 7, dz: 0 });
  });

  it('lifting uses a plane that faces the camera and gives a move in z only', () => {
    const dir: [number, number, number] = [0, -0.5, -1];
    const plane = dragPlane('lift', [0, 0, 10], dir)!;
    expect(plane.normal[1]).toBe(0);
    expect(Math.hypot(plane.normal[0], plane.normal[2])).toBeCloseTo(1, 9);
    const a = rayPlaneHit([0, 100, 100], [0, -0.3, -1], plane)!;
    const b = rayPlaneHit([0, 100, 100], [0, -0.2, -1], plane)!;
    const d = dragDelta('lift', a, b);
    expect(d.dx).toBe(0);
    expect(d.dy).toBe(0);
    expect(d.dz).toBeGreaterThan(0);
  });

  it('a camera that looks straight down cannot lift', () => {
    expect(dragPlane('lift', [0, 0, 0], [0, -1, 0])).toBeNull();
  });
});

describe('resizing a part by one of its faces', () => {
  const box = (over: Partial<BuildPart> = {}): BuildPart => ({ ...defaultPart('box'), width: 40, depth: 20, height: 10, ...over });

  it('moves a side face out and keeps the opposite face where it was (the centre moves by half)', () => {
    const [moved] = resizeBuildPart([box()], 0, 'x+', 10);
    expect(moved).toMatchObject({ width: 50, depth: 20, height: 10, x: 5, y: 0, z: 0 });
    const [other] = resizeBuildPart([box()], 0, 'y-', 6);
    expect(other).toMatchObject({ depth: 26, y: -3, width: 40 });
    // the face that stayed is still in the same place: x- was at -20, it is at 5 - 50 / 2 = -20
    expect(moved!.x - moved!.width / 2).toBeCloseTo(-20, 9);
  });

  it('moves the top without moving the base, and the bottom by its whole distance', () => {
    expect(resizeBuildPart([box({ z: 7 })], 0, 'z+', 12)[0]).toMatchObject({ height: 22, z: 7 });
    expect(resizeBuildPart([box({ z: 7 })], 0, 'z-', 4)[0]).toMatchObject({ height: 14, z: 3 });
  });

  it('shrinks a part when a face is moved in, and a size does not go under the smallest', () => {
    expect(resizeBuildPart([box()], 0, 'x-', -10)[0]).toMatchObject({ width: 30, x: 5 });
    const tiny = resizeBuildPart([box()], 0, 'x+', -1000)[0]!;
    expect(tiny.width).toBe(PART_LIMITS.size.min);
    // the opposite face stays: -20 before, so the centre is -20 + 0.5
    expect(tiny.x).toBeCloseTo(-20 + PART_LIMITS.size.min / 2, 9);
  });

  it('stops at the largest size and moves the centre only by what the face really moved', () => {
    const big = resizeBuildPart([box({ width: 990 })], 0, 'x+', 100)[0]!;
    expect(big.width).toBe(PART_LIMITS.size.max);
    expect(big.x).toBeCloseTo(5, 9);
  });

  it('rounds the new size to the grid', () => {
    expect(resizeBuildPart([box()], 0, 'x+', 10.4, 5)[0]!.width).toBe(50);
    expect(resizeBuildPart([box()], 0, 'x+', 10.4, 0)[0]!.width).toBeCloseTo(50.4, 9);
  });

  it('grows along the part’s own axis when the part is turned', () => {
    const turned = box({ rotZ: 90 });
    const [moved] = resizeBuildPart([turned], 0, 'x+', 10);
    // turned a quarter about z, the part's x axis points along the model's y
    expect(moved!.x).toBeCloseTo(0, 9);
    expect(moved!.y).toBeCloseTo(5, 9);
    // and the handle of that face is at the new face
    expect(partFaceCentre(moved!, 'x+')[1]).toBeCloseTo(30, 9);
    expect(partFaceCentre(moved!, 'x-')[1]).toBeCloseTo(-20, 9);
  });

  it('leaves the list alone for a part that is not there, a number that is not a number or a face that does not exist', () => {
    const parts = [box()];
    expect(resizeBuildPart(parts, 4, 'x+', 5)).toBe(parts);
    expect(resizeBuildPart(parts, 0, 'x+', NaN)).toBe(parts);
    expect(resizeBuildPart(parts, 0, 'w+' as never, 5)).toBe(parts);
  });

  it('does not touch the other parts', () => {
    const parts = [box(), box({ x: 100 })];
    const next = resizeBuildPart(parts, 0, 'z+', 5);
    expect(next[1]).toBe(parts[1]);
  });
});

describe('the places of the handles', () => {
  it('are the middle of each face, turned and moved with the part', () => {
    const p = { ...defaultPart('box'), width: 40, depth: 20, height: 10, x: 100, y: 50, z: 5 };
    expect(partFaceCentre(p, 'x+')).toEqual([120, 50, 10]);
    expect(partFaceCentre(p, 'y-')).toEqual([100, 40, 10]);
    expect(partFaceCentre(p, 'z+')).toEqual([100, 50, 15]);
    expect(partFaceCentre(p, 'z-')).toEqual([100, 50, 5]);
    expect(partAxes(p)).toEqual({ x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] });
    const a = partAxes({ ...p, rotZ: 90 });
    expect(a.x[0]).toBeCloseTo(0, 9);
    expect(a.x[1]).toBeCloseTo(1, 9);
  });

  it('are on the slope of a side that slopes in', () => {
    const cone = { ...defaultPart('cone'), width: 40, depth: 40, height: 50 };
    expect(partFaceCentre(cone, 'x+')).toEqual([10, 0, 25]); // half way up a cone that is 20 out at its base
    const frustum = { ...defaultPart('frustum'), width: 40, depth: 40, height: 20, topPct: 50 };
    expect(partFaceCentre(frustum, 'x+')[0]).toBeCloseTo(15, 9); // 20 at the base, 10 at the top
  });

  it('are on the faces of the mesh: every face handle lies on the part’s bounding box', () => {
    for (const kind of ['box', 'cylinder', 'frustum'] as const) {
      const p = { ...defaultPart(kind), width: 30, depth: 20, height: 12, rotX: 20, rotY: -30, rotZ: 45, x: 10, y: -5, z: 3 };
      const mesh = partMesh(p);
      const lo = [Infinity, Infinity, Infinity];
      const hi = [-Infinity, -Infinity, -Infinity];
      for (const v of mesh.positions) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k]!, v[k]!); hi[k] = Math.max(hi[k]!, v[k]!); }
      for (const face of PART_FACES) {
        const c = partFaceCentre(p, face);
        for (let k = 0; k < 3; k++) { expect(c[k]!).toBeGreaterThanOrEqual(lo[k]! - 1e-6); expect(c[k]!).toBeLessThanOrEqual(hi[k]! + 1e-6); }
      }
    }
  });
});

describe('dragging a handle along its axis', () => {
  it('measures how far a ray points along a line, from the line’s point', () => {
    // the line runs along x from (10, 0, 0); a ray from above points down at x = 25
    expect(axisParameter([25, 100, 3], [0, -1, 0], [10, 0, 0], [1, 0, 0])).toBeCloseTo(15, 9);
    // a ray at x = 4 is behind the point
    expect(axisParameter([4, 100, 3], [0, -1, 0], [10, 0, 0], [1, 0, 0])).toBeCloseTo(-6, 9);
  });

  it('works for a slanted ray and an axis that points the other way', () => {
    const s = axisParameter([0, 50, 0], [1, -1, 0], [0, 0, 0], [-1, 0, 0]);
    // the ray reaches the ground at x = 50, which is 50 away along -x measured in the direction (-1, 0, 0): -50
    expect(s).toBeCloseTo(-50, 9);
  });

  it('has nothing to say for a ray that runs along the line', () => {
    expect(axisParameter([0, 0, 5], [1, 0, 0], [0, 0, 0], [1, 0, 0])).toBeNull();
  });
});
