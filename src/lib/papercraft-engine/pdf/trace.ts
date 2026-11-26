import type { Vec2 } from '../types';

/**
 * Tracing a pattern that is a picture: a bitmap of black outlines (cut lines), dashed lines (folds) and numbers, as many patterns are saved. The lines are
 * found as vectors: the dark pixels are thinned to a one-pixel skeleton, the skeleton is followed into lines (and simplified), and short straight dashes
 * that lie on one line are joined into a fold line. Numbers, text and photos are left out. Pure and deterministic; works on pixels, in pixel
 * coordinates with y pointing down.
 */

export interface PixelImage {
  width: number;
  height: number;
  /** Red, green and blue (8 bits each), row by row. A grey image has the same value three times. */
  rgb: Uint8Array;
}

export interface TracedLine {
  points: Vec2[];
  closed: boolean;
  /** Mean colour of the pixels, 0 to 1. */
  rgb: [number, number, number];
}

export interface TraceResult {
  /** Solid lines: where the paper is cut. */
  cut: TracedLine[];
  /** Dashed lines (a chain of dashes, or dashes and dots) as a start and an end point. */
  folds: { a: Vec2; b: Vec2; rgb: [number, number, number] }[];
  /** How many separate lines of each kind were found, and the photo area that was left out (pixels). */
  skippedPhotoPixels: number;
}

const BUSY = 16;

/** Which pixels are ink: dark enough, and not part of a photo (a block that is mostly not white). */
function inkMask(img: PixelImage): { ink: Uint8Array; photoPixels: number } {
  const { width: w, height: h, rgb } = img;
  const ink = new Uint8Array(w * h);
  const lum = new Uint8Array(w * h);
  const histogram = new Uint32Array(256);
  for (let i = 0; i < w * h; i++) {
    lum[i] = (rgb[i * 3] * 299 + rgb[i * 3 + 1] * 587 + rgb[i * 3 + 2] * 114) / 1000;
    histogram[lum[i]]++;
  }
  // How dark the lines are: the darkest few percent of what is not white. Black lines give a threshold near the middle; grey lines (a pale print) a light one.
  let nonWhite = 0;
  for (let v = 0; v < 245; v++) nonWhite += histogram[v];
  let seen = 0;
  let darkest = 0;
  for (let v = 0; v < 245; v++) {
    seen += histogram[v];
    if (seen >= 0.05 * nonWhite) {
      darkest = v;
      break;
    }
  }
  const threshold = Math.min(235, Math.max(110, darkest + 0.55 * (250 - darkest)));
  for (let i = 0; i < w * h; i++) {
    const r = rgb[i * 3];
    const g = rgb[i * 3 + 1];
    const b = rgb[i * 3 + 2];
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    // Dark enough for these lines, or a thin coloured line that is not nearly white.
    if (lum[i] < threshold || (sat > 70 && lum[i] < Math.max(threshold, 200))) ink[i] = 1;
  }
  // A photo: blocks where most pixels are not white.
  const bw = Math.ceil(w / BUSY);
  const bh = Math.ceil(h / BUSY);
  const busy = new Uint8Array(bw * bh);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let nonWhite = 0;
      let total = 0;
      for (let y = by * BUSY; y < Math.min(h, (by + 1) * BUSY); y++) {
        for (let x = bx * BUSY; x < Math.min(w, (bx + 1) * BUSY); x++) {
          total++;
          if (lum[y * w + x] < 225) nonWhite++;
        }
      }
      if (total > 0 && nonWhite / total > 0.5) busy[by * bw + bx] = 1;
    }
  }
  let photoPixels = 0;
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = bx + dx;
        const ny = by + dy;
        if (nx >= 0 && ny >= 0 && nx < bw && ny < bh && busy[ny * bw + nx]) {
          near = true;
          break;
        }
      }
      if (!near) continue;
      for (let y = by * BUSY; y < Math.min(h, (by + 1) * BUSY); y++) {
        for (let x = bx * BUSY; x < Math.min(w, (bx + 1) * BUSY); x++) {
          if (ink[y * w + x]) {
            ink[y * w + x] = 0;
            photoPixels++;
          }
        }
      }
    }
  }
  return { ink, photoPixels };
}

