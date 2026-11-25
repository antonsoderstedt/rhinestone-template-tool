import type { Vec2 } from '../types';
import type { PageDrawing } from './render';

export type SvgPurpose = 'print' | 'cricut';

const num = (n: number): string => {
  const s = (Math.round(n * 1000) / 1000).toFixed(3).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
};

function pathOf(points: readonly Vec2[], closed: boolean, height: number): string {
  // SVG's y axis points down; the drawing's points up.
  const pts = points.map(([x, y]) => `${num(x)} ${num(height - y)}`);
  return `M${pts.join(' L')}${closed ? ' Z' : ''}`;
}

/**
 * One page as an SVG in millimetres. `cricut`: solid lines in three colours (cut black, score red, draw blue) so
 * Design Space puts them in three layers to assign Cut, Score and Draw. `print`: black cut lines and dashed folds
 * (mountain dash-dot, valley dashed). Plain paths and groups only: no nested svg, no `use`, no opacity, no raster.
 */
export function exportPageSvg(drawing: PageDrawing, purpose: SvgPurpose): string {
  const { widthMm: w, heightMm: h } = drawing;
  const lines: string[] = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${num(w)}mm" height="${num(h)}mm" viewBox="0 0 ${num(w)} ${num(h)}">`);

  const cutStroke = '#000000';
  const group = (id: string, stroke: string, width: number, extra = '') =>
    `<g id="${id}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${extra}>`;

  lines.push(group('cut', cutStroke, purpose === 'cricut' ? 0.1 : 0.25));
  for (const c of drawing.cut) lines.push(`<path d="${pathOf(c.points, c.closed, h)}"/>`);
  lines.push('</g>');

  if (purpose === 'cricut') {
    lines.push(group('score', '#ff0000', 0.1));
    for (const f of drawing.folds) if (f.kind !== 'flat') lines.push(`<path d="${pathOf([f.a, f.b], false, h)}"/>`);
    lines.push('</g>');
    lines.push(group('numbers', '#0000ff', 0.1));
  } else {
    const kinds: { kind: string; dash: string; stroke: string; width: number }[] = [
      { kind: 'mountain', dash: '3 1 0.6 1', stroke: '#000000', width: 0.2 },
      { kind: 'valley', dash: '1.6 1.2', stroke: '#000000', width: 0.2 },
      { kind: 'tab', dash: '1.6 1.2', stroke: '#000000', width: 0.2 },
      { kind: 'flat', dash: '', stroke: '#888888', width: 0.1 },
    ];
    for (const k of kinds) {
      lines.push(group(`fold-${k.kind}`, k.stroke, k.width, k.dash ? ` stroke-dasharray="${k.dash}"` : ''));
      for (const f of drawing.folds) if (f.kind === k.kind) lines.push(`<path d="${pathOf([f.a, f.b], false, h)}"/>`);
      lines.push('</g>');
    }
    lines.push(group('numbers', '#000000', 0.2));
  }
  for (const t of drawing.text) lines.push(`<path d="${pathOf(t, false, h)}"/>`);
  lines.push('</g>');
  lines.push('</svg>');
  return lines.join('\n');
}
