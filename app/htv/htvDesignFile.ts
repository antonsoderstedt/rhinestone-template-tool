/**
 * The HTV design file (ADR 0064): one HTV design as a small JSON file, named `<name>.htv.json`, so that a design can be kept, moved
 * between devices and shared as a template in the catalog (the Rhinestone studio has had `.rhinestone.json` for its projects).
 *
 * The file holds the layers, the garment and the canvas. It does not hold the undo history or what is selected: a design that is opened
 * starts with an empty history. The file is read as untrusted input: every value is checked for its type and range, and the state that
 * comes out is built from those values only, never from the object that was read.
 *
 * Pure functions; nothing here touches the page.
 */

import type { Polyline } from '@/src/lib/rhinestone-engine/index';
import { HTV_DESIGN_SUFFIX } from '../lib/catalog/catalogFormat';
import type { GarmentSize, GarmentType } from '../components/garmentPreview/garmentCatalog';
import { DEFAULT_HTV_CANVAS_STATE, DEFAULT_HTV_GARMENT_STATE, DEFAULT_HTV_STATE, type HtvLayer, type HtvState, type HtvVectorSourceKind } from './HtvState';
import type { HtvPlacementZone } from './htvPlacementZones';

export const HTV_DESIGN_FORMAT = 'rhinestone-studio-htv-design';
export const HTV_DESIGN_VERSION = 1;
/** What an HTV design file is named; an HTV catalog template in JSON must be named like this. */
export { HTV_DESIGN_SUFFIX };
export const MAX_HTV_DESIGN_BYTES = 20 * 1024 * 1024;

export const HTV_FILE_LIMITS = { layers: 300, polylines: 5000, points: 400_000, name: 120, text: 500, coordinateMm: 20_000, sizeMm: 5000 } as const;

const GARMENT_TYPES: readonly GarmentType[] = ['tshirt', 'tee', 'oversized-tee', 'cropped-tee', 'hoodie', 'tote'];
const GARMENT_SIZES: readonly GarmentSize[] = ['S', 'M', 'L', 'XL', 'XXL', 'OS'];
const PLACEMENT_ZONES: readonly HtvPlacementZone[] = ['full-front', 'left-chest', 'right-chest', 'full-back', 'left-sleeve', 'right-sleeve'];
const SOURCE_KINDS: readonly HtvVectorSourceKind[] = ['svg-upload', 'silhouette-trace', 'library-asset'];
const ALIGNS = ['left', 'center', 'right'] as const;
const ID_PATTERN = /^[A-Za-z0-9._-]{1,60}$/;

