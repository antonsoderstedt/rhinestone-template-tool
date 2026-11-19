/**
 * The Artwork tool's bridge to the engine: SVG text and tool settings in, a template and what the panel needs to say out.
 * The tool keeps its older state fields (coverage mode, contour settings) so saved projects still open; the three looks
 * the user sees map onto them.
 */

import {
  createArtworkTemplate,
  importSvgArtwork,
  type ArtworkLook,
  type FeasibilityReport,
  type ImportedShape,
  type RhinestoneTemplate,
  type StoneSizeId,
  type SvgImportResult,
} from '@/src/lib/rhinestone-engine/index';
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

export function generateSvgArtwork(svgTool: SvgToolState, shapesOverride?: readonly ImportedShape[]): ArtworkGeneration {
  const imported = shapesOverride ? null : getImportedArtwork(svgTool.uploadedSvgText ?? '');
  const shapes = shapesOverride ?? imported!.shapes;
  const custom = typeof svgTool.customSpacingMm === 'number' ? svgTool.customSpacingMm : undefined;
  const usePreset = svgTool.densityPreset !== 'custom' || custom !== undefined;

  const result = createArtworkTemplate({
    id: 'svg-preview',
    name: svgTool.svgFileName || 'SVG Preview',
    shapes,
    stoneSize: svgTool.stoneSize,
    look: lookFromCoverage(svgTool.coverageMode),
    rowCount: svgTool.contourSettings.rowCount,
    widthMm: typeof svgTool.targetWidthMm === 'number' ? svgTool.targetWidthMm : undefined,
    heightMm: typeof svgTool.targetHeightMm === 'number' ? svgTool.targetHeightMm : undefined,
    preserveAspectRatio: svgTool.preserveAspectRatio,
    densityPreset: usePreset ? svgTool.densityPreset : undefined,
    customSpacingMm: custom,
    layerRoles: svgTool.layerRoles,
    analyse: true,
  });

  return {
    template: result.template,
    info: {
      layers: result.layers.map((layer) => ({ colour: layer.colour, role: layer.role, reason: layer.reason, stones: layer.stones })),
      feasibility: result.feasibility,
      warnings: [...(imported?.warnings ?? []), ...result.warnings],
      stoneSize: svgTool.stoneSize,
    },
  };
}
