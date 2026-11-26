import { describe, expect, it } from 'vitest';
import { buildPattern, buildSolid, createPapercraft, exportPageDxf, layoutPages, renderBuildOrderPages, renderPages, shapes } from '../src/lib/papercraft-engine';
import { buildOrderOf } from '../src/lib/papercraft-engine/unfold/buildOrder';
import { BUILT_IN_MODELS } from '../app/papercraft/papercraftModels';
import { describeBuildStep } from '../app/papercraft/papercraftBuild';
import { buildCoverContent } from '../app/papercraft/papercraftCover';
import { buildPatternPdf } from '../app/papercraft/papercraftExport';
import { computePapercraft } from '../app/papercraft/papercraftCompute';
import { deserializePapercraft, serializePapercraft, snapshotText } from '../app/papercraft/papercraftSnapshot';
import { initialPapercraftState, papercraftReducer } from '../app/papercraft/papercraftState';
import { translate } from '../app/lib/i18n';

const modelRun = (id: string, mm: number, extra: Parameters<typeof createPapercraft>[0] extends infer T ? Partial<T> : never = {}) =>
  createPapercraft({ mesh: BUILT_IN_MODELS.find((m) => m.id === id)!.mesh(), scale: { by: 'largest', mm }, ...extra });

describe('the order to build in', () => {
  it('starts with the part glued to the most others and always takes the part with the most edges to what is built', () => {
    const parts = [{ id: 1, areaMm2: 100 }, { id: 2, areaMm2: 500 }, { id: 3, areaMm2: 300 }, { id: 4, areaMm2: 200 }];
    const pairs = [
      { number: 1, a: 1, b: 2 }, { number: 2, a: 2, b: 3 }, { number: 3, a: 2, b: 3 }, { number: 4, a: 3, b: 4 }, { number: 5, a: 4, b: 4 }, { number: 6, a: 1, b: 3 },
    ];
    const steps = buildOrderOf(parts, pairs);
    // Parts 2 and 3 both touch three others' worth; 3 touches 1, 2 and 4 (more distinct parts) so it is the base.
    expect(steps.map((s) => s.partId)).toEqual([3, 2, 1, 4]);
    expect(steps[0]).toMatchObject({ step: 1, partId: 3, joins: [], seams: [] });
    expect(steps[1].joins).toEqual([{ partId: 3, edges: [2, 3] }]);
    expect(steps[2].joins).toEqual([{ partId: 2, edges: [1] }, { partId: 3, edges: [6] }]);
    expect(steps[3]).toMatchObject({ partId: 4, seams: [5], joins: [{ partId: 3, edges: [4] }] });
  });

  it('a separate piece starts again with the biggest part left, and every part is in the order once', () => {
    const parts = [{ id: 1, areaMm2: 100 }, { id: 2, areaMm2: 100 }, { id: 3, areaMm2: 900 }, { id: 4, areaMm2: 50 }];
    const steps = buildOrderOf(parts, [{ number: 1, a: 1, b: 2 }]);
    expect(steps.map((s) => s.partId).sort()).toEqual([1, 2, 3, 4]);
    expect(steps[0].partId).toBe(1);
    // After the two that are glued, the biggest of the loose ones.
    expect(steps.map((s) => s.partId)).toEqual([1, 2, 3, 4]);
    expect(steps[2].joins).toEqual([]);
  });

  it('ignores a pair that names a part that is not there, and is deterministic', () => {
    const parts = [{ id: 1, areaMm2: 10 }, { id: 2, areaMm2: 20 }];
    const pairs = [{ number: 1, a: 1, b: 9 }, { number: 2, a: 1, b: 2 }];
    const a = JSON.stringify(buildOrderOf(parts, pairs));
    expect(a).toBe(JSON.stringify(buildOrderOf(parts, pairs)));
    expect(buildOrderOf(parts, pairs).flatMap((s) => s.joins.flatMap((j) => j.edges))).toEqual([2]);
  });

  // Forty models are unfolded one after the other: a few seconds, more on a slow machine.
  it('every glued edge is in exactly one step, as a seam or as a join, for every built-in model', { timeout: 60_000 }, () => {
    for (const m of BUILT_IN_MODELS) {
      const run = modelRun(m.id, m.defaultSizeMm);
      const order = run.pattern.buildOrder;
      expect(order.map((s) => s.partId).sort((a, b) => a - b), m.id).toEqual(run.pattern.parts.map((p) => p.id).sort((a, b) => a - b));
      const used = order.flatMap((s) => [...s.seams, ...s.joins.flatMap((j) => j.edges)]).sort((a, b) => a - b);
      const all = Array.from({ length: run.pattern.edgePairCount }, (_, i) => i + 1);
      expect(used, m.id).toEqual(all);
      // A join only names parts that were built earlier.
      const seen = new Set<number>();
      for (const s of order) {
        for (const j of s.joins) expect(seen.has(j.partId), `${m.id} step ${s.step}`).toBe(true);
        seen.add(s.partId);
      }
    }
  });

  it('numbers the parts by their step when asked, and by size otherwise', () => {
    const horse = BUILT_IN_MODELS.find((m) => m.id === 'horse')!;
    const solid = buildSolid(horse.mesh());
    const bySize = buildPattern(solid, {});
    const byBuild = buildPattern(solid, { numberPartsBy: 'build' });
    const labelOf = (p: typeof bySize, id: number) => p.parts.find((q) => q.id === id)!.labels.find((l) => l.role === 'part')?.text;
    for (const part of bySize.parts) if (labelOf(bySize, part.id)) expect(labelOf(bySize, part.id)).toBe(String(part.id));
    for (const step of byBuild.buildOrder) {
      const text = labelOf(byBuild, step.partId);
      if (text !== undefined) expect(text).toBe(String(step.step));
    }
    expect(byBuild.buildOrder[0].partId).toBe(bySize.buildOrder[0].partId);
  });
});

