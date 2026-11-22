/**
 * Rhinestone template from artwork: the layer, field and row pipeline put together.
 *
 *   shapes -> colour layers (painted in order) -> distance field per layer -> rows of stones -> one spacing pass
 *
 * `look` is what the user chooses: an outline (one row), rows (a few) or solid (every row, then the rest filled).
 * The result never has two stones closer than the material's minimum, and says what it left out and why.
 */

import type { RhinestoneTemplate, Stone, StoneSizeId } from '../types/index';
import type { ImportedShape } from '../svg/svgImport';
import type { Polyline } from '../path/polyline';
import { createRhinestoneTemplate } from '../template/createTemplate';
import { getMinimumCenterDistance, getRecommendedCenterDistance, getRecommendedHoleDiameter } from '../profiles/materialProfiles';
import { getDensitySpacing, type DensityPreset } from '../spacing/density';
import { buildArtworkLayers, type ArtworkLayer, type ArtworkLayers, type BuildLayersOptions } from './layers';
import { buildRegionField, emptyMask, type RegionField } from './regionField';
import { analyseFeasibility, type FeasibilityReport } from './feasibility';
import { layoutRows, type StoneKind } from './rowsLayout';

export type ArtworkLook = 'outline' | 'rows' | 'solid';

export interface CreateArtworkTemplateOptions {
  id: string;
  name: string;
  /** The artwork as shapes (SVG). Give either this or `layers`. */
  shapes?: readonly ImportedShape[];
  /** The artwork as ready-made colour layers (a raster image); size options are then already applied. */
  layers?: ArtworkLayers;
  stoneSize: StoneSizeId;
  look: ArtworkLook;
  /** Number of rows for the `rows` look. Default 3. */
  rowCount?: number;
  widthMm?: number;
  heightMm?: number;
  preserveAspectRatio?: boolean;
  densityPreset?: DensityPreset;
  customSpacingMm?: number;
  materialProfileId?: string;
  /** Colours (`#rrggbb`) to leave out, or to include although they would be treated as background. */
  layerRoles?: Record<string, 'stones' | 'ignore'>;
  ignoreBackground?: boolean;
  /** Give parts thinner than a stone one row down the middle (stones reach past the edge). For letters. */
  overhang?: boolean;
  grid?: BuildLayersOptions['grid'];
  /** Also work out whether the artwork is fine enough for the stones (costs about 0.1 s). */
  analyse?: boolean;
  metadata?: Record<string, string | number | boolean>;
}

export interface ArtworkTemplateResult {
  template: RhinestoneTemplate;
  layers: Array<Pick<ArtworkLayer, 'colour' | 'areaMm2' | 'role' | 'reason'> & { stones: number }>;
  /** Outlines of the shapes after scaling. */
  polylines: Polyline[];
  /** The shape the stones are meant to cover: every layer that got stones, as a distance field. */
  silhouette: RegionField;
  pitchMm: number;
  scale: number;
  /** Only when `analyse` was asked for. */
  feasibility: FeasibilityReport | null;
  warnings: string[];
}

class Occupancy {
  private readonly buckets = new Map<string, Array<[number, number]>>();
  constructor(private readonly size: number) {}
  private key(x: number, y: number) {
    return `${Math.floor(x / this.size)},${Math.floor(y / this.size)}`;
  }
  clear(x: number, y: number, minDistance: number): boolean {
    const cx = Math.floor(x / this.size);
    const cy = Math.floor(y / this.size);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const [px, py] of this.buckets.get(`${cx + dx},${cy + dy}`) ?? []) {
          if (Math.hypot(px - x, py - y) < minDistance) return false;
        }
      }
    }
    return true;
  }
  add(x: number, y: number) {
    const key = this.key(x, y);
    const list = this.buckets.get(key);
    if (list) list.push([x, y]);
    else this.buckets.set(key, [[x, y]]);
  }
}

