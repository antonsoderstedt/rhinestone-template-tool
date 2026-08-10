import { describe, it, expect } from 'vitest';
import {
  DEFAULT_HTV_STATE,
  HTV_MAX_HISTORY_LENGTH,
  htvReducer,
  createHtvTextLayer,
  createHtvVectorLayer,
  type HtvState,
} from '../app/htv/HtvState';

function vectorLayer(id: string, x = 0, y = 0) {
  return createHtvVectorLayer({
    id,
    polylines: [{ points: [{ x: -5, y: -5 }, { x: 5, y: -5 }, { x: 5, y: 5 }, { x: -5, y: 5 }], closed: true }],
    naturalWidthMm: 10,
    naturalHeightMm: 10,
    sourceKind: 'svg-upload',
    x,
    y,
  });
}

function freshState(): HtvState {
  return structuredClone(DEFAULT_HTV_STATE);
}

describe('htvReducer', () => {
  it('adds layers and selects them', () => {
    const state = htvReducer(freshState(), { type: 'ADD_LAYERS', layers: [vectorLayer('a')] });
    expect(state.layers).toHaveLength(1);
    expect(state.selectedLayerIds).toEqual(new Set(['a']));
  });

  it('updates a single layer', () => {
    let state = htvReducer(freshState(), { type: 'ADD_LAYERS', layers: [vectorLayer('a')] });
    state = htvReducer(state, { type: 'UPDATE_LAYER', id: 'a', updates: { x: 42 } });
    expect(state.layers[0]!.x).toBe(42);
  });

  it('updates multiple layers at once', () => {
    let state = htvReducer(freshState(), { type: 'ADD_LAYERS', layers: [vectorLayer('a'), vectorLayer('b')] });
    state = htvReducer(state, { type: 'UPDATE_LAYERS', ids: ['a', 'b'], updates: { colorId: 'red' } });
    expect(state.layers.map((l) => l.colorId)).toEqual(['red', 'red']);
  });

  it('deletes layers and clears them from selection', () => {
    let state = htvReducer(freshState(), { type: 'ADD_LAYERS', layers: [vectorLayer('a'), vectorLayer('b')] });
    state = htvReducer(state, { type: 'DELETE_LAYERS', ids: ['a'] });
    expect(state.layers.map((l) => l.id)).toEqual(['b']);
    expect(state.selectedLayerIds.has('a')).toBe(false);
  });

  it('duplicates layers with deterministic, non-colliding ids and an offset position', () => {
    let state = htvReducer(freshState(), { type: 'ADD_LAYERS', layers: [vectorLayer('a', 10, 10)] });
    state = htvReducer(state, { type: 'DUPLICATE_LAYERS', ids: ['a'] });
    expect(state.layers).toHaveLength(2);
    const duplicate = state.layers.find((l) => l.id !== 'a')!;
    expect(duplicate.x).toBe(18);
    expect(duplicate.y).toBe(18);

    // Same starting state + same duplicate action -> same resulting id (determinism).
    let replay = htvReducer(freshState(), { type: 'ADD_LAYERS', layers: [vectorLayer('a', 10, 10)] });
    replay = htvReducer(replay, { type: 'DUPLICATE_LAYERS', ids: ['a'] });
    expect(replay.layers.map((l) => l.id)).toEqual(state.layers.map((l) => l.id));
  });

  it('reorders layers front/back/up/down', () => {
    let state = htvReducer(freshState(), { type: 'ADD_LAYERS', layers: [vectorLayer('a')] });
    state = htvReducer(state, { type: 'ADD_LAYERS', layers: [vectorLayer('b')] });
    state = htvReducer(state, { type: 'ADD_LAYERS', layers: [vectorLayer('c')] });
    expect(state.layers.map((l) => l.id)).toEqual(['a', 'b', 'c']);

    state = htvReducer(state, { type: 'REORDER_LAYER', id: 'a', direction: 'front' });
    expect(state.layers.map((l) => l.id)).toEqual(['b', 'c', 'a']);

    state = htvReducer(state, { type: 'REORDER_LAYER', id: 'a', direction: 'back' });
    expect(state.layers.map((l) => l.id)).toEqual(['a', 'b', 'c']);

    state = htvReducer(state, { type: 'REORDER_LAYER', id: 'a', direction: 'up' });
    expect(state.layers.map((l) => l.id)).toEqual(['b', 'a', 'c']);
  });

  it('undo restores the previous layer state, redo restores it forward', () => {
    let state = htvReducer(freshState(), { type: 'ADD_LAYERS', layers: [vectorLayer('a')] });
    state = htvReducer(state, { type: 'UPDATE_LAYER', id: 'a', updates: { x: 99 } });
    expect(state.layers[0]!.x).toBe(99);

    state = htvReducer(state, { type: 'UNDO' });
    expect(state.layers[0]!.x).toBe(0);

    state = htvReducer(state, { type: 'REDO' });
    expect(state.layers[0]!.x).toBe(99);
  });

  it('undo on empty history is a no-op', () => {
    const state = freshState();
    expect(htvReducer(state, { type: 'UNDO' })).toBe(state);
  });

  it('caps undo history at HTV_MAX_HISTORY_LENGTH', () => {
    let state = htvReducer(freshState(), { type: 'ADD_LAYERS', layers: [vectorLayer('a')] });
    for (let i = 0; i < HTV_MAX_HISTORY_LENGTH + 10; i++) {
      state = htvReducer(state, { type: 'UPDATE_LAYER', id: 'a', updates: { x: i } });
    }
    expect(state.history.past.length).toBe(HTV_MAX_HISTORY_LENGTH);
  });

  it('updates garment and canvas state', () => {
    let state = htvReducer(freshState(), { type: 'UPDATE_GARMENT', updates: { type: 'hoodie', size: 'XL' } });
    expect(state.garment.type).toBe('hoodie');
    expect(state.garment.size).toBe('XL');

    state = htvReducer(state, { type: 'UPDATE_CANVAS', updates: { zoom: 2 } });
    expect(state.canvas.zoom).toBe(2);
  });
});

describe('createHtvTextLayer', () => {
  it('applies sensible defaults and overrides', () => {
    const layer = createHtvTextLayer({ id: 'text-1', text: 'HELLO', fontId: 'archivo-black' });
    expect(layer.type).toBe('text');
    expect(layer.text).toBe('HELLO');
    expect(layer.visible).toBe(true);
    expect(layer.locked).toBe(false);
    expect(layer.scale).toBe(1);
  });
});
