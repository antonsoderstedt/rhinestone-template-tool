import {
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

  const template = shouldResolve
    ? resolveStoneSpacing(generatedTemplate, {
        minGapMm,
        strategy: 'nudge',
      })
    : generatedTemplate;

  const validation = validateRhinestoneTemplate(template, { minGapMm });
  const movedStoneCount = toNumber(template.metadata?.movedStoneCount);
  const removedStoneCount = toNumber(template.metadata?.removedStoneCount);
  const adjustedStoneCount = movedStoneCount + removedStoneCount;

  const spacingAdjustment = shouldResolve
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
