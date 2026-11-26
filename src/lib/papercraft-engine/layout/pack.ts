import type { LayoutOptions, Page, PageLayout, PageSettings, Part, PatternWarning, Placement, Vec2 } from '../types';
import { boundsOf, candidateBoxes, convexOverlap, rotatePoint } from '../geometry/polygon';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Rule = 'bssf' | 'baf' | 'bl';

/** MaxRects bin: free rectangles, and a choice of rule for where a part goes (best short side fit is the default). */
class Bin {
  free: Rect[];
  constructor(w: number, h: number) {
    this.free = [{ x: 0, y: 0, w, h }];
  }
  find(w: number, h: number, rule: Rule = 'bssf'): { x: number; y: number } | null {
    let best: { x: number; y: number; s1: number; s2: number } | null = null;
    for (const r of this.free) {
      if (r.w + 1e-9 < w || r.h + 1e-9 < h) continue;
      // The rules differ in what they try to keep small: the short side left over (best short side), the area left over (best area), or the height (bottom left).
      const s1 = rule === 'baf' ? r.w * r.h - w * h : rule === 'bl' ? r.y + h : Math.min(r.w - w, r.h - h);
      const s2 = rule === 'baf' ? Math.min(r.w - w, r.h - h) : rule === 'bl' ? r.x : Math.max(r.w - w, r.h - h);
      if (!best || s1 < best.s1 - 1e-9 || (Math.abs(s1 - best.s1) <= 1e-9 && (s2 < best.s2 - 1e-9 || (Math.abs(s2 - best.s2) <= 1e-9 && (r.y < best.y || (r.y === best.y && r.x < best.x)))))) {
        best = { x: r.x, y: r.y, s1, s2 };
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  }
  place(x: number, y: number, w: number, h: number) {
    const next: Rect[] = [];
    for (const r of this.free) {
      if (x >= r.x + r.w - 1e-9 || x + w <= r.x + 1e-9 || y >= r.y + r.h - 1e-9 || y + h <= r.y + 1e-9) {
        next.push(r);
        continue;
      }
      if (x > r.x + 1e-9) next.push({ x: r.x, y: r.y, w: x - r.x, h: r.h });
      if (x + w < r.x + r.w - 1e-9) next.push({ x: x + w, y: r.y, w: r.x + r.w - (x + w), h: r.h });
      if (y > r.y + 1e-9) next.push({ x: r.x, y: r.y, w: r.w, h: y - r.y });
      if (y + h < r.y + r.h - 1e-9) next.push({ x: r.x, y: y + h, w: r.w, h: r.y + r.h - (y + h) });
    }
    this.free = next.filter((a, i) => !next.some((b, j) => i !== j && a.x >= b.x - 1e-9 && a.y >= b.y - 1e-9 && a.x + a.w <= b.x + b.w + 1e-9 && a.y + a.h <= b.y + b.h + 1e-9 && (i > j || a.w < b.w - 1e-9 || a.h < b.h - 1e-9 || a.x !== b.x || a.y !== b.y)));
  }
}

interface Orientation {
  angle: number;
  w: number;
  h: number;
  minX: number;
  minY: number;
}

/** The box round a part (its outline with the tabs) when it is turned by `rotation` radians: its size, and where the corner of the box is before it is moved. */
export function partBox(part: Part, rotation: number): { w: number; h: number; minX: number; minY: number } {
  const o = orientationAt(part, rotation);
  return { w: o.w, h: o.h, minX: o.minX, minY: o.minY };
}

function orientationAt(part: Part, angle: number): Orientation {
  const b = boundsOf(part.hull.map((p) => rotatePoint(p, angle)));
  return { angle, w: b.maxX - b.minX, h: b.maxY - b.minY, minX: b.minX, minY: b.minY };
}

function orientations(part: Part, mode: 'none' | 'quarter' | 'free'): Orientation[] {
  const out: Orientation[] = [];
  const seen = new Set<string>();
  const add = (angle: number) => {
    const b = boundsOf(part.hull.map((p) => rotatePoint(p, angle)));
    const key = `${(b.maxX - b.minX).toFixed(3)}x${(b.maxY - b.minY).toFixed(3)}@${((angle % Math.PI) + Math.PI).toFixed(3)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ angle, w: b.maxX - b.minX, h: b.maxY - b.minY, minX: b.minX, minY: b.minY });
  };
  if (mode !== 'free') {
    add(0);
    if (mode === 'quarter') add(Math.PI / 2);
  }
  // Free turning: the first choices when asked for, the way out for a part that fits no other way.
  if (mode !== 'none') {
    for (const box of candidateBoxes(part.hull)) {
      add(box.angle);
      add(box.angle + Math.PI / 2);
    }
  }
  return out;
}

type Order = 'area' | 'longest' | 'height' | 'width' | 'perimeter';

interface Variant {
  order: Order;
  rotation: 'none' | 'quarter' | 'free';
  rule: Rule;
}

interface Packed {
  pages: Page[];
  tooLarge: number;
}

/** One packing: the pinned parts where the person put them, then the others by one order, turn rule and fit rule. */
function pack(parts: readonly Part[], settings: PageSettings, options: LayoutOptions, variant: Variant): Packed {
  const usableW = settings.pageWidthMm - 2 * settings.marginMm;
  const usableH = settings.pageHeightMm - 2 * settings.marginMm;
  const gap = settings.gapMm;
  const pages: Page[] = [];
  const bins: Bin[] = [];
  const limit = options.maxPartsPerPage !== undefined && options.maxPartsPerPage >= 1 ? Math.floor(options.maxPartsPerPage) : Infinity;

  const newPage = (): number => {
    pages.push({ index: pages.length, widthMm: settings.pageWidthMm, heightMm: settings.pageHeightMm, placements: [] });
    bins.push(new Bin(usableW + gap, usableH + gap));
    return pages.length - 1;
  };
  function commit(pi: number, part: Part, o: Orientation, x: number, y: number) {
    bins[pi].place(x, y, o.w + gap, o.h + gap);
    const px = settings.marginMm + x;
    const py = settings.marginMm + y;
    pages[pi].placements.push({ partId: part.id, rotation: o.angle, x: px, y: py, cos: Math.cos(o.angle), sin: Math.sin(o.angle), tx: px - o.minX, ty: py - o.minY });
  }

  // The square to measure: the lower left corner of the first page, where no part is put.
  const square = options.calibrationMm !== undefined && Number.isFinite(options.calibrationMm) && options.calibrationMm >= 10 ? options.calibrationMm : 0;
  if (square > 0 && square <= usableW + 1e-6 && square <= usableH + 1e-6) {
    const pi = newPage();
    bins[pi].place(0, 0, square + gap, square + gap);
    pages[pi].marks = [{ kind: 'square', x: settings.marginMm, y: settings.marginMm, sizeMm: square }];
  }

  // The parts the person has placed stay where they are (as long as they still are the part they were placed as).
  const pinned = new Set<number>();
  for (const part of parts) {
    const pin = options.pins?.[part.id];
    if (!pin || !Number.isFinite(pin.page) || pin.page < 0 || pin.page > 200 || !Number.isFinite(pin.x) || !Number.isFinite(pin.y)) continue;
    const o = orientationAt(part, pin.rotation);
    if (Math.abs(o.w - pin.w) > 0.05 || Math.abs(o.h - pin.h) > 0.05) continue;
    while (pages.length <= Math.floor(pin.page)) newPage();
    commit(Math.floor(pin.page), part, o, pin.x - settings.marginMm, pin.y - settings.marginMm);
    pinned.add(part.id);
  }

  const key = (o: Orientation): number =>
    variant.order === 'longest' ? Math.max(o.w, o.h) : variant.order === 'height' ? o.h : variant.order === 'width' ? o.w : variant.order === 'perimeter' ? o.w + o.h : o.w * o.h;
  const order = parts
    .filter((part) => !pinned.has(part.id))
    .map((part) => ({ part, ori: orientations(part, variant.rotation) }))
    .sort((a, b) => key(b.ori[0]) - key(a.ori[0]) || a.part.id - b.part.id);

  let tooLarge = 0;
  for (const { part, ori } of order) {
    let placed = false;
    // First orientation that fits an empty page; then the first page with room (and with fewer parts than the limit).
    const fitting = ori.filter((o) => o.w <= usableW + 1e-6 && o.h <= usableH + 1e-6);
    if (fitting.length > 0) {
      for (let pi = 0; pi < bins.length && !placed; pi++) {
        if (pages[pi].placements.length >= limit) continue;
        for (const o of fitting) {
          const spot = bins[pi].find(o.w + gap, o.h + gap, variant.rule);
          if (spot) {
            commit(pi, part, o, spot.x, spot.y);
            placed = true;
            break;
          }
        }
      }
      if (!placed) {
        const pi = newPage();
        const o = fitting[0];
        const spot = bins[pi].find(o.w + gap, o.h + gap, variant.rule)!;
        commit(pi, part, o, spot.x, spot.y);
        placed = true;
      }
    }
    if (!placed) {
      tooLarge++;
      const pi = newPage();
      commit(pi, part, ori[0], 0, 0);
    }
  }
  return { pages, tooLarge };
}

/**
 * Packs parts onto pages (a sheet of paper or a cutting mat). Parts the person has placed (`options.pins`) stay where they were put; the others are
 * turned to their smallest bounding box, largest first, and placed with the MaxRects best-short-side-fit rule, on pages that have fewer parts than
 * `options.maxPartsPerPage`. With `options.tight` several orders, turns and fit rules are tried and the layout with the fewest pages is kept. A part that cannot fit
 * an empty page gets a page of its own and a warning. Pages left with no part are dropped. Deterministic.
 */
export function layoutPages(parts: readonly Part[], settings: PageSettings, options: LayoutOptions = {}): PageLayout {
  const warnings: PatternWarning[] = [];
  const base: Variant = { order: 'area', rotation: settings.rotation ?? 'quarter', rule: 'bssf' };
  let best = pack(parts, settings, options, base);
  if (options.tight) {
    const variants: Variant[] = [];
    const rotations: Variant['rotation'][] = [...new Set<Variant['rotation']>([base.rotation, 'free'])];
    for (const rotation of rotations) {
      for (const order of ['area', 'longest', 'height', 'width', 'perimeter'] as const) {
        for (const rule of ['bssf', 'baf', 'bl'] as const) variants.push({ order, rotation, rule });
      }
    }
    // A cheaper layout is one with fewer pages; at the same number of pages the one that leaves the last page emptiest (more room to add).
    const score = (p: Packed) => {
      const nonEmpty = p.pages.filter((pg) => pg.placements.length > 0);
      const last = nonEmpty[nonEmpty.length - 1];
      return nonEmpty.length * 1000 + (last ? last.placements.length : 0);
    };
    for (const v of variants) {
      const packed = pack(parts, settings, options, v);
      if (packed.tooLarge <= best.tooLarge && score(packed) < score(best)) best = packed;
    }
  }
  const pages = best.pages.filter((p) => p.placements.length > 0 || (p.marks?.length ?? 0) > 0).map((p, i) => ({ ...p, index: i, placements: [...p.placements].sort((a, b) => a.partId - b.partId) }));
  if (best.tooLarge > 0) warnings.push({ code: 'part-too-large', count: best.tooLarge, message: `${best.tooLarge} parts do not fit on a page and were put on pages of their own.` });
  return { pages, warnings };
}

export interface LayoutProblem {
  partId: number;
  page: number;
  /** `outside`: part of it is off the page. `overlap`: it lies over another part (named in `other`). */
  kind: 'outside' | 'overlap';
  other?: number;
}

/** What is wrong with a layout: parts that stick out over the edge of the page and parts that lie over each other. Needs the parts for their outlines. */
export function layoutProblems(layout: PageLayout, parts: readonly Part[]): LayoutProblem[] {
  const byId = new Map(parts.map((p) => [p.id, p]));
  const out: LayoutProblem[] = [];
  for (const page of layout.pages) {
    const hulls = page.placements.map((pl) => ({ id: pl.partId, hull: (byId.get(pl.partId)?.hull ?? []).map((q) => transformPoint(pl, q)) }));
    for (const h of hulls) {
      if (h.hull.some((q) => q[0] < -1e-6 || q[1] < -1e-6 || q[0] > page.widthMm + 1e-6 || q[1] > page.heightMm + 1e-6)) out.push({ partId: h.id, page: page.index, kind: 'outside' });
    }
    for (let i = 0; i < hulls.length; i++) {
      for (let j = i + 1; j < hulls.length; j++) {
        if (hulls[i].hull.length >= 3 && hulls[j].hull.length >= 3 && convexOverlap(hulls[i].hull, hulls[j].hull, 0.05)) {
          out.push({ partId: hulls[i].id, page: page.index, kind: 'overlap', other: hulls[j].id }, { partId: hulls[j].id, page: page.index, kind: 'overlap', other: hulls[i].id });
        }
      }
    }
  }
  return out;
}

export function transformPoint(pl: Placement, p: Vec2): Vec2 {
  return [pl.cos * p[0] - pl.sin * p[1] + pl.tx, pl.sin * p[0] + pl.cos * p[1] + pl.ty];
}
