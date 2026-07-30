import type { EditorAction, EditorState } from './EditorState';

export type GeneratorChangeDecision = 'replace' | 'keep' | 'cancel';

export function shouldPromptForGeneratorMutation(state: EditorState, action: EditorAction): boolean {
  if (!state.editableTemplate.isEditable) {
    return false;
  }

  return (
    action.type === 'UPDATE_TEXT_TOOL' ||
    action.type === 'UPDATE_SVG_TOOL' ||
    action.type === 'UPDATE_GRID_TOOL'
  );
}

export function resolveGeneratorMutationDecision(
  pendingAction: EditorAction,
  decision: GeneratorChangeDecision,
): EditorAction[] {
  if (decision === 'cancel') {
    return [];
  }

  if (decision === 'keep') {
    return [pendingAction];
  }

  return [pendingAction, { type: 'DISCARD_EDITABLE_CHANGES' }];
}
