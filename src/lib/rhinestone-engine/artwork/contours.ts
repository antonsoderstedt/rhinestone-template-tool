/**
 * Iso-contours of a region field, and stones spaced along them.
 *
 * The contour of the distance field at depth d is the edge of the shape moved inwards by d: exactly the offset curve, with
 * correct handling of holes, touching shapes and narrow necks. A row of stones along it is a row that follows the outline.
 */

import type { Polyline, PolylinePoint } from '../path/polyline';
import type { RegionField } from './regionField';

export interface ContourLoop {
  points: PolylinePoint[];
  /** Total length (mm). */
  length: number;
}

interface Segment {
  from: number;
  to: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

/**
 * Closed contours of the field at `level` (mm): the set of points where the signed distance equals `level`.
 * Each loop runs with the inside on its left (y pointing down, so clockwise on screen for an outer edge).
 */
export function extractContours(field: RegionField, level: number): ContourLoop[] {
  const { cols, rows, sdf, originX, originY, cell } = field;
  const segments: Segment[] = [];
  const px = (col: number) => originX + (col + 0.5) * cell;
  const py = (row: number) => originY + (row + 0.5) * cell;

  // Edge ids: horizontal edge between (c, r) and (c + 1, r) is 2 * (r * cols + c); vertical between (c, r) and (c, r + 1) is
  // 2 * (r * cols + c) + 1.
  const hEdge = (c: number, r: number) => 2 * (r * cols + c);
  const vEdge = (c: number, r: number) => 2 * (r * cols + c) + 1;

  for (let r = 0; r + 1 < rows; r++) {
    for (let c = 0; c + 1 < cols; c++) {
      const v00 = sdf[r * cols + c]! - level;
      const v10 = sdf[r * cols + c + 1]! - level;
      const v11 = sdf[(r + 1) * cols + c + 1]! - level;
      const v01 = sdf[(r + 1) * cols + c]! - level;
      const a = v00 > 0;
      const b = v10 > 0;
      const cc = v11 > 0;
      const d = v01 > 0;
      if (a === b && b === cc && cc === d) continue;

      // Crossing points on the four edges (computed lazily).
      const top = () => ({ id: hEdge(c, r), x: px(c) + (v00 / (v00 - v10)) * cell, y: py(r) });
      const bottom = () => ({ id: hEdge(c, r + 1), x: px(c) + (v01 / (v01 - v11)) * cell, y: py(r + 1) });
      const left = () => ({ id: vEdge(c, r), x: px(c), y: py(r) + (v00 / (v00 - v01)) * cell });
      const right = () => ({ id: vEdge(c + 1, r), x: px(c + 1), y: py(r) + (v10 / (v10 - v11)) * cell });

      // Each cut isolates one corner; `inside` says whether that corner is inside the shape.
      const cuts: Array<{ p: ReturnType<typeof top>; q: ReturnType<typeof top>; corner: [number, number]; inside: boolean }> = [];
      const corner = { a: [px(c), py(r)], b: [px(c + 1), py(r)], c: [px(c + 1), py(r + 1)], d: [px(c), py(r + 1)] } as const;
      const centre = (v00 + v10 + v11 + v01) / 4 > 0;
      const caseIndex = (a ? 1 : 0) | (b ? 2 : 0) | (cc ? 4 : 0) | (d ? 8 : 0);
      switch (caseIndex) {
        case 1: case 14: cuts.push({ p: left(), q: top(), corner: [...corner.a], inside: a }); break;
        case 2: case 13: cuts.push({ p: top(), q: right(), corner: [...corner.b], inside: b }); break;
        case 4: case 11: cuts.push({ p: right(), q: bottom(), corner: [...corner.c], inside: cc }); break;
        case 8: case 7: cuts.push({ p: bottom(), q: left(), corner: [...corner.d], inside: d }); break;
        case 3: case 12: cuts.push({ p: left(), q: right(), corner: [...corner.a], inside: a }); break;
        case 6: case 9: cuts.push({ p: top(), q: bottom(), corner: [...corner.b], inside: b }); break;
        case 5: // a and c inside, b and d outside
          if (centre) {
            cuts.push({ p: top(), q: right(), corner: [...corner.b], inside: false }, { p: bottom(), q: left(), corner: [...corner.d], inside: false });
          } else {
            cuts.push({ p: left(), q: top(), corner: [...corner.a], inside: true }, { p: right(), q: bottom(), corner: [...corner.c], inside: true });
          }
          break;
        case 10: // b and d inside, a and c outside
          if (centre) {
            cuts.push({ p: left(), q: top(), corner: [...corner.a], inside: false }, { p: right(), q: bottom(), corner: [...corner.c], inside: false });
          } else {
            cuts.push({ p: top(), q: right(), corner: [...corner.b], inside: true }, { p: bottom(), q: left(), corner: [...corner.d], inside: true });
          }
          break;
      }

      for (const cut of cuts) {
        // Orient so the inside is on the left of the direction of travel.
        const mx = (cut.p.x + cut.q.x) / 2;
        const my = (cut.p.y + cut.q.y) / 2;
        const cross = (cut.q.x - cut.p.x) * (cut.corner[1] - my) - (cut.q.y - cut.p.y) * (cut.corner[0] - mx);
        const forward = cut.inside ? cross < 0 : cross > 0;
        const [s, t] = forward ? [cut.p, cut.q] : [cut.q, cut.p];
        segments.push({ from: s.id, to: t.id, ax: s.x, ay: s.y, bx: t.x, by: t.y });
      }
    }
  }

  // Chain the segments head to tail into closed loops. Saddles can give one edge two outgoing segments; the map keeps a list.
  const byStart = new Map<number, Segment[]>();
  for (const segment of segments) {
    const list = byStart.get(segment.from);
    if (list) list.push(segment);
    else byStart.set(segment.from, [segment]);
  }
  const used = new Set<Segment>();
  const loops: ContourLoop[] = [];
  for (const first of segments) {
    if (used.has(first)) continue;
    const points: PolylinePoint[] = [];
    let current: Segment | undefined = first;
    let guard = 0;
    while (current && !used.has(current) && guard++ < segments.length + 1) {
      used.add(current);
      points.push({ x: current.ax, y: current.ay });
      current = byStart.get(current.to)?.find((s) => !used.has(s));
    }
    if (points.length >= 3) {
      let length = 0;
      for (let i = 0; i < points.length; i++) {
        const p = points[i]!;
        const q = points[(i + 1) % points.length]!;
        length += Math.hypot(q.x - p.x, q.y - p.y);
      }
      loops.push({ points, length });
    }
  }
  // Longest first, then by position, so the output never depends on the scan order.
  return loops.sort((p, q) => q.length - p.length || p.points[0]!.y - q.points[0]!.y || p.points[0]!.x - q.points[0]!.x);
}

// ─── Simplifying and sampling ─────────────────────────────────────────────────

function perpendicularDistance(p: PolylinePoint, a: PolylinePoint, b: PolylinePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Ramer-Douglas-Peucker on an open run of points (keeps both ends). */
function simplifyRun(points: PolylinePoint[], tolerance: number): PolylinePoint[] {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [lo, hi] = stack.pop()!;
    let worst = -1;
    let worstDistance = tolerance;
    for (let i = lo + 1; i < hi; i++) {
      const d = perpendicularDistance(points[i]!, points[lo]!, points[hi]!);
      if (d > worstDistance) {
        worst = i;
        worstDistance = d;
      }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([lo, worst], [worst, hi]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

export interface SampleOptions {
  /** Distance between stones along the path (mm); the real spacing is at least this. */
  pitchMm: number;
  /** A turn sharper than this (degrees) is a corner and always gets a stone. Default 35. */
  cornerAngleDeg?: number;
  /** Simplification tolerance (mm). Default 0.12. */
  toleranceMm?: number;
}

function turnAngleDeg(p: PolylinePoint, v: PolylinePoint, q: PolylinePoint): number {
  const ax = v.x - p.x;
  const ay = v.y - p.y;
  const bx = q.x - v.x;
  const by = q.y - v.y;
  const a = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
  return Math.abs((a * 180) / Math.PI);
}

/**
 * Stones along a closed loop: one at every corner and evenly spaced between, never closer than `pitchMm` along the path.
 * A loop too short for three stones gives none (the caller fills what is left).
 */
export function sampleLoop(loop: ContourLoop, options: SampleOptions): PolylinePoint[] {
  const { pitchMm, cornerAngleDeg = 35, toleranceMm = 0.12 } = options;
  if (loop.length < pitchMm * 3) return [];

  // Start at the top-left point, so the result does not depend on where the contour tracer began.
  let start = 0;
  loop.points.forEach((p, i) => {
    const s = loop.points[start]!;
    if (p.y < s.y - 1e-9 || (Math.abs(p.y - s.y) <= 1e-9 && p.x < s.x)) start = i;
  });
  const ring = [...loop.points.slice(start), ...loop.points.slice(0, start)];

  // Corners from the simplified outline.
  const simple = simplifyRun([...ring, ring[0]!], toleranceMm);
  simple.pop();
  const cornerKeys = new Set<string>();
  const key = (p: PolylinePoint) => `${p.x}|${p.y}`;
  for (let i = 0; i < simple.length; i++) {
    const prev = simple[(i - 1 + simple.length) % simple.length]!;
    const next = simple[(i + 1) % simple.length]!;
    if (turnAngleDeg(prev, simple[i]!, next) > cornerAngleDeg) cornerKeys.add(key(simple[i]!));
  }
  const cornerIndices: number[] = [];
  ring.forEach((p, i) => {
    if (cornerKeys.has(key(p))) cornerIndices.push(i);
  });
  if (cornerIndices.length === 0) cornerIndices.push(0);

  // Cumulative length along the ring.
  const cumulative = [0];
  for (let i = 1; i <= ring.length; i++) {
    const p = ring[i - 1]!;
    const q = ring[i % ring.length]!;
    cumulative.push(cumulative[i - 1]! + Math.hypot(q.x - p.x, q.y - p.y));
  }
  const total = cumulative[ring.length]!;
  const at = (distance: number): PolylinePoint => {
    let lo = 0;
    let hi = ring.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (cumulative[mid + 1]! < distance) lo = mid + 1;
      else hi = mid;
    }
    const p = ring[lo]!;
    const q = ring[(lo + 1) % ring.length]!;
    const span = cumulative[lo + 1]! - cumulative[lo]!;
    const t = span === 0 ? 0 : (distance - cumulative[lo]!) / span;
    return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
  };

  const stones: PolylinePoint[] = [];
  for (let k = 0; k < cornerIndices.length; k++) {
    const from = cumulative[cornerIndices[k]!]!;
    const to = k + 1 < cornerIndices.length ? cumulative[cornerIndices[k + 1]!]! : total + cumulative[cornerIndices[0]!]!;
    const span = to - from;
    stones.push(at(from % total));
    const parts = Math.max(1, Math.floor(span / pitchMm));
    for (let j = 1; j < parts; j++) stones.push(at((from + (span * j) / parts) % total));
  }
  return stones;
}

/** The contour as a closed polyline, for drawing or for the quality tools. */
export function loopToPolyline(loop: ContourLoop): Polyline {
  return { points: loop.points, closed: true };
}