interface Component {
  /** Pixel indices. */
  pixels: number[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function components(ink: Uint8Array, w: number, h: number): Component[] {
  const seen = new Uint8Array(w * h);
  const out: Component[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (!ink[start] || seen[start]) continue;
    const comp: Component = { pixels: [], minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      comp.pixels.push(i);
      const x = i % w;
      const y = (i - x) / w;
      if (x < comp.minX) comp.minX = x;
      if (x > comp.maxX) comp.maxX = x;
      if (y < comp.minY) comp.minY = y;
      if (y > comp.maxY) comp.maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (ink[j] && !seen[j]) {
            seen[j] = 1;
            stack.push(j);
          }
        }
      }
    }
    out.push(comp);
  }
  return out;
}

/** Zhang and Suen thinning of a padded bitmap (1 where ink), until nothing changes. */
function thin(bits: Uint8Array, w: number, h: number): void {
  const n = (x: number, y: number) => bits[y * w + x];
  for (let pass = 0; pass < 200; pass++) {
    let changed = false;
    for (let step = 0; step < 2; step++) {
      const kill: number[] = [];
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          if (!bits[y * w + x]) continue;
          const p2 = n(x, y - 1);
          const p3 = n(x + 1, y - 1);
          const p4 = n(x + 1, y);
          const p5 = n(x + 1, y + 1);
          const p6 = n(x, y + 1);
          const p7 = n(x - 1, y + 1);
          const p8 = n(x - 1, y);
          const p9 = n(x - 1, y - 1);
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let a = 0;
          for (let k = 0; k < 8; k++) if (seq[k] === 0 && seq[k + 1] === 1) a++;
          if (a !== 1) continue;
          if (step === 0 ? p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0 : p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0) kill.push(y * w + x);
        }
      }
      for (const i of kill) bits[i] = 0;
      if (kill.length) changed = true;
    }
    if (!changed) break;
  }
}

const RING: [number, number][] = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

/** Number of separate runs of skeleton pixels in the ring round a pixel: 1 an end, 2 a line, 3 or more a junction. */
function crossing(bits: Uint8Array, w: number, x: number, y: number): number {
  let c = 0;
  for (let k = 0; k < 8; k++) {
    const a = bits[(y + RING[k][1]) * w + x + RING[k][0]];
    const b = bits[(y + RING[(k + 1) % 8][1]) * w + x + RING[(k + 1) % 8][0]];
    if (a === 0 && b === 1) c++;
  }
  return c;
}

/** Douglas and Peucker: the line with the fewest points that stays within `eps` of the original. A line that comes back to its start is simplified in two halves (it has no direction to measure from). */
function simplify(points: readonly Vec2[], eps: number): Vec2[] {
  if (points.length < 3) return points.slice();
  const first = points[0];
  const last = points[points.length - 1];
  if (points.length > 8 && Math.hypot(first[0] - last[0], first[1] - last[1]) < 2) {
    let far = 0;
    let farD = -1;
    points.forEach((p, i) => {
      const d = Math.hypot(p[0] - first[0], p[1] - first[1]);
      if (d > farD) {
        farD = d;
        far = i;
      }
    });
    const a = simplifyOpen(points.slice(0, far + 1), eps);
    const b = simplifyOpen(points.slice(far), eps);
    return [...a, ...b.slice(1)];
  }
  return simplifyOpen(points, eps);
}

function simplifyOpen(points: readonly Vec2[], eps: number): Vec2[] {
  if (points.length < 3) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop()!;
    const [ax, ay] = points[i];
    const [bx, by] = points[j];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let far = -1;
    let farD = eps;
    for (let k = i + 1; k < j; k++) {
      const d = Math.abs((bx - ax) * (ay - points[k][1]) - (ax - points[k][0]) * (by - ay)) / len;
      if (d > farD) {
        farD = d;
        far = k;
      }
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([i, far], [far, j]);
    }
  }
  return points.filter((_, k) => keep[k]);
}

