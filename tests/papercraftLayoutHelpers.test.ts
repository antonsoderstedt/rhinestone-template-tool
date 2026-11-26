import { describe, expect, it } from 'vitest';
import { createPapercraft, partBox, shapes } from '../src/lib/papercraft-engine';
import { boxesOf, clampBox, freeSpot, fullness, pinsOf, snapBox, turnedBox, type SheetSize } from '../app/papercraft/papercraftLayout';
import { computePapercraft } from '../app/papercraft/papercraftCompute';
import { deserializePapercraft, serializePapercraft, snapshotText } from '../app/papercraft/papercraftSnapshot';
import { initialPapercraftState, papercraftReducer } from '../app/papercraft/papercraftState';

const SHEET: SheetSize = { widthMm: 210, heightMm: 297, marginMm: 10, gapMm: 3 };

describe('boxes of the parts on the pages', () => {
  const run = createPapercraft({ mesh: shapes.horse(), scale: { by: 'largest', mm: 220 } });
  const boxes = boxesOf(run.layout, run.pattern.parts);

  it('has a box for every part, on the page it is on, inside the page', () => {
    expect(boxes).toHaveLength(run.pattern.parts.length);
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(-1e-6);
      expect(b.y).toBeGreaterThanOrEqual(-1e-6);
      expect(b.x + b.w).toBeLessThanOrEqual(210 + 1e-6);
      expect(b.y + b.h).toBeLessThanOrEqual(297 + 1e-6);
    }
  });

  it('makes pins that give back the same layout', () => {
    const pinned = createPapercraft({ mesh: shapes.horse(), scale: { by: 'largest', mm: 220 }, layout: { pins: pinsOf(boxes) } });
    const flat = (r: typeof run) => r.layout.pages.flatMap((p) => p.placements.map((q) => [p.index, q.partId, q.x, q.y]));
    const a = flat(pinned);
    const b = flat(run);
    expect(a).toHaveLength(b.length);
    a.forEach((row, i) => row.forEach((v, k) => expect(v).toBeCloseTo(b[i][k], 6)));
  });
});

describe('moving a box', () => {
  it('keeps it on the page', () => {
    expect(clampBox({ x: -5, y: 400, w: 50, h: 40 }, SHEET)).toEqual({ x: 0, y: 257 });
    expect(clampBox({ x: 300, y: -3, w: 50, h: 40 }, SHEET)).toEqual({ x: 160, y: 0 });
    // A box bigger than the page is put at the corner.
    expect(clampBox({ x: 50, y: 50, w: 400, h: 400 }, SHEET)).toEqual({ x: 0, y: 0 });
  });

  it('snaps to the margin and to other boxes (with the gap between) within a couple of millimetres, and not further away', () => {
    const other = { x: 50, y: 50, w: 40, h: 30 };
    expect(snapBox({ x: 11.5, y: 12, w: 20, h: 20 }, SHEET, [])).toEqual({ x: 10, y: 10 });
    // Just right of the other box: its edge plus the gap.
    expect(snapBox({ x: 92, y: 52, w: 20, h: 20 }, SHEET, [other])).toEqual({ x: 93, y: 50 });
    // Not near anything: stays.
    expect(snapBox({ x: 120, y: 160, w: 20, h: 20 }, SHEET, [other])).toEqual({ x: 120, y: 160 });
  });

  it('snaps to the far margin too', () => {
    expect(snapBox({ x: 178, y: 265, w: 20, h: 20 }, SHEET, [])).toEqual({ x: 180, y: 267 });
  });
});

describe('turning and finding room', () => {
  const run = createPapercraft({ mesh: shapes.horse(), scale: { by: 'largest', mm: 220 } });
  const part = run.pattern.parts[run.pattern.parts.length - 1];
  const box = boxesOf(run.layout, run.pattern.parts).find((b) => b.partId === part.id)!;

  it('a quarter turn swaps width and height, keeps the middle where it was and the box on the page', () => {
    const turned = turnedBox(part, box, 1, SHEET);
    expect(turned.w).toBeCloseTo(partBox(part, box.rotation + Math.PI / 2).w, 9);
    expect(turned.rotation).toBeCloseTo(box.rotation + Math.PI / 2, 9);
    expect(turned.x).toBeGreaterThanOrEqual(0);
    expect(turned.x + turned.w).toBeLessThanOrEqual(210 + 1e-9);
    // Four quarter turns are back where it began.
    let b = box;
    for (let i = 0; i < 4; i++) b = turnedBox(part, b, 1, SHEET);
    expect(b.w).toBeCloseTo(box.w, 6);
    expect(b.h).toBeCloseTo(box.h, 6);
  });

  it('finds the first free place from the top left, and none when the page is full', () => {
    expect(freeSpot(40, 30, SHEET, [])).toEqual({ x: 10, y: 257 });
    const spot = freeSpot(40, 30, SHEET, [{ x: 10, y: 257, w: 100, h: 30 }]);
    expect(spot).not.toBeNull();
    expect(spot!.y < 257 || spot!.x >= 113).toBe(true);
    expect(freeSpot(40, 30, SHEET, [{ x: 0, y: 0, w: 210, h: 297 }])).toBeNull();
    // A box bigger than the page inside the margins has no place.
    expect(freeSpot(250, 30, SHEET, [])).toBeNull();
  });

  it('how full a page is, in percent of the space inside the margins', () => {
    expect(fullness([], SHEET)).toBe(0);
    expect(fullness([{ w: 190, h: 277 }], SHEET)).toBe(100);
    expect(fullness([{ w: 95, h: 277 }], SHEET)).toBe(50);
  });
});

