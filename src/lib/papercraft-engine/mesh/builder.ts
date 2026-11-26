import type { RawMesh, Vec3 } from '../types';

/**
 * Models built from simple parts: boxes, cylinders, cones, pyramids and frustums, each with a size, a place and a turn, put together into
 * one mesh. The model is z-up (as everywhere in the engine); a part stands on its base, whose centre is at (x, y, z).
 * Parametric templates are ready-made lists of parts whose sizes follow a few numbers (a box with a lid, a house, a tower).
 * Pure and deterministic; sizes are millimetres.
 */

export type PartKind = 'box' | 'cylinder' | 'cone' | 'pyramid' | 'frustum';
export const PART_KINDS: readonly PartKind[] = ['box', 'cylinder', 'cone', 'pyramid', 'frustum'];

/** Which of the flat ends is left out: an open end has no lid, so two parts can be glued together there, or a tube is left open. */
export type PartOpen = 'none' | 'top' | 'bottom' | 'both';
export const PART_OPENS: readonly PartOpen[] = ['none', 'top', 'bottom', 'both'];

export interface BuildPart {
  kind: PartKind;
  /** Size along x and y, and the height (z), before the part is turned. A cylinder or cone is that wide at the base. */
  width: number;
  depth: number;
  height: number;
  /** Sides round a cylinder, cone, pyramid or frustum (a box has four). */
  sides: number;
  /** The top of a frustum as a percentage of its base. */
  topPct: number;
  open: PartOpen;
  /** Where the centre of the base is. */
  x: number;
  y: number;
  z: number;
  /** Turns in degrees about the base centre: first about x, then y, then z. */
  rotX: number;
  rotY: number;
  rotZ: number;
}

export const PART_LIMITS = {
  size: { min: 1, max: 1000 },
  sides: { min: 3, max: 32 },
  pyramidSides: { min: 3, max: 12 },
  topPct: { min: 5, max: 95 },
  position: { min: -2000, max: 2000 },
  angle: { min: -360, max: 360 },
  parts: 40,
} as const;

export function defaultPart(kind: PartKind): BuildPart {
  const base: BuildPart = { kind, width: 40, depth: 40, height: 40, sides: kind === 'pyramid' ? 4 : kind === 'box' ? 4 : 12, topPct: 50, open: 'none', x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0 };
  return kind === 'cone' || kind === 'pyramid' ? { ...base, height: 50 } : base;
}

const finite = (n: number, fallback: number) => (Number.isFinite(n) ? n : fallback);
const clampTo = (n: number, min: number, max: number, fallback: number) => Math.min(max, Math.max(min, finite(n, fallback)));

/** A part with every number in range (a number that is not a number becomes the default), so the mesh of it can always be built. */
export function clampPart(part: BuildPart): BuildPart {
  const kind: PartKind = PART_KINDS.includes(part.kind) ? part.kind : 'box';
  const fallback = defaultPart(kind);
  const l = PART_LIMITS;
  const sidesLimit = kind === 'pyramid' ? l.pyramidSides : l.sides;
  return {
    kind,
    width: clampTo(part.width, l.size.min, l.size.max, fallback.width),
    depth: clampTo(part.depth, l.size.min, l.size.max, fallback.depth),
    height: clampTo(part.height, l.size.min, l.size.max, fallback.height),
    sides: kind === 'box' ? 4 : Math.round(clampTo(part.sides, sidesLimit.min, sidesLimit.max, fallback.sides)),
    topPct: clampTo(part.topPct, l.topPct.min, l.topPct.max, fallback.topPct),
    open: PART_OPENS.includes(part.open) ? part.open : 'none',
    x: clampTo(part.x, l.position.min, l.position.max, 0),
    y: clampTo(part.y, l.position.min, l.position.max, 0),
    z: clampTo(part.z, l.position.min, l.position.max, 0),
    rotX: clampTo(part.rotX, l.angle.min, l.angle.max, 0),
    rotY: clampTo(part.rotY, l.angle.min, l.angle.max, 0),
    rotZ: clampTo(part.rotZ, l.angle.min, l.angle.max, 0),
  };
}

/** The top of the part as a share of its base: 1 for a box or cylinder, 0 for a cone or pyramid (a point), `topPct` for a frustum. */
function topFactor(part: BuildPart): number {
  switch (part.kind) {
    case 'box':
    case 'cylinder': return 1;
    case 'cone':
    case 'pyramid': return 0;
    case 'frustum': return part.topPct / 100;
  }
}

const RAD = Math.PI / 180;

function turn(p: Vec3, rx: number, ry: number, rz: number): Vec3 {
  let [x, y, z] = p;
  if (rx) {
    const c = Math.cos(rx);
    const s = Math.sin(rx);
    [y, z] = [y * c - z * s, y * s + z * c];
  }
  if (ry) {
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    [x, z] = [x * c + z * s, -x * s + z * c];
  }
  if (rz) {
    const c = Math.cos(rz);
    const s = Math.sin(rz);
    [x, y] = [x * c - y * s, x * s + y * c];
  }
  return [x, y, z];
}

