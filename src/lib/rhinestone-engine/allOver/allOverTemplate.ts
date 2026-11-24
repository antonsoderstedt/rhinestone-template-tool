/**
 * "All over" templates: stones covering a whole area (a jeans leg, a pocket, a jacket back) in a pattern, rather than the shape
 * of a word or a picture.
 *
 * Patterns: a square grid, a hex grid (rows offset by half), a diagonal grid, an even random scatter, and a hex grid that
 * thins out from top to bottom. Every stone is at least the material's minimum centre distance from every other, so any of them
 * can be cut. The scatter is "random" but seeded: the same seed gives the same stones, as everything in the engine does.
 *
 * Pure. Lengths in millimetres.
 */

import type { RhinestoneTemplate, Stone, StoneSizeId } from '../types/index';
import { createRhinestoneTemplate } from '../template/createTemplate';
import { getDensitySpacing, type DensityPreset } from '../spacing/density';
import { getMinimumCenterDistance, getRecommendedHoleDiameter } from '../profiles/materialProfiles';

export type AllOverPattern = 'grid' | 'hex' | 'diagonal' | 'scatter' | 'fade';

export const ALL_OVER_PATTERNS: ReadonlyArray<{ id: AllOverPattern; label: string; description: string }> = [
  { id: 'grid', label: 'Grid', description: 'Straight rows and columns.' },
  { id: 'hex', label: 'Offset rows', description: 'Every second row shifted by half a stone: the most even cover.' },
  { id: 'diagonal', label: 'Diagonal', description: 'A grid turned 45 degrees.' },
  { id: 'scatter', label: 'Scatter', description: 'Evenly spread at random, like sparkle dust.' },
  { id: 'fade', label: 'Fade', description: 'Close together at the top, thinning out towards the bottom.' },
];

/** More stones than this is refused: it would take hours to cut and the browser long to draw. */
export const ALL_OVER_MAX_STONES = 40000;

export interface CreateAllOverTemplateOptions {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  stoneSize: StoneSizeId;
  pattern: AllOverPattern;
  densityPreset?: DensityPreset;
  customSpacingMm?: number;
  /** Used by `scatter` (and the small jitter-free choices of the others). Default 1. */
  seed?: number;
  /** Space kept clear at the edge of the area (mm), so no stone sits on the seam. Default: half a hole. */
  marginMm?: number;
  /** For `fade`: how many times wider the spacing is at the bottom than at the top. Default 2. */
  fadeRatio?: number;
  materialProfileId?: string;
}

