import { clampPart, findTemplate, PART_KINDS, PART_LIMITS, templateValues, type BuildPart, type ModelRecipe, type PagePin, type RawMesh, type Vec3 } from '@/src/lib/papercraft-engine';
import { findBuiltInModel } from './papercraftModels';
import type { ModelSource, PapercraftState, PaperPreset, SizeBy } from './papercraftState';
import { initialPapercraftState, MIN_DETAIL_PCT } from './papercraftState';

/**
 * A papercraft design as it is saved (in My Designs, in a share link, in a backup and on the server): the model, the size, the paper
 * and the tab settings, the edges the owner cut or joined by hand, and the cover choice. Not the view, the selection or the fold amount.
 * An imported model's mesh is kept inside, as flat lists of numbers, so a design opens on another device without the file.
 */
export interface SerializedPapercraft {
  version: 1;
  projectName: string;
  source: { kind: 'builtin'; id: string } | { kind: 'file'; fileName: string; mesh: { positions: number[]; faces: number[][] }; recipe?: ModelRecipe };
  size: { by: SizeBy; mm: number };
  paper: { preset: PaperPreset; marginMm: number; gapMm: number; customWidthMm?: number; customHeightMm?: number };
  detailPct?: number;
  colourParts?: boolean;
  layout?: { pins?: Record<string, PagePin>; maxPartsPerPage?: number; tight?: boolean; calibrationMm?: number };
  pattern: { tabWidthMm: number; tabAngleDeg: number; printedSide: 'outside' | 'inside'; numberHeightMm: number; partLabels: boolean; numberPartsBy?: 'size' | 'build' };
  cover: boolean;
  edits: { forceCut: number[]; forceJoin: number[] };
}

/** An imported mesh bigger than this (numbers in the positions) is not saved: it would not fit in the browser's storage anyway. */
export const MAX_SAVED_POSITION_NUMBERS = 450_000;
export const MAX_SAVED_FACES = 12_000;

const SIZE_BYS: readonly SizeBy[] = ['height', 'width', 'depth', 'largest'];
const PRESETS: readonly PaperPreset[] = ['a3', 'a4', 'a5', 'letter', 'tabloid', 'cricut12x12', 'cricut12x24', 'custom'];

/** Seven significant digits: more than any model needs, and short enough in JSON. */
const compact = (v: number) => Number(v.toPrecision(7));

function serializeMesh(mesh: RawMesh): { positions: number[]; faces: number[][] } {
  const positions: number[] = [];
  for (const p of mesh.positions) positions.push(compact(p[0]), compact(p[1]), compact(p[2]));
  return { positions, faces: mesh.faces.map((f) => [...f]) };
}

function serializeRecipe(recipe: ModelRecipe): ModelRecipe {
  return recipe.kind === 'parametric'
    ? { kind: 'parametric', templateId: recipe.templateId, values: { ...recipe.values } }
    : { kind: 'parts', parts: recipe.parts.map((p) => ({ ...p })) };
}

