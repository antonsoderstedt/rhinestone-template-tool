import { describe, expect, it } from 'vitest';
import {
  buildParts,
  buildPattern,
  buildSolid,
  clampPart,
  createPapercraft,
  defaultPart,
  findTemplate,
  longestSide,
  meshOfRecipe,
  PARAMETRIC_TEMPLATES,
  PART_KINDS,
  PART_LIMITS,
  partMesh,
  partsOfRecipe,
  recipeOfTemplate,
  templateValues,
  type BuildPart,
  type Solid,
} from '../src/lib/papercraft-engine';

const volume = (s: Solid) => {
  let v = 0;
  for (const f of s.faces) for (let k = 1; k + 1 < f.vertices.length; k++) {
    const [a, b, c] = [f.vertices[0]!, f.vertices[k]!, f.vertices[k + 1]!].map((i) => s.vertices[i]!);
    v += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return v;
};
const part = (kind: BuildPart['kind'], over: Partial<BuildPart> = {}): BuildPart => ({ ...defaultPart(kind), ...over });

describe('parts', () => {
  it('every kind is a closed solid with outward faces (positive volume)', () => {
    for (const kind of PART_KINDS) {
      const solid = buildSolid(partMesh(part(kind)));
      expect(solid.closed, kind).toBe(true);
      expect(volume(solid), kind).toBeGreaterThan(0);
    }
  });

  it('a box is as wide, deep and high as asked, and a cylinder is as wide as its diameter', () => {
    const box = partMesh(part('box', { width: 30, depth: 20, height: 10 }));
    const xs = box.positions.map((p) => p[0]);
    const ys = box.positions.map((p) => p[1]);
    const zs = box.positions.map((p) => p[2]);
    expect([Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), Math.max(...zs) - Math.min(...zs)].map((n) => Math.round(n * 1e6) / 1e6)).toEqual([30, 20, 10]);
    const cyl = partMesh(part('cylinder', { width: 50, depth: 50, sides: 16, height: 5 }));
    expect(Math.max(...cyl.positions.map((p) => p[0]))).toBeCloseTo(25, 6);
  });

  it('a box has six faces, a cone sides + 1, a frustum sides + 2', () => {
    expect(partMesh(part('box')).faces).toHaveLength(6);
    expect(partMesh(part('cone', { sides: 9 })).faces).toHaveLength(10);
    expect(partMesh(part('frustum', { sides: 7 })).faces).toHaveLength(9);
  });

  it('an open end leaves out that lid; a tube open at both ends has only its sides', () => {
    expect(partMesh(part('cylinder', { sides: 8, open: 'top' })).faces).toHaveLength(9);
    expect(partMesh(part('cylinder', { sides: 8, open: 'bottom' })).faces).toHaveLength(9);
    expect(partMesh(part('cylinder', { sides: 8, open: 'both' })).faces).toHaveLength(8);
    const solid = buildSolid(partMesh(part('cylinder', { sides: 8, open: 'top' })));
    expect(solid.closed).toBe(false);
    expect(solid.warnings.some((w) => w.code === 'open-edges')).toBe(true);
  });

  it('puts a part where it is placed and turns it about its base centre', () => {
    const moved = partMesh(part('box', { x: 100, y: -50, z: 7 }));
    expect(Math.min(...moved.positions.map((p) => p[2]))).toBeCloseTo(7, 9);
    expect(moved.positions.reduce((s, p) => s + p[0], 0) / moved.positions.length).toBeCloseTo(100, 9);
    const lying = partMesh(part('box', { width: 10, depth: 10, height: 40, rotX: 90 }));
    // Turned onto its side: it is now 40 long in y (or -y) and 10 high.
    const ys = lying.positions.map((p) => p[1]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(40, 6);
    expect(Math.max(...lying.positions.map((p) => p[2]))).toBeCloseTo(5, 6);
  });

  it('brings numbers into range and replaces a number that is not one', () => {
    const odd = clampPart({ ...part('cylinder'), width: -5, height: 99999, sides: 1, topPct: NaN, x: Infinity, rotZ: 1e9 });
    expect(odd.width).toBe(PART_LIMITS.size.min);
    expect(odd.height).toBe(PART_LIMITS.size.max);
    expect(odd.sides).toBe(PART_LIMITS.sides.min);
    expect(odd.topPct).toBe(50);
    expect(odd.x).toBe(0);
    expect(odd.rotZ).toBe(PART_LIMITS.angle.max);
    expect(clampPart({ ...part('pyramid'), sides: 30 }).sides).toBe(PART_LIMITS.pyramidSides.max);
    expect(clampPart({ ...part('box'), sides: 9 }).sides).toBe(4);
  });

  it('puts the parts in one mesh, each a separate shell, and uses at most the limit', () => {
    const two = buildParts([part('box'), part('cone', { z: 40 })]);
    expect(two.faces).toHaveLength(6 + 13);
    expect(Math.max(...two.faces.flat())).toBe(two.positions.length - 1);
    const many = buildParts(Array.from({ length: 60 }, () => part('box')));
    expect(many.faces).toHaveLength(PART_LIMITS.parts * 6);
  });

  it('gives the same mesh every time', () => {
    const parts = [part('frustum', { rotX: 13, rotY: 7, x: 3 }), part('cone', { sides: 5 })];
    expect(JSON.stringify(buildParts(parts))).toBe(JSON.stringify(buildParts(parts)));
  });
});

describe('parametric templates', () => {
  it('each one builds from its defaults and from its extremes, and unfolds into parts that fit an A4 page', () => {
    for (const template of PARAMETRIC_TEMPLATES) {
      const sets = [
        templateValues(template),
        Object.fromEntries(template.params.map((p) => [p.key, p.min])),
        Object.fromEntries(template.params.map((p) => [p.key, p.max])),
      ];
      for (const values of sets) {
        const parts = template.parts(values);
        expect(parts.length, template.id).toBeGreaterThan(0);
        const mesh = buildParts(parts);
        expect(mesh.faces.length, template.id).toBeGreaterThan(0);
        expect(mesh.positions.every((p) => p.every(Number.isFinite)), template.id).toBe(true);
      }
      const run = createPapercraft({ mesh: meshOfRecipe(recipeOfTemplate(template.id)!)!, scale: { by: 'largest', mm: 100 }, page: { pageWidthMm: 210, pageHeightMm: 297, marginMm: 10, gapMm: 3 } });
      expect(run.pattern.parts.length, template.id).toBeGreaterThan(0);
      expect(run.pattern.warnings.filter((w) => w.code === 'part-too-large'), template.id).toEqual([]);
    }
  });

  it('a box with a lid is two shells, and the lid is wider than the box', () => {
    const t = findTemplate('box-with-lid')!;
    const parts = t.parts({ width: 100, depth: 70, height: 50, lid: 15 });
    expect(parts).toHaveLength(2);
    expect(parts[1]!.width).toBeGreaterThan(parts[0]!.width);
    expect(parts[1]!.z).toBe(50);
  });

  it('the tiers of a cake get narrower and stand on each other', () => {
    const parts = findTemplate('cake')!.parts({ diameter: 120, tier: 30, tiers: 3, shrink: 25 });
    expect(parts.map((p) => p.width)).toEqual([120, 90, 67.5]);
    expect(parts.map((p) => p.z)).toEqual([0, 30, 60]);
    expect(parts.map((p) => p.open)).toEqual(['top', 'both', 'bottom']);
  });

  it('values out of range or missing are brought back, and counts are whole', () => {
    const t = findTemplate('pencil-cup')!;
    expect(templateValues(t, { diameter: 5, height: 1e9, sides: 7.6 })).toEqual({ diameter: 30, height: 300, sides: 8 });
    expect(templateValues(t, { diameter: NaN })).toMatchObject({ diameter: 80 });
  });

  it('every template has a name, a description, a label and a tip for each value', () => {
    for (const t of PARAMETRIC_TEMPLATES) {
      expect(t.name && t.description).toBeTruthy();
      for (const p of t.params) {
        expect(p.label && p.tip, `${t.id}.${p.key}`).toBeTruthy();
        expect(p.value).toBeGreaterThanOrEqual(p.min);
        expect(p.value).toBeLessThanOrEqual(p.max);
      }
    }
  });
});

describe('recipes', () => {
  it('a recipe of parts and a recipe of a template both give a mesh; an unknown template gives none', () => {
    expect(meshOfRecipe({ kind: 'parts', parts: [part('box')] })?.faces).toHaveLength(6);
    expect(meshOfRecipe(recipeOfTemplate('house')!)?.faces.length).toBeGreaterThan(6);
    expect(meshOfRecipe({ kind: 'parametric', templateId: 'nope', values: {} })).toBeNull();
    expect(meshOfRecipe({ kind: 'parts', parts: [] })).toBeNull();
    expect(recipeOfTemplate('nope')).toBeNull();
  });

  it('a recipe from outside is cleaned up before it is built', () => {
    const parts = partsOfRecipe({ kind: 'parts', parts: [{ ...part('box'), width: 1e9 }] })!;
    expect(parts[0]!.width).toBe(PART_LIMITS.size.max);
  });

  it('the longest side of a mesh', () => {
    expect(longestSide(partMesh(part('box', { width: 30, depth: 20, height: 70 })))).toBeCloseTo(70, 6);
    expect(longestSide({ positions: [], faces: [] })).toBe(0);
  });
});

describe('a built model goes through the whole pipeline', () => {
  it('an open tube is unfolded without losing a face', () => {
    const solid = buildSolid(partMesh(part('cylinder', { sides: 10, open: 'top' })));
    const pattern = buildPattern(solid, {});
    expect(pattern.parts.length).toBeGreaterThan(0);
  });
});