/** The file name for a design: its name made safe, then the suffix. */
export function htvDesignFileName(projectName: string): string {
  const slug = projectName
    .toLowerCase()
    .replace(/å|ä/g, 'a')
    .replace(/ö/g, 'o')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'htv-design'}${HTV_DESIGN_SUFFIX}`;
}

export const isHtvDesignFileName = (fileName: string): boolean => fileName.toLowerCase().endsWith(HTV_DESIGN_SUFFIX);

/** The design as the text of a file. */
export function serializeHtvDesign(state: HtvState): string {
  return JSON.stringify({
    format: HTV_DESIGN_FORMAT,
    version: HTV_DESIGN_VERSION,
    projectName: state.projectName,
    layers: state.layers,
    canvas: state.canvas,
    garment: state.garment,
  });
}

export type HtvDesignReason = 'not-json' | 'not-a-design' | 'newer' | 'invalid';
export type ParsedHtvDesign = { ok: true; state: HtvState } | { ok: false; reason: HtvDesignReason; detail?: string };

type Obj = Record<string, unknown>;
const isObj = (value: unknown): value is Obj => typeof value === 'object' && value !== null && !Array.isArray(value);
const fail = (detail: string): { ok: false; reason: 'invalid'; detail: string } => ({ ok: false, reason: 'invalid', detail });

const num = (value: unknown, min: number, max: number): number | null => (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null);
const text = (value: unknown, max: number): string | null => (typeof value === 'string' && value.length <= max ? value : null);
const oneOf = <T extends string>(value: unknown, list: readonly T[]): T | null => (typeof value === 'string' && (list as readonly string[]).includes(value) ? (value as T) : null);

/** The polylines of a vector layer; null with the reason when they do not fit. Counts the points so a file cannot be made to hold millions. */
function readPolylines(raw: unknown, budget: { points: number }): Polyline[] | string {
  if (!Array.isArray(raw) || raw.length > HTV_FILE_LIMITS.polylines) return 'The shapes are too many or not a list.';
  const out: Polyline[] = [];
  for (const line of raw) {
    if (!isObj(line) || !Array.isArray(line.points)) return 'A shape has no points.';
    budget.points -= line.points.length;
    if (budget.points < 0) return 'The design has too many points.';
    const points: { x: number; y: number }[] = [];
    for (const p of line.points) {
      if (!isObj(p)) return 'A point is not a point.';
      const x = num(p.x, -HTV_FILE_LIMITS.coordinateMm, HTV_FILE_LIMITS.coordinateMm);
      const y = num(p.y, -HTV_FILE_LIMITS.coordinateMm, HTV_FILE_LIMITS.coordinateMm);
      if (x === null || y === null) return 'A point is out of range.';
      points.push({ x, y });
    }
    out.push(line.closed === undefined ? { points } : { points, closed: line.closed === true });
  }
  return out;
}

function readLayer(raw: unknown, seen: Set<string>, budget: { points: number }): HtvLayer | string {
  if (!isObj(raw)) return 'A layer is not an object.';
  const id = typeof raw.id === 'string' && ID_PATTERN.test(raw.id) ? raw.id : null;
  if (id === null || seen.has(id)) return 'A layer has a bad or repeated id.';
  const placementId = oneOf(raw.placementId, PLACEMENT_ZONES);
  const name = text(raw.name, HTV_FILE_LIMITS.name);
  const x = num(raw.x, -HTV_FILE_LIMITS.coordinateMm, HTV_FILE_LIMITS.coordinateMm);
  const y = num(raw.y, -HTV_FILE_LIMITS.coordinateMm, HTV_FILE_LIMITS.coordinateMm);
  const rotationDeg = num(raw.rotationDeg, -3600, 3600);
  const scale = num(raw.scale, 0.001, 1000);
  const colorId = text(raw.colorId, 60);
  const groupId = raw.groupId === null || raw.groupId === undefined ? null : text(raw.groupId, 60);
  if (!placementId || name === null || x === null || y === null || rotationDeg === null || scale === null || colorId === null || colorId === '') return `Layer ${id} has a value that does not fit.`;
  if (raw.groupId !== null && raw.groupId !== undefined && groupId === null) return `Layer ${id} has a bad group.`;
  const base = { id, placementId, name, x, y, rotationDeg, scale, visible: raw.visible !== false, locked: raw.locked === true, colorId, flipX: raw.flipX === true, flipY: raw.flipY === true, groupId };

  if (raw.type === 'text') {
    const body = text(raw.text, HTV_FILE_LIMITS.text);
    const fontId = text(raw.fontId, 120);
    const fontSizeMm = num(raw.fontSizeMm, 1, 2000);
    const letterSpacingMm = num(raw.letterSpacingMm, -100, 500);
    const align = oneOf(raw.align, ALIGNS);
    const curveAmount = num(raw.curveAmount, -100, 100);
    if (body === null || fontId === null || fontSizeMm === null || letterSpacingMm === null || !align || curveAmount === null) return `Text layer ${id} has a value that does not fit.`;
    seen.add(id);
    return { ...base, type: 'text', text: body, fontId, fontSizeMm, letterSpacingMm, align, curveAmount };
  }

  if (raw.type === 'vector') {
    const sourceKind = oneOf(raw.sourceKind, SOURCE_KINDS);
    const naturalWidthMm = num(raw.naturalWidthMm, 0, HTV_FILE_LIMITS.sizeMm);
    const naturalHeightMm = num(raw.naturalHeightMm, 0, HTV_FILE_LIMITS.sizeMm);
    const polylines = readPolylines(raw.polylines, budget);
    if (typeof polylines === 'string') return `Layer ${id}: ${polylines}`;
    if (!sourceKind || naturalWidthMm === null || naturalHeightMm === null) return `Shape layer ${id} has a value that does not fit.`;
    const excluded = Array.isArray(raw.excludedContours) ? raw.excludedContours : [];
    if (!excluded.every((i) => Number.isInteger(i) && (i as number) >= 0 && (i as number) < polylines.length)) return `Shape layer ${id} hides a shape that is not there.`;
    seen.add(id);
    return { ...base, type: 'vector', sourceKind, polylines, naturalWidthMm, naturalHeightMm, excludedContours: [...new Set(excluded as number[])] };
  }
  return `Layer ${id} is neither text nor a shape.`;
}

/** Reads the text of a design file. The state that comes back has no history and nothing selected. */
export function parseHtvDesign(source: string): ParsedHtvDesign {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    return { ok: false, reason: 'not-json' };
  }
  if (!isObj(raw) || raw.format !== HTV_DESIGN_FORMAT) return { ok: false, reason: 'not-a-design' };
  if (typeof raw.version !== 'number' || !Number.isInteger(raw.version) || raw.version < 1) return fail('The file has no version.');
  if (raw.version > HTV_DESIGN_VERSION) return { ok: false, reason: 'newer' };

  const projectName = (text(raw.projectName, HTV_FILE_LIMITS.name) ?? '').trim() || DEFAULT_HTV_STATE.projectName;
  if (!Array.isArray(raw.layers) || raw.layers.length > HTV_FILE_LIMITS.layers) return fail('The layers are too many or not a list.');
  const seen = new Set<string>();
  const budget = { points: HTV_FILE_LIMITS.points };
  const layers: HtvLayer[] = [];
  for (const item of raw.layers) {
    const layer = readLayer(item, seen, budget);
    if (typeof layer === 'string') return fail(layer);
    layers.push(layer);
  }

  const c = isObj(raw.canvas) ? raw.canvas : {};
  const canvas = {
    zoom: num(c.zoom, 0.05, 50) ?? DEFAULT_HTV_CANVAS_STATE.zoom,
    panX: num(c.panX, -1e6, 1e6) ?? DEFAULT_HTV_CANVAS_STATE.panX,
    panY: num(c.panY, -1e6, 1e6) ?? DEFAULT_HTV_CANVAS_STATE.panY,
  };

  const g = isObj(raw.garment) ? raw.garment : {};
  const placementZone = oneOf(g.placementZone, PLACEMENT_ZONES) ?? DEFAULT_HTV_GARMENT_STATE.placementZone;
  const active = Array.isArray(g.activePlacementZones) ? [...new Set(g.activePlacementZones.map((z) => oneOf(z, PLACEMENT_ZONES)).filter((z): z is HtvPlacementZone => z !== null))] : [];
  if (!active.includes(placementZone)) active.push(placementZone);
  const garmentColor = text(g.colorId, 60);
  const garmentType = oneOf(g.type, GARMENT_TYPES) ?? DEFAULT_HTV_GARMENT_STATE.type;
  const garment = {
    type: garmentType === 'tshirt' ? 'tee' : garmentType, // an older name for the same garment
    size: oneOf(g.size, GARMENT_SIZES) ?? DEFAULT_HTV_GARMENT_STATE.size,
    colorId: garmentColor ? garmentColor : DEFAULT_HTV_GARMENT_STATE.colorId,
    placementZone,
    activePlacementZones: active,
  };

  return { ok: true, state: { projectName, layers, selectedLayerIds: new Set(), canvas, garment, history: { past: [], future: [] } } };
}