export function createArtworkTemplate(options: CreateArtworkTemplateOptions): ArtworkTemplateResult {
  const { id, name, shapes, stoneSize, look, materialProfileId } = options;
  const hole = getRecommendedHoleDiameter(stoneSize, materialProfileId);
  const minCentre = getMinimumCenterDistance(hole / 2, hole / 2, materialProfileId);
  const recommended = getRecommendedCenterDistance(stoneSize, materialProfileId);
  const pitch = options.densityPreset
    ? Math.max(minCentre, getDensitySpacing({ stoneSize, materialProfileId, preset: options.densityPreset, customSpacingMm: options.customSpacingMm }).spacingMm)
    : options.customSpacingMm !== undefined
      ? Math.max(minCentre, options.customSpacingMm)
      : recommended;

  const built =
    options.layers ??
    buildArtworkLayers(shapes ?? [], {
      widthMm: options.widthMm,
      heightMm: options.heightMm,
      preserveAspectRatio: options.preserveAspectRatio,
      ignoreBackground: options.ignoreBackground,
      grid: options.grid,
    });
  const warnings = [...built.warnings];

  // Layers painted later are on top: they get their stones first, and lower layers give way where they meet.
  const rows = look === 'outline' ? 1 : look === 'rows' ? Math.max(1, Math.floor(options.rowCount ?? 3)) : ('all' as const);
  const occupancy = new Occupancy(Math.max(minCentre, 1));
  const stones: Stone[] = [];
  const layerSummary: ArtworkTemplateResult['layers'] = built.layers.map((layer) => ({ colour: layer.colour, areaMm2: layer.areaMm2, role: layer.role, reason: layer.reason, stones: 0 }));

  const order = built.layers.map((_, i) => i).reverse();
  for (const layerIndex of order) {
    const layer = built.layers[layerIndex]!;
    const role = options.layerRoles?.[layer.colour] ?? layer.role;
    layerSummary[layerIndex]!.role = role;
    if (role === 'ignore') continue;
    const field = buildRegionField(layer.mask);
    const placed = layoutRows(field, { holeDiameterMm: hole, pitchMm: pitch, minCentreDistanceMm: minCentre, rows, overhang: options.overhang });
    for (const p of placed) {
      if (!occupancy.clear(p.x, p.y, minCentre)) continue;
      occupancy.add(p.x, p.y);
      const kind: StoneKind = p.kind;
      stones.push({
        id: '',
        center: { x: p.x, y: p.y },
        stoneSize,
        holeDiameterMm: hole,
        metadata: {
          layerColour: layer.colour,
          layerIndex,
          row: p.row,
          placement: kind,
          // Same names the older generators used, so the rest of the editor can tell the edge row from the fill.
          collisionSource: kind === 'fill' ? 'fill' : 'outline',
          edgeBand: kind === 'fill' ? 'interior' : 'edge',
        },
      });
      layerSummary[layerIndex]!.stones++;
    }
    if (placed.length === 0) warnings.push(`${layer.colour}: too small or too thin for ${stoneSize} stones at this size, so it got none.`);
  }

  const union = emptyMask(built.grid);
  built.layers.forEach((layer, i) => {
    if (layerSummary[i]!.role === 'ignore') return;
    for (let k = 0; k < union.data.length; k++) if (layer.mask.data[k]) union.data[k] = 1;
  });

  stones.sort((a, b) => a.center.y - b.center.y || a.center.x - b.center.x);
  stones.forEach((stone, i) => {
    stone.id = `${stoneSize.toLowerCase()}-art-${i + 1}`;
  });

  const template = createRhinestoneTemplate({
    id,
    name,
    stones,
    metadata: {
      generatedBy: 'createArtworkTemplate',
      look,
      rows: rows === 'all' ? 'all' : rows,
      stoneSize,
      resolvedSpacingMm: pitch,
      materialProfileId: materialProfileId ?? 'magic-flock-cricut-maker',
      layerCount: built.layers.length,
      outlineStoneCount: stones.filter((stone) => stone.metadata?.collisionSource === 'outline').length,
      fillStoneCount: stones.filter((stone) => stone.metadata?.collisionSource === 'fill').length,
      ...options.metadata,
    },
  });

  const feasibility = options.analyse
    ? analyseFeasibility(built.layers.map((layer, i) => ({ ...layer, role: layerSummary[i]!.role })), { materialProfileId })
    : null;

  return { template, layers: layerSummary, polylines: built.polylines, silhouette: buildRegionField(union), pitchMm: pitch, scale: built.scale, feasibility, warnings };
}
