import type { Page, PageLayout, PageSettings, Part, PatternWarning, Placement, Vec2 } from '../types';
import { boundsOf, candidateBoxes, rotatePoint } from '../geometry/polygon';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** MaxRects bin with the "best short side fit" rule. */
class Bin {
  free: Rect[];
  constructor(w: number, h: number) {
    this.free = [{ x: 0, y: 0, w, h }];
  }
  find(w: number, h: number): { x: number; y: number } | null {
    let best: { x: number; y: number; s1: number; s2: number } | null = null;
    for (const r of this.free) {
      if (r.w + 1e-9 < w || r.h + 1e-9 < h) continue;
      const s1 = Math.min(r.w - w, r.h - h);
      const s2 = Math.max(r.w - w, r.h - h);
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

function orientations(part: Part): Orientation[] {
  const out: Orientation[] = [];
  const seen = new Set<string>();
  for (const box of candidateBoxes(part.hull)) {
    for (const extra of [0, Math.PI / 2]) {
      const angle = box.angle + extra;
      const b = boundsOf(part.hull.map((p) => rotatePoint(p, angle)));
      const key = `${(b.maxX - b.minX).toFixed(3)}x${(b.maxY - b.minY).toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ angle, w: b.maxX - b.minX, h: b.maxY - b.minY, minX: b.minX, minY: b.minY });
    }
  }
  return out;
}

/**
 * Packs parts onto pages (a sheet of paper or a cutting mat). Parts are turned to their smallest bounding box,
 * largest first, and placed with the MaxRects best-short-side-fit rule. A part that cannot fit an empty page gets
 * a page of its own and a warning. Deterministic.
 */
export function layoutPages(parts: readonly Part[], settings: PageSettings): PageLayout {
  const warnings: PatternWarning[] = [];
  const usableW = settings.pageWidthMm - 2 * settings.marginMm;
  const usableH = settings.pageHeightMm - 2 * settings.marginMm;
  const gap = settings.gapMm;
  const pages: Page[] = [];
  const bins: Bin[] = [];

  const newPage = (): number => {
    pages.push({ index: pages.length, widthMm: settings.pageWidthMm, heightMm: settings.pageHeightMm, placements: [] });
    bins.push(new Bin(usableW + gap, usableH + gap));
    return pages.length - 1;
  };

  const order = parts
    .map((part) => ({ part, ori: orientations(part) }))
    .sort((a, b) => b.ori[0].w * b.ori[0].h - a.ori[0].w * a.ori[0].h || a.part.id - b.part.id);

  let tooLarge = 0;
  for (const { part, ori } of order) {
    let placed = false;
    // First orientation that fits an empty page; then the first page with room.
    const fitting = ori.filter((o) => o.w <= usableW + 1e-6 && o.h <= usableH + 1e-6);
    if (fitting.length > 0) {
      for (let pi = 0; pi < bins.length && !placed; pi++) {
        for (const o of fitting) {
          const spot = bins[pi].find(o.w + gap, o.h + gap);
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
        const spot = bins[pi].find(o.w + gap, o.h + gap)!;
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
  if (tooLarge > 0) warnings.push({ code: 'part-too-large', count: tooLarge, message: `${tooLarge} parts do not fit on a page and were put on pages of their own.` });

  function commit(pi: number, part: Part, o: Orientation, x: number, y: number) {
    bins[pi].place(x, y, o.w + gap, o.h + gap);
    const px = settings.marginMm + x;
    const py = settings.marginMm + y;
    const cos = Math.cos(o.angle);
    const sin = Math.sin(o.angle);
    pages[pi].placements.push({ partId: part.id, rotation: o.angle, x: px, y: py, cos, sin, tx: px - o.minX, ty: py - o.minY });
  }

  for (const page of pages) page.placements.sort((a, b) => a.partId - b.partId);
  return { pages, warnings };
}

export function transformPoint(pl: Placement, p: Vec2): Vec2 {
  return [pl.cos * p[0] - pl.sin * p[1] + pl.tx, pl.sin * p[0] + pl.cos * p[1] + pl.ty];
}