describe('the layout in the studio state', () => {
  const horse = () => papercraftReducer(initialPapercraftState(), { type: 'USE_BUILT_IN', id: 'horse' });

  it('starts with no pins, no limit and tight packing, and the pages follow the limit', () => {
    expect(horse().layout).toEqual({ pins: {}, maxPartsPerPage: null, tight: true });
    const limited = papercraftReducer(horse(), { type: 'SET_PAGE_LIMIT', limit: 2 });
    expect(limited.layout.maxPartsPerPage).toBe(2);
    const r = computePapercraft(limited);
    if (!r.ok) throw new Error('no run');
    expect(Math.max(...r.run.layout.pages.map((p) => p.placements.length))).toBeLessThanOrEqual(2);
    expect(papercraftReducer(limited, { type: 'SET_PAGE_LIMIT', limit: null }).layout.maxPartsPerPage).toBeNull();
    expect(papercraftReducer(limited, { type: 'SET_PAGE_LIMIT', limit: 0 }).layout.maxPartsPerPage).toBeNull();
  });

  it('keeps the pins the person set, and gives them up for a new limit, a new packing, a reset or another model', () => {
    const r = computePapercraft(horse());
    if (!r.ok) throw new Error('no run');
    const pins = pinsOf(boxesOf(r.run.layout, r.run.pattern.parts));
    const pinned = papercraftReducer(horse(), { type: 'SET_PINS', pins });
    expect(Object.keys(pinned.layout.pins).length).toBe(r.run.pattern.parts.length);
    expect(papercraftReducer(pinned, { type: 'SET_PAGE_LIMIT', limit: 3 }).layout.pins).toEqual({});
    expect(papercraftReducer(pinned, { type: 'SET_TIGHT', on: false }).layout.pins).toEqual({});
    expect(papercraftReducer(pinned, { type: 'RESET_LAYOUT' }).layout.pins).toEqual({});
    expect(papercraftReducer(pinned, { type: 'USE_BUILT_IN', id: 'dog' }).layout.pins).toEqual({});
    expect(papercraftReducer(pinned, { type: 'SET_DETAIL', pct: 60 }).layout.pins).toEqual({});
  });

  it('is saved and opened again, and a design from before has no layout (the defaults)', () => {
    const r = computePapercraft(horse());
    if (!r.ok) throw new Error('no run');
    const s = { ...horse(), layout: { pins: pinsOf(boxesOf(r.run.layout, r.run.pattern.parts)), maxPartsPerPage: 4, tight: false } };
    const back = deserializePapercraft(JSON.parse(snapshotText(s)))!;
    expect(back.layout).toEqual(s.layout);
    const plain = serializePapercraft(horse()) as unknown as Record<string, unknown>;
    expect('layout' in plain).toBe(false);
    expect(deserializePapercraft(JSON.parse(JSON.stringify(plain)))!.layout).toEqual({ pins: {}, maxPartsPerPage: null, tight: true });
  });

  it('opens a layout with damaged pins without them: not numbers, a page that is far out, a part number that is not one', () => {
    const base = serializePapercraft(horse()) as unknown as Record<string, unknown>;
    const wild = {
      ...base,
      layout: {
        pins: {
          '1': { page: 0, rotation: 0, x: 10, y: 10, w: 50, h: 40 },
          '2': { page: 'a', rotation: 0, x: 10, y: 10, w: 50, h: 40 },
          '3': { page: 9999, rotation: 0, x: 10, y: 10, w: 50, h: 40 },
          x: { page: 0, rotation: 0, x: 10, y: 10, w: 50, h: 40 },
          '4': { page: 0, rotation: 0, x: 10, y: 10, w: -5, h: 40 },
        },
        maxPartsPerPage: 99999,
      },
    };
    const back = deserializePapercraft(JSON.parse(JSON.stringify(wild)))!;
    expect(Object.keys(back.layout.pins)).toEqual(['1']);
    expect(back.layout.maxPartsPerPage).toBe(50);
  });
});