/** One part as a mesh: faces counter-clockwise seen from outside, so a part is a solid on its own. */
export function partMesh(input: BuildPart): RawMesh {
  const part = clampPart(input);
  const n = part.sides;
  const f = topFactor(part);
  // A four-sided part is a rectangle with its corners at ±width/2 and ±depth/2; any other count is an ellipse that wide.
  const start = n === 4 ? Math.PI / 4 : 0;
  const reach = n === 4 ? Math.SQRT2 : 1;
  const ring = (factor: number, z: number): Vec3[] =>
    Array.from({ length: n }, (_, i) => {
      const a = start + (2 * Math.PI * i) / n;
      return [(part.width / 2) * reach * Math.cos(a) * factor, (part.depth / 2) * reach * Math.sin(a) * factor, z] as const;
    });

  const local: Vec3[] = [...ring(1, 0)];
  const faces: number[][] = [];
  const pointed = f === 0;
  if (pointed) {
    local.push([0, 0, part.height]);
    for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n]);
  } else {
    local.push(...ring(f, part.height));
    for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n + ((i + 1) % n), n + i]);
    if (part.open !== 'top' && part.open !== 'both') faces.push(Array.from({ length: n }, (_, i) => n + i));
  }
  if (part.open !== 'bottom' && part.open !== 'both') faces.push(Array.from({ length: n }, (_, i) => n - 1 - i));

  const rx = part.rotX * RAD;
  const ry = part.rotY * RAD;
  const rz = part.rotZ * RAD;
  const positions = local.map((p): Vec3 => {
    const q = turn(p, rx, ry, rz);
    return [q[0] + part.x, q[1] + part.y, q[2] + part.z];
  });
  return { positions, faces };
}

/** All the parts in one mesh (the parts stay separate shells; a part is not cut by another). At most `PART_LIMITS.parts` are used. */
export function buildParts(parts: readonly BuildPart[]): RawMesh {
  const positions: Vec3[] = [];
  const faces: number[][] = [];
  for (const part of parts.slice(0, PART_LIMITS.parts)) {
    const m = partMesh(part);
    const offset = positions.length;
    positions.push(...m.positions);
    for (const face of m.faces) faces.push(face.map((i) => i + offset));
  }
  return { positions, faces };
}

// ─── Parametric templates ─────────────────────────────────────────────────────

