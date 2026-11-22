import { describe, expect, it } from 'vitest';
import { DEFAULT_EDITOR_STATE, editorReducer } from '../app/editor/EditorState';
import { NUDGE_BIG_STEP_MM, NUDGE_FINE_STEP_MM, NUDGE_STEP_MM, isNudgeKey, nudgeMoves } from '../app/editor/nudge';
import { createRhinestoneTemplate } from '../src/lib/rhinestone-engine/index';

const stone = (id: string, x: number, y: number) => ({ id, center: { x, y }, stoneSize: 'SS10' as const, holeDiameterMm: 3.43 });

describe('arrow key nudge (plan B13)', () => {
  const stones = [stone('a', 10, 10), stone('b', 30, 10), stone('c', 50, 10)];

  it('moves only the selected stones in the arrow direction', () => {
    expect(nudgeMoves(stones, new Set(['a', 'b']), 'ArrowRight')).toEqual([
      { id: 'a', toX: 10 + NUDGE_STEP_MM, toY: 10 },
      { id: 'b', toX: 30 + NUDGE_STEP_MM, toY: 10 },
    ]);
    expect(nudgeMoves(stones, new Set(['c']), 'ArrowUp')).toEqual([{ id: 'c', toX: 50, toY: 10 - NUDGE_STEP_MM }]);
  });

  it('uses a bigger step with Shift and a finer one with Alt', () => {
    expect(nudgeMoves(stones, new Set(['a']), 'ArrowDown', { shift: true })![0]!.toY).toBe(10 + NUDGE_BIG_STEP_MM);
    expect(nudgeMoves(stones, new Set(['a']), 'ArrowLeft', { alt: true })![0]!.toX).toBeCloseTo(10 - NUDGE_FINE_STEP_MM, 6);
  });

  it('does nothing for other keys or an empty selection', () => {
    expect(nudgeMoves(stones, new Set(['a']), 'a')).toBeNull();
    expect(nudgeMoves(stones, new Set(), 'ArrowLeft')).toBeNull();
    expect(isNudgeKey('ArrowLeft')).toBe(true);
    expect(isNudgeKey('Enter')).toBe(false);
  });

  it('goes through the same collision rule as a drag, and undoes in one step', () => {
    let state = structuredClone(DEFAULT_EDITOR_STATE);
    state = editorReducer(state, { type: 'SET_TEMPLATE', template: createRhinestoneTemplate({ id: 't', name: 't', stones: [stone('a', 10, 10), stone('b', 14, 10)] }) });
    state = editorReducer({ ...state, activeTool: 'grid' }, { type: 'CONVERT_TO_EDITABLE' });
    // 'a' nudged right would sit on 'b': refused, nothing changes.
    const blocked = editorReducer(state, { type: 'MOVE_STONES', moves: nudgeMoves(state.editableTemplate.stones, new Set(['a']), 'ArrowRight', { shift: true })! });
    expect(blocked.editableTemplate.stones.find((s) => s.id === 'a')!.center.x).toBe(10);
    // Away from it is fine.
    const moved = editorReducer(state, { type: 'MOVE_STONES', moves: nudgeMoves(state.editableTemplate.stones, new Set(['a']), 'ArrowLeft')! });
    expect(moved.editableTemplate.stones.find((s) => s.id === 'a')!.center.x).toBe(9.5);
    expect(editorReducer(moved, { type: 'UNDO' }).editableTemplate.stones.find((s) => s.id === 'a')!.center.x).toBe(10);
  });
});