/** A small seeded generator (mulberry32), so a "random" scatter is the same every time for a seed. */
function seededRandom(seed: number): () => number {
  let a = (seed | 0) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Point = { x: number; y: number };

function gridPoints(width: number, height: number, pitch: number, offsetRows: boolean): Point[] {
  const points: Point[] = [];
  const rowStep = offsetRows ? (pitch * Math.sqrt(3)) / 2 : pitch;
  let row = 0;
  for (let y = 0; y <= height + 1e-9; y += rowStep, row++) {
    const shift = offsetRows && row % 2 === 1 ? pitch / 2 : 0;
    for (let x = shift; x <= width + 1e-9; x += pitch) points.push({ x, y });
  }
  return points;
}

/** A square grid turned 45 degrees: the points of a grid of spacing `pitch / sqrt(2)` on a checkerboard. */
function diagonalPoints(width: number, height: number, pitch: number): Point[] {
  const step = pitch / Math.SQRT2;
  const points: Point[] = [];
  let row = 0;
  for (let y = 0; y <= height + 1e-9; y += step, row++) {
    for (let x = row % 2 === 0 ? 0 : step; x <= width + 1e-9; x += step * 2) points.push({ x, y });
  }
  return points;
}

/** Bridson's Poisson-disc sampling: random points, none closer than `radius`, spread evenly. */
function scatterPoints(width: number, height: number, radius: number, random: () => number): Point[] {
  const cell = radius / Math.SQRT2;
  const cols = Math.max(1, Math.ceil(width / cell) + 1);
  const rows = Math.max(1, Math.ceil(height / cell) + 1);
  const grid = new Int32Array(cols * rows).fill(-1);
  const points: Point[] = [];
  const active: number[] = [];
  const insert = (p: Point) => {
    points.push(p);
    grid[Math.floor(p.y / cell) * cols + Math.floor(p.x / cell)] = points.length - 1;
    active.push(points.length - 1);
  };
  const far = (p: Point) => {
    const cx = Math.floor(p.x / cell);
    const cy = Math.floor(p.y / cell);
    for (let y = Math.max(0, cy - 2); y <= Math.min(rows - 1, cy + 2); y++) {
      for (let x = Math.max(0, cx - 2); x <= Math.min(cols - 1, cx + 2); x++) {
        const index = grid[y * cols + x]!;
        if (index >= 0 && Math.hypot(points[index]!.x - p.x, points[index]!.y - p.y) < radius) return false;
      }
    }
    return true;
  };
  insert({ x: random() * width, y: random() * height });
  while (active.length > 0) {
    const pick = Math.floor(random() * active.length);
    const base = points[active[pick]!]!;
    let placed = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      const angle = random() * Math.PI * 2;
      const distance = radius * (1 + random());
      const candidate = { x: base.x + Math.cos(angle) * distance, y: base.y + Math.sin(angle) * distance };
      if (candidate.x < 0 || candidate.y < 0 || candidate.x > width || candidate.y > height) continue;
      if (!far(candidate)) continue;
      insert(candidate);
      placed = true;
      break;
    }
    if (!placed) active.splice(pick, 1);
  }
  // Sorted, so the order of the stones does not depend on the order they were found in.
  return points.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Offset rows whose spacing grows from `pitch` at the top to `pitch * ratio` at the bottom. */
function fadePoints(width: number, height: number, pitch: number, ratio: number, minCentre: number): Point[] {
  const points: Point[] = [];
  let y = 0;
  let row = 0;
  while (y <= height + 1e-9) {
    const along = height > 0 ? y / height : 0;
    const local = pitch * (1 + (ratio - 1) * along);
    const shift = row % 2 === 1 ? local / 2 : 0;
    for (let x = shift; x <= width + 1e-9; x += local) points.push({ x, y });
    // Rows are a hex step apart, but never closer than a stone can sit to the row above.
    y += Math.max(minCentre, (local * Math.sqrt(3)) / 2);
    row++;
  }
  return points;
}

export function createAllOverTemplate(options: CreateAllOverTemplateOptions): RhinestoneTemplate {
  const { id, name, widthMm, heightMm, stoneSize, pattern, materialProfileId } = options;
  if (!(widthMm > 0) || !(heightMm > 0) || !Number.isFinite(widthMm) || !Number.isFinite(heightMm)) {
    throw new Error(`createAllOverTemplate: width and height must be positive numbers, got ${widthMm} x ${heightMm}.`);
  }
  const hole = getRecommendedHoleDiameter(stoneSize, materialProfileId);
  const minCentre = getMinimumCenterDistance(hole / 2, hole / 2, materialProfileId);
  const preset = options.densityPreset ?? 'airy';
  const pitch = Math.max(
    minCentre,
    getDensitySpacing({ stoneSize, materialProfileId, preset, customSpacingMm: options.customSpacingMm }).spacingMm,
  );
  const margin = options.marginMm ?? hole / 2;
  const width = Math.max(0, widthMm - 2 * margin);
  const height = Math.max(0, heightMm - 2 * margin);

  // A cheap upper bound before any points are made, so a huge area does not freeze the page.
  const estimate = (width * height) / (pitch * pitch * (pattern === 'grid' ? 1 : 0.866));
  if (estimate > ALL_OVER_MAX_STONES * 1.2) {
    throw new Error(`This area would need about ${Math.round(estimate)} stones. Make the area smaller or the spacing wider (the limit is ${ALL_OVER_MAX_STONES}).`);
  }

  let points: Point[];
  switch (pattern) {
    case 'grid':
      points = gridPoints(width, height, pitch, false);
      break;
    case 'hex':
      points = gridPoints(width, height, pitch, true);
      break;
    case 'diagonal':
      points = diagonalPoints(width, height, pitch);
      break;
    case 'scatter':
      points = scatterPoints(width, height, pitch, seededRandom(options.seed ?? 1));
      break;
    case 'fade':
      points = fadePoints(width, height, pitch, Math.max(1, options.fadeRatio ?? 2), minCentre);
      break;
    default:
      throw new Error(`createAllOverTemplate: unknown pattern "${String(pattern)}".`);
  }
  if (points.length > ALL_OVER_MAX_STONES) {
    throw new Error(`This area would need ${points.length} stones. Make the area smaller or the spacing wider (the limit is ${ALL_OVER_MAX_STONES}).`);
  }

  const origin = 10 + margin;
  const round = (value: number) => Math.round(value * 1e4) / 1e4;
  const stones: Stone[] = points.map((p, i) => ({
    id: `${stoneSize.toLowerCase()}-all-${i + 1}`,
    center: { x: round(origin + p.x), y: round(origin + p.y) },
    stoneSize,
    holeDiameterMm: hole,
    metadata: { placement: pattern },
  }));

  return createRhinestoneTemplate({
    id,
    name,
    stones,
    widthMm,
    heightMm,
    metadata: {
      generatedBy: 'createAllOverTemplate',
      pattern,
      stoneSize,
      areaWidthMm: widthMm,
      areaHeightMm: heightMm,
      resolvedSpacingMm: pitch,
      seed: options.seed ?? 1,
      materialProfileId: materialProfileId ?? 'magic-flock-cricut-maker',
    },
  });
}
