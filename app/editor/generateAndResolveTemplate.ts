import {
  enlargeToCuttableSpacing,
  getDefaultMaterialProfile,
  resolveStoneSpacing,
  validateRhinestoneTemplate,
} from '@/src/lib/rhinestone-engine/index';
import type { RhinestoneTemplate } from '@/src/lib/rhinestone-engine/index';
import type { EditorTool } from './EditorState';

export interface SpacingAdjustmentSummary {
  adjustedStoneCount: number;
  movedStoneCount: number;
  removedStoneCount: number;
  maxDisplacementMm: number;
  resolutionPasses: number;
  tooDenseForStoneSize: boolean;
  /** Set when the whole layout was enlarged by this factor to make overlapping stones cuttable (stone fonts). */
  enlargedByFactor?: number;
}

export interface GenerateAndResolveTemplateResult {
  template: RhinestoneTemplate | null;
  spacingAdjustment: SpacingAdjustmentSummary | null;
  validation: ReturnType<typeof validateRhinestoneTemplate> | null;
}

export interface GenerateAndResolveTemplateOptions {
  sourceTool: EditorTool;
  generateTemplate: () => Promise<RhinestoneTemplate | null> | RhinestoneTemplate | null;
  minGapMm?: number;
}

const AUTO_SPACING_SOURCE_TOOLS = new Set<EditorTool>([
  'text',
  'svg',
  'svg-alphabet',
  'letter-stencil',
]);

export function shouldAutoResolveTemplateSpacing(sourceTool: EditorTool): boolean {
  return AUTO_SPACING_SOURCE_TOOLS.has(sourceTool);
}

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

export async function generateAndResolveTemplate(
  options: GenerateAndResolveTemplateOptions,
): Promise<GenerateAndResolveTemplateResult> {
  const generatedTemplate = await options.generateTemplate();
  if (!generatedTemplate) {
    return {
      template: null,
      spacingAdjustment: null,
      validation: null,
    };
  }

  const minGapMm = options.minGapMm ?? getDefaultMaterialProfile().minimumEdgeSpacingMm;
  const shouldResolve = shouldAutoResolveTemplateSpacing(options.sourceTool)
    && generatedTemplate.source !== 'vendor';

  let template = shouldResolve
    ? resolveStoneSpacing(generatedTemplate, {
        minGapMm,
        strategy: 'nudge',
      })
    : generatedTemplate;

  // Vendor stone fonts are often drawings of overlapping dots. Nudging cannot fix that (it would smear the
  // letters); the layout is enlarged until the stones fit instead, which keeps every letter intact.
  let enlargement: { scale: number; removedCount: number } | null = null;
  if (options.sourceTool === 'rhinestone-font') {
    const enlarged = enlargeToCuttableSpacing(generatedTemplate, { minGapMm });
    if (enlarged.scale > 1) {
      template = enlarged.template;
      enlargement = { scale: enlarged.scale, removedCount: enlarged.removedCount };
    }
  }

  const validation = validateRhinestoneTemplate(template, { minGapMm });
  const movedStoneCount = toNumber(template.metadata?.movedStoneCount);
  const removedStoneCount = toNumber(template.metadata?.removedStoneCount);
  const adjustedStoneCount = movedStoneCount + removedStoneCount;

  const spacingAdjustment = enlargement
    ? {
        adjustedStoneCount: enlargement.removedCount,
        movedStoneCount: template.stones.length,
        removedStoneCount: enlargement.removedCount,
        maxDisplacementMm: 0,
        resolutionPasses: 0,
        tooDenseForStoneSize: false,
        enlargedByFactor: enlargement.scale,
      }
    : shouldResolve
    ? {
        adjustedStoneCount,
        movedStoneCount,
        removedStoneCount,
        maxDisplacementMm: toNumber(template.metadata?.maxDisplacementMm),
        resolutionPasses: toNumber(template.metadata?.resolutionPasses),
        tooDenseForStoneSize: Boolean(template.metadata?.tooDenseForStoneSize),
      }
    : null;

  return {
    template,
    spacingAdjustment,
    validation,
  };
}
