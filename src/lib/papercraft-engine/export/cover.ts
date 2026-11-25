import type { PageLayout, Pattern, Solid, Vec2 } from '../types';
import { boundsOf } from '../geometry/polygon';
import { transformPoint } from '../layout/pack';
import { partRgb } from './colors';
import { textWidthMm, wrapText } from './helvetica';
import { projectModel } from './preview';
import type { PageDrawing, TextRun } from './render';
import { strokeText } from './strokeFont';

/** What the cover page says. The app writes the words (in the reader's language); the engine places them. */
export interface CoverContent {
  title: string;
  subtitle: string;
  /** Label and value rows (assembled size, parts, paper, difficulty, time ...). */
  facts: { label: string; value: string }[];
  legendTitle: string;
  legend: { kind: 'cut' | 'mountain' | 'valley' | 'tab' | 'number'; label: string }[];
  pageMapTitle: string;
  /** Said under the page map when not every page fits, e.g. "+3 more pages". */
  pageMapMore: (hidden: number) => string;
  stepsTitle: string;
  steps: string[];
  footer?: string;
}

const MARGIN = 15;
const GREY: [number, number, number] = [0.38, 0.38, 0.4];

interface Builder {
  d: PageDrawing;
  text: (run: TextRun) => void;
}

function newBuilder(widthMm: number, heightMm: number): Builder {
  const d: PageDrawing = { widthMm, heightMm, cut: [], folds: [], text: [], fills: [], texts: [] };
  return { d, text: (run) => d.texts.push(run) };
}

/** Lays out numbered steps from the bottom up; returns their height and a function that draws them. */
function layoutSteps(content: CoverContent, width: number, size: number) {
  const lead = size * 1.35;
  const indent = size * 1.8;
  const blocks = content.steps.map((s) => wrapText(s, width - indent, size));
  const height = 7 + blocks.reduce((sum, lines) => sum + lines.length * lead + lead * 0.35, 0);
  return { size, lead, indent, blocks, height };
}

/**
 * The cover page: the title, a picture of the finished model, the facts, how to read the lines, a map of what is on each page and
 * the steps to build it. Everything is placed inside the page margins; the page size is a parameter (A4 or Letter).
 */
