import { describe, expect, it } from 'vitest';
import { DEFAULT_EDITOR_STATE, type EditorState } from '../app/editor/EditorState';
import { FIT_TO_MAT_MARGIN, buildFitToMatPlan, canResizeDesign } from '../app/editor/fitToMat';

function stateWith(partial: Partial<EditorState>): EditorState {
  return { ...structuredClone(DEFAULT_EDITOR_STATE), ...partial };
}
const template = (id: string) => ({ id, name: 'T', unit: 'mm' as const, stones: [] });

describe('buildFitToMatPlan', () => {
  it('resizes a text design through its target size, keeping the proportions', () => {
    const state = stateWith({ activeTool: 'text', template: template('text-outline-preview') });
    const plan = buildFitToMatPlan(state, { widthMm: 584.2, heightMm: 100 }, '12x12');
    expect(plan?.action.type).toBe('UPDATE_TEXT_TOOL');
    expect(plan?.scale).toBeCloseTo(0.5 * (1 - FIT_TO_MAT_MARGIN), 5);
    if (plan?.action.type === 'UPDATE_TEXT_TOOL') {
      expect(plan.action.updates.preserveAspectRatio).toBe(true);
      expect(plan.action.updates.targetWidthMm).toBeLessThan(292.1);
    }
  });

  it('works from the Select tool, using the generated design to tell which tool made it', () => {
    const state = stateWith({ activeTool: 'select', template: template('text-dotmatrix-preview') });
    expect(buildFitToMatPlan(state, { widthMm: 400, heightMm: 50 }, '12x12')?.action.type).toBe('UPDATE_TEXT_TOOL');
  });

  it('resizes an uploaded SVG, and only when there is an upload', () => {
    const bare = stateWith({ activeTool: 'svg', template: template('svg-preview') });
    expect(buildFitToMatPlan(bare, { widthMm: 400, heightMm: 400 }, '12x12')).toBeNull();
    const withSvg = stateWith({ activeTool: 'svg', template: template('svg-preview'), svgTool: { ...DEFAULT_EDITOR_STATE.svgTool, uploadedSvgText: '<svg/>' } });
    expect(buildFitToMatPlan(withSvg, { widthMm: 400, heightMm: 400 }, '12x12')?.action.type).toBe('UPDATE_SVG_TOOL');
  });

  it('does nothing when the design already fits, or when it was made by hand', () => {
    const text = stateWith({ activeTool: 'text', template: template('text-outline-preview') });
    expect(buildFitToMatPlan(text, { widthMm: 100, heightMm: 50 }, '12x12')).toBeNull();
    const manual = stateWith({ activeTool: 'manual', template: template('manual') });
    expect(canResizeDesign(manual)).toBe(false);
    expect(buildFitToMatPlan(manual, { widthMm: 900, heightMm: 900 }, '12x12')).toBeNull();
  });
});
