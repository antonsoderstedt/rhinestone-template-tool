import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDITOR_STATE,
  editorReducer,
  type EditableStone,
  type EditorState,
} from '../app/editor/EditorState';

function stone(id: string, x: number, y: number, holeDiameterMm = 3): EditableStone {
  return {
    id,
    center: { x, y },
    holeDiameterMm,
    stoneSize: 'SS10',
  };
}

function makeTemplate(stones: EditableStone[]) {
  return {
    id: 'template',
    name: 'Template',
    unit: 'mm' as const,
    stones,
  };
}

function makeEditableState(initialStones: EditableStone[] = [stone('a', 10, 10), stone('b', 30, 10), stone('c', 50, 10)]): EditorState {
  let state = structuredClone(DEFAULT_EDITOR_STATE);
  state = editorReducer(state, { type: 'SET_TEMPLATE', template: makeTemplate(initialStones) });
  state = editorReducer({ ...state, activeTool: 'grid' }, { type: 'CONVERT_TO_EDITABLE' });
  return state;
}

const filledSvg = '<svg xmlns="http://www.w3.org/2000/svg"><defs><style>.cls-1{fill:#ff7bb2;}</style></defs><path class="cls-1" d="M 0 0 L 100 0 L 100 40 L 0 40 Z" /></svg>';

