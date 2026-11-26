import type { Vec2 } from '../types';

/**
 * Reading the lines out of a finished PDF pattern: where the paper is cut and where it is folded, as drawn by the pattern's maker. Only what
 * a cutting file needs: the stroked paths of every page (lines, curves and rectangles, with their colour, width and dash), in PDF points with y up.
 * Fills, text, images and shadings are skipped. Handles cross-reference tables and streams, object streams, nested page trees, page
 * contents in several streams, form XObjects, and `Flate`, ASCIIHex and ASCII85 streams. Encrypted files are refused. Pure and deterministic; the
 * only browser-standard thing it uses is `DecompressionStream` (also in Node) to inflate.
 */

export class PdfReadError extends Error {
  constructor(public readonly code: 'not-a-pdf' | 'encrypted' | 'too-big' | 'no-pages' | 'broken') {
    super(code);
  }
}

export const MAX_PDF_BYTES = 60 * 1024 * 1024;

// ─── Objects ──────────────────────────────────────────────────────────────────

type Obj = null | boolean | number | Name | Str | Ref | Obj[] | Dict;
interface Name { n: string }
interface Str { s: string }
interface Ref { r: number }
interface Dict { d: Record<string, Obj> }

const isDict = (o: Obj | undefined): o is Dict => typeof o === 'object' && o !== null && !Array.isArray(o) && 'd' in o;
const isName = (o: Obj | undefined): o is Name => typeof o === 'object' && o !== null && !Array.isArray(o) && 'n' in o;
const isRef = (o: Obj | undefined): o is Ref => typeof o === 'object' && o !== null && !Array.isArray(o) && 'r' in o;

const WS = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set('()<>[]{}/%'.split('').map((c) => c.charCodeAt(0)));

class Parser {
  pos: number;
  constructor(readonly src: string, pos = 0) {
    this.pos = pos;
  }
  skip(): void {
    const s = this.src;
    while (this.pos < s.length) {
      const c = s.charCodeAt(this.pos);
      if (WS.has(c)) this.pos++;
      else if (c === 37) {
        while (this.pos < s.length && s.charCodeAt(this.pos) !== 10 && s.charCodeAt(this.pos) !== 13) this.pos++;
      } else break;
    }
  }
  parse(depth = 0): Obj {
    if (depth > 60) throw new PdfReadError('broken');
    this.skip();
    const s = this.src;
    const c = s[this.pos];
    if (c === undefined) throw new PdfReadError('broken');
    if (c === '/') {
      this.pos++;
      let name = '';
      while (this.pos < s.length && !WS.has(s.charCodeAt(this.pos)) && !DELIM.has(s.charCodeAt(this.pos))) {
        if (s[this.pos] === '#' && /^[0-9a-fA-F]{2}$/.test(s.slice(this.pos + 1, this.pos + 3))) {
          name += String.fromCharCode(parseInt(s.slice(this.pos + 1, this.pos + 3), 16));
          this.pos += 3;
        } else name += s[this.pos++];
      }
      return { n: name };
    }
    if (c === '(') return this.literal();
    if (c === '<') {
      if (s[this.pos + 1] === '<') {
        this.pos += 2;
        const d: Record<string, Obj> = {};
        for (;;) {
          this.skip();
          if (s[this.pos] === '>' && s[this.pos + 1] === '>') {
            this.pos += 2;
            return { d };
          }
          const key = this.parse(depth + 1);
          if (!isName(key)) throw new PdfReadError('broken');
          d[key.n] = this.parse(depth + 1);
        }
      }
      const end = s.indexOf('>', this.pos);
      if (end < 0) throw new PdfReadError('broken');
      const hex = s.slice(this.pos + 1, end).replace(/\s+/g, '');
      this.pos = end + 1;
      let out = '';
      for (let i = 0; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2).padEnd(2, '0'), 16) || 0);
      return { s: out };
    }
    if (c === '[') {
      this.pos++;
      const a: Obj[] = [];
      for (;;) {
        this.skip();
        if (s[this.pos] === ']') {
          this.pos++;
          return a;
        }
        if (this.pos >= s.length) throw new PdfReadError('broken');
        a.push(this.parse(depth + 1));
      }
    }
    const m = /^[+-]?(?:\d+\.?\d*|\.\d+)/.exec(s.slice(this.pos, this.pos + 40));
    if (m) {
      this.pos += m[0].length;
      const value = Number(m[0]);
      if (/^\d+$/.test(m[0])) {
        // "12 0 R" is a reference.
        const ref = /^\s+(\d+)\s+R(?![A-Za-z0-9])/.exec(s.slice(this.pos, this.pos + 24));
        if (ref) {
          this.pos += ref[0].length;
          return { r: value };
        }
      }
      return value;
    }
    const word = /^[A-Za-z]+/.exec(s.slice(this.pos, this.pos + 8));
    if (word) {
      this.pos += word[0].length;
      if (word[0] === 'true') return true;
      if (word[0] === 'false') return false;
      return null;
    }
    this.pos++;
    return null;
  }
  literal(): Str {
    const s = this.src;
    this.pos++;
    let depth = 1;
    let out = '';
    while (this.pos < s.length && depth > 0) {
      const ch = s[this.pos++];
      if (ch === '\\') {
        const n = s[this.pos++];
        if (n === 'n') out += '\n';
        else if (n === 'r') out += '\r';
        else if (n === 't') out += '\t';
        else if (n === 'b') out += '\b';
        else if (n === 'f') out += '\f';
        else if (n !== undefined && /[0-7]/.test(n)) {
          let oct = n;
          while (oct.length < 3 && /[0-7]/.test(s[this.pos] ?? '')) oct += s[this.pos++];
          out += String.fromCharCode(parseInt(oct, 8) & 255);
        } else if (n !== '\n' && n !== '\r' && n !== undefined) out += n;
      } else if (ch === '(') {
        depth++;
        out += ch;
      } else if (ch === ')') {
        depth--;
        if (depth > 0) out += ch;
      } else out += ch;
    }
    return { s: out };
  }
}