interface Skeleton {
  /** Lines between junctions and ends, as pixel paths in image coordinates. */
  paths: { pts: Vec2[]; closed: boolean; endpoint: boolean }[];
}

/** The skeleton of a component followed into paths. A path that ends in an open end on one side is flagged (its other end may meet a junction). */
function skeletonPaths(comp: Component, w: number): Skeleton {
  const pad = 2;
  const bw = comp.maxX - comp.minX + 1 + 2 * pad;
  const bh = comp.maxY - comp.minY + 1 + 2 * pad;
  const bits = new Uint8Array(bw * bh);
  for (const i of comp.pixels) {
    const x = i % w;
    const y = (i - x) / w;
    bits[(y - comp.minY + pad) * bw + (x - comp.minX + pad)] = 1;
  }
  thin(bits, bw, bh);
  const cn = new Uint8Array(bw * bh);
  for (let y = 1; y < bh - 1; y++) for (let x = 1; x < bw - 1; x++) if (bits[y * bw + x]) cn[y * bw + x] = crossing(bits, bw, x, y);
  const visited = new Uint8Array(bw * bh);
  const paths: Skeleton['paths'] = [];
  const toImage = (x: number, y: number): Vec2 => [x - pad + comp.minX, y - pad + comp.minY];
  const neighbours = (x: number, y: number): number[] => {
    const out: number[] = [];
    for (const [dx, dy] of RING) if (bits[(y + dy) * bw + x + dx]) out.push((y + dy) * bw + x + dx);
    return out;
  };
  const walk = (sx: number, sy: number, firstIdx: number): { pts: Vec2[]; endNode: boolean } => {
    const pts: Vec2[] = [toImage(sx, sy)];
    let prev = sy * bw + sx;
    let cur = firstIdx;
    for (let guard = 0; guard < bw * bh; guard++) {
      const x = cur % bw;
      const y = (cur - x) / bw;
      pts.push(toImage(x, y));
      if (cn[cur] !== 2) return { pts, endNode: true };
      visited[cur] = 1;
      // The next pixel: not the one we came from, and not one that touches it (that would only cut a corner of a thick junction).
      const px = prev % bw;
      const py = (prev - px) / bw;
      let next = -1;
      let nextTouchesPrev = true;
      for (const nb of neighbours(x, y)) {
        if (nb === prev || (visited[nb] && cn[nb] === 2)) continue;
        const nx = nb % bw;
        const ny = (nb - nx) / bw;
        const touches = Math.abs(nx - px) <= 1 && Math.abs(ny - py) <= 1;
        // Prefer a pixel that does not touch the last one, then a junction or end.
        if (next < 0 || (nextTouchesPrev && !touches) || (touches === nextTouchesPrev && cn[nb] !== 2 && cn[next] === 2)) {
          next = nb;
          nextTouchesPrev = touches;
        }
      }
      if (next < 0) return { pts, endNode: false };
      prev = cur;
      cur = next;
    }
    return { pts, endNode: false };
  };
  for (let y = 1; y < bh - 1; y++) {
    for (let x = 1; x < bw - 1; x++) {
      const idx = y * bw + x;
      if (!bits[idx] || cn[idx] === 2) continue;
      // An end or a junction: follow every line that leaves it.
      for (const nb of neighbours(x, y)) {
        if (visited[nb] && cn[nb] === 2) continue;
        const nx = nb % bw;
        const ny = (nb - nx) / bw;
        if (cn[nb] !== 2 && (ny * bw + nx) < idx) continue;
        const { pts } = walk(x, y, nb);
        if (pts.length >= 2) paths.push({ pts, closed: false, endpoint: cn[idx] === 1 || cn[(Math.round(pts[pts.length - 1][1]) + pad - comp.minY) * bw + Math.round(pts[pts.length - 1][0]) + pad - comp.minX] === 1 });
      }
    }
  }
  // Closed loops with no junction or end on them.
  for (let y = 1; y < bh - 1; y++) {
    for (let x = 1; x < bw - 1; x++) {
      const idx = y * bw + x;
      if (!bits[idx] || cn[idx] !== 2 || visited[idx]) continue;
      const nbs = neighbours(x, y);
      const { pts } = walk(x, y, nbs[0]);
      if (pts.length >= 4) paths.push({ pts, closed: true, endpoint: false });
    }
  }
  return { paths };
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

interface Dash {
  /** The two ends of the straight piece, centre, unit direction and length. */
  a: Vec2;
  b: Vec2;
  cx: number;
  cy: number;
  ux: number;
  uy: number;
  length: number;
  dot: boolean;
}

/** A small component as a dash or a dot, or null when it is not thin and straight (a digit, a letter). */
function dashOf(pixels: readonly number[], w: number): Dash | null {
  const n = pixels.length;
  let sx = 0;
  let sy = 0;
  for (const i of pixels) {
    const x = i % w;
    sx += x;
    sy += (i - x) / w;
  }
  const cx = sx / n;
  const cy = sy / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const i of pixels) {
    const x = (i % w) - cx;
    const y = Math.floor(i / w) - cy;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);
  let lo = Infinity;
  let hi = -Infinity;
  let side = 0;
  for (const i of pixels) {
    const x = (i % w) - cx;
    const y = Math.floor(i / w) - cy;
    const along = x * ux + y * uy;
    const across = Math.abs(-x * uy + y * ux);
    if (along < lo) lo = along;
    if (along > hi) hi = along;
    if (across > side) side = across;
  }
  const length = hi - lo + 1;
  const width = 2 * side + 1;
  if (n <= 12 && length <= 5 && width <= 5) return { a: [cx, cy], b: [cx, cy], cx, cy, ux, uy, length, dot: true };
  if (length < 4 || width > 4.5 || length / width < 2) return null;
  return { a: [cx + ux * lo, cy + uy * lo], b: [cx + ux * hi, cy + uy * hi], cx: cx + (ux * (lo + hi)) / 2, cy: cy + (uy * (lo + hi)) / 2, ux, uy, length, dot: false };
}