export interface TemplateParam {
  key: string;
  /** English; the studio translates it. */
  label: string;
  /** What it does, in English. */
  tip: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** A length in millimetres (shown in the person's unit) or a plain count. */
  unit: 'mm' | 'count';
}

export interface ParametricTemplate {
  id: string;
  name: string;
  description: string;
  params: readonly TemplateParam[];
  parts(values: Record<string, number>): BuildPart[];
}

const mm = (key: string, label: string, tip: string, min: number, max: number, value: number): TemplateParam => ({ key, label, tip, min, max, step: 1, value, unit: 'mm' });
const count = (key: string, label: string, tip: string, min: number, max: number, value: number): TemplateParam => ({ key, label, tip, min, max, step: 1, value, unit: 'count' });

const part = (kind: PartKind, over: Partial<BuildPart>): BuildPart => ({ ...defaultPart(kind), ...over });

export const PARAMETRIC_TEMPLATES: readonly ParametricTemplate[] = [
  {
    id: 'box-with-lid',
    name: 'Box with a lid',
    description: 'A box and a lid that sits on it.',
    params: [
      mm('width', 'Width', 'The width of the box.', 20, 400, 100),
      mm('depth', 'Depth', 'The depth of the box.', 20, 400, 70),
      mm('height', 'Height', 'The height of the box without the lid.', 10, 300, 50),
      mm('lid', 'Lid height', 'How far the lid reaches down over the box.', 5, 100, 15),
    ],
    parts: (v) => [
      part('box', { width: v.width, depth: v.depth, height: v.height, open: 'top' }),
      // The lid is a little wider than the box so it fits over it.
      part('box', { width: v.width + 4, depth: v.depth + 4, height: v.lid, open: 'bottom', z: v.height }),
    ],
  },
  {
    id: 'pencil-cup',
    name: 'Pencil cup',
    description: 'An open tube with a bottom.',
    params: [
      mm('diameter', 'Diameter', 'How wide the cup is.', 30, 200, 80),
      mm('height', 'Height', 'How tall the cup is.', 30, 300, 100),
      count('sides', 'Sides', 'How many sides the cup has. More sides are rounder but need more folds.', 3, 24, 8),
    ],
    parts: (v) => [part('cylinder', { width: v.diameter, depth: v.diameter, height: v.height, sides: v.sides, open: 'top' })],
  },
  {
    id: 'house',
    name: 'House',
    description: 'Walls with a pointed roof.',
    params: [
      mm('width', 'Width', 'The width of the house.', 30, 300, 100),
      mm('depth', 'Depth', 'The depth of the house.', 30, 300, 80),
      mm('wall', 'Wall height', 'How tall the walls are.', 20, 300, 60),
      mm('roof', 'Roof height', 'How tall the roof is above the walls.', 10, 200, 45),
    ],
    parts: (v) => [
      part('box', { width: v.width, depth: v.depth, height: v.wall, open: 'top' }),
      part('pyramid', { width: v.width * 1.12, depth: v.depth * 1.12, height: v.roof, sides: 4, open: 'bottom', z: v.wall }),
    ],
  },
  {
    id: 'tower',
    name: 'Tower',
    description: 'A tapering tower with a pointed top.',
    params: [
      mm('base', 'Base width', 'How wide the tower is at the bottom.', 20, 200, 70),
      mm('top', 'Top width', 'How wide the tower is under the point.', 10, 200, 45),
      mm('height', 'Height', 'The height of the tower without the point.', 30, 400, 120),
      mm('point', 'Point height', 'How tall the pointed top is.', 10, 200, 50),
      count('sides', 'Sides', 'How many sides the tower has.', 3, 16, 8),
    ],
    parts: (v) => {
      const top = Math.min(v.top, v.base - 1);
      return [
        part('frustum', { width: v.base, depth: v.base, height: v.height, sides: v.sides, topPct: Math.max(5, (top / v.base) * 100), open: 'top' }),
        part('cone', { width: top, depth: top, height: v.point, sides: v.sides, open: 'bottom', z: v.height }),
      ];
    },
  },
  {
    id: 'cake',
    name: 'Tiered cake',
    description: 'Round tiers on top of each other, each a bit smaller.',
    params: [
      mm('diameter', 'Bottom width', 'How wide the lowest tier is.', 40, 300, 120),
      mm('tier', 'Tier height', 'How tall each tier is.', 10, 150, 35),
      count('tiers', 'Tiers', 'How many tiers.', 1, 6, 3),
      { key: 'shrink', label: 'Each tier is smaller by', tip: 'How much narrower each tier is than the one below, in percent.', min: 5, max: 40, step: 5, value: 25, unit: 'count' },
    ],
    parts: (v) => {
      const out: BuildPart[] = [];
      const tiers = Math.round(v.tiers);
      for (let i = 0; i < tiers; i++) {
        const d = Math.max(10, v.diameter * (1 - v.shrink / 100) ** i);
        out.push(part('cylinder', { width: d, depth: d, height: v.tier, sides: 16, z: i * v.tier, open: i === 0 ? (tiers > 1 ? 'top' : 'none') : i === tiers - 1 ? 'bottom' : 'both' }));
      }
      return out;
    },
  },
];

export function findTemplate(id: string): ParametricTemplate | undefined {
  return PARAMETRIC_TEMPLATES.find((t) => t.id === id);
}

/** The values of a template with every one in range; a missing or broken value is the template's default. */
export function templateValues(template: ParametricTemplate, values: Readonly<Record<string, number>> = {}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of template.params) {
    const raw = values[p.key];
    out[p.key] = typeof raw === 'number' && Number.isFinite(raw) ? Math.min(p.max, Math.max(p.min, p.step >= 1 ? Math.round(raw) : raw)) : p.value;
  }
  return out;
}

// ─── Recipes ──────────────────────────────────────────────────────────────────

/** How a built model is made, kept with the model so it can be changed again after it was saved. */
export type ModelRecipe =
  | { kind: 'parametric'; templateId: string; values: Record<string, number> }
  | { kind: 'parts'; parts: BuildPart[] };

/** The parts a recipe stands for (the numbers brought into range), or null for a template that does not exist. */
export function partsOfRecipe(recipe: ModelRecipe): BuildPart[] | null {
  if (recipe.kind === 'parts') return recipe.parts.slice(0, PART_LIMITS.parts).map(clampPart);
  const template = findTemplate(recipe.templateId);
  return template ? template.parts(templateValues(template, recipe.values)).map(clampPart) : null;
}

export function meshOfRecipe(recipe: ModelRecipe): RawMesh | null {
  const parts = partsOfRecipe(recipe);
  return parts && parts.length > 0 ? buildParts(parts) : null;
}

/** The recipe of a template with its default values. */
export function recipeOfTemplate(id: string): ModelRecipe | null {
  const template = findTemplate(id);
  return template ? { kind: 'parametric', templateId: id, values: templateValues(template) } : null;
}

/** The longest side of a mesh's bounding box: the size the studio should show it at. */
export function longestSide(mesh: RawMesh): number {
  if (mesh.positions.length === 0) return 0;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of mesh.positions) for (let k = 0; k < 3; k++) {
    lo[k] = Math.min(lo[k]!, p[k]!);
    hi[k] = Math.max(hi[k]!, p[k]!);
  }
  return Math.max(hi[0]! - lo[0]!, hi[1]! - lo[1]!, hi[2]! - lo[2]!);
}
