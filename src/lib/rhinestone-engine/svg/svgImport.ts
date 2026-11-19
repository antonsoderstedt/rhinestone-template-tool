/**
 * SVG artwork importer.
 *
 * Reads an SVG the way a viewer would, as far as artwork for stones needs: nested groups and their transforms, `<use>` of
 * local shapes, CSS classes from `<style>`, inline `style`, `fill-rule`, arcs, rounded rectangles, hidden elements and the
 * file's own size. Everything is turned into polylines in the file's user units; the colour, stroke and fill rule of each
 * shape are kept so later steps can build colour layers.
 *
 * Pure and deterministic. The SVG is parsed with a small tolerant tokenizer; it is never rendered, never put in the DOM and
 * nothing it references outside the file (links, data URLs, scripts, entities) is followed: such files are refused.
 */

import type { Polyline, PolylinePoint } from '../path/polyline';
import { roundMm } from '../geometry/rounding';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ImportedShape {
  /** Document order, 0-based; later shapes are painted over earlier ones. */
  order: number;
  element: string;
  /** In the file's user units, transforms applied. */
  polylines: Polyline[];
  /** Normalised `#rrggbb`, or null when not filled. */
  fill: string | null;
  fillOpacity: number;
  stroke: string | null;
  /** In user units, after transforms. */
  strokeWidth: number;
  strokeOpacity: number;
  /** Product of the opacity of the shape and all its ancestors. */
  opacity: number;
  fillRule: 'nonzero' | 'evenodd';
}

export interface SvgImportResult {
  shapes: ImportedShape[];
  viewBox: { x: number; y: number; width: number; height: number } | null;
  /** Size the file declares (width/height with units, else the viewBox at 96 dpi), in mm. Null when it declares neither. */
  naturalSizeMm: { widthMm: number; heightMm: number } | null;
  /** Millimetres per user unit when the natural size is known. */
  userUnitMm: number | null;
  /** Things in the file that were left out, in plain language. */
  warnings: string[];
}

export interface SvgImportOptions {
  /** Segments per Bezier curve. Default 24. */
  curveSegments?: number;
  /** Segments for a circle or ellipse. Default 64. */
  circleSegments?: number;
}

// ─── Limits ───────────────────────────────────────────────────────────────────

const MAX_NODES = 200_000;
const MAX_USE_INSTANCES = 5_000;
const MAX_USE_DEPTH = 8;

// ─── Safety ───────────────────────────────────────────────────────────────────