describe('the square to measure', () => {
  it('is in the lower left corner of the first page and no part is put on it', () => {
    const run = modelRun('horse', 220, { layout: { calibrationMm: 100 } });
    const first = run.layout.pages[0];
    expect(first.marks).toEqual([{ kind: 'square', x: 10, y: 10, sizeMm: 100 }]);
    expect(run.layout.pages.slice(1).every((p) => p.marks === undefined)).toBe(true);
    for (const pl of first.placements) {
      const part = run.pattern.parts.find((p) => p.id === pl.partId)!;
      const pts = part.hull.map((q) => [pl.cos * q[0] - pl.sin * q[1] + pl.tx, pl.sin * q[0] + pl.cos * q[1] + pl.ty]);
      const inX = pts.some((p) => p[0] > 10 && p[0] < 110);
      const inY = pts.some((p) => p[1] > 10 && p[1] < 110);
      expect(inX && inY).toBe(false);
    }
  });

  it('is drawn as a cut square with its size written, so it is in the printed and the cutting files', () => {
    const run = modelRun('cube', 60, { layout: { calibrationMm: 100 } });
    const drawing = renderPages(run.layout.pages, run.pattern.parts)[0];
    const square = drawing.cut.find((c) => c.closed && c.points.length === 4 && Math.abs(c.points[1][0] - c.points[0][0] - 100) < 1e-9);
    expect(square).toBeDefined();
    expect(drawing.text.length).toBeGreaterThan(0);
    expect(exportPageDxf(drawing)).toContain('CUT');
  });

  it('is left out when it is not asked for, too small, or does not fit the page; a page with only the square is kept', () => {
    const plain = modelRun('cube', 60);
    expect(plain.layout.pages.every((p) => p.marks === undefined)).toBe(true);
    expect(modelRun('cube', 60, { layout: { calibrationMm: 5 } }).layout.pages[0].marks).toBeUndefined();
    expect(modelRun('cube', 60, { layout: { calibrationMm: Number.NaN } }).layout.pages[0].marks).toBeUndefined();
    expect(modelRun('cube', 60, { layout: { calibrationMm: 500 } }).layout.pages[0].marks).toBeUndefined();
    // Every part pinned to the second page: the first page still has the square.
    const base = modelRun('cube', 60);
    const pins = Object.fromEntries(base.pattern.parts.map((p) => [p.id, { page: 1, rotation: 0, x: 10, y: 10, w: 1, h: 1 }]));
    const layout = layoutPages(base.pattern.parts, base.pageSettings, { calibrationMm: 100, pins });
    expect(layout.pages[0].marks).toHaveLength(1);
  });

  it('is deterministic with tight packing', () => {
    const a = modelRun('horse', 220, { layout: { calibrationMm: 100, tight: true } });
    const b = modelRun('horse', 220, { layout: { calibrationMm: 100, tight: true } });
    expect(JSON.stringify(a.layout)).toBe(JSON.stringify(b.layout));
    expect(shapes.cube(1).faces.length).toBe(6);
  });
});