/** Chains of dashes (three or more) that lie on one line, with the dots between them: each is a fold line. */
function chainDashes(dashes: readonly Dash[], maxGap: number): { a: Vec2; b: Vec2; used: number[] }[] {
  const real = dashes.map((d, i) => ({ d, i })).filter((e) => !e.d.dot);
  const parent = real.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  // A grid so that only near dashes are compared.
  const cell = maxGap * 2;
  const grid = new Map<string, number[]>();
  real.forEach((e, k) => {
    const key = `${Math.floor(e.d.cx / cell)},${Math.floor(e.d.cy / cell)}`;
    const list = grid.get(key);
    if (list) list.push(k);
    else grid.set(key, [k]);
  });
  const cosLimit = Math.cos((7 * Math.PI) / 180);
  real.forEach((e, k) => {
    const gx = Math.floor(e.d.cx / cell);
    const gy = Math.floor(e.d.cy / cell);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const m of grid.get(`${gx + dx},${gy + dy}`) ?? []) {
          if (m <= k) continue;
          const o = real[m].d;
          const a = e.d;
          if (Math.abs(a.ux * o.ux + a.uy * o.uy) < cosLimit) continue;
          const vx = o.cx - a.cx;
          const vy = o.cy - a.cy;
          const along = Math.abs(vx * a.ux + vy * a.uy);
          const lateral = Math.abs(-vx * a.uy + vy * a.ux);
          const gap = along - (a.length + o.length) / 2;
          if (lateral <= 3 && gap <= maxGap && gap >= -3) parent[find(m)] = find(k);
        }
      }
    }
  });
  const groups = new Map<number, number[]>();
  real.forEach((_, k) => {
    const root = find(k);
    const list = groups.get(root);
    if (list) list.push(k);
    else groups.set(root, [k]);
  });
  const out: { a: Vec2; b: Vec2; used: number[] }[] = [];
  for (const members of groups.values()) {
    if (members.length < 3) continue;
    // The line through all the ends: its direction from the farthest two ends.
    const ends: Vec2[] = members.flatMap((k) => [real[k].d.a, real[k].d.b]);
    let best: [Vec2, Vec2] = [ends[0], ends[1]];
    let bestD = -1;
    for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++) {
      const d = dist(ends[i], ends[j]);
      if (d > bestD) {
        bestD = d;
        best = [ends[i], ends[j]];
      }
    }
    const used = members.map((k) => real[k].i);
    // Dots on the line between the ends belong to it.
    const ux = (best[1][0] - best[0][0]) / (bestD || 1);
    const uy = (best[1][1] - best[0][1]) / (bestD || 1);
    dashes.forEach((d, i) => {
      if (!d.dot) return;
      const vx = d.cx - best[0][0];
      const vy = d.cy - best[0][1];
      const along = vx * ux + vy * uy;
      const lateral = Math.abs(-vx * uy + vy * ux);
      if (lateral <= 3 && along >= -2 && along <= bestD + 2) used.push(i);
    });
    out.push({ a: best[0], b: best[1], used });
  }
  return out;
}

