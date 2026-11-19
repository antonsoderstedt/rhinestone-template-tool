import { describe, expect, it } from 'vitest';
import { DEFAULT_EDITOR_STATE, editorReducer, type EditableStone, type EditorState } from '../app/editor/EditorState';

function stone(id: string, x: number, y: number): EditableStone {
  return { id, center: { x, y }, holeDiameterMm: 3, stoneSize: 'SS10' };
}
const generated = [stone('a', 10, 10), stone('b', 10.5, 10), stone('c', 40, 40)];
function generatedState(): EditorState {
  return editorReducer(structuredClone(DEFAULT_EDITOR_STATE), {
    type: 'SET_TEMPLATE',
    template: { id: 'text-outline-preview', name: 'T', unit: 'mm', stones: generated },
  });
}

describe('REPLACE_STONES', () => {
  it('converts a generated design to editable and puts the new stones in', () => {
    const next = editorReducer(generatedState(), { type: 'REPLACE_STONES', stones: [stone('a', 9, 10), stone('b', 12, 10), stone('c', 40, 40)] });
    expect(next.editableTemplate.isEditable).toBe(true);
    expect(next.editableTemplate.stones.map((s) => s.center.x)).toEqual([9, 12, 40]);
  });

  it('undo brings back the stones as they were before the fix', () => {
    const fixed = editorReducer(generatedState(), { type: 'REPLACE_STONES', stones: [stone('a', 9, 10)] });
    const undone = editorReducer(fixed, { type: 'UNDO' });
    expect(undone.editableTemplate.stones.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(undone.editableTemplate.stones.find((s) => s.id === 'b')?.center.x).toBe(10.5);
    // and redo applies the fix again
    expect(editorReducer(undone, { type: 'REDO' }).editableTemplate.stones).toHaveLength(1);
  });

  it('is one undo step on an already editable design and drops selections of removed stones', () => {
    let state = editorReducer(generatedState(), { type: 'CONVERT_TO_EDITABLE' });
    state = editorReducer(state, { type: 'SET_SELECTED_STONES', ids: new Set(['b', 'c']) });
    const depth = state.history.past.length;
    const fixed = editorReducer(state, { type: 'REPLACE_STONES', stones: [stone('a', 10, 10), stone('c', 40, 40)] });
    expect(fixed.history.past.length).toBe(depth + 1);
    expect([...fixed.selectedStoneIds]).toEqual(['c']);
  });

  it('does nothing without a design', () => {
    const empty = structuredClone(DEFAULT_EDITOR_STATE);
    expect(editorReducer(empty, { type: 'REPLACE_STONES', stones: [stone('a', 1, 1)] })).toBe(empty);
  });
});