describe('the build order in the studio', () => {
  const horse = () => papercraftReducer(initialPapercraftState(), { type: 'USE_BUILT_IN', id: 'horse' });
  const en = (text: string, vars?: Record<string, string | number>) => translate('en', text, vars);
  const sv = (text: string, vars?: Record<string, string | number>) => translate('sv', text, vars);

  it('numbers the parts by the build order for a new model, and the square starts off', () => {
    expect(horse().pattern.numberPartsBy).toBe('build');
    expect(horse().layout.calibrationMm).toBeNull();
  });

  it('the square is switched on and off, starts the placing over, and is kept in range', () => {
    const on = papercraftReducer(horse(), { type: 'SET_CALIBRATION', mm: 100 });
    expect(on.layout.calibrationMm).toBe(100);
    const r = computePapercraft(on);
    if (!r.ok) throw new Error('no run');
    expect(r.run.layout.pages[0].marks).toEqual([{ kind: 'square', x: 10, y: 10, sizeMm: 100 }]);
    expect(papercraftReducer(on, { type: 'SET_CALIBRATION', mm: null }).layout.calibrationMm).toBeNull();
    expect(papercraftReducer(on, { type: 'SET_CALIBRATION', mm: 3 }).layout.calibrationMm).toBeNull();
    expect(papercraftReducer(on, { type: 'SET_CALIBRATION', mm: 9000 }).layout.calibrationMm).toBe(500);
    const pinned = papercraftReducer(on, { type: 'SET_PINS', pins: { 1: { page: 0, rotation: 0, x: 1, y: 1, w: 1, h: 1 } } });
    expect(papercraftReducer(pinned, { type: 'SET_CALIBRATION', mm: null }).layout.pins).toEqual({});
  });

  it('keeps the square and the numbering through save and open; an older design was numbered by size', () => {
    const s = { ...horse(), layout: { ...horse().layout, calibrationMm: 100 }, pattern: { ...horse().pattern, numberPartsBy: 'size' as const } };
    const back = deserializePapercraft(JSON.parse(snapshotText(s)))!;
    expect(back.layout.calibrationMm).toBe(100);
    expect(back.pattern.numberPartsBy).toBe('size');
    const old = serializePapercraft(horse()) as unknown as { pattern: Record<string, unknown> };
    delete old.pattern.numberPartsBy;
    expect(deserializePapercraft(JSON.parse(JSON.stringify(old)))!.pattern.numberPartsBy).toBe('size');
  });

  it('says every step in both languages with nothing left to fill in', () => {
    const run = modelRun('horse', 220);
    for (const step of run.pattern.buildOrder) {
      for (const t of [en, sv]) {
        const text = describeBuildStep(t, step);
        expect(text.length).toBeGreaterThan(10);
        expect(text).not.toMatch(/\{\w+\}/);
      }
    }
    expect(describeBuildStep(en, run.pattern.buildOrder[0])).toContain('Start with part');
    expect(describeBuildStep(en, run.pattern.buildOrder[1])).toContain('Take part');
    expect(describeBuildStep(sv, run.pattern.buildOrder[0])).toContain('Börja med del');
  });

  it('puts the build order on pages after the cover in the PDF, and none for a model of one part', () => {
    const run = modelRun('horse', 220);
    const content = buildCoverContent(run, 'Horse', 'a4', en, true);
    expect(content.buildOrder?.steps).toHaveLength(run.pattern.parts.length);
    const withOrder = buildPatternPdf(run, { content, size: { widthMm: 210, heightMm: 297 } });
    const without = buildPatternPdf(run, { content: { ...content, buildOrder: undefined }, size: { widthMm: 210, heightMm: 297 } });
    const pagesIn = (b: Uint8Array) => (new TextDecoder('latin1').decode(b).match(/\/Type \/Page\b(?!s)/g) ?? []).length;
    expect(pagesIn(withOrder)).toBeGreaterThan(pagesIn(without));
    const one = modelRun('test-cube', 40);
    expect(buildCoverContent(one, 'Cube', 'a4', en, true).buildOrder === undefined || one.pattern.buildOrder.length > 1).toBe(true);
  });

  it('wraps long steps and goes on to another page when there are many', () => {
    const steps = Array.from({ length: 80 }, (_, i) => `Take part ${i + 1}. Fold it along the dashed lines and glue edges 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 to part ${i}.`);
    const pages = renderBuildOrderPages({ title: 'Build order', steps, footer: 'Made with Papercraft Studio' }, { widthMm: 210, heightMm: 297 });
    expect(pages.length).toBeGreaterThan(1);
    for (const p of pages) for (const run of p.texts) {
      expect(run.y).toBeGreaterThanOrEqual(5);
      expect(run.y).toBeLessThanOrEqual(297);
    }
    expect(pages.flatMap((p) => p.texts.filter((r) => /^\d+$/.test(r.text))).length).toBe(80);
  });
});
