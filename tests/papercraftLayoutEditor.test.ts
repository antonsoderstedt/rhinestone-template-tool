import { describe, expect, it } from 'vitest';
import { createPapercraft, layoutPages, layoutProblems, shapes, transformPoint } from '../src/lib/papercraft-engine';
import type { PagePin, PageSettings, Part, PapercraftResult } from '../src/lib/papercraft-engine';
import { BUILT_IN_MODELS } from '../app/papercraft/papercraftModels';


function modelRun(id: string, mm: number, extra: Partial<Parameters<typeof createPapercraft>[0]> = {}): PapercraftResult {
  const model = BUILT_IN_MODELS.find((m) => m.id === id)!;
  return createPapercraft({ mesh: model.mesh(), scale: { by: 'largest', mm }, ...extra });
}

const horse = () => modelRun('horse', 220);

/** The pin that stands for where a part is now, optionally moved. */
function pinOf(run: PapercraftResult, partId: number, patch: Partial<PagePin> = {}): PagePin {
  for (const page of run.layout.pages) {
    const pl = page.placements.find((p) => p.partId === partId);
    if (!pl) continue;
    const part = run.pattern.parts.find((p) => p.id === partId)!;
    const pts = part.hull.map((q) => transformPoint(pl, q));
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    return { page: page.index, rotation: pl.rotation, x: pl.x, y: pl.y, w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), ...patch };
  }
  throw new Error('part not on a page');
}

const boxOf = (run: PapercraftResult, partId: number) => {
  for (const page of run.layout.pages) {
    const pl = page.placements.find((p) => p.partId === partId);
    if (!pl) continue;
    const pts = run.pattern.parts.find((p) => p.id === partId)!.hull.map((q) => transformPoint(pl, q));
    return { page: page.index, x: Math.min(...pts.map((q) => q[0])), y: Math.min(...pts.map((q) => q[1])), w: Math.max(...pts.map((q) => q[0])) - Math.min(...pts.map((q) => q[0])), h: Math.max(...pts.map((q) => q[1])) - Math.min(...pts.map((q) => q[1])) };
  }
  throw new Error('part not on a page');
};

describe('parts the person has placed', () => {
  it('stay where they were put: another page, another place, turned', () => {
    const run = horse();
    const part = run.pattern.parts[0];
    const pin = pinOf(run, part.id);
    // Quarter turn: the box turns, so width and height trade places.
    const turned = layoutPages(run.pattern.parts, run.pageSettings, { pins: { [part.id]: { ...pin, page: 1, x: 30, y: 40, rotation: pin.rotation + Math.PI / 2, w: pin.h, h: pin.w } } });
    const pl = turned.pages[1].placements.find((p) => p.partId === part.id)!;
    expect(pl.x).toBeCloseTo(30, 9);
    expect(pl.y).toBeCloseTo(40, 9);
    expect(pl.rotation).toBeCloseTo(pin.rotation + Math.PI / 2, 9);
  });

  it('are the only thing that moves: the other parts are placed round them and never on top of them', () => {
    const run = horse();
    const biggest = run.pattern.parts[0];
    const pin = pinOf(run, biggest.id, { x: 50, y: 60 });
    const layout = layoutPages(run.pattern.parts, run.pageSettings, { pins: { [biggest.id]: pin } });
    const problems = layoutProblems(layout, run.pattern.parts).filter((p) => p.kind === 'overlap');
    expect(problems).toEqual([]);
    expect(layout.pages.flatMap((p) => p.placements)).toHaveLength(run.pattern.parts.length);
  });

  it('all pinned: the layout is exactly the pins, in the order of the pages, and empty pages are dropped', () => {
    const run = horse();
    const pins: Record<number, PagePin> = {};
    run.pattern.parts.forEach((part, i) => {
      pins[part.id] = pinOf(run, part.id, { page: i === 0 ? 0 : 3 });
      // Spread the parts on page 3 so they do not overlap: one under the other would not fit, so give each its own x.
      if (i > 0) pins[part.id].x = 10 + ((i - 1) % 3) * 5;
    });
    const layout = layoutPages(run.pattern.parts, run.pageSettings, { pins });
    // Pages 1 and 2 had nothing: they are not there, so the parts are on two pages.
    expect(layout.pages).toHaveLength(2);
    expect(layout.pages.map((p) => p.index)).toEqual([0, 1]);
  });

  it('a pin for a part that has changed since is ignored (another size, another model)', () => {
    const run = horse();
    const part = run.pattern.parts[0];
    const stale: PagePin = { ...pinOf(run, part.id), w: 999, h: 999, page: 2, x: 5, y: 5 };
    const layout = layoutPages(run.pattern.parts, run.pageSettings, { pins: { [part.id]: stale } });
    const same = layoutPages(run.pattern.parts, run.pageSettings);
    expect(JSON.stringify(layout)).toBe(JSON.stringify(same));
  });

  it('a pin that is not a number or is far out is ignored', () => {
    const run = horse();
    const part = run.pattern.parts[0];
    const pin = pinOf(run, part.id);
    for (const bad of [{ ...pin, x: Number.NaN }, { ...pin, page: -1 }, { ...pin, page: 5000 }, { ...pin, y: Number.POSITIVE_INFINITY }]) {
      expect(JSON.stringify(layoutPages(run.pattern.parts, run.pageSettings, { pins: { [part.id]: bad } }))).toBe(JSON.stringify(layoutPages(run.pattern.parts, run.pageSettings)));
    }
  });
});