// ─── Streams ──────────────────────────────────────────────────────────────────

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream('deflate');
  const writer = stream.writable.getWriter();
  void writer.write(data as unknown as Uint8Array<ArrayBuffer>).catch(() => undefined);
  void writer.close().catch(() => undefined);
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
    if (total > 256 * 1024 * 1024) throw new PdfReadError('too-big');
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

function ascii85(text: string): Uint8Array {
  const out: number[] = [];
  const clean = text.replace(/\s+/g, '').replace(/^<~/, '').replace(/~>.*$/, '');
  let group: number[] = [];
  for (const ch of clean) {
    if (ch === 'z' && group.length === 0) {
      out.push(0, 0, 0, 0);
      continue;
    }
    group.push(ch.charCodeAt(0) - 33);
    if (group.length === 5) {
      let v = 0;
      for (const g of group) v = v * 85 + g;
      out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
      group = [];
    }
  }
  if (group.length > 1) {
    const n = group.length;
    while (group.length < 5) group.push(84);
    let v = 0;
    for (const g of group) v = v * 85 + g;
    const bytes = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
    out.push(...bytes.slice(0, n - 1));
  }
  return Uint8Array.from(out);
}

const bytesOf = (text: string, start: number, end: number): Uint8Array => {
  const out = new Uint8Array(end - start);
  for (let i = start; i < end; i++) out[i - start] = text.charCodeAt(i) & 255;
  return out;
};

const latin1 = (data: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < data.length; i += 8192) out += String.fromCharCode(...data.subarray(i, i + 8192));
  return out;
};

// ─── The document ─────────────────────────────────────────────────────────────

interface Entry {
  value: Obj;
  stream?: { start: number; end: number };
}

interface Doc {
  text: string;
  objects: Map<number, Entry>;
  warnings: Set<string>;
}

const resolve = (doc: Doc, o: Obj | undefined, guard = 0): Obj | undefined => {
  let cur = o;
  while (isRef(cur) && guard++ < 20) cur = doc.objects.get(cur.r)?.value;
  return cur;
};
const num = (doc: Doc, o: Obj | undefined): number | undefined => {
  const v = resolve(doc, o);
  return typeof v === 'number' ? v : undefined;
};
const nameOf = (doc: Doc, o: Obj | undefined): string | undefined => {
  const v = resolve(doc, o);
  return isName(v) ? v.n : undefined;
};
const get = (doc: Doc, dict: Dict | undefined, key: string): Obj | undefined => (dict ? resolve(doc, dict.d[key]) : undefined);

