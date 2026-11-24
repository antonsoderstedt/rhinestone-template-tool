import { describe, expect, it } from 'vitest';
import { DEFAULT_EDITOR_STATE, editorReducer } from '../app/editor/EditorState';
import { structurallyEqual } from '../app/editor/useStableValue';
import type { WorkspaceSettings } from '../app/lib/workspaceSettings';

describe('structurallyEqual', () => {
  it('treats equal plain data as equal and different data as different', () => {
    expect(structurallyEqual({ a: 1, b: ['x', { c: null }] }, { a: 1, b: ['x', { c: null }] })).toBe(true);
    expect(structurallyEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(structurallyEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(structurallyEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(structurallyEqual([], {})).toBe(false);
    expect(structurallyEqual(null, {})).toBe(false);
    expect(structurallyEqual(NaN, NaN)).toBe(true);
  });

  it('compares class instances by identity', () => {
    expect(structurallyEqual(new Set([1]), new Set([1]))).toBe(false);
    const set = new Set([1]);
    expect(structurallyEqual(set, set)).toBe(true);
  });
});

describe('generation inputs under a re-based reducer', () => {
  const settings = {
    defaultStoneSize: 'SS16',
    defaultDensityPreset: 'safe',
    defaultArtworkLongestSideMm: 60,
  } as WorkspaceSettings;

  it('APPLY_WORKSPACE_DEFAULTS returns a new svgTool object each time it is replayed, with the same content', () => {
    // React replays a reducer update on every render while an earlier update still waits for its lane
    // (e.g. one dispatched while the tree was hidden). The generation effect therefore has to be keyed
    // on content, not identity — see useStableValue.
    const first = editorReducer(DEFAULT_EDITOR_STATE, { type: 'APPLY_WORKSPACE_DEFAULTS', settings });
    const replayed = editorReducer(DEFAULT_EDITOR_STATE, { type: 'APPLY_WORKSPACE_DEFAULTS', settings });
    expect(replayed.svgTool).not.toBe(first.svgTool);
    expect(structurallyEqual(replayed.svgTool, first.svgTool)).toBe(true);
    expect(structurallyEqual(replayed.textTool, first.textTool)).toBe(true);
    expect(structurallyEqual(replayed.gridTool, first.gridTool)).toBe(true);
  });
});
