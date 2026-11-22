import { describe, expect, it } from 'vitest';
import { parseRhinestoneProject, serializeRhinestoneProject, createStoneGridTemplate, type Stone } from '../src/lib/rhinestone-engine/index';
import { DEFAULT_EDITOR_STATE, editorReducer, type EditorState } from '../app/editor/EditorState';
import { boundsOfStones, composeDesign, nextPartId, offsetBelow, partsStones, transformStones, translateTemplate, type DesignPart } from '../app/editor/designParts';
import { buildEffectiveTemplate, buildProjectFileFromEditorState } from '../app/editor/projectPersistence';

const stone = (id: string, x: number, y: number): Stone => ({ id, center: { x, y }, stoneSize: 'SS10', holeDiameterMm: 3.43 });
const part = (id: string, offsetX = 0, offsetY = 0): DesignPart => ({ id, name: id, offsetX, offsetY, stones: [stone('a', 10, 10), stone('b', 20, 10)] });
const fresh = (): EditorState => structuredClone(DEFAULT_EDITOR_STATE);
const grid = () => createStoneGridTemplate({ id: 'g', name: 'g', columns: 3, rows: 2, stoneSize: 'SS10', densityPreset: 'standard' });

describe('placing parts', () => {
  it('shows a part where its offset puts it, with ids that cannot clash and its id on every stone', () => {
    const placed = partsStones([part('part-1', 5, 7), part('part-2')]);
    expect(placed.map((s) => s.id)).toEqual(['part-1:a', 'part-1:b', 'part-2:a', 'part-2:b']);
    expect(placed[0]!.center).toEqual({ x: 15, y: 17 });
    expect(placed.every((s) => typeof s.metadata?.partId === 'string')).toBe(true);
  });

  it('puts the next piece below what is there, left edges aligned, with a gap', () => {
    const kept = partsStones([part('p')]);
    const b = boundsOfStones(kept)!;
    const offset = offsetBelow(kept, 8.285, 8.285, 10);
    expect(offset.x).toBeCloseTo(b.minX - 8.285, 3);
    expect(offset.y).toBeCloseTo(b.maxY + 10 - 8.285, 3);
    expect(offsetBelow([], 0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('makes part ids that are not in use', () => {
    const used = [part('part-1'), part('part-2')];
    expect(used.some((p) => p.id === nextPartId(used))).toBe(false);
  });

  it('moves a template and its cut shapes, and leaves the original alone', () => {
    const t = { ...grid(), cutShapes: [{ type: 'rect' as const, x: 1, y: 2, widthMm: 10, heightMm: 5 }] };
    const moved = translateTemplate(t, 3, 4);
    expect(moved.stones[0]!.center.x).toBeCloseTo(t.stones[0]!.center.x + 3, 6);
    expect(moved.cutShapes![0]).toMatchObject({ x: 4, y: 6 });
    expect(t.cutShapes![0]).toMatchObject({ x: 1, y: 2 });
  });
});

describe('the whole design', () => {
  it('is the working piece plus every part, and is just the working piece when there are no parts', () => {
    const working = grid();
    expect(composeDesign(working, [], 'x')).toBe(working);
    const all = composeDesign(working, [part('part-1')], 'My design')!;
    expect(all.stones).toHaveLength(working.stones.length + 2);
    expect(all.name).toBe('My design');
  });

  it('exists with parts only, before anything is generated', () => {
    expect(composeDesign(null, [part('part-1')], 'x')!.stones).toHaveLength(2);
    expect(composeDesign(null, [], 'x')).toBeNull();
  });

  it('buildEffectiveTemplate includes the parts, editable or not', () => {
    let state = fresh();
    state.template = grid();
    state = editorReducer(state, { type: 'ADD_PART', part: part('part-1') });
    expect(buildEffectiveTemplate(state)!.stones).toHaveLength(grid().stones.length + 2);
    state = editorReducer(state, { type: 'CONVERT_TO_EDITABLE' });
    expect(buildEffectiveTemplate(state)!.stones).toHaveLength(grid().stones.length + 2);
  });
});

describe('the reducer', () => {
  it('adds, renames, moves and removes parts', () => {
    let state = editorReducer(fresh(), { type: 'ADD_PART', part: part('part-1') });
    state = editorReducer(state, { type: 'ADD_PART', part: part('part-2') });
    state = editorReducer(state, { type: 'UPDATE_PART', id: 'part-1', updates: { name: 'Number', offsetX: 12 } });
    expect(state.parts.find((p) => p.id === 'part-1')).toMatchObject({ name: 'Number', offsetX: 12 });
    state = editorReducer(state, { type: 'REMOVE_PART', id: 'part-2' });
    expect(state.parts.map((p) => p.id)).toEqual(['part-1']);
  });

  it('moves the working piece by the difference, and puts a regenerated piece in the same place', () => {
    let state = fresh();
    state = editorReducer(state, { type: 'SET_TEMPLATE', template: grid() });
    const x0 = state.template!.stones[0]!.center.x;
    state = editorReducer(state, { type: 'SET_WORKING_OFFSET', x: 30, y: 12 });
    expect(state.template!.stones[0]!.center.x).toBeCloseTo(x0 + 30, 6);
    state = editorReducer(state, { type: 'SET_WORKING_OFFSET', x: 40, y: 12 });
    expect(state.template!.stones[0]!.center.x).toBeCloseTo(x0 + 40, 6);
    // the generator draws at its own origin again; the offset is applied when it is set
    state = editorReducer(state, { type: 'SET_TEMPLATE', template: grid() });
    expect(state.template!.stones[0]!.center.x).toBeCloseTo(x0 + 40, 6);
    expect(state.template!.stones[0]!.center.y).toBeCloseTo(grid().stones[0]!.center.y + 12, 6);
  });

  it('moves editable stones with it', () => {
    let state = editorReducer(fresh(), { type: 'SET_TEMPLATE', template: grid() });
    state = editorReducer(state, { type: 'CONVERT_TO_EDITABLE' });
    const x0 = state.editableTemplate.stones[0]!.center.x;
    state = editorReducer(state, { type: 'SET_WORKING_OFFSET', x: 5, y: 0 });
    expect(state.editableTemplate.stones[0]!.center.x).toBeCloseTo(x0 + 5, 6);
  });

  it('a reset clears the parts', () => {
    const state = editorReducer(editorReducer(fresh(), { type: 'ADD_PART', part: part('part-1') }), { type: 'RESET_EDITOR' });
    expect(state.parts).toEqual([]);
    expect(state.workingOffset).toEqual({ x: 0, y: 0 });
  });
});

describe('saving and opening', () => {
  const withText = (): EditorState => {
    let state = fresh();
    state.activeTool = 'text';
    state = editorReducer(state, { type: 'ADD_PART', part: part('part-1', 4, 6) });
    state = editorReducer(state, { type: 'SET_WORKING_OFFSET', x: 0, y: 40 });
    return state;
  };

  it('keeps parts and the working offset through the project file', () => {
    const file = buildProjectFileFromEditorState(withText())!;
    const back = parseRhinestoneProject(serializeRhinestoneProject(file));
    expect(back.parts).toHaveLength(1);
    expect(back.parts![0]).toMatchObject({ id: 'part-1', offsetX: 4, offsetY: 6 });
    expect(back.parts![0]!.stones).toHaveLength(2);
    expect(back.workingOffset).toEqual({ x: 0, y: 40 });
  });

  it('saves parts even when nothing is being generated', () => {
    const state = editorReducer(fresh(), { type: 'ADD_PART', part: part('part-1') });
    state.activeTool = 'select';
    const file = buildProjectFileFromEditorState(state)!;
    expect(file.generatorState.generatorId).toBe('manual-editor');
    expect(file.parts).toHaveLength(1);
  });

  it('writes nothing about parts when there are none, and refuses broken parts', () => {
    const plain = buildProjectFileFromEditorState((() => { const s = fresh(); s.activeTool = 'text'; return s; })())!;
    expect(plain.parts).toBeUndefined();
    expect(plain.workingOffset).toBeUndefined();

    const json = JSON.parse(serializeRhinestoneProject(buildProjectFileFromEditorState(withText())!));
    json.parts[0].offsetX = 'left';
    expect(() => parseRhinestoneProject(JSON.stringify(json))).toThrow(/offsetX/);
    json.parts[0].offsetX = 1;
    json.parts.push({ ...json.parts[0] });
    expect(() => parseRhinestoneProject(JSON.stringify(json))).toThrow(/used twice/);
  });
});

describe('turning, mirroring, duplicating and undoing parts', () => {
  const asymmetric = (): DesignPart => ({
    id: 'part-1', name: 'L', offsetX: 0, offsetY: 0,
    stones: [stone('a', 10, 10), stone('b', 20, 10), stone('c', 10, 20)],
  });
  const centres = (stones: Stone[]) => stones.map((s) => [Math.round(s.center.x * 10) / 10, Math.round(s.center.y * 10) / 10]);

  it('a quarter turn keeps the part in place, spacing unchanged, and four turns are the identity', () => {
    const before = asymmetric().stones;
    const turned = transformStones(before, 'rotate-cw');
    expect(boundsOfStones(turned)!.minX).toBeCloseTo(boundsOfStones(before)!.minX, 3);
    expect(Math.hypot(turned[0]!.center.x - turned[1]!.center.x, turned[0]!.center.y - turned[1]!.center.y)).toBeCloseTo(10, 6);
    let again = before;
    for (let i = 0; i < 4; i++) again = transformStones(again, 'rotate-cw');
    expect(centres(again)).toEqual(centres(before));
    expect(centres(transformStones(transformStones(before, 'rotate-cw'), 'rotate-ccw'))).toEqual(centres(before));
  });

  it('flips mirror about the middle and twice is the identity', () => {
    const before = asymmetric().stones;
    const flipped = transformStones(before, 'flip-horizontal');
    expect(flipped[0]!.center.x).toBeCloseTo(20, 6); // a at x 10 mirrored in the span 10..20
    expect(flipped[0]!.center.y).toBeCloseTo(10, 6);
    expect(centres(transformStones(flipped, 'flip-horizontal'))).toEqual(centres(before));
    expect(centres(transformStones(before, 'flip-vertical'))[0]).toEqual([10, 20]);
  });

  it('TRANSFORM_PART and DUPLICATE_PART change the right part only', () => {
    let state = editorReducer(fresh(), { type: 'ADD_PART', part: asymmetric() });
    state = editorReducer(state, { type: 'ADD_PART', part: { ...asymmetric(), id: 'part-2' } });
    state = editorReducer(state, { type: 'TRANSFORM_PART', id: 'part-1', op: 'flip-horizontal' });
    expect(state.parts[0]!.stones[0]!.center.x).toBeCloseTo(20, 6);
    expect(state.parts[1]!.stones[0]!.center.x).toBeCloseTo(10, 6);
    state = editorReducer(state, { type: 'DUPLICATE_PART', id: 'part-2' });
    expect(state.parts).toHaveLength(3);
    expect(state.parts[2]!.name).toBe('L copy');
    // below the others, not on top of them
    const copyTop = Math.min(...partsStones([state.parts[2]!]).map((s) => s.center.y));
    const othersBottom = Math.max(...partsStones(state.parts.slice(0, 2)).map((s) => s.center.y));
    expect(copyTop).toBeGreaterThan(othersBottom);
    expect(new Set(state.parts.map((p) => p.id)).size).toBe(3);
  });

  it('undo and redo walk back through adding, turning and removing; a new change drops the redo steps', () => {
    let state = fresh();
    state = editorReducer(state, { type: 'ADD_PART', part: asymmetric() });
    state = editorReducer(state, { type: 'TRANSFORM_PART', id: 'part-1', op: 'rotate-cw' });
    state = editorReducer(state, { type: 'REMOVE_PART', id: 'part-1' });
    expect(state.parts).toHaveLength(0);
    state = editorReducer(state, { type: 'UNDO_PARTS' });
    expect(state.parts).toHaveLength(1);
    state = editorReducer(state, { type: 'UNDO_PARTS' });
    expect(centres(state.parts[0]!.stones)).toEqual(centres(asymmetric().stones));
    state = editorReducer(state, { type: 'REDO_PARTS' });
    expect(centres(state.parts[0]!.stones)).not.toEqual(centres(asymmetric().stones));
    state = editorReducer(state, { type: 'UPDATE_PART', id: 'part-1', updates: { offsetX: 3 } });
    expect(state.partsHistory.future).toEqual([]);
    expect(editorReducer(fresh(), { type: 'UNDO_PARTS' }).parts).toEqual([]);
  });

  it('typing a position is one undo step, a rename is none, and opening a design clears the history', () => {
    let state = editorReducer(fresh(), { type: 'ADD_PART', part: asymmetric() });
    for (const x of [1, 12, 123]) state = editorReducer(state, { type: 'UPDATE_PART', id: 'part-1', updates: { offsetX: x } });
    state = editorReducer(state, { type: 'UPDATE_PART', id: 'part-1', updates: { name: 'Anna' } });
    expect(state.partsHistory.past).toHaveLength(2); // the add, and the whole move
    state = editorReducer(state, { type: 'UNDO_PARTS' });
    expect(state.parts[0]!.offsetX).toBe(0);
    expect(editorReducer(state, { type: 'SET_PARTS', parts: [], workingOffset: { x: 0, y: 0 } }).partsHistory.past).toEqual([]);
  });
});

describe('aligning pieces', () => {
  const wide = (): DesignPart => ({ id: 'part-1', name: 'wide', offsetX: 0, offsetY: 0, stones: [stone('a', 10, 10), stone('b', 110, 10)] });
  const narrow = (): DesignPart => ({ id: 'part-2', name: 'narrow', offsetX: 0, offsetY: 30, stones: [stone('a', 40, 10), stone('b', 50, 10)] });
  const bounds = (state: EditorState, id: string) => boundsOfStones(partsStones(state.parts.filter((p) => p.id === id)))!;

  it('centres a part on the others, and lines up left and right edges', () => {
    let state = editorReducer(editorReducer(fresh(), { type: 'ADD_PART', part: wide() }), { type: 'ADD_PART', part: narrow() });
    const wideBounds = bounds(state, 'part-1');
    state = editorReducer(state, { type: 'ALIGN_PART', id: 'part-2', align: 'center' });
    const n = bounds(state, 'part-2');
    expect((n.minX + n.maxX) / 2).toBeCloseTo((wideBounds.minX + wideBounds.maxX) / 2, 3);
    state = editorReducer(state, { type: 'ALIGN_PART', id: 'part-2', align: 'left' });
    expect(bounds(state, 'part-2').minX).toBeCloseTo(wideBounds.minX, 3);
    state = editorReducer(state, { type: 'ALIGN_PART', id: 'part-2', align: 'right' });
    expect(bounds(state, 'part-2').maxX).toBeCloseTo(wideBounds.maxX, 3);
  });

  it('is one undo step, and does nothing when it is already there or alone', () => {
    let state = editorReducer(editorReducer(fresh(), { type: 'ADD_PART', part: wide() }), { type: 'ADD_PART', part: narrow() });
    const before = state.partsHistory.past.length;
    state = editorReducer(state, { type: 'ALIGN_PART', id: 'part-2', align: 'center' });
    expect(state.partsHistory.past).toHaveLength(before + 1);
    expect(editorReducer(state, { type: 'ALIGN_PART', id: 'part-2', align: 'center' })).toBe(state);
    const alone = editorReducer(fresh(), { type: 'ADD_PART', part: wide() });
    expect(editorReducer(alone, { type: 'ALIGN_PART', id: 'part-1', align: 'center' })).toBe(alone);
  });

  it('aligns the piece being worked on to the parts', () => {
    let state = editorReducer(fresh(), { type: 'ADD_PART', part: wide() });
    state = editorReducer(state, { type: 'SET_TEMPLATE', template: grid() });
    state = editorReducer(state, { type: 'ALIGN_WORKING', align: 'center' });
    const w = boundsOfStones(state.template!.stones)!;
    const p = bounds(state, 'part-1');
    expect((w.minX + w.maxX) / 2).toBeCloseTo((p.minX + p.maxX) / 2, 2);
    expect(state.workingOffset.x).not.toBe(0);
  });

  it('a drag is one undo step per drag, however many moves it has', () => {
    let state = editorReducer(fresh(), { type: 'ADD_PART', part: wide() });
    for (let drag = 0; drag < 2; drag++) {
      state = editorReducer(state, { type: 'END_PARTS_STEP' });
      for (const x of [1, 2, 3]) state = editorReducer(state, { type: 'UPDATE_PART', id: 'part-1', updates: { offsetX: x + drag * 10 } });
      state = editorReducer(state, { type: 'END_PARTS_STEP' });
    }
    expect(state.partsHistory.past).toHaveLength(3); // the add and the two drags
    state = editorReducer(state, { type: 'UNDO_PARTS' });
    expect(state.parts[0]!.offsetX).toBe(3);
  });
});

import { MAX_SPREAD_FACTOR, alignDeltaY, rotateStonesBy, snapOffset, spreadStones } from '../app/editor/designParts';

describe('parts: free rotation, spreading, vertical alignment, snapping (plan B2, B3, B13, B14)', () => {
  const mk = (id: string, x: number, y: number) => ({ id, center: { x, y }, stoneSize: 'SS10' as const, holeDiameterMm: 3 });
  const row = [mk('a', 0, 0), mk('b', 10, 0), mk('c', 20, 0)];
  const distance = (a: { center: { x: number; y: number } }, b: { center: { x: number; y: number } }) => Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y);

  it('turns by any angle without changing the spacing between stones', () => {
    for (const deg of [30, 45, 90, 137, -60]) {
      const turned = rotateStonesBy(row, deg);
      expect(distance(turned[0]!, turned[1]!)).toBeCloseTo(10, 3);
      expect(distance(turned[0]!, turned[2]!)).toBeCloseTo(20, 3);
    }
    const quarter = rotateStonesBy(row, 90);
    expect(quarter.map((s) => s.center.x.toFixed(2))).toEqual(['10.00', '10.00', '10.00']);
    expect(quarter[0]!.center.y).toBeCloseTo(-10, 3);
  });

  it('turning 360 degrees brings the stones back, and a bad angle changes nothing', () => {
    expect(rotateStonesBy(row, 360).map((s) => [Math.round(s.center.x), Math.round(s.center.y)])).toEqual([[0, 0], [10, 0], [20, 0]]);
    expect(rotateStonesBy(row, Number.NaN)).toEqual(row);
  });

  it('spreads about the middle, and never brings stones closer', () => {
    const wider = spreadStones(row, 2);
    expect(wider.map((s) => s.center.x)).toEqual([-10, 10, 30]);
    expect(spreadStones(row, 0.5).map((s) => s.center.x)).toEqual([0, 10, 20]);
    expect(spreadStones(row, 99).map((s) => s.center.x)).toEqual([10 - 10 * MAX_SPREAD_FACTOR, 10, 10 + 10 * MAX_SPREAD_FACTOR]);
    expect(wider[0]!.holeDiameterMm).toBe(3);
  });

  it('lines up top, middle and bottom', () => {
    const own = { minX: 0, minY: 10, maxX: 5, maxY: 20 };
    const others = { minX: 0, minY: 0, maxX: 5, maxY: 40 };
    expect(alignDeltaY(own, others, 'top')).toBe(-10);
    expect(alignDeltaY(own, others, 'middle')).toBe(5);
    expect(alignDeltaY(own, others, 'bottom')).toBe(20);
    expect(alignDeltaY(own, null, 'top')).toBe(0);
  });

  it('snaps to the nearest edge or middle within the threshold, per axis', () => {
    const others = [{ minX: 0, minY: 0, maxX: 100, maxY: 40 }];
    // Left edge 1.2 mm from the others' left edge; top 30 mm away: only x snaps.
    expect(snapOffset({ minX: 1.2, minY: 70, maxX: 41.2, maxY: 90 }, others, 2)).toEqual({ x: -1.2, y: 0 });
    // The middle of own (x 50) is 0.5 from the middle of the others (50.5 -> own middle 50).
    expect(snapOffset({ minX: 30, minY: 70, maxX: 70, maxY: 90 }, [{ minX: 0, minY: 0, maxX: 101, maxY: 40 }], 2).x).toBe(0.5);
    expect(snapOffset({ minX: 30, minY: 70, maxX: 70, maxY: 90 }, [], 2)).toEqual({ x: 0, y: 0 });
  });
});

import { DEFAULT_EDITOR_STATE as BASE_STATE, editorReducer as reduce } from '../app/editor/EditorState';
import { createRhinestoneTemplate as makeTemplate } from '../src/lib/rhinestone-engine/index';

describe('parts in the reducer: turn by angle, spread, vertical align, take back (plan B2, B3, B14)', () => {
  const stone = (id: string, x: number, y: number) => ({ id, center: { x, y }, stoneSize: 'SS10' as const, holeDiameterMm: 3 });
  const withOnePart = () => {
    let state = structuredClone(BASE_STATE);
    state = reduce(state, { type: 'SET_TEMPLATE', template: makeTemplate({ id: 't', name: 't', stones: [stone('a', 10, 10), stone('b', 20, 10), stone('c', 30, 10)] }) });
    state = reduce({ ...state, activeTool: 'grid' }, { type: 'ADD_PART', part: { id: 'p1', name: 'Row', offsetX: 0, offsetY: 0, stones: [stone('a', 10, 10), stone('b', 20, 10), stone('c', 30, 10)] } });
    return reduce(state, { type: 'SET_TEMPLATE', template: null });
  };

  it('turns a part by an angle with one undo step, and ignores a full turn', () => {
    let state = withOnePart();
    expect(reduce(state, { type: 'TURN_PART_BY', id: 'p1', degrees: 360 })).toBe(state);
    state = reduce(state, { type: 'TURN_PART_BY', id: 'p1', degrees: 90 });
    expect(state.parts[0]!.stones.map((s) => Math.round(s.center.x))).toEqual([20, 20, 20]);
    expect(reduce(state, { type: 'UNDO_PARTS' }).parts[0]!.stones.map((s) => s.center.x)).toEqual([10, 20, 30]);
  });

  it('spreads out, never in', () => {
    let state = withOnePart();
    expect(reduce(state, { type: 'SPREAD_PART', id: 'p1', factor: 0.8 })).toBe(state);
    state = reduce(state, { type: 'SPREAD_PART', id: 'p1', factor: 1.5 });
    expect(state.parts[0]!.stones.map((s) => s.center.x)).toEqual([5, 20, 35]);
  });

  it('aligns a part vertically with the piece being worked on', () => {
    let state = withOnePart();
    state = reduce({ ...state, activeTool: 'grid' }, { type: 'SET_TEMPLATE', template: makeTemplate({ id: 't2', name: 't2', stones: [stone('w', 10, 50), stone('x', 10, 70)] }) });
    state = reduce(state, { type: 'ALIGN_PART', id: 'p1', align: 'top' });
    // Top edge of the part (y 10 - 1.5) moves to the top edge of the working piece (y 50 - 1.5).
    expect(state.parts[0]!.offsetY).toBe(40);
    expect(state.parts[0]!.offsetX).toBe(0);
  });

  it('takes a part back to edit its stones, but only when no piece is in progress, and in one parts undo step', () => {
    let state = withOnePart();
    state = reduce(state, { type: 'SET_TEMPLATE', template: makeTemplate({ id: 'w', name: 'w', stones: [stone('w', 50, 50)] }) });
    expect(reduce(state, { type: 'EDIT_PART', id: 'p1' })).toBe(state);
    state = reduce(state, { type: 'SET_TEMPLATE', template: null });
    state = reduce(state, { type: 'UPDATE_PART', id: 'p1', updates: { offsetX: 5, offsetY: 7 } });
    const back = reduce(state, { type: 'EDIT_PART', id: 'p1' });
    expect(back.parts).toHaveLength(0);
    expect(back.activeTool).toBe('select');
    expect(back.editableTemplate.isEditable).toBe(true);
    expect(back.editableTemplate.stones.map((s) => [s.center.x, s.center.y])).toEqual([[15, 17], [25, 17], [35, 17]]);
    expect(reduce(back, { type: 'UNDO_PARTS' }).parts).toHaveLength(1);
  });
});
