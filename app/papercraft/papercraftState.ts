import type { RawMesh } from '@/src/lib/papercraft-engine';
import { findBuiltInModel } from './papercraftModels';

export type PaperPreset = 'a3' | 'a4' | 'a5' | 'letter' | 'tabloid' | 'cricut12x12' | 'cricut12x24' | 'custom';
export type SizeBy = 'height' | 'width' | 'depth' | 'largest';
export type PapercraftView = 'model' | 'pattern' | 'pages';

export type ModelSource =
  | { kind: 'builtin'; id: string }
  /**
   * `mesh` is what the pattern is made from and what is saved. `original` is the mesh before it was simplified: kept in this visit
   * only (a saved design holds the simplified mesh), so the detail can be changed or undone without importing the file again.
   */
  | { kind: 'file'; fileName: string; mesh: RawMesh; original?: RawMesh };

export interface PapercraftState {
  projectName: string;
  source: ModelSource;
  size: { by: SizeBy; mm: number };
  /** `customWidthMm` and `customHeightMm` are the size of the sheet when the preset is `custom`. */
  paper: { preset: PaperPreset; marginMm: number; gapMm: number; customWidthMm: number; customHeightMm: number };
  /** How much of a built-in model's detail is kept, in percent (100 is as it is made). An imported model is simplified by its face count instead. */
  detailPct: number;
  /** Each part in its own colour on the screen (it only tells parts apart; print and cut are not coloured). */
  colourParts: boolean;
  pattern: {
    tabWidthMm: number;
    tabAngleDeg: number;
    printedSide: 'outside' | 'inside';
    numberHeightMm: number;
    partLabels: boolean;
  };
  /** A cover page first in the PDF. */
  cover: boolean;
  /** Edge ids the user has cut or joined by hand (ids belong to the current model). */
  edits: { forceCut: number[]; forceJoin: number[] };
  view: PapercraftView;
  selectedPartId: number | null;
  /** 1 is the finished model, 0 is laid flat. */
  fold: number;
}

export const DEFAULT_MODEL_ID = 'test-cube';

/** The least detail a built-in model keeps: below this it is no longer the animal. */
export const MIN_DETAIL_PCT = 30;

export function initialPapercraftState(): PapercraftState {
  const model = findBuiltInModel(DEFAULT_MODEL_ID)!;
  return {
    projectName: model.name,
    source: { kind: 'builtin', id: model.id },
    size: { by: 'largest', mm: model.defaultSizeMm },
    paper: { preset: 'a4', marginMm: 10, gapMm: 3, customWidthMm: 300, customHeightMm: 400 },
    detailPct: 100,
    colourParts: false,
    pattern: { tabWidthMm: 8, tabAngleDeg: 45, printedSide: 'outside', numberHeightMm: 3, partLabels: true },
    cover: true,
    edits: { forceCut: [], forceJoin: [] },
    view: 'pattern',
    selectedPartId: null,
    fold: 1,
  };
}

export type PapercraftAction =
  /** Replace everything: a saved design, a shared link, an old version. */
  | { type: 'LOAD_STATE'; state: PapercraftState }
  | { type: 'SET_NAME'; name: string }
  | { type: 'USE_BUILT_IN'; id: string }
  | { type: 'USE_FILE'; fileName: string; mesh: RawMesh; original?: RawMesh }
  /** A simplified version of the imported mesh (fewer faces). The mesh it came from is kept so the change can be undone. */
  | { type: 'SIMPLIFY_MESH'; mesh: RawMesh }
  /** Back to the imported mesh as it was before it was simplified. */
  | { type: 'RESTORE_ORIGINAL' }
  /** A repaired version of the imported mesh (holes closed, turned inside out). Ignored for a built-in model. */
  | { type: 'REPAIR_MESH'; mesh: RawMesh }
  | { type: 'SET_SIZE'; size: Partial<PapercraftState['size']> }
  | { type: 'SET_PAPER'; paper: Partial<PapercraftState['paper']> }
  | { type: 'SET_DETAIL'; pct: number }
  | { type: 'SET_COLOURS'; on: boolean }
  | { type: 'SET_PATTERN'; pattern: Partial<PapercraftState['pattern']> }
  | { type: 'SET_COVER'; cover: boolean }
  /** Click on an edge: a folded edge is cut, a cut edge is folded. `joined` is what it is now. */
  | { type: 'TOGGLE_EDGE'; edgeId: number; joined: boolean }
  | { type: 'RESET_EDITS' }
  | { type: 'SET_VIEW'; view: PapercraftView }
  | { type: 'SELECT_PART'; partId: number | null }
  | { type: 'SET_FOLD'; fold: number };