describe('editorReducer', () => {
  it('uses outline placement by default when switching to a bold bundled outline font', () => {
    const state = editorReducer(structuredClone(DEFAULT_EDITOR_STATE), {
      type: 'UPDATE_TEXT_TOOL',
      updates: { fontId: 'archivo-black' },
    });
    expect(state.textTool.coverageMode).toBe('outline');
    expect(state.textTool.fillMode).toBe('outline');
    expect(state.textTool.outlineTextStyle).toBe('outline');
  });

  it('uses filled placement when switching to a medium-weight bundled outline font', () => {
    const state = editorReducer(structuredClone(DEFAULT_EDITOR_STATE), {
      type: 'UPDATE_TEXT_TOOL',
      updates: { fontId: 'oswald-condensed' },
    });
    expect(state.textTool.coverageMode).toBe('outline-fill');
    expect(state.textTool.fillMode).toBe('outline-fill');
    expect(state.textTool.outlineTextStyle).toBe('filled-typography');
  });

  it('lets outline text style drive the default text placement intent', () => {
    const filled = editorReducer(structuredClone(DEFAULT_EDITOR_STATE), {
      type: 'UPDATE_TEXT_TOOL',
      updates: { fontId: 'archivo-black', outlineTextStyle: 'filled-typography' },
    });
    expect(filled.textTool.coverageMode).toBe('outline-fill');
    expect(filled.textTool.fillMode).toBe('outline-fill');

    const outline = editorReducer(filled, {
      type: 'UPDATE_TEXT_TOOL',
      updates: { outlineTextStyle: 'outline' },
    });
    expect(outline.textTool.coverageMode).toBe('outline');
    expect(outline.textTool.fillMode).toBe('outline');
  });

  it('keeps legacy outline font on outline placement', () => {
    const bundled = editorReducer(structuredClone(DEFAULT_EDITOR_STATE), {
      type: 'UPDATE_TEXT_TOOL',
      updates: { fontId: 'archivo-black' },
    });
    const legacy = editorReducer(bundled, {
      type: 'UPDATE_TEXT_TOOL',
      updates: { fontId: 'legacy-original' },
    });
    expect(legacy.textTool.coverageMode).toBe('outline');
    expect(legacy.textTool.fillMode).toBe('outline');
  });

  it('syncs text coverage and fill mode controls', () => {
    const filled = editorReducer(structuredClone(DEFAULT_EDITOR_STATE), {
      type: 'UPDATE_TEXT_TOOL',
      updates: { fillMode: 'outline-fill' },
    });
    expect(filled.textTool.coverageMode).toBe('outline-fill');

    const outline = editorReducer(filled, {
      type: 'UPDATE_TEXT_TOOL',
      updates: { coverageMode: 'outline' },
    });
    expect(outline.textTool.fillMode).toBe('outline');
  });

  it('syncs SVG coverage and fill mode controls', () => {
    const filled = editorReducer(structuredClone(DEFAULT_EDITOR_STATE), {
      type: 'UPDATE_SVG_TOOL',
      updates: { fillMode: 'fill' },
    });
    expect(filled.svgTool.coverageMode).toBe('fill');

    const outlineFill = editorReducer(filled, {
      type: 'UPDATE_SVG_TOOL',
      updates: { coverageMode: 'outline-fill' },
    });
    expect(outlineFill.svgTool.fillMode).toBe('outline-fill');
  });

  it('defaults filled uploaded SVG artwork to outline-fill and a larger width', () => {
    const state = editorReducer(structuredClone(DEFAULT_EDITOR_STATE), {
      type: 'UPDATE_SVG_TOOL',
      updates: { uploadedSvgText: filledSvg },
    });
    expect(state.svgTool.coverageMode).toBe('outline-fill');
    expect(state.svgTool.fillMode).toBe('outline-fill');
    expect(state.svgTool.targetWidthMm).toBe(200);
  });

  it('clamps rhinestone font stone size to the selected font support', () => {
    const state = editorReducer(structuredClone(DEFAULT_EDITOR_STATE), {
      type: 'UPDATE_RHINESTONE_FONT_TOOL',
      updates: { rhinestoneFontId: 'test-fixture', stoneSize: 'SS6' },
    });
    expect(state.rhinestoneFontTool.stoneSize).toBe('SS10');
  });

  it('derives rhinestone font presentation mode from font style', () => {
    const line = editorReducer(structuredClone(DEFAULT_EDITOR_STATE), {
      type: 'UPDATE_RHINESTONE_FONT_TOOL',
      updates: { rhinestoneFontId: 'small-line-ss10' },
    });
    expect(line.rhinestoneFontTool.presentationMode).toBe('line');
    expect(line.rhinestoneFontTool.letterSpacingMm).toBe(0);

    const digits = editorReducer(structuredClone(DEFAULT_EDITOR_STATE), {
      type: 'UPDATE_RHINESTONE_FONT_TOOL',
      updates: { rhinestoneFontId: 'huge-numbers-ss10' },
    });
    expect(digits.rhinestoneFontTool.presentationMode).toBe('digits');
    expect(digits.rhinestoneFontTool.letterSpacingMm).toBe(0);
  });

  it('updates rhinestone font sample text when switching fonts from an untouched sample', () => {
    const state = editorReducer(structuredClone(DEFAULT_EDITOR_STATE), {
      type: 'UPDATE_RHINESTONE_FONT_TOOL',
      updates: { rhinestoneFontId: 'small-line-ss10' },
    });
    expect(state.rhinestoneFontTool.text).toBe('CHEER');
  });

  it('preserves custom rhinestone font text when switching fonts', () => {
    const custom = editorReducer(structuredClone(DEFAULT_EDITOR_STATE), {
      type: 'UPDATE_RHINESTONE_FONT_TOOL',
      updates: { text: 'Custom Name' },
    });
    const switched = editorReducer(custom, {
      type: 'UPDATE_RHINESTONE_FONT_TOOL',
      updates: { rhinestoneFontId: 'huge-numbers-ss10' },
    });
    expect(switched.rhinestoneFontTool.text).toBe('Custom Name');
  });

  it('preserves custom rhinestone font spacing when switching fonts', () => {
    const custom = editorReducer(structuredClone(DEFAULT_EDITOR_STATE), {
      type: 'UPDATE_RHINESTONE_FONT_TOOL',
      updates: { letterSpacingMm: 2.5, lineSpacingMm: 1.5 },
    });
    const switched = editorReducer(custom, {
      type: 'UPDATE_RHINESTONE_FONT_TOOL',
      updates: { rhinestoneFontId: 'small-line-ss10' },
    });
    expect(switched.rhinestoneFontTool.presentationMode).toBe('line');
    expect(switched.rhinestoneFontTool.letterSpacingMm).toBe(2.5);
    expect(switched.rhinestoneFontTool.lineSpacingMm).toBe(1.5);
  });

  it('supports Make Editable and undo', () => {
    let state = structuredClone(DEFAULT_EDITOR_STATE);
    state = editorReducer(state, { type: 'SET_TEMPLATE', template: makeTemplate([stone('a', 10, 10)]) });
    state = editorReducer({ ...state, activeTool: 'grid' }, { type: 'CONVERT_TO_EDITABLE' });
    expect(state.editableTemplate.isEditable).toBe(true);
    expect(state.history.past).toHaveLength(1);

    state = editorReducer(state, { type: 'UNDO' });
    expect(state.editableTemplate.stones).toHaveLength(0);
  });

  it('adds and deletes stones with undo/redo support', () => {
    let state = makeEditableState([stone('a', 10, 10)]);
    state = editorReducer(state, { type: 'ADD_STONES', stones: [stone('b', 25, 10)] });
    expect(state.editableTemplate.stones).toHaveLength(2);

    state = editorReducer(state, { type: 'DELETE_STONES', stoneIds: ['b'] });
    expect(state.editableTemplate.stones.map((item) => item.id)).toEqual(['a']);

    state = editorReducer(state, { type: 'UNDO' });
    expect(state.editableTemplate.stones).toHaveLength(2);

    state = editorReducer(state, { type: 'REDO' });
    expect(state.editableTemplate.stones.map((item) => item.id)).toEqual(['a']);
  });

  it('duplicates stones with a 5mm offset', () => {
    let state = makeEditableState([stone('a', 10, 10)]);
    state = editorReducer(state, { type: 'DUPLICATE_STONES', stoneIds: ['a'] });
    expect(state.editableTemplate.stones).toHaveLength(2);
    const duplicate = state.editableTemplate.stones.find((item) => item.id !== 'a');
    expect(duplicate?.center).toEqual({ x: 15, y: 15 });
  });

  it('copies and pastes stones with a 10mm offset', () => {
    let state = makeEditableState([stone('a', 10, 10)]);
    state = editorReducer(state, { type: 'COPY_STONES', stoneIds: ['a'] });
    state = editorReducer(state, { type: 'PASTE_STONES' });
    const pasted = state.editableTemplate.stones.find((item) => item.id !== 'a');
    expect(pasted?.center).toEqual({ x: 20, y: 20 });
  });

  it('updates X/Y with history support', () => {
    let state = makeEditableState([stone('a', 10, 10)]);
    state = editorReducer(state, { type: 'UPDATE_STONE', id: 'a', updates: { center: { x: 22, y: 18 } } });
    expect(state.editableTemplate.stones[0]?.center).toEqual({ x: 22, y: 18 });
    expect(state.history.past).toHaveLength(2);
  });

  it('aligns stones horizontally and vertically', () => {
    let state = makeEditableState([stone('a', 10, 10), stone('b', 30, 20), stone('c', 50, 30)]);
    state = editorReducer(state, { type: 'ALIGN_STONES', stoneIds: ['a', 'b', 'c'], direction: 'center' });
    expect(state.editableTemplate.stones.map((item) => item.center.x)).toEqual([30, 30, 30]);

    state = editorReducer(state, { type: 'ALIGN_STONES', stoneIds: ['a', 'b', 'c'], direction: 'middle' });
    expect(state.editableTemplate.stones.map((item) => item.center.y)).toEqual([20, 20, 20]);
  });

  it('distributes stones horizontally and vertically', () => {
    let state = makeEditableState([stone('a', 10, 10), stone('b', 20, 10), stone('c', 50, 10)]);
    state = editorReducer(state, { type: 'DISTRIBUTE_STONES', stoneIds: ['a', 'b', 'c'], direction: 'horizontal' });
    expect(state.editableTemplate.stones.map((item) => item.center.x)).toEqual([10, 30, 50]);

    state = makeEditableState([stone('a', 10, 10), stone('b', 10, 20), stone('c', 10, 50)]);
    state = editorReducer(state, { type: 'DISTRIBUTE_STONES', stoneIds: ['a', 'b', 'c'], direction: 'vertical' });
    expect(state.editableTemplate.stones.map((item) => item.center.y)).toEqual([10, 30, 50]);
  });

  it('clears redo after a new mutation', () => {
    let state = makeEditableState([stone('a', 10, 10)]);
    state = editorReducer(state, { type: 'ADD_STONES', stones: [stone('b', 25, 10)] });
    state = editorReducer(state, { type: 'UNDO' });
    expect(state.history.future).toHaveLength(1);

    state = editorReducer(state, { type: 'ADD_STONES', stones: [stone('c', 40, 10)] });
    expect(state.history.future).toHaveLength(0);
  });

  it('does not create history for zoom, pan, hover-like canvas updates or selection', () => {
    let state = makeEditableState();
    const historyLength = state.history.past.length;
    state = editorReducer(state, { type: 'UPDATE_CANVAS', updates: { zoom: 2, panX: 20, panY: 10 } });
    state = editorReducer(state, { type: 'SET_SELECTED_STONES', ids: new Set(['a']) });
    expect(state.history.past).toHaveLength(historyLength);
  });

  it('blocks collision on add', () => {
    const state = makeEditableState([stone('a', 10, 10)]);
    const nextState = editorReducer(state, { type: 'ADD_STONES', stones: [stone('b', 10.5, 10)] });
    expect(nextState.editableTemplate.stones).toHaveLength(1);
    expect(nextState.history.past).toHaveLength(state.history.past.length);
  });

  it('blocks collision on drag-like move', () => {
    const state = makeEditableState([stone('a', 10, 10), stone('b', 20, 10)]);
    const nextState = editorReducer(state, { type: 'MOVE_STONES', moves: [{ id: 'a', toX: 19, toY: 10 }] });
    expect(nextState.editableTemplate.stones[0]?.center).toEqual({ x: 10, y: 10 });
  });

  it('blocks collision on X/Y editing', () => {
    const state = makeEditableState([stone('a', 10, 10), stone('b', 20, 10)]);
    const nextState = editorReducer(state, { type: 'UPDATE_STONE', id: 'a', updates: { center: { x: 19, y: 10 } } });
    expect(nextState.editableTemplate.stones[0]?.center).toEqual({ x: 10, y: 10 });
  });

  it('restores editable projects with empty history and direct editability', () => {
    let state = makeEditableState([stone('a', 10, 10)]);
    state = editorReducer(state, {
      type: 'RESTORE_EDITABLE',
      stones: [stone('restored', 30, 30)],
      sourceGenerator: 'manual-grid',
    });
    expect(state.history.past).toHaveLength(0);
    expect(state.editableTemplate.sourceGenerator).toBe('manual-grid');

    state = editorReducer(state, { type: 'ADD_STONES', stones: [stone('new', 50, 50)] });
    expect(state.editableTemplate.stones).toHaveLength(2);
  });
});