async function decodeStream(doc: Doc, entry: Entry): Promise<Uint8Array | null> {
  if (!entry.stream || !isDict(entry.value)) return null;
  const dict = entry.value;
  let data = bytesOf(doc.text, entry.stream.start, entry.stream.end);
  const filterObj = get(doc, dict, 'Filter');
  const filters = (Array.isArray(filterObj) ? filterObj : filterObj === undefined ? [] : [filterObj]).map((f) => nameOf(doc, f));
  const parms = get(doc, dict, 'DecodeParms');
  const parmList = Array.isArray(parms) ? parms : parms === undefined ? [] : [parms];
  for (let i = 0; i < filters.length; i++) {
    const f = filters[i];
    if (f === 'FlateDecode' || f === 'Fl') {
      try {
        data = await inflate(data);
      } catch (e) {
        if (e instanceof PdfReadError) throw e;
        return null;
      }
      const p = resolve(doc, parmList[i]);
      const predictor = isDict(p) ? num(doc, p.d.Predictor) : undefined;
      if (predictor && predictor > 1) {
        doc.warnings.add('A stream with a predictor was skipped.');
        return null;
      }
    } else if (f === 'ASCIIHexDecode' || f === 'AHx') {
      const hex = latin1(data).replace(/[^0-9a-fA-F]/g, '');
      const out = new Uint8Array(Math.floor(hex.length / 2));
      for (let k = 0; k < out.length; k++) out[k] = parseInt(hex.slice(2 * k, 2 * k + 2), 16);
      data = out;
    } else if (f === 'ASCII85Decode' || f === 'A85') data = ascii85(latin1(data));
    else {
      doc.warnings.add(`A stream with the filter ${f ?? 'unknown'} was skipped.`);
      return null;
    }
  }
  return data;
}

async function loadObjects(doc: Doc): Promise<void> {
  const { text } = doc;
  const re = /(?:^|[\r\n\s])(\d+)\s+(\d+)\s+obj\b/g;
  const objStreams: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const id = Number(m[1]);
    const p = new Parser(text, m.index + m[0].length);
    let value: Obj;
    try {
      value = p.parse();
    } catch {
      continue;
    }
    const entry: Entry = { value };
    p.skip();
    if (isDict(value) && text.startsWith('stream', p.pos)) {
      let s = p.pos + 6;
      if (text[s] === '\r') s++;
      if (text[s] === '\n') s++;
      const length = typeof value.d.Length === 'number' ? value.d.Length : undefined;
      let end = -1;
      if (length !== undefined && s + length <= text.length && /^\s*endstream/.test(text.slice(s + length, s + length + 16))) end = s + length;
      if (end < 0) {
        const e = text.indexOf('endstream', s);
        end = e < 0 ? text.length : e;
        while (end > s && (text[end - 1] === '\n' || text[end - 1] === '\r') && length === undefined) end--;
      }
      entry.stream = { start: s, end };
      re.lastIndex = Math.max(re.lastIndex, end);
      if (isName(value.d.Type) && value.d.Type.n === 'ObjStm') objStreams.push(id);
    } else re.lastIndex = Math.max(re.lastIndex, p.pos);
    doc.objects.set(id, entry);
  }
  // Objects packed in object streams.
  for (const id of objStreams) {
    const entry = doc.objects.get(id)!;
    const data = await decodeStream(doc, entry);
    if (!data || !isDict(entry.value)) continue;
    const body = latin1(data);
    const count = num(doc, entry.value.d.N) ?? 0;
    const first = num(doc, entry.value.d.First) ?? 0;
    const head = new Parser(body, 0);
    const pairs: [number, number][] = [];
    for (let i = 0; i < count; i++) {
      const a = head.parse();
      const b = head.parse();
      if (typeof a === 'number' && typeof b === 'number') pairs.push([a, b]);
    }
    for (const [objId, offset] of pairs) {
      try {
        const value = new Parser(body, first + offset).parse();
        if (!doc.objects.has(objId)) doc.objects.set(objId, { value });
      } catch {
        // A damaged packed object is left out.
      }
    }
  }
}