export function renderCover(
  content: CoverContent,
  solid: Solid,
  pattern: Pattern,
  layout: PageLayout,
  size: { widthMm: number; heightMm: number },
): PageDrawing {
  const W = size.widthMm;
  const H = size.heightMm;
  const b = newBuilder(W, H);
  const inner = W - 2 * MARGIN;
  let y = H - MARGIN;

  // Title.
  let titleSize = 9;
  while (titleSize > 5 && wrapText(content.title, inner, titleSize, true).some((l) => textWidthMm(l, titleSize, true) > inner)) titleSize -= 0.5;
  const titleLines = wrapText(content.title, inner, titleSize, true).slice(0, 2);
  for (const line of titleLines) {
    y -= titleSize * 0.95;
    b.text({ x: MARGIN, y, text: line, sizeMm: titleSize, bold: true });
    y -= titleSize * 0.15;
  }
  y -= 6;
  b.text({ x: MARGIN, y, text: content.subtitle, sizeMm: 4, rgb: GREY });
  y -= 6;

  // Facts (left) and the picture of the model (right).
  const regionTop = y;
  const colW = inner * 0.5;
  const labelW = 33;
  let fy = regionTop;
  for (const fact of content.facts) {
    const lines = wrapText(fact.value, colW - labelW - 2, 3.6, true);
    fy -= 3.6 * 1.05;
    b.text({ x: MARGIN, y: fy, text: fact.label, sizeMm: 3.2, rgb: GREY });
    lines.forEach((line, i) => {
      if (i > 0) fy -= 4.8;
      b.text({ x: MARGIN + labelW, y: fy, text: line, sizeMm: 3.6, bold: true });
    });
    fy -= 3.4;
  }
  const picX = MARGIN + colW + 8;
  const picW = W - MARGIN - picX;
  const picH = Math.max(52, Math.min(72, regionTop - fy));
  const polys = projectModel(solid, pattern);
  if (polys.length > 0) {
    const all = polys.flatMap((p) => p.points);
    const bb = boundsOf(all);
    const scale = Math.min(picW / Math.max(bb.maxX - bb.minX, 1e-6), picH / Math.max(bb.maxY - bb.minY, 1e-6));
    const ox = picX + (picW - (bb.maxX - bb.minX) * scale) / 2 - bb.minX * scale;
    const oy = regionTop - picH + (picH - (bb.maxY - bb.minY) * scale) / 2 - bb.minY * scale;
    for (const poly of polys) {
      b.d.fills.push({
        points: poly.points.map((p): Vec2 => [p[0] * scale + ox, p[1] * scale + oy]),
        rgb: poly.rgb,
        strokeRgb: [0.15, 0.15, 0.17],
        strokeMm: 0.15,
      });
    }
  }
  y = Math.min(fy, regionTop - picH) - 5;

  // Steps go at the bottom; the legend and the page map share what is left.
  let stepSize = 3.6;
  let steps = layoutSteps(content, inner, stepSize);
  while (steps.height > 100 && stepSize > 2.8) {
    stepSize -= 0.2;
    steps = layoutSteps(content, inner, stepSize);
  }
  const footerRoom = content.footer ? 6 : 0;
  const stepsTop = MARGIN + footerRoom + steps.height;
  let sy = stepsTop;
  b.text({ x: MARGIN, y: sy - 4.2, text: content.stepsTitle, sizeMm: 4.2, bold: true });
  sy -= 7 + 1.5;
  content.steps.forEach((_, i) => {
    const lines = steps.blocks[i];
    b.text({ x: MARGIN, y: sy, text: `${i + 1}.`, sizeMm: stepSize, bold: true });
    lines.forEach((line, k) => b.text({ x: MARGIN + steps.indent, y: sy - k * steps.lead, text: line, sizeMm: stepSize }));
    sy -= lines.length * steps.lead + steps.lead * 0.35;
  });
  if (content.footer) b.text({ x: MARGIN, y: MARGIN - 2, text: content.footer, sizeMm: 2.8, rgb: GREY });

  // Legend (left) and page map (right) between the picture and the steps.
  const bandTop = y;
  const bandBottom = stepsTop + 5;
  const legendW = Math.min(78, inner * 0.42);
  let ly = bandTop;
  b.text({ x: MARGIN, y: ly - 4.2, text: content.legendTitle, sizeMm: 4.2, bold: true });
  ly -= 9;
  for (const item of content.legend) {
    const x0 = MARGIN;
    const x1 = MARGIN + 16;
    const mid = ly + 1.1;
    if (item.kind === 'cut') b.d.cut.push({ points: [[x0, mid], [x1, mid]], closed: false });
    else if (item.kind === 'number') b.d.text.push(...strokeText('7', x0 + 8, mid, 3, 0));
    else b.d.folds.push({ a: [x0, mid], b: [x1, mid], kind: item.kind });
    for (const [i, line] of wrapText(item.label, legendW - 20, 3.2).entries()) {
      b.text({ x: MARGIN + 20, y: ly - i * 4.2, text: line, sizeMm: 3.2 });
      if (i > 0) ly -= 4.2;
    }
    ly -= 6.2;
  }

  const mapX = MARGIN + legendW + 8;
  const mapW = W - MARGIN - mapX;
  b.text({ x: mapX, y: bandTop - 4.2, text: content.pageMapTitle, sizeMm: 4.2, bold: true });
  const mapTop = bandTop - 9;
  const avail = Math.max(10, mapTop - bandBottom);
  const pages = layout.pages;
  const aspect = pages.length > 0 ? pages[0].heightMm / pages[0].widthMm : Math.SQRT2;
  const gap = 3;
  // As few columns as the pages need (at most 4 to start with), as big as the room allows; more, smaller columns when they do not fit.
  let cols = Math.max(1, Math.min(pages.length, 4));
  let thumbW = 0;
  let rows = 1;
  for (const c of [cols, cols + 1, cols + 2, cols + 4].filter((v, i, a) => a.indexOf(v) === i && v <= 8)) {
    cols = c;
    thumbW = Math.min((mapW - gap * (c - 1)) / c, Math.max(8, (avail - 4) / aspect));
    rows = Math.max(1, Math.floor((avail + gap) / (thumbW * aspect + 4 + gap)));
    if (rows * c >= pages.length) break;
  }
  const thumbH = thumbW * aspect;
  const capacity = rows * cols;
  const shown = Math.min(pages.length, capacity);
  const byId = new Map(pattern.parts.map((p) => [p.id, p]));
  for (let i = 0; i < shown; i++) {
    const page = pages[i];
    const cx = mapX + (i % cols) * (thumbW + gap);
    const cy = mapTop - Math.floor(i / cols) * (thumbH + 4 + gap) - thumbH;
    const s = thumbW / page.widthMm;
    b.d.fills.push({ points: [[cx, cy], [cx + thumbW, cy], [cx + thumbW, cy + thumbH], [cx, cy + thumbH]], rgb: [1, 1, 1], strokeRgb: GREY, strokeMm: 0.2 });
    for (const pl of page.placements) {
      const part = byId.get(pl.partId);
      if (!part) continue;
      const hull = part.hull.map((p): Vec2 => {
        const q = transformPoint(pl, p);
        return [cx + q[0] * s, cy + q[1] * s];
      });
      b.d.fills.push({ points: hull, rgb: partRgb(part.id, 80), strokeRgb: [0.3, 0.3, 0.32], strokeMm: 0.1 });
      const centre = hull.reduce<Vec2>((acc, p) => [acc[0] + p[0] / hull.length, acc[1] + p[1] / hull.length], [0, 0]);
      b.d.text.push(...strokeText(String(part.id), centre[0], centre[1], Math.min(3, Math.max(1.6, thumbW * 0.12)), 0));
    }
    b.text({ x: cx + thumbW / 2, y: cy - 3, text: String(i + 1), sizeMm: 2.6, align: 'middle', rgb: GREY });
  }
  if (pages.length > shown) {
    b.text({ x: mapX, y: mapTop - rows * (thumbH + 4 + gap) - 1, text: content.pageMapMore(pages.length - shown), sizeMm: 3, rgb: GREY });
  }
  return b.d;
}