/** Returns the reasons the file must be refused; an empty list means it can be read. */
export function findUnsafeSvgContent(svg: string): string[] {
  const issues: string[] = [];
  const test = (re: RegExp, label: string) => {
    if (re.test(svg)) issues.push(label);
  };
  test(/<script/i, '<script>');
  test(/<foreignObject/i, '<foreignObject>');
  test(/<image\b/i, 'an embedded image (<image>)');
  test(/<!ENTITY/i, 'entity declarations');
  test(/\bon[a-z]+\s*=\s*["']/i, 'event handlers (onload=, onclick=, …)');
  test(/javascript:/i, 'javascript: links');
  test(/data:/i, 'data: URLs');
  test(/@import/i, '@import');
  for (const match of svg.matchAll(/\b(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const target = (match[1] ?? match[2] ?? '').trim();
    if (!target.startsWith('#')) issues.push(`a link to something outside the file (${target.slice(0, 40)})`);
  }
  for (const match of svg.matchAll(/url\(\s*(["']?)([^)"']*)\1\s*\)/gi)) {
    const target = (match[2] ?? '').trim();
    if (!target.startsWith('#')) issues.push(`a reference to something outside the file (url(${target.slice(0, 40)}))`);
  }
  return [...new Set(issues)];
}

// ─── Tolerant XML tree ────────────────────────────────────────────────────────

interface SvgNode {
  tag: string;
  attrs: Record<string, string>;
  children: SvgNode[];
  /** Text content (only kept for <style>). */
  text: string;
}

function parseAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s=/"'<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const name = m[1]!.toLowerCase().replace(/^[a-z0-9]+:(?=href$)/, ''); // xlink:href -> href
    attrs[name] = decodeEntities(m[2] ?? m[3] ?? '');
  }
  return attrs;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseSvgTree(svg: string): { root: SvgNode | null; nodeCount: number } {
  const stack: SvgNode[] = [];
  let root: SvgNode | null = null;
  let count = 0;
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<(\/?)([^\s/>!?]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|([^<]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    if (m[1] !== undefined) {
      const top = stack[stack.length - 1];
      if (top) top.text += m[1];
    } else if (m[3] !== undefined) {
      const tag = m[3].toLowerCase().replace(/^[^:]+:/, '');
      if (m[2] === '/') {
        // Close the nearest open element with this name (tolerates sloppy nesting).
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i]!.tag === tag) {
            stack.length = i;
            break;
          }
        }
      } else {
        if (++count > MAX_NODES) throw new Error('This SVG has too many elements to read.');
        const node: SvgNode = { tag, attrs: parseAttrs(m[4] ?? ''), children: [], text: '' };
        const parent = stack[stack.length - 1];
        if (parent) parent.children.push(node);
        else if (!root) root = node;
        if (m[5] !== '/') stack.push(node);
      }
    } else if (m[6] !== undefined) {
      const top = stack[stack.length - 1];
      if (top) top.text += decodeEntities(m[6]);
    }
  }
  return { root, nodeCount: count };
}

// ─── Colour ───────────────────────────────────────────────────────────────────

const NAMED_COLOURS: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', orange: '#ffa500',
  purple: '#800080', pink: '#ffc0cb', gray: '#808080', grey: '#808080', silver: '#c0c0c0', maroon: '#800000', navy: '#000080',
  teal: '#008080', lime: '#00ff00', aqua: '#00ffff', cyan: '#00ffff', fuchsia: '#ff00ff', magenta: '#ff00ff', gold: '#ffd700',
  brown: '#a52a2a', beige: '#f5f5dc', ivory: '#fffff0', coral: '#ff7f50', crimson: '#dc143c', violet: '#ee82ee', indigo: '#4b0082',
};

/** `#rrggbb`, null for none/transparent, or `undefined` when the value is not a colour this importer understands. */
function parseColour(value: string): string | null | undefined {
  const v = value.trim().toLowerCase();
  if (v === 'none' || v === 'transparent') return null;
  if (v === 'currentcolor') return '#000000';
  if (NAMED_COLOURS[v]) return NAMED_COLOURS[v]!;
  let m = /^#([0-9a-f]{3})$/.exec(v);
  if (m) return `#${m[1]![0]}${m[1]![0]}${m[1]![1]}${m[1]![1]}${m[1]![2]}${m[1]![2]}`;
  m = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(v);
  if (m) return `#${m[1]}`;
  m = /^rgba?\(\s*([\d.]+)(%?)\s*[, ]\s*([\d.]+)(%?)\s*[, ]\s*([\d.]+)(%?)/.exec(v);
  if (m) {
    const channel = (n: string, pct: string) => Math.max(0, Math.min(255, Math.round(pct ? (parseFloat(n) / 100) * 255 : parseFloat(n))));
    return '#' + [channel(m[1]!, m[2]!), channel(m[3]!, m[4]!), channel(m[5]!, m[6]!)].map((c) => c.toString(16).padStart(2, '0')).join('');
  }
  return undefined;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

interface StyleRule {
  selector: { tag?: string; classes: string[]; id?: string };
  specificity: number;
  order: number;
  declarations: Record<string, string>;
}

function parseDeclarations(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of block.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).replace(/!important/i, '').trim();
  }
  return out;
}

function parseStyleSheet(css: string, warnings: Set<string>, startOrder: number): StyleRule[] {
  const rules: StyleRule[] = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  let order = startOrder;
  while ((m = re.exec(clean)) !== null) {
    const declarations = parseDeclarations(m[2]!);
    for (const raw of m[1]!.split(',')) {
      const sel = raw.trim();
      if (!sel || sel.startsWith('@')) continue;
      const parsed = /^(\*|[a-z][a-z0-9-]*)?((?:\.[\w-]+)*)(#[\w-]+)?$/i.exec(sel);
      if (!parsed || (sel.includes(' ') || sel.includes('>') || sel.includes(':') || sel.includes('['))) {
        warnings.add(`A style rule (${sel.slice(0, 30)}) uses a selector that is not supported and was ignored.`);
        continue;
      }
      const tag = parsed[1] && parsed[1] !== '*' ? parsed[1].toLowerCase() : undefined;
      const classes = parsed[2] ? parsed[2].split('.').filter(Boolean) : [];
      const id = parsed[3]?.slice(1);
      rules.push({
        selector: { tag, classes, id },
        specificity: (id ? 100 : 0) + classes.length * 10 + (tag ? 1 : 0),
        order: order++,
        declarations,
      });
    }
  }
  return rules;
}

function ruleMatches(rule: StyleRule, node: SvgNode): boolean {
  const { tag, classes, id } = rule.selector;
  if (tag && tag !== node.tag) return false;
  if (id && node.attrs.id !== id) return false;
  if (classes.length > 0) {
    const have = new Set((node.attrs.class ?? '').split(/\s+/).filter(Boolean));
    if (!classes.every((c) => have.has(c))) return false;
  }
  return true;
}

interface Style {
  fill: string | null;
  fillOpacity: number;
  stroke: string | null;
  strokeWidth: number;
  strokeOpacity: number;
  fillRule: 'nonzero' | 'evenodd';
  visibility: boolean;
  /** Product of opacity down the tree. */
  opacity: number;
}

const ROOT_STYLE: Style = {
  fill: '#000000',
  fillOpacity: 1,
  stroke: null,
  strokeWidth: 1,
  strokeOpacity: 1,
  fillRule: 'nonzero',
  visibility: true,
  opacity: 1,
};

const num = (value: string | undefined, fallback: number): number => {
  if (value === undefined) return fallback;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

const opacityValue = (value: string | undefined, fallback: number): number => {
  if (value === undefined) return fallback;
  const v = value.trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, v.endsWith('%') ? n / 100 : n));
};

const STYLE_PROPERTIES = ['fill', 'stroke', 'stroke-width', 'fill-rule', 'opacity', 'fill-opacity', 'stroke-opacity', 'display', 'visibility'];

function declaredProperties(node: SvgNode, rules: readonly StyleRule[]): Record<string, string> {
  const out: Record<string, string> = {};
  // Presentation attributes are the weakest, then stylesheet rules by specificity and order, then the style attribute.
  for (const p of STYLE_PROPERTIES) if (node.attrs[p] !== undefined) out[p] = node.attrs[p]!;
  const matching = rules.filter((r) => ruleMatches(r, node)).sort((a, b) => a.specificity - b.specificity || a.order - b.order);
  for (const rule of matching) Object.assign(out, rule.declarations);
  if (node.attrs.style) Object.assign(out, parseDeclarations(node.attrs.style));
  return out;
}

function computeStyle(parent: Style, declared: Record<string, string>, warnings: Set<string>): { style: Style; display: boolean } {
  const style: Style = { ...parent };
  if (declared.fill !== undefined) {
    const colour = declared.fill.startsWith('url(') ? '#808080' : parseColour(declared.fill);
    if (declared.fill.startsWith('url(')) warnings.add('Gradient or pattern fills are treated as one flat colour.');
    if (colour !== undefined) style.fill = colour;
  }
  if (declared.stroke !== undefined) {
    const colour = declared.stroke.startsWith('url(') ? '#808080' : parseColour(declared.stroke);
    if (colour !== undefined) style.stroke = colour;
  }
  style.strokeWidth = num(declared['stroke-width'], parent.strokeWidth);
  if (declared['fill-rule']) style.fillRule = declared['fill-rule'].trim() === 'evenodd' ? 'evenodd' : 'nonzero';
  style.fillOpacity = opacityValue(declared['fill-opacity'], parent.fillOpacity);
  style.strokeOpacity = opacityValue(declared['stroke-opacity'], parent.strokeOpacity);
  if (declared.visibility) style.visibility = declared.visibility.trim() !== 'hidden' && declared.visibility.trim() !== 'collapse';
  style.opacity = parent.opacity * opacityValue(declared.opacity, 1);
  return { style, display: declared.display?.trim() !== 'none' };
}

// ─── Matrices ─────────────────────────────────────────────────────────────────

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const multiply = (a: Matrix, b: Matrix): Matrix => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];

const apply = (m: Matrix, p: PolylinePoint): PolylinePoint => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });

/** Parses an SVG `transform` list. An unknown function is skipped with a warning, never a crash. */
function parseTransform(value: string | undefined, warnings: Set<string>): Matrix {
  if (!value) return IDENTITY;
  let result: Matrix = IDENTITY;
  const re = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    const args = (m[2]!.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
    let next: Matrix | null = null;
    switch (m[1]) {
      case 'translate': next = [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0]; break;
      case 'scale': next = [args[0] ?? 1, 0, 0, args[1] ?? args[0] ?? 1, 0, 0]; break;
      case 'rotate': {
        const a = ((args[0] ?? 0) * Math.PI) / 180;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const rotation: Matrix = [cos, sin, -sin, cos, 0, 0];
        if (args.length >= 3) {
          const cx = args[1]!;
          const cy = args[2]!;
          next = multiply(multiply([1, 0, 0, 1, cx, cy], rotation), [1, 0, 0, 1, -cx, -cy]);
        } else next = rotation;
        break;
      }
      case 'skewX': next = [1, 0, Math.tan(((args[0] ?? 0) * Math.PI) / 180), 1, 0, 0]; break;
      case 'skewY': next = [1, Math.tan(((args[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0]; break;
      case 'matrix': if (args.length >= 6) next = [args[0]!, args[1]!, args[2]!, args[3]!, args[4]!, args[5]!]; break;
    }
    if (next) result = multiply(result, next);
    else warnings.add(`A transform (${m[1]}) could not be read and was ignored.`);
  }
  return result;
}

// ─── Geometry ─────────────────────────────────────────────────────────────────

const round4 = (v: number) => roundMm(v, 4);

function flattenCubic(p0: PolylinePoint, p1: PolylinePoint, p2: PolylinePoint, p3: PolylinePoint, seg: number): PolylinePoint[] {
  return Array.from({ length: seg }, (_, i) => {
    const t = (i + 1) / seg;
    const mt = 1 - t;
    return {
      x: round4(mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x),
      y: round4(mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y),
    };
  });
}

function flattenQuadratic(p0: PolylinePoint, p1: PolylinePoint, p2: PolylinePoint, seg: number): PolylinePoint[] {
  return Array.from({ length: seg }, (_, i) => {
    const t = (i + 1) / seg;
    const mt = 1 - t;
    return {
      x: round4(mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x),
      y: round4(mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y),
    };
  });
}

/** SVG elliptical arc (spec F.6) from `from` to `to`, as points after `from`. */
function flattenArc(
  from: PolylinePoint,
  to: PolylinePoint,
  rxIn: number,
  ryIn: number,
  rotationDeg: number,
  largeArc: boolean,
  sweep: boolean,
  segmentsPerQuarter: number,
): PolylinePoint[] {
  if (from.x === to.x && from.y === to.y) return [];
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) return [{ x: to.x, y: to.y }];
  const phi = (rotationDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }
  const numerator = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const denominator = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const factor = (largeArc === sweep ? -1 : 1) * Math.sqrt(Math.max(0, numerator / denominator));
  const cxp = (factor * rx * y1p) / ry;
  const cyp = (-factor * ry * x1p) / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (from.x + to.x) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (from.y + to.y) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  else if (sweep && delta < 0) delta += 2 * Math.PI;
  const segments = Math.max(4, Math.ceil((Math.abs(delta) / (Math.PI / 2)) * segmentsPerQuarter));
  const points: PolylinePoint[] = [];
  for (let i = 1; i <= segments; i++) {
    const t = theta1 + (delta * i) / segments;
    const x = rx * Math.cos(t);
    const y = ry * Math.sin(t);
    points.push({ x: round4(cosPhi * x - sinPhi * y + cx), y: round4(sinPhi * x + cosPhi * y + cy) });
  }
  points[points.length - 1] = { x: to.x, y: to.y };
  return points;
}

const NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;

function parsePath(d: string, curveSegments: number, arcQuarter: number): Polyline[] {
  const polylines: Polyline[] = [];
  let points: PolylinePoint[] = [];
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  let lastCubic: PolylinePoint | null = null;
  let lastQuad: PolylinePoint | null = null;

  const flush = (closed: boolean) => {
    if (points.length >= 2) {
      const pts = points.map((p) => ({ ...p }));
      if (closed && pts.length > 2) {
        const first = pts[0]!;
        const last = pts[pts.length - 1]!;
        if (Math.abs(first.x - last.x) < 1e-9 && Math.abs(first.y - last.y) < 1e-9) pts.pop();
      }
      polylines.push(closed ? { points: pts, closed: true } : { points: pts });
    }
    points = [];
  };
  const begin = () => {
    if (points.length === 0) points = [{ x: cx, y: cy }];
  };

  let i = 0;
  let cmd = '';
  const skipSeparators = () => {
    while (i < d.length && /[\s,]/.test(d[i]!)) i++;
  };
  const readNumber = (): number | null => {
    skipSeparators();
    NUMBER.lastIndex = i;
    const m = NUMBER.exec(d);
    if (!m) return null;
    i = NUMBER.lastIndex;
    return Number(m[0]);
  };
  const readFlag = (): boolean | null => {
    skipSeparators();
    const c = d[i];
    if (c === '0' || c === '1') {
      i++;
      return c === '1';
    }
    return null;
  };

  while (i < d.length) {
    skipSeparators();
    if (i >= d.length) break;
    const ch = d[i]!;
    if (/[a-zA-Z]/.test(ch)) {
      cmd = ch;
      i++;
      if (cmd === 'Z' || cmd === 'z') {
        flush(true);
        cx = startX;
        cy = startY;
        lastCubic = null;
        lastQuad = null;
        continue;
      }
    } else if (!cmd || cmd === 'Z' || cmd === 'z') {
      break; // numbers with no command
    }
    const rel = cmd === cmd.toLowerCase();
    const upper = cmd.toUpperCase();
    const args: number[] = [];
    const need = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 }[upper];
    if (!need) break;
    let ok = true;
    for (let k = 0; k < need; k++) {
      if (upper === 'A' && (k === 3 || k === 4)) {
        const flag = readFlag();
        if (flag === null) { ok = false; break; }
        args.push(flag ? 1 : 0);
      } else {
        const n = readNumber();
        if (n === null) { ok = false; break; }
        args.push(n);
      }
    }
    if (!ok) break;

    const ox = rel ? cx : 0;
    const oy = rel ? cy : 0;
    switch (upper) {
      case 'M':
        flush(false);
        cx = args[0]! + ox;
        cy = args[1]! + oy;
        startX = cx;
        startY = cy;
        points = [{ x: cx, y: cy }];
        cmd = rel ? 'l' : 'L'; // further pairs are line-tos
        lastCubic = null;
        lastQuad = null;
        break;
      case 'L':
        begin();
        cx = args[0]! + ox;
        cy = args[1]! + oy;
        points.push({ x: cx, y: cy });
        lastCubic = null;
        lastQuad = null;
        break;
      case 'H':
        begin();
        cx = args[0]! + ox;
        points.push({ x: cx, y: cy });
        lastCubic = null;
        lastQuad = null;
        break;
      case 'V':
        begin();
        cy = args[0]! + oy;
        points.push({ x: cx, y: cy });
        lastCubic = null;
        lastQuad = null;
        break;
      case 'C': {
        begin();
        const p1 = { x: args[0]! + ox, y: args[1]! + oy };
        const p2 = { x: args[2]! + ox, y: args[3]! + oy };
        const end = { x: args[4]! + ox, y: args[5]! + oy };
        points.push(...flattenCubic({ x: cx, y: cy }, p1, p2, end, curveSegments));
        cx = end.x;
        cy = end.y;
        lastCubic = p2;
        lastQuad = null;
        break;
      }
      case 'S': {
        begin();
        const p1 = lastCubic ? { x: 2 * cx - lastCubic.x, y: 2 * cy - lastCubic.y } : { x: cx, y: cy };
        const p2 = { x: args[0]! + ox, y: args[1]! + oy };
        const end = { x: args[2]! + ox, y: args[3]! + oy };
        points.push(...flattenCubic({ x: cx, y: cy }, p1, p2, end, curveSegments));
        cx = end.x;
        cy = end.y;
        lastCubic = p2;
        lastQuad = null;
        break;
      }
      case 'Q': {
        begin();
        const ctrl = { x: args[0]! + ox, y: args[1]! + oy };
        const end = { x: args[2]! + ox, y: args[3]! + oy };
        points.push(...flattenQuadratic({ x: cx, y: cy }, ctrl, end, curveSegments));
        cx = end.x;
        cy = end.y;
        lastQuad = ctrl;
        lastCubic = null;
        break;
      }
      case 'T': {
        begin();
        const ctrl: PolylinePoint = lastQuad ? { x: 2 * cx - lastQuad.x, y: 2 * cy - lastQuad.y } : { x: cx, y: cy };
        const end = { x: args[0]! + ox, y: args[1]! + oy };
        points.push(...flattenQuadratic({ x: cx, y: cy }, ctrl, end, curveSegments));
        cx = end.x;
        cy = end.y;
        lastQuad = ctrl;
        lastCubic = null;
        break;
      }
      case 'A': {
        begin();
        const end = { x: args[5]! + ox, y: args[6]! + oy };
        points.push(...flattenArc({ x: cx, y: cy }, end, args[0]!, args[1]!, args[2]!, args[3] === 1, args[4] === 1, arcQuarter));
        cx = end.x;
        cy = end.y;
        lastCubic = null;
        lastQuad = null;
        break;
      }
    }
  }
  flush(false);
  return polylines;
}

function ellipsePoints(cx: number, cy: number, rx: number, ry: number, seg: number): PolylinePoint[] {
  return Array.from({ length: seg }, (_, i) => {
    const a = (2 * Math.PI * i) / seg;
    return { x: round4(cx + rx * Math.cos(a)), y: round4(cy + ry * Math.sin(a)) };
  });
}

function roundedRect(x: number, y: number, w: number, h: number, rxIn: number, ryIn: number, seg: number): PolylinePoint[] {
  const rx = Math.min(rxIn, w / 2);
  const ry = Math.min(ryIn, h / 2);
  if (rx <= 0 || ry <= 0) return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
  const corner = (cxp: number, cyp: number, from: number): PolylinePoint[] =>
    Array.from({ length: seg + 1 }, (_, i) => {
      const a = from + ((Math.PI / 2) * i) / seg;
      return { x: round4(cxp + rx * Math.cos(a)), y: round4(cyp + ry * Math.sin(a)) };
    });
  return [
    ...corner(x + w - rx, y + ry, -Math.PI / 2),
    ...corner(x + w - rx, y + h - ry, 0),
    ...corner(x + rx, y + h - ry, Math.PI / 2),
    ...corner(x + rx, y + ry, Math.PI),
  ];
}

function pointsAttr(value: string | undefined): PolylinePoint[] {
  const nums = (value?.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
  const pts: PolylinePoint[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i]!, y: nums[i + 1]! });
  return pts;
}

function shapePolylines(node: SvgNode, curveSegments: number, circleSegments: number): Polyline[] | null {
  const a = node.attrs;
  switch (node.tag) {
    case 'line':
      return [{ points: [{ x: num(a.x1, 0), y: num(a.y1, 0) }, { x: num(a.x2, 0), y: num(a.y2, 0) }] }];
    case 'polyline': {
      const pts = pointsAttr(a.points);
      return pts.length >= 2 ? [{ points: pts }] : [];
    }
    case 'polygon': {
      const pts = pointsAttr(a.points);
      return pts.length >= 2 ? [{ points: pts, closed: true }] : [];
    }
    case 'rect': {
      const w = num(a.width, 0);
      const h = num(a.height, 0);
      if (w <= 0 || h <= 0) return [];
      const rxAttr = a.rx !== undefined ? num(a.rx, 0) : undefined;
      const ryAttr = a.ry !== undefined ? num(a.ry, 0) : undefined;
      const rx = rxAttr ?? ryAttr ?? 0;
      const ry = ryAttr ?? rxAttr ?? 0;
      return [{ points: roundedRect(num(a.x, 0), num(a.y, 0), w, h, rx, ry, 8), closed: true }];
    }
    case 'circle': {
      const r = num(a.r, 0);
      return r > 0 ? [{ points: ellipsePoints(num(a.cx, 0), num(a.cy, 0), r, r, circleSegments), closed: true }] : [];
    }
    case 'ellipse': {
      const rx = num(a.rx, 0);
      const ry = num(a.ry, 0);
      return rx > 0 && ry > 0 ? [{ points: ellipsePoints(num(a.cx, 0), num(a.cy, 0), rx, ry, circleSegments), closed: true }] : [];
    }
    case 'path':
      return parsePath(a.d ?? '', curveSegments, 16);
    default:
      return null;
  }
}

// ─── Units ────────────────────────────────────────────────────────────────────

const MM_PER_UNIT: Record<string, number> = { px: 25.4 / 96, pt: 25.4 / 72, pc: 25.4 / 6, mm: 1, cm: 10, in: 25.4, q: 0.25 };

/** Length with a unit in mm; null for percentages, missing values and unknown units. */
function lengthMm(value: string | undefined): number | null {
  if (!value) return null;
  const m = /^\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)\s*([a-z%]*)\s*$/i.exec(value);
  if (!m) return null;
  const unit = m[2]!.toLowerCase();
  if (unit === '%') return null;
  const factor = unit === '' ? MM_PER_UNIT.px! : MM_PER_UNIT[unit];
  return factor === undefined ? null : Number(m[1]) * factor;
}

// ─── Import ───────────────────────────────────────────────────────────────────

const NOT_RENDERED = new Set([
  'defs', 'symbol', 'clippath', 'mask', 'marker', 'pattern', 'lineargradient', 'radialgradient', 'filter', 'style', 'title', 'desc',
  'metadata', 'script', 'font', 'font-face', 'view', 'cursor', 'animate', 'set', 'animatetransform',
]);

export function importSvgArtwork(svgText: string, options: SvgImportOptions = {}): SvgImportResult {
  const unsafe = findUnsafeSvgContent(svgText);
  if (unsafe.length > 0) throw new Error(`Unsafe SVG content: ${unsafe.join('; ')}`);

  const { curveSegments = 24, circleSegments = 64 } = options;
  const { root } = parseSvgTree(svgText);
  if (!root || root.tag !== 'svg') throw new Error('This file is not an SVG image.');

  const warnings = new Set<string>();
  const idMap = new Map<string, SvgNode>();
  const rules: StyleRule[] = [];
  const collect = (node: SvgNode) => {
    if (node.attrs.id && !idMap.has(node.attrs.id)) idMap.set(node.attrs.id, node);
    if (node.tag === 'style') rules.push(...parseStyleSheet(node.text, warnings, rules.length));
    node.children.forEach(collect);
  };
  collect(root);

  const viewBoxParts = (root.attrs.viewbox?.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
  const viewBox = viewBoxParts.length === 4 && viewBoxParts[2]! > 0 && viewBoxParts[3]! > 0
    ? { x: viewBoxParts[0]!, y: viewBoxParts[1]!, width: viewBoxParts[2]!, height: viewBoxParts[3]! }
    : null;
  const declaredWidth = lengthMm(root.attrs.width);
  const declaredHeight = lengthMm(root.attrs.height);
  let naturalSizeMm: SvgImportResult['naturalSizeMm'] = null;
  if (declaredWidth !== null && declaredHeight !== null) naturalSizeMm = { widthMm: declaredWidth, heightMm: declaredHeight };
  else if (viewBox) {
    const fromWidth = declaredWidth !== null ? declaredWidth / viewBox.width : null;
    const fromHeight = declaredHeight !== null ? declaredHeight / viewBox.height : null;
    const unit = fromWidth ?? fromHeight ?? MM_PER_UNIT.px!;
    naturalSizeMm = { widthMm: viewBox.width * unit, heightMm: viewBox.height * unit };
  }
  const userUnitMm = naturalSizeMm && viewBox ? naturalSizeMm.widthMm / viewBox.width : naturalSizeMm ? MM_PER_UNIT.px! : null;

  const shapes: ImportedShape[] = [];
  let useInstances = 0;
  let sawText = false;
  let order = 0;

  const visit = (node: SvgNode, matrix: Matrix, parentStyle: Style, useDepth: number, isRoot: boolean) => {
    const tag = node.tag;
    if (tag === 'text' || tag === 'tspan') { sawText = true; return; }
    if (NOT_RENDERED.has(tag)) return;

    const own = parseTransform(node.attrs.transform, warnings);
    const declared = declaredProperties(node, rules);
    const { style, display } = computeStyle(parentStyle, declared, warnings);
    if (!display) return;
    const m = isRoot ? matrix : multiply(matrix, own);

    if (tag === 'g' || tag === 'switch' || tag === 'a' || tag === 'svg') {
      let childMatrix = m;
      if (tag === 'svg' && !isRoot) {
        warnings.add('A nested <svg> was read without its own viewBox scaling.');
        childMatrix = multiply(m, [1, 0, 0, 1, num(node.attrs.x, 0), num(node.attrs.y, 0)]);
      }
      for (const child of node.children) visit(child, childMatrix, style, useDepth, false);
      return;
    }

    if (tag === 'use') {
      const href = node.attrs.href;
      const target = href?.startsWith('#') ? idMap.get(href.slice(1)) : undefined;
      if (!target) { warnings.add('A <use> pointed at something that is not in the file and was skipped.'); return; }
      if (useDepth >= MAX_USE_DEPTH || ++useInstances > MAX_USE_INSTANCES) { warnings.add('Too many repeated <use> elements; the rest were skipped.'); return; }
      const placed = multiply(m, [1, 0, 0, 1, num(node.attrs.x, 0), num(node.attrs.y, 0)]);
      if (target.tag === 'symbol' || target.tag === 'svg') {
        const { style: targetStyle } = computeStyle(style, declaredProperties(target, rules), warnings);
        for (const child of target.children) visit(child, placed, targetStyle, useDepth + 1, false);
      } else visit(target, placed, style, useDepth + 1, false);
      return;
    }

    const polylines = shapePolylines(node, curveSegments, circleSegments);
    if (polylines === null) {
      if (tag === 'image') warnings.add('An embedded image was ignored.');
      return;
    }
    if (!style.visibility || style.opacity <= 0) return;
    const filled = style.fill !== null && style.fillOpacity > 0;
    const stroked = style.stroke !== null && style.strokeOpacity > 0 && style.strokeWidth > 0;
    if (!filled && !stroked) return;
    const transformed = polylines
      .map((p): Polyline => ({ ...p, points: p.points.map((pt) => apply(m, pt)) }))
      .filter((p) => p.points.length >= 2);
    if (transformed.length === 0) return;
    const scale = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
    shapes.push({
      order: order++,
      element: tag,
      polylines: transformed,
      fill: filled ? style.fill : null,
      fillOpacity: style.fillOpacity,
      stroke: stroked ? style.stroke : null,
      strokeWidth: style.strokeWidth * scale,
      strokeOpacity: style.strokeOpacity,
      opacity: style.opacity,
      fillRule: style.fillRule,
    });
  };

  const { style: rootStyle } = computeStyle(ROOT_STYLE, declaredProperties(root, rules), warnings);
  visit(root, IDENTITY, rootStyle, 0, true);

  if (sawText) warnings.add('Text was ignored. Convert text to outlines first (Illustrator: Type, Create Outlines; Inkscape: Path, Object to Path; Figma: Flatten).');
  return { shapes, viewBox, naturalSizeMm, userUnitMm, warnings: [...warnings] };
}
