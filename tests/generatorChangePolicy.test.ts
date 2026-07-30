import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDITOR_STATE,
  editorReducer,
  type EditorAction,
  type EditorState,
} from '../app/editor/EditorState';
import {
  resolveGeneratorMutationDecision,
  shouldPromptForGeneratorMutation,
} from '../app/editor/generatorChangePolicy';

function makeEditableState(): EditorState {
  let state = structuredClone(DEFAULT_EDITOR_STATE);
  state = editorReducer(state, {
    type: 'SET_TEMPLATE',
    template: {
      id: 'grid-template',
      name: 'Grid',
      unit: 'mm',
      stones: [
        { id: 'a', center: { x: 10, y: 10 }, holeDiameterMm: 3, stoneSize: 'SS10' },
      ],
    },
  });
  state = editorReducer({ ...state, activeTool: 'grid' }, { type: 'CONVERT_TO_EDITABLE' });
  return state;
}

describe('generatorChangePolicy', () => {
  it('prompts for generator mutations after Make Editable', () => {
    const state = makeEditableState();
    expect(
      shouldPromptForGeneratorMutation(state, { type: 'UPDATE_GRID_TOOL', updates: { columns: 8 } }),
    ).toBe(true);
  });

  it('does not prompt when design is not editable', () => {
    expect(
      shouldPromptForGeneratorMutation(DEFAULT_EDITOR_STATE, { type: 'UPDATE_GRID_TOOL', updates: { columns: 8 } }),
    ).toBe(false);
  });

  it('keep editable design applies the mutation and preserves editable state', () => {
    const pendingAction: EditorAction = { type: 'UPDATE_GRID_TOOL', updates: { columns: 8 } };
    expect(resolveGeneratorMutationDecision(pendingAction, 'keep')).toEqual([pendingAction]);
  });

  it('regenerate applies the mutation and discards editable changes', () => {
    const pendingAction: EditorAction = { type: 'UPDATE_GRID_TOOL', updates: { columns: 8 } };
    expect(resolveGeneratorMutationDecision(pendingAction, 'replace')).toEqual([
      pendingAction,
      { type: 'DISCARD_EDITABLE_CHANGES' },
    ]);
  });

  it('cancel applies nothing', () => {
    const pendingAction: EditorAction = { type: 'UPDATE_GRID_TOOL', updates: { columns: 8 } };
    expect(resolveGeneratorMutationDecision(pendingAction, 'cancel')).toEqual([]);
  });
});