/** The nearest point on a set of lines to `p`, and how far it is. */
function nearestOnLines(p: Vec2, lines: readonly Vec2[][]): { point: Vec2; distance: number } | null {
  let best: { point: Vec2; distance: number } | null = null;
  for (const line of lines) {
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, ay] = line[i];
      const [bx, by] = line[i + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / len2));
      const q: Vec2 = [ax + t * dx, ay + t * dy];
      const d = dist(p, q);
      if (!best || d < best.distance) best = { point: q, distance: d };
    }
  }
  return best;
}

/** Lines that end next to each other (a number touched the line and split it) are one line: ends within `tol` pixels are joined, and a line whose two ends meet is closed. */
function joinEnds(lines: TracedLine[], tol: number): TracedLine[] {
  const out = lines.map((l) => ({ ...l, points: l.points.slice() }));
  for (let guard = 0; guard < 5000; guard++) {
    let best: { i: number; j: number; ei: 0 | 1; ej: 0 | 1; d: number } | null = null;
    for (let i = 0; i < out.length; i++) {
      if (out[i].closed) continue;
      for (let j = i; j < out.length; j++) {
        if (out[j].closed) continue;
        for (const ei of [0, 1] as const) {
          for (const ej of [0, 1] as const) {
            if (i === j && (ei === ej || out[i].points.length < 3)) continue;
            const a = ei === 0 ? out[i].points[0] : out[i].points[out[i].points.length - 1];
            const b = ej === 0 ? out[j].points[0] : out[j].points[out[j].points.length - 1];
            const d = dist(a, b);
            if (d <= tol && (!best || d < best.d)) best = { i, j, ei, ej, d };
          }
        }
      }
    }
    if (!best) break;
    const { i, j, ei, ej } = best;
    if (i === j) {
      out[i].closed = true;
      continue;
    }
    // Put the end of i last and the end of j first, then join.
    const a = ei === 1 ? out[i].points : out[i].points.slice().reverse();
    const b = ej === 0 ? out[j].points : out[j].points.slice().reverse();
    out[i] = { points: [...a, ...b], closed: false, rgb: out[i].rgb };
    out.splice(j, 1);
  }
  return out;
}

export interface TraceOptions {
  /** Lines shorter than this many pixels are not cuts (they are specks or dashes). */
  minCutPx?: number;
  /** The most pixels between two dashes of a fold line. */
  maxGapPx?: number;
  /** How far a line may be off the pixels it follows, in pixels. */
  tolerancePx?: number;
  /** Called with the bitmap that is traced (for a page made of tiles, the tiles put together): to see what the tracing saw. */
  onBitmap?: (image: PixelImage) => void;
}

