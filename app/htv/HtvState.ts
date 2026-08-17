/**
 * HTV Studio state — completely separate from the rhinestone editor's
 * EditorState.ts (see chat decision log: HTV is its own section with its
 * own canvas/state, sharing only presentational UI components).
 *
 * A design is a stack of layers (text or vector). Every layer resolves to
 * closed vector geometry (Polyline[]) — there is no "raw raster layer" that
 * survives into the export, since an HTV cut file must be vector paths,
 * never rasterized. An imported image is only ever a staging step inside
 * the silhouette-conversion tool; it becomes a real vector layer once the
 * user applies the trace.
 */

import type { Polyline } from '@/src/lib/rhinestone-engine/index';
import type { GarmentSize, GarmentType } from '../components/garmentPreview/garmentCatalog';
import type { HtvPlacementZone } from './htvPlacementZones';
import { DEFAULT_HTV_COLOR_ID } from './htvMaterialCatalog';

// ─── Layers ─────────────────────────────────────────────────────────────────

export type HtvLayerType = 'text' | 'vector';
export type HtvVectorSourceKind = 'svg-upload' | 'silhouette-trace' | 'library-asset';

interface HtvLayerBase {
  id: string;
  name: string;
  /** Center position on the design canvas, mm. */
  x: number;
  y: number;
  rotationDeg: number;
  /** Uniform scale multiplier applied on top of the layer's natural size. */
  scale: number;
  visible: boolean;
  locked: boolean;
  /** HTV material color id — see htvMaterialCatalog.ts. */
  colorId: string;
}

export interface HtvTextLayer extends HtvLayerBase {
  type: 'text';
  text: string;
  fontId: string;
  fontSizeMm: number;
  letterSpacingMm: number;
  align: 'left' | 'center' | 'right';
  /** Arc-bend amount, -100 (frown) to 100 (smile), 0 = straight baseline. */
  curveAmount: number;
}

export interface HtvVectorLayer extends HtvLayerBase {
  type: 'vector';
  sourceKind: HtvVectorSourceKind;
  /** Closed polylines defining the cut shape, in the layer's own local mm space, before position/rotation/scale are applied. */
  polylines: Polyline[];
  naturalWidthMm: number;
  naturalHeightMm: number;
}

export type HtvLayer = HtvTextLayer | HtvVectorLayer;

// ─── History ────────────────────────────────────────────────────────────────

export interface HtvHistoryEntry {
  layers: HtvLayer[];
  selectedLayerIds: Set<string>;
}

export const HTV_MAX_HISTORY_LENGTH = 100;

function pushHtvHistory(past: readonly HtvHistoryEntry[], entry: HtvHistoryEntry): HtvHistoryEntry[] {
  const next = [...past, entry];
  return next.length > HTV_MAX_HISTORY_LENGTH ? next.slice(next.length - HTV_MAX_HISTORY_LENGTH) : next;
}

function generateSequentialLayerIds(existingLayers: readonly HtvLayer[], prefix: string, count: number): string[] {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const layer of existingLayers) {
    const m = pattern.exec(layer.id);
    if (m) {
      const n = parseInt(m[1]!, 10);
      if (n > max) max = n;
    }
  }
  return Array.from({ length: count }, (_, i) => `${prefix}-${max + i + 1}`);
}

// ─── Garment placement ────────────────────────────────────────────────────────

export interface HtvGarmentState {
  type: GarmentType;
  size: GarmentSize;
  colorId: string;
  placementZone: HtvPlacementZone;
}

// ─── Canvas ─────────────────────────────────────────────────────────────────

export interface HtvCanvasState {
  zoom: number;
  panX: number;
  panY: number;
}

// ─── Top-level state ──────────────────────────────────────────────────────────

export interface HtvState {
  projectName: string;
  layers: HtvLayer[];
  selectedLayerIds: Set<string>;
  canvas: HtvCanvasState;
  garment: HtvGarmentState;
  history: { past: HtvHistoryEntry[]; future: HtvHistoryEntry[] };
}

export const DEFAULT_HTV_CANVAS_STATE: HtvCanvasState = { zoom: 1, panX: 0, panY: 0 };

export const DEFAULT_HTV_GARMENT_STATE: HtvGarmentState = {
  type: 'tshirt',
  size: 'M',
  colorId: 'white',
  placementZone: 'center-chest',
};

