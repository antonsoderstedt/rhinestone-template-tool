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
