/**
 * The Artwork tool's bridge to the engine: SVG text and tool settings in, a template and what the panel needs to say out.
 * The part shared with the worker is in `artworkCore.ts`; this file adds pictures (raster images) and look thumbnails.
 */

import { buildRasterLayers, createArtworkTemplate, type ArtworkLook, type RasterImage } from '@/src/lib/rhinestone-engine/index';
import { dotsOf, type TextThumbnail } from './textStyleThumbnails';
import type { SvgToolState } from './EditorState';
import { ARTWORK_LOOKS, generateSvgArtwork, lookFromCoverage, type ArtworkGeneration } from './artworkCore';

export * from './artworkCore';

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