export const DEFAULT_HTV_STATE: HtvState = {
  projectName: 'Untitled HTV Design',
  layers: [],
  selectedLayerIds: new Set(),
  canvas: { ...DEFAULT_HTV_CANVAS_STATE },
  garment: { ...DEFAULT_HTV_GARMENT_STATE },
  history: { past: [], future: [] },
};

// ─── Actions ──────────────────────────────────────────────────────────────────

export type HtvAction =
  | { type: 'SET_PROJECT_NAME'; name: string }
  | { type: 'ADD_LAYERS'; layers: HtvLayer[] }
  | { type: 'UPDATE_LAYER'; id: string; updates: Partial<HtvLayer> }
  | { type: 'UPDATE_LAYERS'; ids: string[]; updates: Partial<Pick<HtvLayer, 'x' | 'y' | 'rotationDeg' | 'scale' | 'colorId' | 'visible' | 'locked'>> }
  | { type: 'DELETE_LAYERS'; ids: string[] }
  | { type: 'DUPLICATE_LAYERS'; ids: string[] }
  | { type: 'REORDER_LAYER'; id: string; direction: 'up' | 'down' | 'front' | 'back' }
  | { type: 'SET_LAYER_ORDER'; orderedIds: string[] }
  | { type: 'APPLY_COLOR_PALETTE'; colorIds: string[] }
  | { type: 'SET_SELECTED_LAYERS'; ids: string[] }
  | { type: 'UPDATE_CANVAS'; updates: Partial<HtvCanvasState> }
  | { type: 'UPDATE_GARMENT'; updates: Partial<HtvGarmentState> }
  | { type: 'LOAD_STATE'; state: HtvState }
  | { type: 'UNDO' }
  | { type: 'REDO' };

function snapshot(state: HtvState): HtvHistoryEntry {
  return { layers: state.layers, selectedLayerIds: new Set(state.selectedLayerIds) };
}