// ─── Pages ────────────────────────────────────────────────────────────────────

interface PageInfo {
  dict: Dict;
  mediaBox: [number, number, number, number];
  rotate: number;
  resources: Dict | undefined;
}

function pageList(doc: Doc): PageInfo[] {
  const pages: PageInfo[] = [];
  const rootMatch = [...doc.text.matchAll(/\/Root\s+(\d+)\s+\d+\s+R/g)].pop();
  const catalog = rootMatch ? resolve(doc, { r: Number(rootMatch[1]) }) : undefined;
  const seen = new Set<Dict>();
  const walk = (node: Obj | undefined, inherited: { box?: Obj; rotate?: Obj; resources?: Obj }, depth: number) => {
    const dict = resolve(doc, node);
    if (!isDict(dict) || seen.has(dict) || depth > 40) return;
    seen.add(dict);
    const inh = {
      box: dict.d.MediaBox ?? inherited.box,
      rotate: dict.d.Rotate ?? inherited.rotate,
      resources: dict.d.Resources ?? inherited.resources,
    };
    const kids = get(doc, dict, 'Kids');
    if (Array.isArray(kids)) {
      for (const k of kids) walk(k, inh, depth + 1);
      return;
    }
    const crop = get(doc, dict, 'CropBox');
    const boxArr = resolve(doc, Array.isArray(crop) ? crop : inh.box);
    const nums = Array.isArray(boxArr) ? boxArr.map((v) => num(doc, v)) : [];
    const box: [number, number, number, number] = nums.length === 4 && nums.every((v) => v !== undefined) ? (nums as [number, number, number, number]) : [0, 0, 612, 792];
    const rot = num(doc, inh.rotate) ?? 0;
    const res = resolve(doc, inh.resources);
    pages.push({ dict, mediaBox: [Math.min(box[0], box[2]), Math.min(box[1], box[3]), Math.max(box[0], box[2]), Math.max(box[1], box[3])], rotate: ((Math.round(rot / 90) * 90) % 360 + 360) % 360, resources: isDict(res) ? res : undefined });
  };
  if (isDict(catalog)) walk(get(doc, catalog, 'Pages'), {}, 0);
  if (pages.length === 0) {
    // A broken page tree: every object that says it is a page.
    for (const [, e] of doc.objects) if (isDict(e.value) && isName(e.value.d.Type) && e.value.d.Type.n === 'Page') walk(e.value, {}, 0);
  }
  return pages;
}

// ─── Drawing operators ────────────────────────────────────────────────────────

export interface PdfStroke {
  /** In PDF points, y up, page rotation applied, origin at the lower left corner of the page. */
  points: Vec2[];
  closed: boolean;
  /** Red, green, blue between 0 and 1. */
  rgb: [number, number, number];
  /** Line width in points. */
  width: number;
  /** The dash pattern in points (empty: a solid line). */
  dash: number[];
}

export interface PdfPage {
  /** 1-based. */
  number: number;
  widthPt: number;
  heightPt: number;
  strokes: PdfStroke[];
}

export interface PdfDocument {
  pages: PdfPage[];
  warnings: string[];
}

type Matrix = [number, number, number, number, number, number];
const IDENT: Matrix = [1, 0, 0, 1, 0, 0];
const mul = (a: Matrix, b: Matrix): Matrix => [
  a[0] * b[0] + a[1] * b[2],
  a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2],
  a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4],
  a[4] * b[1] + a[5] * b[3] + b[5],
];
const apply = (m: Matrix, x: number, y: number): Vec2 => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

interface GState {
  ctm: Matrix;
  stroke: [number, number, number];
  width: number;
  dash: number[];
}

