import { describe, expect, it } from 'vitest';
import { PAGE_PRESETS } from '../src/lib/papercraft-engine';
import { computePapercraft, meshOfSource, pageSizeOf } from '../app/papercraft/papercraftCompute';
import { deserializePapercraft, serializePapercraft, snapshotText } from '../app/papercraft/papercraftSnapshot';
import { initialPapercraftState, MIN_DETAIL_PCT, papercraftReducer, type PapercraftState } from '../app/papercraft/papercraftState';
import { coverPageSize, paperPresetLabel } from '../app/papercraft/papercraftCover';
import { translate } from '../app/lib/i18n';

const start = (): PapercraftState => initialPapercraftState();
const t = (text: string) => translate('en', text);
const sv = (text: string) => translate('sv', text);
const horse = (): PapercraftState => papercraftReducer(start(), { type: 'USE_BUILT_IN', id: 'horse' });

describe('paper sizes', () => {
  it('has A3 and A5 and Tabloid next to A4 and Letter', () => {
    expect(PAGE_PRESETS.a3).toEqual({ pageWidthMm: 297, pageHeightMm: 420 });
    expect(PAGE_PRESETS.a5).toEqual({ pageWidthMm: 148, pageHeightMm: 210 });
    expect(PAGE_PRESETS.tabloid.pageHeightMm).toBeCloseTo(431.8, 6);
  });

  it('makes the pages the size of the preset, and fewer of them on a bigger sheet', () => {
    const base = { ...horse(), size: { by: 'largest' as const, mm: 320 } };
    const pages = (preset: PapercraftState['paper']['preset']) => {
      const r = computePapercraft({ ...base, paper: { ...base.paper, preset } });
      if (!r.ok) throw new Error('no run');
      return r.run;
    };
    const a3 = pages('a3');
    expect(a3.layout.pages[0]).toMatchObject({ widthMm: 297, heightMm: 420 });
    expect(pages('a5').layout.pages.length).toBeGreaterThan(a3.layout.pages.length);
    expect(a3.layout.pages.length).toBeLessThanOrEqual(pages('a4').layout.pages.length);
  });

  it('a size of your own: the pages are that size', () => {
    const s = { ...horse(), paper: { ...start().paper, preset: 'custom' as const, customWidthMm: 330, customHeightMm: 480 } };
    expect(pageSizeOf(s.paper)).toEqual({ pageWidthMm: 330, pageHeightMm: 480 });
    const r = computePapercraft(s);
    if (!r.ok) throw new Error('no run');
    expect(r.run.layout.pages[0]).toMatchObject({ widthMm: 330, heightMm: 480 });
  });

  it('has a name in both languages, and the cover is printed on A4 (or Letter for the American sizes)', () => {
    for (const p of ['a3', 'a4', 'a5', 'letter', 'tabloid', 'cricut12x12', 'cricut12x24', 'custom'] as const) {
      expect(paperPresetLabel(t, p).length, p).toBeGreaterThan(0);
      expect(paperPresetLabel(sv, p).length, p).toBeGreaterThan(0);
    }
    expect(coverPageSize('a3')).toEqual({ widthMm: 210, heightMm: 297 });
    expect(coverPageSize('tabloid')).toEqual({ widthMm: 215.9, heightMm: 279.4 });
  });
});

describe('detail of a built-in model', () => {
  it('starts at 100 % (the model as it is made) and goes down to a floor', () => {
    expect(horse().detailPct).toBe(100);
    expect(papercraftReducer(horse(), { type: 'SET_DETAIL', pct: 60 }).detailPct).toBe(60);
    expect(papercraftReducer(horse(), { type: 'SET_DETAIL', pct: 5 }).detailPct).toBe(MIN_DETAIL_PCT);
    expect(papercraftReducer(horse(), { type: 'SET_DETAIL', pct: 500 }).detailPct).toBe(100);
  });

  it('less detail gives fewer faces and parts, and the model stays closed', () => {
    const faces = (pct: number) => {
      const r = computePapercraft({ ...horse(), detailPct: pct });
      if (!r.ok) throw new Error('no run');
      expect(r.run.solid.closed).toBe(true);
      return r.run.solid.faces.length;
    };
    expect(faces(60)).toBeLessThan(faces(100));
    expect(faces(40)).toBeLessThan(faces(60));
  });

  it('100 % is the model itself, and a new model or file starts at full detail again', () => {
    const s = horse();
    expect(meshOfSource({ ...s, detailPct: 100 })).toEqual(meshOfSource({ source: s.source }));
    const lowered = papercraftReducer(s, { type: 'SET_DETAIL', pct: 50 });
    expect(papercraftReducer(lowered, { type: 'USE_BUILT_IN', id: 'dog' }).detailPct).toBe(100);
    expect(papercraftReducer(lowered, { type: 'USE_FILE', fileName: 'a.obj', mesh: { positions: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], faces: [[0, 1, 2]] } }).detailPct).toBe(100);
  });

  it('a change of detail starts the edge edits over (their ids belong to the old model)', () => {
    const edited = papercraftReducer(horse(), { type: 'TOGGLE_EDGE', edgeId: 3, joined: true });
    expect(edited.edits.forceCut.length + edited.edits.forceJoin.length).toBeGreaterThan(0);
    const less = papercraftReducer(edited, { type: 'SET_DETAIL', pct: 70 });
    expect(less.edits).toEqual({ forceCut: [], forceJoin: [] });
  });
});

describe('colours of the parts', () => {
  it('are off at first, and the person can turn them on', () => {
    expect(start().colourParts).toBe(false);
    expect(papercraftReducer(start(), { type: 'SET_COLOURS', on: true }).colourParts).toBe(true);
  });
});

describe('saving the new settings', () => {
  it('keeps a size of your own, the detail and the colours through save and open', () => {
    const s: PapercraftState = {
      ...horse(),
      detailPct: 55,
      colourParts: true,
      paper: { ...start().paper, preset: 'custom', customWidthMm: 321, customHeightMm: 456 },
    };
    const back = deserializePapercraft(JSON.parse(snapshotText(s)));
    expect(back).not.toBeNull();
    expect(back!.detailPct).toBe(55);
    expect(back!.colourParts).toBe(true);
    expect(back!.paper).toMatchObject({ preset: 'custom', customWidthMm: 321, customHeightMm: 456 });
  });

  it('opens a design saved before these settings existed, with the defaults', () => {
    const old = serializePapercraft(horse()) as unknown as Record<string, unknown>;
    delete old.detailPct;
    delete old.colourParts;
    const paper = { ...(old.paper as Record<string, unknown>) };
    delete paper.customWidthMm;
    delete paper.customHeightMm;
    old.paper = paper;
    const back = deserializePapercraft(JSON.parse(JSON.stringify(old)))!;
    expect(back.detailPct).toBe(100);
    expect(back.colourParts).toBe(false);
    expect(back.paper.customWidthMm).toBe(300);
  });

  it('keeps the numbers in range and does not write the defaults into the save', () => {
    const plain = serializePapercraft(horse()) as unknown as Record<string, unknown>;
    expect('detailPct' in plain).toBe(false);
    expect('colourParts' in plain).toBe(false);
    const wild = { ...plain, detailPct: -4, paper: { ...(plain.paper as object), customWidthMm: 5, customHeightMm: 99999 } };
    const back = deserializePapercraft(JSON.parse(JSON.stringify(wild)))!;
    expect(back.detailPct).toBe(MIN_DETAIL_PCT);
    expect(back.paper.customWidthMm).toBe(50);
    expect(back.paper.customHeightMm).toBe(2000);
  });
});
