import type { Vec2 } from '../types';
import type { PageDrawing } from '../export/render';
import type { PdfPage, PdfStroke } from './read';

/**
 * From the lines of a finished PDF pattern to a cutting file. The lines of a page are grouped by how they are drawn (colour, and solid or dashed):
 * each group is a style that the person gives a role (cut, score, or leave out). The roles make a `PageDrawing`, the same thing the studio
 * draws its own patterns as, so the Cricut SVG and the Silhouette DXF come from the same code.
 */

export type LineRole = 'cut' | 'score' | 'ignore';

export interface LineStyle {
  /** The colour as `#rrggbb` and `solid` or `dash`, together: `#ff0000/dash`. */
  id: string;
  hex: string;
  dashed: boolean;
  /** Number of lines and their total length in millimetres at 100 %. */
  count: number;
  lengthMm: number;
}

const MM_PER_PT = 25.4 / 72;

const hexOf = (rgb: readonly [number, number, number]): string =>
  '#' + rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');

export const styleIdOf = (s: PdfStroke): string => `${hexOf(s.rgb)}/${s.dash.length > 0 ? 'dash' : 'solid'}`;

const lengthOf = (s: PdfStroke): number => {
  let sum = 0;
  for (let i = 1; i < s.points.length; i++) sum += Math.hypot(s.points[i][0] - s.points[i - 1][0], s.points[i][1] - s.points[i - 1][1]);
  if (s.closed && s.points.length > 2) sum += Math.hypot(s.points[0][0] - s.points[s.points.length - 1][0], s.points[0][1] - s.points[s.points.length - 1][1]);
  return sum;
};

/** A line that runs round the edge of the page (a frame): not part of the pattern. */
function isFrame(s: PdfStroke, page: PdfPage): boolean {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of s.points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return maxX - minX >= 0.96 * page.widthPt && maxY - minY >= 0.96 * page.heightPt;
}

/** The ways lines are drawn on a page, the longest first. */
export function lineStyles(page: PdfPage): LineStyle[] {
  const by = new Map<string, LineStyle>();
  for (const s of page.strokes) {
    if (isFrame(s, page)) continue;
    const id = styleIdOf(s);
    const style = by.get(id) ?? { id, hex: hexOf(s.rgb), dashed: s.dash.length > 0, count: 0, lengthMm: 0 };
    style.count++;
    style.lengthMm += lengthOf(s) * MM_PER_PT;
    by.set(id, style);
  }
  return [...by.values()].sort((a, b) => b.lengthMm - a.lengthMm || a.id.localeCompare(b.id));
}

/** A first guess: dashed lines are folds (score), solid lines are cuts, and white or nearly white lines (a background, a hidden line) are left out. */
export function defaultRoles(styles: readonly LineStyle[]): Record<string, LineRole> {
  const roles: Record<string, LineRole> = {};
  for (const s of styles) {
    const channels = [1, 3, 5].map((i) => parseInt(s.hex.slice(i, i + 2), 16) / 255);
    const nearlyWhite = Math.min(...channels) > 0.93;
    roles[s.id] = nearlyWhite ? 'ignore' : s.dashed ? 'score' : 'cut';
  }
  return roles;
}

export interface PatternOptions {
  /** Scale in percent: the size the pattern is drawn at. */
  scalePct: number;
  /** Make the sheet only as big as the pattern (plus the margin), not as big as the page of the PDF. */
  crop: boolean;
  marginMm: number;
  /** Lines shorter than this are left out (specks and dots). */
  minLengthMm: number;
}

export const DEFAULT_PATTERN_OPTIONS: PatternOptions = { scalePct: 100, crop: false, marginMm: 5, minLengthMm: 0.5 };

/** The cutting drawing of a page: cut lines as outlines, score lines as lines, in millimetres with y up. Lines whose style has no role are left out. */
export function patternDrawing(page: PdfPage, roles: Readonly<Record<string, LineRole>>, options: Partial<PatternOptions> = {}): PageDrawing {
  const o = { ...DEFAULT_PATTERN_OPTIONS, ...options };
  const k = MM_PER_PT * (Math.max(1, o.scalePct) / 100);
  const cut: PageDrawing['cut'] = [];
  const folds: PageDrawing['folds'] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const note = (p: Vec2) => {
    minX = Math.min(minX, p[0]);
    minY = Math.min(minY, p[1]);
    maxX = Math.max(maxX, p[0]);
    maxY = Math.max(maxY, p[1]);
  };
  for (const s of page.strokes) {
    if (isFrame(s, page)) continue;
    const role = roles[styleIdOf(s)] ?? 'ignore';
    if (role === 'ignore' || lengthOf(s) * k < o.minLengthMm) continue;
    let pts = s.points.map((p): Vec2 => [p[0] * k, p[1] * k]);
    let closed = s.closed;
    // A line that comes back to where it began is closed.
    if (!closed && pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.01) {
      closed = true;
      pts = pts.slice(0, -1);
    }
    pts.forEach(note);
    if (role === 'cut') cut.push({ points: pts, closed });
    else {
      for (let i = 1; i < pts.length; i++) folds.push({ a: pts[i - 1], b: pts[i], kind: 'valley' });
      if (closed && pts.length > 2) folds.push({ a: pts[pts.length - 1], b: pts[0], kind: 'valley' });
    }
  }
  let width = page.widthPt * k;
  let height = page.heightPt * k;
  if (o.crop && Number.isFinite(minX)) {
    const dx = o.marginMm - minX;
    const dy = o.marginMm - minY;
    const move = (p: Vec2): Vec2 => [p[0] + dx, p[1] + dy];
    for (const c of cut) c.points = c.points.map(move);
    for (const f of folds) {
      f.a = move(f.a);
      f.b = move(f.b);
    }
    width = maxX - minX + 2 * o.marginMm;
    height = maxY - minY + 2 * o.marginMm;
  }
  return { widthMm: width, heightMm: height, cut, folds, text: [], fills: [], texts: [] };
}
