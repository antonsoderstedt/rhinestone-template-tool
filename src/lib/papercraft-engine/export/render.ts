import type { FoldKind, Page, Part, Vec2 } from '../types';
import { transformPoint } from '../layout/pack';
import { strokeText } from './strokeFont';

export interface PageDrawing {
  widthMm: number;
  heightMm: number;
  /** Cut outlines. */
  cut: { points: Vec2[]; closed: boolean }[];
  folds: { a: Vec2; b: Vec2; kind: FoldKind }[];
  /** Numbers as line strokes. */
  text: Vec2[][];
}

export interface RenderOptions {
  /** "1/3" at the foot of the page (print only; leave off for the cutting machine). */
  pageNumbers?: boolean;
}

/** Everything that is drawn on one page, in page coordinates (millimetres, y up). */
export function renderPage(page: Page, parts: readonly Part[], pageCount: number, options: RenderOptions = {}): PageDrawing {
  const byId = new Map(parts.map((p) => [p.id, p]));
  const drawing: PageDrawing = { widthMm: page.widthMm, heightMm: page.heightMm, cut: [], folds: [], text: [] };
  for (const pl of page.placements) {
    const part = byId.get(pl.partId);
    if (!part) continue;
    for (const c of part.cutPaths) drawing.cut.push({ closed: c.closed, points: c.points.map((p) => transformPoint(pl, p)) });
    for (const f of part.foldLines) drawing.folds.push({ a: transformPoint(pl, f.a), b: transformPoint(pl, f.b), kind: f.kind });
    for (const l of part.labels) {
      const c = transformPoint(pl, [l.x, l.y]);
      // Keep the text readable on the page whatever way the part was turned.
      let angle = l.angle + pl.rotation;
      if (Math.cos(angle) < -1e-9) angle += Math.PI;
      drawing.text.push(...strokeText(l.text, c[0], c[1], l.height, angle));
    }
  }
  if (options.pageNumbers) {
    drawing.text.push(...strokeText(`${page.index + 1}/${pageCount}`, page.widthMm / 2, 4, 3, 0));
  }
  return drawing;
}

export function renderPages(pages: readonly Page[], parts: readonly Part[], options: RenderOptions = {}): PageDrawing[] {
  return pages.map((p) => renderPage(p, parts, pages.length, options));
}