export function htvReducer(state: HtvState, action: HtvAction): HtvState {
  switch (action.type) {
    case 'SET_PROJECT_NAME':
      return { ...state, projectName: action.name };

    case 'ADD_LAYERS': {
      if (action.layers.length === 0) return state;
      const historyEntry = snapshot(state);
      return {
        ...state,
        layers: [...state.layers, ...action.layers],
        selectedLayerIds: new Set(action.layers.map((l) => l.id)),
        history: { past: pushHtvHistory(state.history.past, historyEntry), future: [] },
      };
    }

    case 'UPDATE_LAYER': {
      const index = state.layers.findIndex((l) => l.id === action.id);
      if (index === -1) return state;
      const historyEntry = snapshot(state);
      const layers = [...state.layers];
      layers[index] = { ...layers[index]!, ...action.updates } as HtvLayer;
      return { ...state, layers, history: { past: pushHtvHistory(state.history.past, historyEntry), future: [] } };
    }

    case 'UPDATE_LAYERS': {
      if (action.ids.length === 0) return state;
      const idSet = new Set(action.ids);
      const historyEntry = snapshot(state);
      const layers = state.layers.map((layer) =>
        idSet.has(layer.id) ? ({ ...layer, ...action.updates } as HtvLayer) : layer,
      );
      return { ...state, layers, history: { past: pushHtvHistory(state.history.past, historyEntry), future: [] } };
    }

    case 'DELETE_LAYERS': {
      if (action.ids.length === 0) return state;
      const idSet = new Set(action.ids);
      const historyEntry = snapshot(state);
      const layers = state.layers.filter((layer) => !idSet.has(layer.id));
      const selectedLayerIds = new Set([...state.selectedLayerIds].filter((id) => !idSet.has(id)));
      return { ...state, layers, selectedLayerIds, history: { past: pushHtvHistory(state.history.past, historyEntry), future: [] } };
    }

    case 'DUPLICATE_LAYERS': {
      const toDuplicate = state.layers.filter((layer) => action.ids.includes(layer.id));
      if (toDuplicate.length === 0) return state;
      const historyEntry = snapshot(state);
      const newIds = generateSequentialLayerIds(state.layers, 'dup', toDuplicate.length);
      const duplicated = toDuplicate.map((layer, i) => ({
        ...layer,
        id: newIds[i]!,
        name: `${layer.name} copy`,
        x: layer.x + 8,
        y: layer.y + 8,
      }));
      return {
        ...state,
        layers: [...state.layers, ...duplicated],
        selectedLayerIds: new Set(duplicated.map((l) => l.id)),
        history: { past: pushHtvHistory(state.history.past, historyEntry), future: [] },
      };
    }

    case 'REORDER_LAYER': {
      const index = state.layers.findIndex((l) => l.id === action.id);
      if (index === -1) return state;
      const historyEntry = snapshot(state);
      const layers = [...state.layers];
      const [layer] = layers.splice(index, 1);
      if (action.direction === 'up') layers.splice(Math.min(index + 1, layers.length), 0, layer!);
      else if (action.direction === 'down') layers.splice(Math.max(index - 1, 0), 0, layer!);
      else if (action.direction === 'front') layers.push(layer!);
      else layers.unshift(layer!);
      return { ...state, layers, history: { past: pushHtvHistory(state.history.past, historyEntry), future: [] } };
    }

    case 'SET_LAYER_ORDER': {
      const byId = new Map(state.layers.map((l) => [l.id, l] as const));
      const reordered = action.orderedIds.map((id) => byId.get(id)).filter((l): l is HtvLayer => l !== undefined);
      if (reordered.length !== state.layers.length) return state;
      const historyEntry = snapshot(state);
      return { ...state, layers: reordered, history: { past: pushHtvHistory(state.history.past, historyEntry), future: [] } };
    }

    case 'APPLY_COLOR_PALETTE': {
      if (action.colorIds.length === 0 || state.layers.length === 0) return state;
      const historyEntry = snapshot(state);
      const layers = state.layers.map((layer, index) => ({
        ...layer,
        colorId: action.colorIds[index % action.colorIds.length]!,
      }));
      return { ...state, layers, history: { past: pushHtvHistory(state.history.past, historyEntry), future: [] } };
    }

    case 'SET_SELECTED_LAYERS':
      return { ...state, selectedLayerIds: new Set(action.ids) };

    case 'UPDATE_CANVAS':
      return { ...state, canvas: { ...state.canvas, ...action.updates } };

    case 'UPDATE_GARMENT':
      return { ...state, garment: { ...state.garment, ...action.updates } };

    case 'LOAD_STATE':
      return action.state;

    case 'UNDO': {
      if (state.history.past.length === 0) return state;
      const previous = state.history.past[state.history.past.length - 1]!;
      const currentEntry = snapshot(state);
      return {
        ...state,
        layers: previous.layers,
        selectedLayerIds: previous.selectedLayerIds,
        history: {
          past: state.history.past.slice(0, -1),
          future: [currentEntry, ...state.history.future],
        },
      };
    }

    case 'REDO': {
      if (state.history.future.length === 0) return state;
      const next = state.history.future[0]!;
      const currentEntry = snapshot(state);
      return {
        ...state,
        layers: next.layers,
        selectedLayerIds: next.selectedLayerIds,
        history: {
          past: pushHtvHistory(state.history.past, currentEntry),
          future: state.history.future.slice(1),
        },
      };
    }

    default:
      return state;
  }
}

// ─── Layer factory helpers ────────────────────────────────────────────────────

export function createHtvTextLayer(overrides: Partial<HtvTextLayer> & Pick<HtvTextLayer, 'id'>): HtvTextLayer {
  return {
    type: 'text',
    name: 'Text',
    x: 0,
    y: 0,
    rotationDeg: 0,
    scale: 1,
    visible: true,
    locked: false,
    colorId: DEFAULT_HTV_COLOR_ID,
    text: 'TEXT',
    fontId: '',
    fontSizeMm: 40,
    letterSpacingMm: 2,
    align: 'left',
    curveAmount: 0,
    ...overrides,
  };
}

export function createHtvVectorLayer(overrides: Partial<HtvVectorLayer> & Pick<HtvVectorLayer, 'id' | 'polylines' | 'naturalWidthMm' | 'naturalHeightMm' | 'sourceKind'>): HtvVectorLayer {
  return {
    type: 'vector',
    name: 'Shape',
    x: 0,
    y: 0,
    rotationDeg: 0,
    scale: 1,
    visible: true,
    locked: false,
    colorId: DEFAULT_HTV_COLOR_ID,
    ...overrides,
  };
}
