import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDITOR_STATE,
  editorReducer,
  type EditorState,
} from '../app/editor/EditorState';
import {
  buildEffectiveTemplate,
  buildProjectFileFromEditorState,
} from '../app/editor/projectPersistence';

function makeState(): EditorState {
  let state = structuredClone(DEFAULT_EDITOR_STATE);
  state = editorReducer(state, {
    type: 'SET_TEMPLATE',
    template: {
      id: 'template',
      name: 'Template',
      unit: 'mm',
      stones: [
        { id: 'a', center: { x: 10, y: 10 }, holeDiameterMm: 3, stoneSize: 'SS10' },
      ],
    },
  });
  return state;
}

describe('projectPersistence', () => {
  it('builds an effective template from editable stones', () => {
    let state = makeState();
    state = editorReducer({ ...state, activeTool: 'grid' }, { type: 'CONVERT_TO_EDITABLE' });
    state = editorReducer(state, {
      type: 'ADD_STONES',
      stones: [{ id: 'b', center: { x: 40, y: 10 }, holeDiameterMm: 3, stoneSize: 'SS10' }],
    });

    const effective = buildEffectiveTemplate(state);
    expect(effective?.stones.map((stone) => stone.id)).toEqual(['a', 'b']);
  });

  it('stores export settings and editable state in the saved project', () => {
    let state = makeState();
    state.includeGuideBox = false;
    state.includeLabels = true;
    state.paddingMm = 9;
    state = editorReducer({ ...state, activeTool: 'grid' }, { type: 'CONVERT_TO_EDITABLE' });

    const project = buildProjectFileFromEditorState(state);
    expect(project?.exportSettings).toEqual({
      includeGuideBox: false,
      includeLabels: true,
      paddingMm: 9,
    });
    expect(project?.editableState?.isEditable).toBe(true);
  });
});
