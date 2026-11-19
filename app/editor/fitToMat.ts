/**
 * "Fit to mat": turns a design that is too big for a Cricut mat into a smaller one.
 *
 * Stones cannot simply be squeezed closer (the holes would overlap), so the design is regenerated
 * smaller by changing the target size of the tool that made it. Designs made by hand, or by tools
 * without a size setting, cannot be resized this way and return null.
 */

import { getFitToMatScale, type MatId } from '@/src/lib/rhinestone-engine/index';
import type { EditorAction, EditorState } from './EditorState';
import { getEditableSourceGenerator } from './projectPersistence';

/** Generated designs snap to whole stones, so aim a little under the mat to be sure of fitting. */
export const FIT_TO_MAT_MARGIN = 0.03;

export interface FitToMatPlan {
  action: EditorAction;
  /** Fraction of the current size the design is resized to (below 1). */
  scale: number;
  targetWidthMm: number;
  targetHeightMm: number;
}

type SizedGenerator = 'text' | 'svg';

function resolveSizedGenerator(state: Pick<EditorState, 'activeTool' | 'textTool' | 'editableTemplate' | 'template'>): SizedGenerator | null {
  const generator = getEditableSourceGenerator(state);
  if (generator === 'outline-text' || generator === 'dot-matrix-text') return 'text';
  if (generator === 'svg-upload' || generator === 'polyline-logo') return 'svg';

  // Not editing and on the Select tool: the generated template remembers which tool made it.
  const id = state.template?.id ?? '';
  if (id.startsWith('text-')) return 'text';
  if (id.startsWith('svg-')) return 'svg';
  return null;
}

/** True when the design came from a tool with a size setting, so it can be regenerated smaller. */
export function canResizeDesign(
  state: Pick<EditorState, 'activeTool' | 'textTool' | 'svgTool' | 'editableTemplate' | 'template'>,
): boolean {
  const generator = resolveSizedGenerator(state);
  if (!generator) return false;
  if (generator === 'svg') return Boolean(state.svgTool.uploadedSvgText || state.svgTool.uploadedImageDataUrl);
  return true;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildFitToMatPlan(
  state: Pick<EditorState, 'activeTool' | 'textTool' | 'svgTool' | 'editableTemplate' | 'template'>,
  currentSizeMm: { widthMm: number; heightMm: number },
  mat: MatId,
): FitToMatPlan | null {
  const fit = getFitToMatScale(currentSizeMm.widthMm, currentSizeMm.heightMm, mat, FIT_TO_MAT_MARGIN);
  if (fit.alreadyFits) return null;

  if (!canResizeDesign(state)) return null;
  const generator = resolveSizedGenerator(state);
  if (!generator) return null;

  const targetWidthMm = round1(currentSizeMm.widthMm * fit.scale);
  const targetHeightMm = round1(currentSizeMm.heightMm * fit.scale);
  const updates = { targetWidthMm, targetHeightMm, preserveAspectRatio: true };

  return {
    action: generator === 'text' ? { type: 'UPDATE_TEXT_TOOL', updates } : { type: 'UPDATE_SVG_TOOL', updates },
    scale: fit.scale,
    targetWidthMm,
    targetHeightMm,
  };
}