export function serializePapercraft(state: PapercraftState): SerializedPapercraft {
  return {
    version: 1,
    projectName: state.projectName,
    source:
      state.source.kind === 'builtin'
        ? { kind: 'builtin', id: state.source.id }
        : { kind: 'file', fileName: state.source.fileName, mesh: serializeMesh(state.source.mesh), ...(state.source.recipe ? { recipe: serializeRecipe(state.source.recipe) } : {}) },
    size: { ...state.size },
    paper: { ...state.paper },
    ...(state.detailPct < 100 ? { detailPct: state.detailPct } : {}),
    ...(state.colourParts ? { colourParts: true } : {}),
    ...(Object.keys(state.layout.pins).length > 0 || state.layout.maxPartsPerPage !== null || !state.layout.tight || state.layout.calibrationMm !== null
      ? {
          layout: {
            ...(Object.keys(state.layout.pins).length > 0 ? { pins: Object.fromEntries(Object.entries(state.layout.pins).map(([id, p]) => [id, { ...p }])) } : {}),
            ...(state.layout.maxPartsPerPage !== null ? { maxPartsPerPage: state.layout.maxPartsPerPage } : {}),
            ...(!state.layout.tight ? { tight: false } : {}),
            ...(state.layout.calibrationMm !== null ? { calibrationMm: state.layout.calibrationMm } : {}),
          },
        }
      : {}),
    pattern: { ...state.pattern },
    cover: state.cover,
    edits: { forceCut: [...state.edits.forceCut], forceJoin: [...state.edits.forceJoin] },
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const isIndexList = (v: unknown): v is number[] => Array.isArray(v) && v.length <= 100_000 && v.every((x) => Number.isInteger(x) && x >= 0);

function readMesh(value: unknown): RawMesh | null {
  if (!isRecord(value) || !Array.isArray(value.positions) || !Array.isArray(value.faces)) return null;
  const flat = value.positions;
  if (flat.length === 0 || flat.length % 3 !== 0 || flat.length > MAX_SAVED_POSITION_NUMBERS || !flat.every(isNum)) return null;
  if (value.faces.length === 0 || value.faces.length > MAX_SAVED_FACES) return null;
  const count = flat.length / 3;
  const faces: number[][] = [];
  for (const f of value.faces) {
    if (!Array.isArray(f) || f.length < 3 || f.length > 512 || !f.every((i) => Number.isInteger(i) && i >= 0 && i < count)) return null;
    faces.push(f as number[]);
  }
  const positions: Vec3[] = [];
  for (let i = 0; i < count; i++) positions.push([flat[i * 3] as number, flat[i * 3 + 1] as number, flat[i * 3 + 2] as number]);
  return { positions, faces };
}

const PART_NUMBER_KEYS = ['width', 'depth', 'height', 'sides', 'topPct', 'x', 'y', 'z', 'rotX', 'rotY', 'rotZ'] as const;

/** The recipe of a saved model: what is wrong with it is brought into range or the recipe is left out (the mesh is saved with it anyway). */
function readRecipe(value: unknown): ModelRecipe | undefined {
  if (!isRecord(value)) return undefined;
  if (value.kind === 'parametric') {
    const template = typeof value.templateId === 'string' ? findTemplate(value.templateId) : undefined;
    if (!template || !isRecord(value.values)) return undefined;
    const given: Record<string, number> = {};
    for (const [key, v] of Object.entries(value.values)) if (isNum(v)) given[key] = v;
    return { kind: 'parametric', templateId: template.id, values: templateValues(template, given) };
  }
  if (value.kind === 'parts' && Array.isArray(value.parts) && value.parts.length > 0) {
    const parts: BuildPart[] = [];
    for (const raw of value.parts.slice(0, PART_LIMITS.parts)) {
      if (!isRecord(raw) || !PART_KINDS.includes(raw.kind as BuildPart['kind'])) return undefined;
      if (!PART_NUMBER_KEYS.every((k) => isNum(raw[k]))) return undefined;
      parts.push(clampPart(raw as unknown as BuildPart));
    }
    return { kind: 'parts', parts };
  }
  return undefined;
}

function readSource(value: unknown): ModelSource | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'builtin') return typeof value.id === 'string' && findBuiltInModel(value.id) ? { kind: 'builtin', id: value.id } : null;
  if (value.kind === 'file') {
    const mesh = readMesh(value.mesh);
    if (!mesh || typeof value.fileName !== 'string') return null;
    const recipe = readRecipe(value.recipe);
    return { kind: 'file', fileName: value.fileName.slice(0, 200), mesh, ...(recipe ? { recipe } : {}) };
  }
  return null;
}

/**
 * The state a saved design stands for, or null when the data is not a design of ours (a damaged file, a link made by something else, a
 * model that is no longer built in). Numbers out of range are brought into range; the shape of the data is not guessed at.
 */