const cmykToRgb = (c: number, m: number, y: number, k: number): [number, number, number] => [(1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)];
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const TOKEN = /\s*(?:(%[^\r\n]*)|([+-]?(?:\d+\.?\d*|\.\d+))|(\/[^\s()<>\[\]{}\/%]*)|(\()|(<<)|(>>)|(<[0-9a-fA-F\s]*>)|(\[)|(\])|([^\s()<>\[\]{}\/%]+))/y;

interface Interpreter {
  doc: Doc;
  strokes: PdfStroke[];
  budget: number;
}

async function interpret(it: Interpreter, content: string, resources: Dict | undefined, start: GState, depth: number): Promise<void> {
  const { doc } = it;
  let gs: GState = { ...start, dash: [...start.dash] };
  const stack: GState[] = [];
  let subpaths: { pts: Vec2[]; closed: boolean }[] = [];
  let cur: { pts: Vec2[]; closed: boolean } | null = null;
  let operands: (number | string | number[])[] = [];
  const arrayStack: (number | string)[][] = [];
  let nestedDict = 0;
  let pos = 0;
  const L = content.length;

  const begin = (x: number, y: number) => {
    cur = { pts: [apply(gs.ctm, x, y)], closed: false };
    subpaths.push(cur);
  };
  const flat = (p0: Vec2, c1: Vec2, c2: Vec2, p3: Vec2): Vec2[] => {
    const out: Vec2[] = [];
    const n = 10;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      out.push([
        u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1],
      ]);
    }
    return out;
  };
  const scale = () => Math.sqrt(Math.abs(gs.ctm[0] * gs.ctm[3] - gs.ctm[1] * gs.ctm[2]));
  const paint = (stroke: boolean, close: boolean) => {
    if (stroke) {
      for (const sp of subpaths) {
        if (sp.pts.length < 2) continue;
        if (it.strokes.length >= it.budget) {
          doc.warnings.add('A page with a very large number of lines was cut short.');
          break;
        }
        const s = scale();
        it.strokes.push({ points: sp.pts, closed: sp.closed || close, rgb: [...gs.stroke], width: gs.width * s, dash: gs.dash.map((d) => d * s) });
      }
    }
    subpaths = [];
    cur = null;
  };
  const n = (i: number): number => (typeof operands[i] === 'number' ? (operands[i] as number) : 0);

  const run = async (op: string): Promise<void> => {
    switch (op) {
      case 'q': stack.push({ ...gs, dash: [...gs.dash] }); break;
      case 'Q': if (stack.length) gs = stack.pop()!; break;
      case 'cm': gs.ctm = mul([n(0), n(1), n(2), n(3), n(4), n(5)], gs.ctm); break;
      case 'w': gs.width = n(0); break;
      case 'd': gs.dash = Array.isArray(operands[0]) ? (operands[0] as number[]).filter((v) => v >= 0) : []; if (gs.dash.every((v) => v === 0)) gs.dash = []; break;
      case 'RG': gs.stroke = [clamp01(n(0)), clamp01(n(1)), clamp01(n(2))]; break;
      case 'G': gs.stroke = [clamp01(n(0)), clamp01(n(0)), clamp01(n(0))]; break;
      case 'K': gs.stroke = cmykToRgb(clamp01(n(0)), clamp01(n(1)), clamp01(n(2)), clamp01(n(3))); break;
      case 'SC': case 'SCN': {
        const v = operands.filter((x): x is number => typeof x === 'number');
        if (v.length === 3) gs.stroke = [clamp01(v[0]), clamp01(v[1]), clamp01(v[2])];
        else if (v.length === 1) gs.stroke = [clamp01(v[0]), clamp01(v[0]), clamp01(v[0])];
        else if (v.length === 4) gs.stroke = cmykToRgb(clamp01(v[0]), clamp01(v[1]), clamp01(v[2]), clamp01(v[3]));
        break;
      }
      case 'gs': {
        const states = get(doc, resources, 'ExtGState');
        const name = typeof operands[0] === 'string' ? operands[0] : '';
        const st = isDict(states) ? resolve(doc, states.d[name]) : undefined;
        if (isDict(st)) {
          const lw = num(doc, st.d.LW);
          if (lw !== undefined) gs.width = lw;
          const d = resolve(doc, st.d.D);
          if (Array.isArray(d)) {
            const arr = resolve(doc, d[0]);
            gs.dash = Array.isArray(arr) ? arr.map((v) => num(doc, v) ?? 0).filter((v) => v >= 0) : [];
            if (gs.dash.every((v) => v === 0)) gs.dash = [];
          }
        }
        break;
      }
      case 'm': begin(n(0), n(1)); break;
      case 'l': if (!cur) begin(n(0), n(1)); else cur.pts.push(apply(gs.ctm, n(0), n(1))); break;
      case 'c': case 'v': case 'y': {
        if (!cur) break;
        const p0 = cur.pts[cur.pts.length - 1];
        let c1: Vec2;
        let c2: Vec2;
        let p3: Vec2;
        if (op === 'c') { c1 = apply(gs.ctm, n(0), n(1)); c2 = apply(gs.ctm, n(2), n(3)); p3 = apply(gs.ctm, n(4), n(5)); }
        else if (op === 'v') { c1 = p0; c2 = apply(gs.ctm, n(0), n(1)); p3 = apply(gs.ctm, n(2), n(3)); }
        else { c1 = apply(gs.ctm, n(0), n(1)); p3 = apply(gs.ctm, n(2), n(3)); c2 = p3; }
        cur.pts.push(...flat(p0, c1, c2, p3));
        break;
      }
      case 'h': if (cur) { cur.closed = true; } break;
      case 're': {
        const [x, y, w, h] = [n(0), n(1), n(2), n(3)];
        const pts = [apply(gs.ctm, x, y), apply(gs.ctm, x + w, y), apply(gs.ctm, x + w, y + h), apply(gs.ctm, x, y + h)];
        cur = { pts, closed: true };
        subpaths.push(cur);
        break;
      }
      case 'S': paint(true, false); break;
      case 's': paint(true, true); break;
      case 'B': case 'B*': paint(true, false); break;
      case 'b': case 'b*': paint(true, true); break;
      case 'f': case 'F': case 'f*': case 'n': paint(false, false); break;
      case 'Do': {
        if (depth >= 8) break;
        const xobjs = get(doc, resources, 'XObject');
        const name = typeof operands[0] === 'string' ? operands[0] : '';
        const ref = isDict(xobjs) ? xobjs.d[name] : undefined;
        const entry = isRef(ref) ? doc.objects.get(ref.r) : undefined;
        if (!entry || !isDict(entry.value) || nameOf(doc, entry.value.d.Subtype) !== 'Form') break;
        const data = await decodeStream(doc, entry);
        if (!data) break;
        const mArr = get(doc, entry.value, 'Matrix');
        const mv = Array.isArray(mArr) ? mArr.map((v) => num(doc, v) ?? 0) : [];
        const matrix: Matrix = mv.length === 6 ? (mv as Matrix) : IDENT;
        const formRes = get(doc, entry.value, 'Resources');
        await interpret(it, latin1(data), isDict(formRes) ? formRes : resources, { ...gs, dash: [...gs.dash], ctm: mul(matrix, gs.ctm) }, depth + 1);
        break;
      }
      default: break;
    }
  };

  // The content is tokenized in one pass; operators run as they come.
  TOKEN.lastIndex = 0;
  while (pos < L) {
    TOKEN.lastIndex = pos;
    const m = TOKEN.exec(content);
    if (!m) break;
    pos = TOKEN.lastIndex;
    if (m[1] !== undefined) continue;
    if (m[2] !== undefined) {
      const value = Number(m[2]);
      if (arrayStack.length) arrayStack[arrayStack.length - 1].push(value);
      else if (!nestedDict) operands.push(value);
    } else if (m[3] !== undefined) {
      if (arrayStack.length) arrayStack[arrayStack.length - 1].push(m[3].slice(1));
      else if (!nestedDict) operands.push(m[3].slice(1));
    } else if (m[4] !== undefined) {
      // A string: skipped (text is not drawn here), but it has to be stepped over.
      let depthP = 1;
      let i = pos;
      while (i < L && depthP > 0) {
        const ch = content[i++];
        if (ch === '\\') i++;
        else if (ch === '(') depthP++;
        else if (ch === ')') depthP--;
      }
      pos = i;
    } else if (m[5] !== undefined) nestedDict++;
    else if (m[6] !== undefined) nestedDict = Math.max(0, nestedDict - 1);
    else if (m[7] !== undefined) continue;
    else if (m[8] !== undefined) arrayStack.push([]);
    else if (m[9] !== undefined) {
      const arr = arrayStack.pop();
      if (arr && !nestedDict) {
        if (arrayStack.length) arrayStack[arrayStack.length - 1].push(...(arr as number[]));
        else operands.push(arr.filter((v): v is number => typeof v === 'number'));
      }
    } else if (m[10] !== undefined) {
      const op = m[10];
      if (op === 'BI') {
        // An inline image: skip to its end.
        const idAt = content.indexOf('ID', pos);
        const eiRe = /[\s]EI(?=[\s]|$)/g;
        eiRe.lastIndex = idAt < 0 ? pos : idAt + 2;
        const ei = eiRe.exec(content);
        pos = ei ? ei.index + ei[0].length : L;
      } else if (!nestedDict && arrayStack.length === 0) await run(op);
      operands = [];
    }
  }
}

