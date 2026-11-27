import type { ModelRecipe, PagePin, RawMesh } from '@/src/lib/papercraft-engine';
import { findBuiltInModel } from './papercraftModels';

export type PaperPreset = 'a3' | 'a4' | 'a5' | 'letter' | 'tabloid' | 'cricut12x12' | 'cricut12x24' | 'custom';
export type SizeBy = 'height' | 'width' | 'depth' | 'largest';
/** `build` shows the parts of a model made from parts, to move with the mouse; it is only there for such a model. */
export type PapercraftView = 'model' | 'pattern' | 'pages' | 'build';

export type ModelSource =
  | { kind: 'builtin'; id: string }
  /**
   * `mesh` is what the pattern is made from and what is saved. `original` is the mesh before it was simplified: kept in this visit
   * only (a saved design holds the simplified mesh), so the detail can be changed or undone without importing the file again.
   * `recipe` is how a model built in the studio (from a template or from parts) is made: kept so it can be changed again.
   */
  | { kind: 'file'; fileName: string; mesh: RawMesh; original?: RawMesh; recipe?: ModelRecipe };

export interface PapercraftState {
  projectName: string;
  source: ModelSource;
  size: { by: SizeBy; mm: number };
  /** `customWidthMm` and `customHeightMm` are the size of the sheet when the preset is `custom`. */
  paper: { preset: PaperPreset; marginMm: number; gapMm: number; customWidthMm: number; customHeightMm: number };
  /** How much of a built-in model's detail is kept, in percent (100 is as it is made). An imported model is simplified by its face count instead. */
  detailPct: number;
  /** Where the person has put parts on the pages (by part id), how many parts to a page at most, and whether to pack tightly. */
  layout: { pins: Record<number, PagePin>; maxPartsPerPage: number | null; tight: boolean; /** The size of a square to measure on the first page, or none. */ calibrationMm: number | null };
  /** Each part in its own colour on the screen (it only tells parts apart; print and cut are not coloured). */
  colourParts: boolean;
  pattern: {
    tabWidthMm: number;
    tabAngleDeg: number;
    printedSide: 'outside' | 'inside';
    numberHeightMm: number;
    partLabels: boolean;
    /** The number on a part: its step in the order of building, or its place in the order of size. */
    numberPartsBy: 'size' | 'build';
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
    layout: { pins: {}, maxPartsPerPage: null, tight: true, calibrationMm: null },
    pattern: { tabWidthMm: 8, tabAngleDeg: 45, printedSide: 'outside', numberHeightMm: 3, partLabels: true, numberPartsBy: 'build' },
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
  /** A new model built in the studio from a recipe. The size is the longest side of the mesh, so the numbers of the recipe are the real sizes. */
  | { type: 'USE_RECIPE'; name: string; recipe: ModelRecipe; mesh: RawMesh; sizeMm: number }
  /** The recipe of the model built in the studio was changed: the mesh follows, the name and the paper stay. */
  | { type: 'SET_RECIPE'; recipe: ModelRecipe; mesh: RawMesh; sizeMm: number }
  /** Back to the imported mesh as it was before it was simplified. */
  | { type: 'RESTORE_ORIGINAL' }
  /** A repaired version of the imported mesh (holes closed, turned inside out). Ignored for a built-in model. */
  | { type: 'REPAIR_MESH'; mesh: RawMesh }
  | { type: 'SET_SIZE'; size: Partial<PapercraftState['size']> }
  | { type: 'SET_PAPER'; paper: Partial<PapercraftState['paper']> }
  | { type: 'SET_DETAIL'; pct: number }
  | { type: 'SET_COLOURS'; on: boolean }
  /** The parts as the person has placed them (all of them, so the layout stays as it is). */
  | { type: 'SET_PINS'; pins: Record<number, PagePin> }
  /** Back to the program placing the parts. */
  | { type: 'RESET_LAYOUT' }
  | { type: 'SET_PAGE_LIMIT'; limit: number | null }
  | { type: 'SET_TIGHT'; on: boolean }
  | { type: 'SET_CALIBRATION'; mm: number | null }
  | { type: 'SET_PATTERN'; pattern: Partial<PapercraftState['pattern']> }
  | { type: 'SET_COVER'; cover: boolean }
  /** Click on an edge: a folded edge is cut, a cut edge is folded. `joined` is what it is now. */
  | { type: 'TOGGLE_EDGE'; edgeId: number; joined: boolean }
  | { type: 'RESET_EDITS' }
  | { type: 'SET_VIEW'; view: PapercraftView }
  | { type: 'SELECT_PART'; partId: number | null }
  | { type: 'SET_FOLD'; fold: number };

/** The size to show for a built model: to a hundredth of a millimetre, within what the studio allows. */
const sizeOf = (mm: number) => (Number.isFinite(mm) && mm > 0 ? Math.round(Math.min(3000, Math.max(5, mm)) * 100) / 100 : 100);

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
        layout: { ...state.layout, pins: {} },
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
        layout: { ...state.layout, pins: {} },
        edits: { forceCut: [], forceJoin: [] },
        selectedPartId: null,
        fold: 1,
      };
    case 'USE_RECIPE':
      return {
        ...state,
        projectName: action.name,
        source: { kind: 'file', fileName: action.name, mesh: action.mesh, recipe: action.recipe },
        size: { by: 'largest', mm: sizeOf(action.sizeMm) },
        detailPct: 100,
        layout: { ...state.layout, pins: {} },
        edits: { forceCut: [], forceJoin: [] },
        selectedPartId: null,
        fold: 1,
      };
    case 'SET_RECIPE': {
      if (state.source.kind !== 'file') return state;
      return {
        ...state,
        source: { kind: 'file', fileName: state.source.fileName, mesh: action.mesh, recipe: action.recipe },
        size: { by: 'largest', mm: sizeOf(action.sizeMm) },
        layout: { ...state.layout, pins: {} },
        edits: { forceCut: [], forceJoin: [] },
        selectedPartId: null,
      };
    }
    case 'REPAIR_MESH':
      if (state.source.kind !== 'file') return state;
      return { ...state, source: { ...state.source, mesh: action.mesh }, layout: { ...state.layout, pins: {} }, edits: { forceCut: [], forceJoin: [] }, selectedPartId: null };
    case 'SIMPLIFY_MESH':
      if (state.source.kind !== 'file') return state;
      return {
        ...state,
        source: { ...state.source, mesh: action.mesh, original: state.source.original ?? state.source.mesh },
        layout: { ...state.layout, pins: {} },
        edits: { forceCut: [], forceJoin: [] },
        selectedPartId: null,
      };
    case 'RESTORE_ORIGINAL': {
      if (state.source.kind !== 'file' || !state.source.original) return state;
      const { original, ...rest } = state.source;
      return { ...state, source: { ...rest, mesh: original }, layout: { ...state.layout, pins: {} }, edits: { forceCut: [], forceJoin: [] }, selectedPartId: null };
    }
    case 'SET_SIZE': {
      const size = { ...state.size, ...action.size };
      if (!(size.mm > 0) || !Number.isFinite(size.mm)) return state;
      return { ...state, size, selectedPartId: null };
    }
    case 'SET_DETAIL':
      return { ...state, detailPct: Math.min(100, Math.max(MIN_DETAIL_PCT, Math.round(action.pct))), layout: { ...state.layout, pins: {} }, edits: { forceCut: [], forceJoin: [] }, selectedPartId: null };
    case 'SET_PINS':
      return { ...state, layout: { ...state.layout, pins: action.pins } };
    case 'RESET_LAYOUT':
      return { ...state, layout: { ...state.layout, pins: {} } };
    case 'SET_PAGE_LIMIT':
      // A limit changes which parts go where: the program places them again.
      return { ...state, layout: { ...state.layout, pins: {}, maxPartsPerPage: action.limit === null || !(action.limit >= 1) ? null : Math.min(50, Math.floor(action.limit)) } };
    case 'SET_TIGHT':
      return { ...state, layout: { ...state.layout, pins: {}, tight: action.on } };
    case 'SET_CALIBRATION':
      // The first page changes: the parts are placed again.
      return { ...state, layout: { ...state.layout, pins: {}, calibrationMm: action.mm !== null && action.mm >= 10 ? Math.min(500, action.mm) : null } };
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
