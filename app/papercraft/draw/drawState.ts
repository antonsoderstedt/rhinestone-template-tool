import { newDoc, type DrawDoc } from '@/src/lib/papercraft-engine';

/** The drawing, what is selected, and a history to undo and redo. A drag changes the drawing without a history entry (PREVIEW) and is kept as one step when it ends (COMMIT). */
export interface DrawState {
  doc: DrawDoc;
  selection: number[];
  past: DrawDoc[];
  future: DrawDoc[];
  /** The drawing as it was before the drag that is going on. */
  pending: DrawDoc | null;
}

export const HISTORY_LIMIT = 100;

export function initialDrawState(doc: DrawDoc = newDoc()): DrawState {
  return { doc, selection: [], past: [], future: [], pending: null };
}

export type DrawAction =
  /** A finished change: one step in the history. */
  | { type: 'EDIT'; doc: DrawDoc; selection?: number[] }
  /** A change that is still going on (a drag): shown, not yet a step. */
  | { type: 'PREVIEW'; doc: DrawDoc }
  | { type: 'COMMIT' }
  | { type: 'CANCEL' }
  | { type: 'SELECT'; ids: number[] }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  /** A different drawing altogether (a new one, one opened from a file): the history starts again. */
  | { type: 'REPLACE'; doc: DrawDoc };

const push = (past: DrawDoc[], doc: DrawDoc) => [...past, doc].slice(-HISTORY_LIMIT);
const keepExisting = (doc: DrawDoc, ids: readonly number[]) => ids.filter((id) => doc.items.some((i) => i.id === id));

export function drawReducer(state: DrawState, action: DrawAction): DrawState {
  switch (action.type) {
    case 'EDIT': {
      if (action.doc === state.doc) return action.selection ? { ...state, selection: keepExisting(state.doc, action.selection) } : state;
      return { doc: action.doc, selection: keepExisting(action.doc, action.selection ?? state.selection), past: push(state.past, state.pending ?? state.doc), future: [], pending: null };
    }
    case 'PREVIEW':
      return { ...state, doc: action.doc, pending: state.pending ?? state.doc };
    case 'COMMIT':
      if (!state.pending) return state;
      return { ...state, past: state.pending === state.doc ? state.past : push(state.past, state.pending), future: state.pending === state.doc ? state.future : [], pending: null, selection: keepExisting(state.doc, state.selection) };
    case 'CANCEL':
      return state.pending ? { ...state, doc: state.pending, pending: null } : state;
    case 'SELECT':
      return { ...state, selection: keepExisting(state.doc, action.ids) };
    case 'UNDO': {
      if (state.pending) return { ...state, doc: state.pending, pending: null };
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return { doc: previous, selection: keepExisting(previous, state.selection), past: state.past.slice(0, -1), future: [state.doc, ...state.future].slice(0, HISTORY_LIMIT), pending: null };
    }
    case 'REDO': {
      const next = state.future[0];
      if (!next || state.pending) return state;
      return { doc: next, selection: keepExisting(next, state.selection), past: push(state.past, state.doc), future: state.future.slice(1), pending: null };
    }
    case 'REPLACE':
      return initialDrawState(action.doc);
  }
}
