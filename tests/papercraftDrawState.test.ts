import { describe, expect, it } from 'vitest';
import { addItem, moveItems, newDoc, rectanglePoints } from '../src/lib/papercraft-engine';
import { drawReducer, HISTORY_LIMIT, initialDrawState } from '../app/papercraft/draw/drawState';

const withSquare = () => addItem(newDoc(), { kind: 'cut', points: rectanglePoints(0, 0, 10, 10), closed: true });

describe('drawing history', () => {
  it('an edit is a step that can be undone and redone, and a new edit clears what could be redone', () => {
    let s = initialDrawState();
    const a = withSquare();
    s = drawReducer(s, { type: 'EDIT', doc: a.doc, selection: [a.id!] });
    expect(s.doc.items).toHaveLength(1);
    expect(s.selection).toEqual([1]);
    s = drawReducer(s, { type: 'UNDO' });
    expect(s.doc.items).toHaveLength(0);
    expect(s.selection).toEqual([]);
    s = drawReducer(s, { type: 'REDO' });
    expect(s.doc.items).toHaveLength(1);
    s = drawReducer(s, { type: 'UNDO' });
    s = drawReducer(s, { type: 'EDIT', doc: addItem(s.doc, { kind: 'mountain', points: [[0, 0], [5, 5]], closed: false }).doc });
    expect(s.future).toEqual([]);
    expect(drawReducer(s, { type: 'REDO' })).toBe(s);
  });

  it('a drag is one step however many times it was previewed', () => {
    let s = drawReducer(initialDrawState(), { type: 'EDIT', doc: withSquare().doc, selection: [1] });
    const before = s.doc;
    for (let dx = 1; dx <= 20; dx++) s = drawReducer(s, { type: 'PREVIEW', doc: moveItems(before, [1], dx, 0) });
    expect(s.past).toHaveLength(1);
    s = drawReducer(s, { type: 'COMMIT' });
    expect(s.past).toHaveLength(2);
    expect(s.past[1]).toBe(before);
    expect(s.doc.items[0]!.points[0]).toEqual([20, 0]);
    s = drawReducer(s, { type: 'UNDO' });
    expect(s.doc).toBe(before);
  });

  it('cancelling a drag puts the drawing back, and a drag that changed nothing is no step', () => {
    let s = drawReducer(initialDrawState(), { type: 'EDIT', doc: withSquare().doc });
    const before = s.doc;
    s = drawReducer(s, { type: 'PREVIEW', doc: moveItems(before, [1], 5, 5) });
    s = drawReducer(s, { type: 'CANCEL' });
    expect(s.doc).toBe(before);
    expect(s.pending).toBeNull();
    const steps = s.past.length;
    s = drawReducer(s, { type: 'PREVIEW', doc: before });
    s = drawReducer(s, { type: 'COMMIT' });
    expect(s.past).toHaveLength(steps);
  });

  it('undo during a drag only stops the drag', () => {
    let s = drawReducer(initialDrawState(), { type: 'EDIT', doc: withSquare().doc });
    const before = s.doc;
    s = drawReducer(s, { type: 'PREVIEW', doc: moveItems(before, [1], 5, 5) });
    s = drawReducer(s, { type: 'UNDO' });
    expect(s.doc).toBe(before);
    expect(s.past).toHaveLength(1);
  });

  it('the selection only holds items that exist', () => {
    let s = drawReducer(initialDrawState(), { type: 'EDIT', doc: withSquare().doc, selection: [1, 99] });
    expect(s.selection).toEqual([1]);
    s = drawReducer(s, { type: 'SELECT', ids: [1, 5] });
    expect(s.selection).toEqual([1]);
  });

  it('keeps at most the limit of steps, and a replaced drawing starts a new history', () => {
    let s = initialDrawState();
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) s = drawReducer(s, { type: 'EDIT', doc: addItem(s.doc, { kind: 'mountain', points: [[0, 0], [1 + i, 1]], closed: false }).doc });
    expect(s.past).toHaveLength(HISTORY_LIMIT);
    s = drawReducer(s, { type: 'REPLACE', doc: newDoc() });
    expect(s.past).toEqual([]);
    expect(s.doc.items).toEqual([]);
  });

  it('an edit that changes nothing is no step', () => {
    const s = drawReducer(initialDrawState(), { type: 'EDIT', doc: withSquare().doc });
    expect(drawReducer(s, { type: 'EDIT', doc: s.doc })).toBe(s);
  });
});
