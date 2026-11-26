import { partBox, transformPoint, type PageLayout, type PagePin, type Part } from '@/src/lib/papercraft-engine';

/** Helpers for placing parts by hand on the pages: where each part is, where it snaps, where it fits. All in millimetres, y up, on a page. */

export interface PartBox {
  partId: number;
  page: number;
  rotation: number;
  /** The lower left corner and size of the box round the part (outline and tabs) on the page. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SheetSize {
  widthMm: number;
  heightMm: number;
  marginMm: number;
  gapMm: number;
}

/** Where every part is: the box round it on its page. */
export function boxesOf(layout: PageLayout, parts: readonly Part[]): PartBox[] {
  const byId = new Map(parts.map((p) => [p.id, p]));
  const out: PartBox[] = [];
  for (const page of layout.pages) {
    for (const pl of page.placements) {
      const part = byId.get(pl.partId);
      if (!part) continue;
      const pts = part.hull.map((q) => transformPoint(pl, q));
      const xs = pts.map((q) => q[0]);
      const ys = pts.map((q) => q[1]);
      out.push({ partId: pl.partId, page: page.index, rotation: pl.rotation, x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) });
    }
  }
  return out;
}

/** Every part as a pin where it is now: this keeps the layout as it is when the person moves one part. */
export function pinsOf(boxes: readonly PartBox[]): Record<number, PagePin> {
  const pins: Record<number, PagePin> = {};
  for (const b of boxes) pins[b.partId] = { page: b.page, rotation: b.rotation, x: b.x, y: b.y, w: b.w, h: b.h };
  return pins;
}

/** The box moved so it is inside the page (the page edge, not the margin: the person may want the margin). */
export function clampBox(b: Pick<PartBox, 'x' | 'y' | 'w' | 'h'>, sheet: SheetSize): { x: number; y: number } {
  return {
    x: Math.min(Math.max(b.x, 0), Math.max(0, sheet.widthMm - b.w)),
    y: Math.min(Math.max(b.y, 0), Math.max(0, sheet.heightMm - b.h)),
  };
}

const SNAP_MM = 2.5;

/** The box pulled to the margin of the page and to the sides of the other boxes (with the gap between), when it is within a couple of millimetres. */
export function snapBox(b: Pick<PartBox, 'x' | 'y' | 'w' | 'h'>, sheet: SheetSize, others: readonly Pick<PartBox, 'x' | 'y' | 'w' | 'h'>[]): { x: number; y: number } {
  const gap = sheet.gapMm;
  const xs: number[] = [sheet.marginMm, sheet.widthMm - sheet.marginMm - b.w];
  const ys: number[] = [sheet.marginMm, sheet.heightMm - sheet.marginMm - b.h];
  for (const o of others) {
    xs.push(o.x + o.w + gap, o.x - b.w - gap, o.x);
    ys.push(o.y + o.h + gap, o.y - b.h - gap, o.y);
  }
  const pull = (value: number, targets: number[]) => {
    let best = value;
    let bestD = SNAP_MM;
    for (const t of targets) {
      const d = Math.abs(t - value);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  };
  return { x: pull(b.x, xs), y: pull(b.y, ys) };
}

/** The box of a part turned by quarter turns about its middle, kept on the page. */
export function turnedBox(part: Part, box: PartBox, quarterTurns: number, sheet: SheetSize): PartBox {
  const rotation = box.rotation + (quarterTurns * Math.PI) / 2;
  const turned = partBox(part, rotation);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const moved = clampBox({ x: cx - turned.w / 2, y: cy - turned.h / 2, w: turned.w, h: turned.h }, sheet);
  return { ...box, rotation, w: turned.w, h: turned.h, ...moved };
}

const overlaps = (a: Pick<PartBox, 'x' | 'y' | 'w' | 'h'>, b: Pick<PartBox, 'x' | 'y' | 'w' | 'h'>, gap: number) =>
  a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

/** The first place on a page, looking from the top left, where a box of this size fits among the boxes there; null when there is none. */
export function freeSpot(w: number, h: number, sheet: SheetSize, others: readonly Pick<PartBox, 'x' | 'y' | 'w' | 'h'>[]): { x: number; y: number } | null {
  const step = 5;
  const maxX = sheet.widthMm - sheet.marginMm - w;
  const maxY = sheet.heightMm - sheet.marginMm - h;
  if (maxX < sheet.marginMm - 1e-6 || maxY < sheet.marginMm - 1e-6) return null;
  for (let y = maxY; y >= sheet.marginMm - 1e-6; y -= step) {
    for (let x = sheet.marginMm; x <= maxX + 1e-6; x += step) {
      const candidate = { x, y, w, h };
      if (!others.some((o) => overlaps(candidate, o, sheet.gapMm))) return { x, y };
    }
  }
  return null;
}

/** How full the page is, in percent: the area of the boxes round the parts against the area inside the margins. */
export function fullness(boxes: readonly Pick<PartBox, 'w' | 'h'>[], sheet: SheetSize): number {
  const usable = Math.max(1, (sheet.widthMm - 2 * sheet.marginMm) * (sheet.heightMm - 2 * sheet.marginMm));
  return Math.min(100, Math.round((boxes.reduce((s, b) => s + b.w * b.h, 0) / usable) * 100));
}
