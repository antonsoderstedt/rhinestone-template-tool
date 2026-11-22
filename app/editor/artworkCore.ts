/**
 * The Artwork tool's bridge to the engine (the part that also runs in the worker): SVG text and tool settings in, a template and what the panel needs to say out.
 * The tool keeps its older state fields (coverage mode, contour settings) so saved projects still open; the three looks
 * the user sees map onto them.
 */

// Deep imports, not the engine's index: this file is bundled into the artwork worker, which must not pull in the fonts,
// storage and export code the index re-exports.
import { createArtworkTemplate, type ArtworkLook } from '@/src/lib/rhinestone-engine/artwork/artworkTemplate';
import type { FeasibilityReport } from '@/src/lib/rhinestone-engine/artwork/feasibility';
import type { PlacedShape } from '@/src/lib/rhinestone-engine/artwork/layers';
import { importSvgArtwork, type ImportedShape, type SvgImportResult } from '@/src/lib/rhinestone-engine/svg/svgImport';
import type { RhinestoneTemplate, StoneSizeId } from '@/src/lib/rhinestone-engine/types/index';
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
