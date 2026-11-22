/**
 * The Artwork tool's bridge to the engine: SVG text and tool settings in, a template and what the panel needs to say out.
 * The tool keeps its older state fields (coverage mode, contour settings) so saved projects still open; the three looks
 * the user sees map onto them.
 */

import {
  buildRasterLayers,
  createArtworkTemplate,
  importSvgArtwork,
  type ArtworkLook,
  type FeasibilityReport,
  type ImportedShape,
  type PlacedShape,
  type RasterImage,
  type RhinestoneTemplate,
  type StoneSizeId,
  type SvgImportResult,
} from '@/src/lib/rhinestone-engine/index';
import { dotsOf, type TextThumbnail } from './textStyleThumbnails';
import type { TemplateCoverageMode } from '@/src/lib/rhinestone-engine/fill/fillTemplate';
import type { SvgToolState } from './EditorState';

export interface ArtworkLayerInfo {
  colour: string;
  role: 'stones' | 'ignore';
  reason?: string;
  stones: number;
}

export interface ArtworkInfo {
  layers: ArtworkLayerInfo[];
  /** The artwork as drawn, to show behind the stones (empty for a picture). */
  source: PlacedShape[];
  feasibility: FeasibilityReport | null;
  warnings: string[];
  stoneSize: StoneSizeId;
}

export const ARTWORK_LOOKS: ReadonlyArray<{ look: ArtworkLook; label: string; help: string; coverageMode: TemplateCoverageMode }> = [
  { look: 'outline', label: 'Outline', help: 'One row of stones along the edge.', coverageMode: 'outline' },
  { look: 'rows', label: 'Rows', help: 'A few rows following the edge.', coverageMode: 'contour' },
  { look: 'solid', label: 'Solid', help: 'Filled with stones, edge to centre.', coverageMode: 'outline-fill' },
];

export function lookFromCoverage(mode: TemplateCoverageMode): ArtworkLook {
  if (mode === 'outline') return 'outline';
  if (mode === 'contour') return 'rows';
  return 'solid';
}

// Reading a file is cheap, but the panel and the generation both need it on every change of size or stone.
const cache = new Map<string, SvgImportResult>();
export function getImportedArtwork(svgText: string): SvgImportResult {
  const hit = cache.get(svgText);
  if (hit) return hit;
  const result = importSvgArtwork(svgText);
  if (cache.size >= 4) cache.delete(cache.keys().next().value as string);
  cache.set(svgText, result);
  return result;
}

export interface ArtworkGeneration {
  template: RhinestoneTemplate;
  info: ArtworkInfo;
}

export function generateSvgArtwork(
  svgTool: SvgToolState,
  shapesOverride?: readonly ImportedShape[],
  overrides: { look?: ArtworkLook; analyse?: boolean } = {},
): ArtworkGeneration {
  const imported = shapesOverride ? null : getImportedArtwork(svgTool.uploadedSvgText ?? '');
  const shapes = shapesOverride ?? imported!.shapes;
  const custom = typeof svgTool.customSpacingMm === 'number' ? svgTool.customSpacingMm : undefined;
  const usePreset = svgTool.densityPreset !== 'custom' || custom !== undefined;

  const result = createArtworkTemplate({
    id: 'svg-preview',
    name: svgTool.svgFileName || 'SVG Preview',
    shapes,
    stoneSize: svgTool.stoneSize,
    look: overrides.look ?? lookFromCoverage(svgTool.coverageMode),
    rowCount: svgTool.contourSettings.rowCount,
    widthMm: typeof svgTool.targetWidthMm === 'number' ? svgTool.targetWidthMm : undefined,
    heightMm: typeof svgTool.targetHeightMm === 'number' ? svgTool.targetHeightMm : undefined,
    preserveAspectRatio: svgTool.preserveAspectRatio,
    densityPreset: usePreset ? svgTool.densityPreset : undefined,
    customSpacingMm: custom,
    layerRoles: svgTool.layerRoles,
    layerStoneColours: svgTool.layerStoneColours,
    analyse: overrides.analyse ?? true,
  });

  return {
    template: result.template,
    info: {
      layers: result.layers.map((layer) => ({ colour: layer.colour, role: layer.role, reason: layer.reason, stones: layer.stones })),
      source: result.placedShapes,
      feasibility: result.feasibility,
      warnings: [...(imported?.warnings ?? []), ...result.warnings],
      stoneSize: svgTool.stoneSize,
    },
  };
}

/** An uploaded picture: background removed, reduced to the chosen number of colours, then the same layout as SVG artwork. */
export function generateRasterArtwork(svgTool: SvgToolState, image: RasterImage): ArtworkGeneration {
  const custom = typeof svgTool.customSpacingMm === 'number' ? svgTool.customSpacingMm : undefined;
  const usePreset = svgTool.densityPreset !== 'custom' || custom !== undefined;
  const width = typeof svgTool.targetWidthMm === 'number' ? svgTool.targetWidthMm : undefined;
  const height = typeof svgTool.targetHeightMm === 'number' ? svgTool.targetHeightMm : undefined;
  // No size chosen yet: 100 mm on the longer side, as for SVG artwork.
  const landscape = image.widthPx >= image.heightPx;
  const layers = buildRasterLayers(image, {
    colorCount: svgTool.imageColorCount ?? 1,
    widthMm: width ?? (height === undefined && landscape ? 100 : undefined),
    heightMm: height ?? (width === undefined && !landscape ? 100 : undefined),
    preserveAspectRatio: svgTool.preserveAspectRatio,
    detail: svgTool.imageDetail,
    invert: svgTool.imageInvert,
    threshold: svgTool.imageThreshold,
  });
  const result = createArtworkTemplate({
    id: 'image-preview',
    name: svgTool.imageFileName || 'Image Artwork Preview',
    layers,
    stoneSize: svgTool.stoneSize,
    look: lookFromCoverage(svgTool.coverageMode),
    rowCount: svgTool.contourSettings.rowCount,
    densityPreset: usePreset ? svgTool.densityPreset : undefined,
    customSpacingMm: custom,
    layerRoles: svgTool.layerRoles,
    layerStoneColours: svgTool.layerStoneColours,
    analyse: true,
  });
  return {
    template: result.template,
    info: {
      layers: result.layers.map((layer) => ({ colour: layer.colour, role: layer.role, reason: layer.reason, stones: layer.stones })),
      source: result.placedShapes,
      feasibility: result.feasibility,
      warnings: [...layers.warnings, ...result.warnings],
      stoneSize: svgTool.stoneSize,
    },
  };
}

/** Past this many stones a picture of each look would take too long to make, so none is made. */
const THUMBNAIL_STONE_LIMIT = 6000;

/** Small pictures of the artwork in each look, made by the same generator (no size advice, so it is quicker). */
export function generateLookThumbnails(svgTool: SvgToolState): Partial<Record<ArtworkLook, TextThumbnail>> {
  const pictures: Partial<Record<ArtworkLook, TextThumbnail>> = {};
  if (!svgTool.uploadedSvgText) return pictures;
  for (const option of ARTWORK_LOOKS) {
    const { template } = generateSvgArtwork(svgTool, undefined, { look: option.look, analyse: false });
    if (template.stones.length > THUMBNAIL_STONE_LIMIT) return {};
    const drawn = dotsOf(template);
    if (drawn) pictures[option.look] = { ...drawn, isSample: false };
  }
  return pictures;
}