/** Lays the strokes of a page out as the page shows them: the page's own rotation applied and the origin at the lower left of the visible box. */
function pageMatrix(info: PageInfo): { m: Matrix; width: number; height: number } {
  const [x0, y0, x1, y1] = info.mediaBox;
  const w = x1 - x0;
  const h = y1 - y0;
  const base: Matrix = [1, 0, 0, 1, -x0, -y0];
  switch (info.rotate) {
    case 90: return { m: mul(base, [0, -1, 1, 0, 0, w]), width: h, height: w };
    case 180: return { m: mul(base, [-1, 0, 0, -1, w, h]), width: w, height: h };
    case 270: return { m: mul(base, [0, 1, -1, 0, h, 0]), width: h, height: w };
    default: return { m: base, width: w, height: h };
  }
}

const MAX_STROKES_PER_PAGE = 400_000;

/** Reads every page of a PDF. Throws a `PdfReadError` for a file that is not a PDF, is encrypted, is too big or has no pages. */
export async function readPdf(bytes: Uint8Array): Promise<PdfDocument> {
  if (bytes.length > MAX_PDF_BYTES) throw new PdfReadError('too-big');
  const text = latin1(bytes);
  if (!text.slice(0, 1024).includes('%PDF-')) throw new PdfReadError('not-a-pdf');
  if (/\/Encrypt\s+(?:\d+\s+\d+\s+R|<<)/.test(text.slice(Math.max(0, text.length - 4096)))) throw new PdfReadError('encrypted');
  const doc: Doc = { text, objects: new Map(), warnings: new Set() };
  await loadObjects(doc);
  if (/\/Encrypt\s+\d+\s+\d+\s+R/.test(text) && [...doc.objects.values()].some((e) => isDict(e.value) && 'Filter' in e.value.d && 'O' in e.value.d && 'U' in e.value.d)) throw new PdfReadError('encrypted');
  const infos = pageList(doc);
  if (infos.length === 0) throw new PdfReadError('no-pages');
  const pages: PdfPage[] = [];
  for (let i = 0; i < infos.length; i++) {
    const info = infos[i];
    const { m, width, height } = pageMatrix(info);
    const contents = get(doc, info.dict, 'Contents');
    const parts = Array.isArray(contents) ? contents : contents === undefined ? [] : [info.dict.d.Contents];
    let content = '';
    for (const part of parts) {
      const ref = Array.isArray(contents) ? part : info.dict.d.Contents;
      const entry = isRef(ref) ? doc.objects.get(ref.r) : undefined;
      const data = entry ? await decodeStream(doc, entry) : null;
      if (data) content += latin1(data) + '\n';
    }
    const it: Interpreter = { doc, strokes: [], budget: MAX_STROKES_PER_PAGE };
    await interpret(it, content, info.resources, { ctm: m, stroke: [0, 0, 0], width: 1, dash: [] }, 0);
    pages.push({ number: i + 1, widthPt: width, heightPt: height, strokes: it.strokes });
  }
  return { pages, warnings: [...doc.warnings] };
}