export function deserializePapercraft(data: unknown): PapercraftState | null {
  if (!isRecord(data) || data.version !== 1) return null;
  const source = readSource(data.source);
  if (!source) return null;
  const size = data.size;
  const paper = data.paper;
  const pattern = data.pattern;
  const edits = data.edits;
  if (!isRecord(size) || !isRecord(paper) || !isRecord(pattern) || !isRecord(edits)) return null;
  if (!SIZE_BYS.includes(size.by as SizeBy) || !isNum(size.mm) || size.mm <= 0) return null;
  if (!PRESETS.includes(paper.preset as PaperPreset) || !isNum(paper.marginMm) || !isNum(paper.gapMm)) return null;
  if (!isNum(pattern.tabWidthMm) || !isNum(pattern.tabAngleDeg) || !isNum(pattern.numberHeightMm)) return null;
  if (pattern.printedSide !== 'outside' && pattern.printedSide !== 'inside') return null;
  if (typeof pattern.partLabels !== 'boolean' || typeof data.cover !== 'boolean' || typeof data.projectName !== 'string') return null;
  if (!isIndexList(edits.forceCut) || !isIndexList(edits.forceJoin)) return null;
  const base = initialPapercraftState();
  return {
    ...base,
    projectName: data.projectName.slice(0, 200),
    source,
    size: { by: size.by as SizeBy, mm: clamp(size.mm, 1, 100_000) },
    paper: {
      preset: paper.preset as PaperPreset,
      marginMm: clamp(paper.marginMm, 0, 50),
      gapMm: clamp(paper.gapMm, 0, 30),
      customWidthMm: isNum(paper.customWidthMm) ? clamp(paper.customWidthMm, 50, 2000) : base.paper.customWidthMm,
      customHeightMm: isNum(paper.customHeightMm) ? clamp(paper.customHeightMm, 50, 2000) : base.paper.customHeightMm,
    },
    detailPct: isNum(data.detailPct) ? clamp(Math.round(data.detailPct), MIN_DETAIL_PCT, 100) : 100,
    colourParts: data.colourParts === true,
    layout: readLayout(data.layout),
    pattern: {
      tabWidthMm: clamp(pattern.tabWidthMm, 3, 30),
      tabAngleDeg: clamp(pattern.tabAngleDeg, 10, 90),
      printedSide: pattern.printedSide,
      numberHeightMm: clamp(pattern.numberHeightMm, 1.5, 15),
      partLabels: pattern.partLabels,
      // A design saved before there was a choice was numbered by size.
      numberPartsBy: pattern.numberPartsBy === 'build' ? 'build' : 'size',
    },
    cover: data.cover,
    edits: { forceCut: edits.forceCut, forceJoin: edits.forceJoin },
  };
}

const MAX_PINS = 500;

/** The pins of a saved layout: only entries that are numbers and make sense; the rest is left out. */
function readLayout(value: unknown): PapercraftState['layout'] {
  const base = initialPapercraftState().layout;
  if (!isRecord(value)) return base;
  const pins: Record<number, PagePin> = {};
  if (isRecord(value.pins)) {
    for (const [key, raw] of Object.entries(value.pins).slice(0, MAX_PINS)) {
      const id = Number(key);
      if (!Number.isInteger(id) || id < 1 || !isRecord(raw)) continue;
      const { page, rotation, x, y, w, h } = raw;
      if (![page, rotation, x, y, w, h].every(isNum)) continue;
      if ((page as number) < 0 || (page as number) > 200 || (w as number) <= 0 || (h as number) <= 0) continue;
      pins[id] = { page: Math.floor(page as number), rotation: rotation as number, x: x as number, y: y as number, w: w as number, h: h as number };
    }
  }
  return {
    pins,
    maxPartsPerPage: isNum(value.maxPartsPerPage) && value.maxPartsPerPage >= 1 ? Math.min(50, Math.floor(value.maxPartsPerPage)) : null,
    tight: value.tight !== false,
    calibrationMm: isNum(value.calibrationMm) && value.calibrationMm >= 10 ? Math.min(500, value.calibrationMm) : null,
  };
}

/** The design as one piece of text (to compare, to keep versions of, and to put in a link). */
export function snapshotText(state: PapercraftState): string {
  return JSON.stringify(serializePapercraft(state));
}

/** Can this design be saved? An imported mesh that is too big is not. */
export function canSavePapercraft(state: PapercraftState): boolean {
  return state.source.kind === 'builtin' || (state.source.mesh.positions.length * 3 <= MAX_SAVED_POSITION_NUMBERS && state.source.mesh.faces.length <= MAX_SAVED_FACES);
}