/** Traces the lines of a bitmap pattern. */
export function traceLineArt(img: PixelImage, options: TraceOptions = {}): TraceResult {
  const { width: w, height: h } = img;
  const minCut = options.minCutPx ?? 24;
  const maxGap = options.maxGapPx ?? 30;
  const tol = options.tolerancePx ?? 1.4;
  options.onBitmap?.(img);
  const { ink, photoPixels } = inkMask(img);
  const comps = components(ink, w, h);
  // The colour of a line: the mean of its darker half (the pixels at the edge of a line are mixed with the paper), in steps of a tenth, so that
  // lines drawn in one colour get one colour.
  const colourOf = (pixels: readonly number[]): [number, number, number] => {
    const lums = pixels.map((i) => img.rgb[i * 3] * 299 + img.rgb[i * 3 + 1] * 587 + img.rgb[i * 3 + 2] * 114);
    const sorted = [...lums].sort((a, b) => a - b);
    const cutoff = sorted[Math.floor(sorted.length / 2)] ?? 0;
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    pixels.forEach((i, k) => {
      if (lums[k] > cutoff) return;
      r += img.rgb[i * 3];
      g += img.rgb[i * 3 + 1];
      b += img.rgb[i * 3 + 2];
      n++;
    });
    n = n || 1;
    const step = (v: number) => Math.round((v / n / 255) * 10) / 10;
    return [step(r), step(g), step(b)];
  };

  const cut: TracedLine[] = [];
  const dashes: Dash[] = [];
  const dashColours: [number, number, number][] = [];
  for (const comp of comps) {
    const extent = Math.max(comp.maxX - comp.minX, comp.maxY - comp.minY) + 1;
    if (extent < minCut) {
      const d = dashOf(comp.pixels, w);
      if (d) {
        dashes.push(d);
        dashColours.push(colourOf(comp.pixels));
      }
      continue;
    }
    const rgb = colourOf(comp.pixels);
    for (const path of skeletonPaths(comp, w).paths) {
      const points = simplify(path.pts, tol);
      let length = 0;
      for (let i = 1; i < points.length; i++) length += dist(points[i - 1], points[i]);
      if (length < minCut) {
        // A short piece on a line: the first dash of a fold line that touches the outline, or a speck.
        if (points.length >= 2 && length >= 4) {
          const a = points[0];
          const b = points[points.length - 1];
          const len = dist(a, b) || 1;
          dashes.push({ a, b, cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, ux: (b[0] - a[0]) / len, uy: (b[1] - a[1]) / len, length: len, dot: false });
          dashColours.push(rgb);
        }
        continue;
      }
      cut.push({ points, closed: path.closed, rgb });
    }
  }

  const joined = joinEnds(cut, 4);
  cut.length = 0;
  cut.push(...joined);
  const chains = chainDashes(dashes, maxGap);
  const lines = cut.map((c) => c.points);
  const folds: TraceResult['folds'] = chains.map((chain) => {
    let a = chain.a;
    let b = chain.b;
    // A fold line runs to the outline it belongs to: a gap of a dash at the end is closed.
    const ux = (b[0] - a[0]) / (dist(a, b) || 1);
    const uy = (b[1] - a[1]) / (dist(a, b) || 1);
    for (const end of [0, 1] as const) {
      const p = end === 0 ? a : b;
      const hit = nearestOnLines(p, lines);
      if (hit && hit.distance > 0.5 && hit.distance <= maxGap) {
        // Only when the outline is ahead of the line (in the way it points), not beside it.
        const vx = hit.point[0] - p[0];
        const vy = hit.point[1] - p[1];
        const dir = end === 0 ? -1 : 1;
        if (dir * (vx * ux + vy * uy) > 0.5 * hit.distance) {
          if (end === 0) a = hit.point;
          else b = hit.point;
        }
      }
    }
    return { a, b, rgb: dashColours[chain.used[0]] ?? [0, 0, 0] };
  });
  return { cut, folds, skippedPhotoPixels: photoPixels };
}
