import { describe, expect, it } from 'vitest';
import { defaultPart, moveBuildPart, turnBuildPart, type BuildPart } from '../src/lib/papercraft-engine';
import { dragDelta, dragPlane, modelToScene, rayPlaneHit, sceneToModel } from '../app/papercraft/partsDrag';

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