describe('how many parts on a page', () => {
  it('no page has more parts than the limit (when none are pinned), and the same parts are all there', () => {
    const run = horse();
    for (const limit of [1, 2, 3]) {
      const layout = layoutPages(run.pattern.parts, run.pageSettings, { maxPartsPerPage: limit });
      expect(Math.max(...layout.pages.map((p) => p.placements.length))).toBeLessThanOrEqual(limit);
      expect(layout.pages.flatMap((p) => p.placements)).toHaveLength(run.pattern.parts.length);
    }
    expect(layoutPages(run.pattern.parts, run.pageSettings, { maxPartsPerPage: 1 }).pages).toHaveLength(run.pattern.parts.length);
  });

  it('a limit of 0 or a number that is not one means no limit', () => {
    const run = horse();
    const none = JSON.stringify(layoutPages(run.pattern.parts, run.pageSettings));
    expect(JSON.stringify(layoutPages(run.pattern.parts, run.pageSettings, { maxPartsPerPage: 0 }))).toBe(none);
    expect(JSON.stringify(layoutPages(run.pattern.parts, run.pageSettings, { maxPartsPerPage: Number.NaN }))).toBe(none);
  });
});

describe('packing tightly', () => {
  it('never uses more pages than the plain packing, and puts every part on a page without overlap', () => {
    for (const id of ['horse', 'dog', 'elephant', 'giraffe', 'penguin']) {
      const model = BUILT_IN_MODELS.find((m) => m.id === id)!;
      const run = modelRun(id, model.defaultSizeMm);
      const plain = layoutPages(run.pattern.parts, run.pageSettings);
      const tight = layoutPages(run.pattern.parts, run.pageSettings, { tight: true });
      expect(tight.pages.length, id).toBeLessThanOrEqual(plain.pages.length);
      expect(tight.pages.flatMap((p) => p.placements), id).toHaveLength(run.pattern.parts.length);
      expect(layoutProblems(tight, run.pattern.parts), id).toEqual([]);
    }
  });

  it('is deterministic', () => {
    const run = horse();
    expect(JSON.stringify(layoutPages(run.pattern.parts, run.pageSettings, { tight: true }))).toBe(JSON.stringify(layoutPages(run.pattern.parts, run.pageSettings, { tight: true })));
  });
});

describe('what is wrong with a layout', () => {
  it('a normal layout has no problems', () => {
    const run = horse();
    expect(layoutProblems(run.layout, run.pattern.parts)).toEqual([]);
  });

  it('finds a part that sticks out over the edge of the page, and two parts that lie over each other', () => {
    const run = horse();
    const [a, b] = run.pattern.parts;
    const pa = pinOf(run, a.id, { page: 0, x: -20, y: 20 });
    const out = layoutPages(run.pattern.parts, run.pageSettings, { pins: { [a.id]: pa } });
    expect(layoutProblems(out, run.pattern.parts)).toContainEqual({ partId: a.id, page: 0, kind: 'outside' });
    const pa2 = pinOf(run, a.id, { page: 0, x: 20, y: 20 });
    const pb2 = pinOf(run, b.id, { page: 0, x: 30, y: 30 });
    const over = layoutPages(run.pattern.parts, run.pageSettings, { pins: { [a.id]: pa2, [b.id]: pb2 } });
    const found = layoutProblems(over, run.pattern.parts).filter((p) => p.kind === 'overlap');
    expect(found.map((p) => p.partId).sort()).toEqual([a.id, b.id].sort());
  });
});

describe('the layout through the pipeline', () => {
  it('createPapercraft takes the layout options and the pages follow them', () => {
    const base = modelRun('horse', 220);
    const limited = createPapercraft({ mesh: shapes.horse(), scale: { by: 'largest', mm: 220 }, layout: { maxPartsPerPage: 1 } });
    expect(limited.layout.pages.length).toBe(limited.pattern.parts.length);
    expect(limited.layout.pages.length).toBeGreaterThan(base.layout.pages.length - 1);
    const part: Part = base.pattern.parts[0];
    const moved = createPapercraft({ mesh: shapes.horse(), scale: { by: 'largest', mm: 220 }, layout: { pins: { [part.id]: pinOf(base, part.id, { x: 55, y: 66 }) } } });
    expect(boxOf(moved, part.id)).toMatchObject({ x: 55, y: 66 });
  });
});