const without = (list: readonly number[], id: number) => list.filter((x) => x !== id);

export function papercraftReducer(state: PapercraftState, action: PapercraftAction): PapercraftState {
  switch (action.type) {
    case 'LOAD_STATE':
      // The view stays the one the person is in; the rest is the loaded design.
      return { ...action.state, view: state.view, selectedPartId: null, fold: 1 };
    case 'SET_NAME':
      return { ...state, projectName: action.name };
    case 'USE_BUILT_IN': {
      const model = findBuiltInModel(action.id);
      if (!model) return state;
      return {
        ...state,
        projectName: model.name,
        source: { kind: 'builtin', id: model.id },
        size: { by: 'largest', mm: model.defaultSizeMm },
        detailPct: 100,
        edits: { forceCut: [], forceJoin: [] },
        selectedPartId: null,
        fold: 1,
      };
    }
    case 'USE_FILE':
      return {
        ...state,
        projectName: action.fileName.replace(/\.[^.]+$/, '') || 'Model',
        source: { kind: 'file', fileName: action.fileName, mesh: action.mesh, ...(action.original ? { original: action.original } : {}) },
        size: { by: 'largest', mm: 100 },
        detailPct: 100,
        edits: { forceCut: [], forceJoin: [] },
        selectedPartId: null,
        fold: 1,
      };
    case 'REPAIR_MESH':
      if (state.source.kind !== 'file') return state;
      return { ...state, source: { ...state.source, mesh: action.mesh }, edits: { forceCut: [], forceJoin: [] }, selectedPartId: null };
    case 'SIMPLIFY_MESH':
      if (state.source.kind !== 'file') return state;
      return {
        ...state,
        source: { ...state.source, mesh: action.mesh, original: state.source.original ?? state.source.mesh },
        edits: { forceCut: [], forceJoin: [] },
        selectedPartId: null,
      };
    case 'RESTORE_ORIGINAL': {
      if (state.source.kind !== 'file' || !state.source.original) return state;
      const { original, ...rest } = state.source;
      return { ...state, source: { ...rest, mesh: original }, edits: { forceCut: [], forceJoin: [] }, selectedPartId: null };
    }
    case 'SET_SIZE': {
      const size = { ...state.size, ...action.size };
      if (!(size.mm > 0) || !Number.isFinite(size.mm)) return state;
      return { ...state, size, selectedPartId: null };
    }
    case 'SET_DETAIL':
      return { ...state, detailPct: Math.min(100, Math.max(MIN_DETAIL_PCT, Math.round(action.pct))), edits: { forceCut: [], forceJoin: [] }, selectedPartId: null };
    case 'SET_COLOURS':
      return { ...state, colourParts: action.on };
    case 'SET_PAPER':
      return { ...state, paper: { ...state.paper, ...action.paper }, selectedPartId: null };
    case 'SET_PATTERN':
      return { ...state, pattern: { ...state.pattern, ...action.pattern }, selectedPartId: null };
    case 'SET_COVER':
      return { ...state, cover: action.cover };
    case 'TOGGLE_EDGE': {
      const { forceCut, forceJoin } = state.edits;
      const edits = action.joined
        ? { forceCut: [...without(forceCut, action.edgeId), action.edgeId], forceJoin: without(forceJoin, action.edgeId) }
        : { forceCut: without(forceCut, action.edgeId), forceJoin: [...without(forceJoin, action.edgeId), action.edgeId] };
      return { ...state, edits, selectedPartId: null };
    }
    case 'RESET_EDITS':
      return { ...state, edits: { forceCut: [], forceJoin: [] }, selectedPartId: null };
    case 'SET_VIEW':
      return { ...state, view: action.view };
    case 'SELECT_PART':
      return { ...state, selectedPartId: action.partId };
    case 'SET_FOLD':
      return { ...state, fold: Math.min(1, Math.max(0, action.fold)) };
  }
}
