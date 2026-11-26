import {
  DEFAULT_PATTERN_SETTINGS,
  type FoldKind,
  type EdgeSegment,
  type FoldLine,
  type Label,
  type Part,
  type Pattern,
  type PatternSettings,
  type PatternWarning,
  type Solid,
  type Tab,
  type Vec2,
} from '../types';
import { boundsOf, convexHull, convexOverlap, fitsInBox } from '../geometry/polygon';
import { dist2, dot3, sub3 } from '../geometry/vec';
import { unfold } from './unfold';

/** Mountain or valley (or flat) for the fold along an edge shared by two faces. */
export function foldKindOfEdge(solid: Solid, edgeId: number, printedSide: 'outside' | 'inside'): FoldKind {
  const edge = solid.edges[edgeId];
  const f1 = solid.faces[edge.faces[0]];
  const f2 = solid.faces[edge.faces[1]];
  const cos = Math.max(-1, Math.min(1, dot3(f1.normal, f2.normal)));
  if ((Math.acos(cos) * 180) / Math.PI < 0.5) return 'flat';
  const origin = solid.vertices[edge.a];
  let best = 0;
  for (const v of f2.vertices) {
    if (v === edge.a || v === edge.b) continue;
    const d = dot3(f1.normal, sub3(solid.vertices[v], origin));
    if (Math.abs(d) > Math.abs(best)) best = d;
  }
  const convex = best < 0;
  // Seen from the printed side, a convex corner (a ridge toward the viewer) is a mountain fold.
  return convex === (printedSide === 'outside') ? 'mountain' : 'valley';
}

const uprightAngle = (dx: number, dy: number): number => {
  let a = Math.atan2(dy, dx);
  if (Math.cos(a) < -1e-9) a += Math.PI;
  return a;
};

function polygonCentroid(points: readonly Vec2[]): Vec2 {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    const cr = p[0] * q[1] - q[0] * p[1];
    a += cr;
    cx += (p[0] + q[0]) * cr;
    cy += (p[1] + q[1]) * cr;
  }
  if (Math.abs(a) < 1e-12) return points[0];
  return [cx / (3 * a), cy / (3 * a)];
}

/**
 * The rules that order the edges when unfolding (`weightVariant` of `unfold`), best first. Different rules give different nets of the same
 * model and some leave room for every glue tab where others do not, so several are tried.
 */
export const UNFOLD_RULES = [0, 1, 7, 6, 8, 5, 9, 2, 4, 3, 10, 11] as const;

/** How many rules are worth trying for a model of this size (each is a full unfolding): a small model tries them all. */
export function rulesToTry(faceCount: number): number {
  return faceCount <= 150 ? UNFOLD_RULES.length : faceCount <= 500 ? 6 : faceCount <= 1500 ? 3 : 1;
}

/** Lower is better: a glue tab that cannot be made costs much more than an extra part; a very narrow tab costs about an extra part and a narrowed tab a little. */
export function patternScore(pattern: Pattern): number {
  const missing = pattern.warnings.find((w) => w.code === 'tab-missing')?.count ?? 0;
  const narrowed = pattern.warnings.find((w) => w.code === 'tab-narrowed')?.count ?? 0;
  const veryNarrow = pattern.warnings.find((w) => w.code === 'tab-very-narrow')?.count ?? 0;
  return 10 * missing + 3 * veryNarrow + 2 * (pattern.stats.partCount - 1) + 0.5 * narrowed;
}

/**
 * Builds the printable/cuttable pattern: unfolds the solid, then adds glue tabs, edge numbers, fold lines (mountain,
 * valley) and cut outlines to every part. Several rules for ordering the edges are tried (for a small enough model) and the pattern with
 * the fewest missing tabs, then the fewest parts, is kept. With edges cut or joined by hand, the rule that won without them is used, so the
 * net does not jump about while it is being edited; a rule given in `weightVariant` is used as it is.
 */
export function buildPattern(solid: Solid, userSettings: Partial<PatternSettings> = {}): Pattern {
  const edited = (userSettings.forceCutEdges?.length ?? 0) + (userSettings.forceJoinEdges?.length ?? 0) > 0;
  if (userSettings.weightVariant !== undefined) return buildPatternWithRule(solid, userSettings);
  if (edited) {
    // The edits are made on the net that was shown without them: the same rule, so the net does not jump about.
    const shown = buildPattern(solid, { ...userSettings, forceCutEdges: [], forceJoinEdges: [] });
    return buildPatternWithRule(solid, { ...userSettings, weightVariant: shown.rule });
  }
  let best: Pattern | null = null;
  let bestScore = Infinity;
  for (const rule of UNFOLD_RULES.slice(0, rulesToTry(solid.faces.length))) {
    const pattern = buildPatternWithRule(solid, { ...userSettings, weightVariant: rule });
    const score = patternScore(pattern);
    if (score < bestScore - 1e-9) {
      best = pattern;
      bestScore = score;
    }
    // A perfect net (one part, every tab full width): nothing can be better.
    if (bestScore <= 1e-9) break;
  }
  return best!;
}

/** One unfolding by one rule, with its tabs, numbers and lines. */
export function buildPatternWithRule(solid: Solid, userSettings: Partial<PatternSettings> = {}): Pattern {
  const settings: PatternSettings = { ...DEFAULT_PATTERN_SETTINGS, ...userSettings };
  const warnings: PatternWarning[] = [];
  const maxFaces = settings.maxPartSize
    ? {
        widthMm: Math.max(1, settings.maxPartSize.widthMm - 2 * settings.tabWidthMm),
        heightMm: Math.max(1, settings.maxPartSize.heightMm - 2 * settings.tabWidthMm),
      }
    : undefined;
  const result = unfold(solid, { maxPartSize: maxFaces, forceCutEdges: settings.forceCutEdges, forceJoinEdges: settings.forceJoinEdges, weightVariant: settings.weightVariant });
  if (result.rejectedForcedJoins.length > 0) {
    warnings.push({ code: 'forced-join-overlaps', count: result.rejectedForcedJoins.length, message: `${result.rejectedForcedJoins.length} joins you asked for were not made because the part would overlap itself or be too big.` });
  }
  if (result.nonManifoldEdges.length > 0) {
    warnings.push({ code: 'non-manifold-edge-cut', count: result.nonManifoldEdges.length, message: `${result.nonManifoldEdges.length} edges shared by more than two faces are cut.` });
  }
  const nonManifold = new Set(result.nonManifoldEdges);

  // Edge numbers: every cut edge with two faces, in part order, gets one number shared by both sides.
  const pairNumber = new Map<number, number>();
  for (const island of result.islands) {
    for (const f of island) {
      for (const e of solid.faces[f].edgeIds) {
        if (result.joined.has(e) || nonManifold.has(e) || solid.edges[e].faces.length !== 2 || pairNumber.has(e)) continue;
        pairNumber.set(e, pairNumber.size + 1);
      }
    }
  }

  // Side angles to try, from the chosen one down to sharper ones (a tab in a narrow gap between faces needs sharper sides).
  const baseAngle = Math.min(89.9, Math.max(10, settings.tabAngleDeg));
  const tabAngles = [...new Set([baseAngle, 30, 20, 12].filter((a) => a <= baseAngle + 1e-9))].map((a) => Math.tan((a * Math.PI) / 180));
  // The last resort: a triangle that comes to a point in the middle of the edge (0 stands for it below).
  tabAngles.push(0);
  const veryNarrowMm = Math.max(1.2, settings.minTabWidthMm * 0.4);
  const tabsByFace = new Map<number, Tab[]>();
  let tabMissing = 0;
  const missingTabEdgeIds: number[] = [];
  let tabNarrowed = 0;
  let tabVeryNarrow = 0;

  // Obstacles (face triangles and placed tabs) per part, for tab fitting.
  const obstacles: Vec2[][][] = result.islands.map((island) =>
    island.flatMap((f) => result.triangles[f].map((t) => t.map((i) => result.placed[f][i]))),
  );
  const tabsInIsland = result.islands.map(() => 0);

  const tryTab = (faceId: number, k: number, island: number): { points: Vec2[]; width: number } | null => {
    const pts = result.placed[faceId];
    const P = pts[k];
    const Q = pts[(k + 1) % pts.length];
    const L = dist2(P, Q);
    if (L < 1e-6) return null;
    const d: Vec2 = [(Q[0] - P[0]) / L, (Q[1] - P[1]) / L];
    const o: Vec2 = [d[1], -d[0]];
    // Down to a very narrow tab (a thin line of glue) before giving up on the edge.
    for (let w = settings.tabWidthMm; w >= veryNarrowMm - 1e-9; w *= 0.75) {
      for (const tan of tabAngles) {
        const inset = tan === 0 ? 0.49 * L : Math.min(w / tan, 0.4 * L);
        const p1: Vec2 = [P[0] + o[0] * w + d[0] * inset, P[1] + o[1] * w + d[1] * inset];
        const q1: Vec2 = [Q[0] + o[0] * w - d[0] * inset, Q[1] + o[1] * w - d[1] * inset];
        const quad: Vec2[] = [P, Q, q1, p1];
        const tris: Vec2[][] = [[P, Q, q1], [P, q1, p1]];
        const b = boundsOf(quad);
        const hit = obstacles[island].some((ob) => {
          const ob2 = boundsOf(ob);
          if (ob2.maxX < b.minX + 1e-4 || b.maxX < ob2.minX + 1e-4 || ob2.maxY < b.minY + 1e-4 || b.maxY < ob2.minY + 1e-4) return false;
          return tris.some((t) => convexOverlap(t, ob));
        });
        if (!hit) return { points: quad, width: w };
      }
    }
    return null;
  };

  // Every glued pair, with the two places its tab could go.
  interface Side {
    face: number;
    k: number;
    island: number;
  }
  const pairs: { eid: number; number: number; sides: [Side, Side] }[] = [];
  result.islands.forEach((island, pi) => {
    for (const f of island) {
      solid.faces[f].edgeIds.forEach((eid, k) => {
        const number = pairNumber.get(eid);
        if (number === undefined) return;
        const edge = solid.edges[eid];
        const other = edge.faces[0] === f ? edge.faces[1] : edge.faces[0];
        // The pair is handled once, from its lower face.
        if (other < f) return;
        pairs.push({
          eid,
          number,
          sides: [
            { face: f, k, island: pi },
            { face: other, k: solid.faces[other].edgeIds.indexOf(eid), island: result.islandOf[other] },
          ],
        });
      });
    }
  });

  // The tightest places first: an edge with little room gets it before the roomy ones fill it up. How much room an edge has is
  // measured with the faces only, before any tab is placed (-1: no room at all).
  const room = new Map<number, number>();
  for (const pair of pairs) room.set(pair.eid, Math.max(...pair.sides.map((side) => tryTab(side.face, side.k, side.island)?.width ?? -1)));
  pairs.sort((a, b) => room.get(a.eid)! - room.get(b.eid)! || a.number - b.number);

  for (const pair of pairs) {
    const sides = [...pair.sides].sort((a, b) => tabsInIsland[a.island] - tabsInIsland[b.island] || a.face - b.face);
    let chosen: { side: Side; tab: { points: Vec2[]; width: number } } | null = null;
    for (const side of sides) {
      const tab = tryTab(side.face, side.k, side.island);
      if (tab && (!chosen || tab.width > chosen.tab.width + 1e-9)) chosen = { side, tab };
      if (tab && tab.width >= settings.tabWidthMm - 1e-9) break;
    }
    if (!chosen) {
      tabMissing++;
      missingTabEdgeIds.push(pair.eid);
      continue;
    }
    if (chosen.tab.width < settings.minTabWidthMm - 1e-9) tabVeryNarrow++;
    else if (chosen.tab.width < settings.tabWidthMm - 1e-9) tabNarrowed++;
    const [P, Q, q1, p1] = chosen.tab.points;
    obstacles[chosen.side.island].push([P, Q, q1], [P, q1, p1]);
    tabsInIsland[chosen.side.island]++;
    const list = tabsByFace.get(chosen.side.face) ?? [];
    list.push({ edgeNumber: pair.number, edgeId: pair.eid, faceId: chosen.side.face, points: chosen.tab.points, widthMm: chosen.tab.width });
    tabsByFace.set(chosen.side.face, list);
  }
  const rawParts = result.islands;
  if (tabMissing > 0) warnings.push({ code: 'tab-missing', count: tabMissing, message: `${tabMissing} edges have no room for a glue tab. Glue those edges edge to edge.` });
  if (tabVeryNarrow > 0) warnings.push({ code: 'tab-very-narrow', count: tabVeryNarrow, message: `${tabVeryNarrow} glue tabs are under ${settings.minTabWidthMm} mm wide: there is little room there. Use a thin line of glue.` });
  if (tabNarrowed > 0) warnings.push({ code: 'tab-narrowed', count: tabNarrowed, message: `${tabNarrowed} glue tabs are narrower than asked to fit.` });

  const parts: Part[] = rawParts.map((island, pi) => {
    const faces = island.map((f) => ({ faceId: f, points: result.placed[f] }));
    const tabs: Tab[] = island.flatMap((f) => tabsByFace.get(f) ?? []);
    const tabOfEdge = new Map<number, Tab>();
    for (const t of tabs) tabOfEdge.set(t.edgeId, t);

    const foldLines: FoldLine[] = [];
    const labels: Label[] = [];
    const edgeSegments: EdgeSegment[] = [];
    const segments: Vec2[][] = [];

    for (const f of island) {
      const face = solid.faces[f];
      const pts = result.placed[f];
      face.edgeIds.forEach((eid, k) => {
        const P = pts[k];
        const Q = pts[(k + 1) % pts.length];
        if (result.joined.has(eid)) {
          if (solid.edges[eid].faces[0] === f) {
            foldLines.push({ a: P, b: Q, kind: foldKindOfEdge(solid, eid, settings.printedSide) });
            edgeSegments.push({ edgeId: eid, a: P, b: Q, state: 'joined' });
          }
          return;
        }
        edgeSegments.push({ edgeId: eid, a: P, b: Q, state: pairNumber.has(eid) ? 'cut' : 'open', number: pairNumber.get(eid) });
        const tab = tabOfEdge.get(eid);
        if (tab && tab.faceId === f) {
          const [, , q1, p1] = tab.points;
          segments.push([P, p1, q1, Q]);
          foldLines.push({ a: P, b: Q, kind: 'tab' });
        } else {
          segments.push([P, Q]);
        }
      });
    }

    // Edge numbers: on the tab when it is wide enough to hold them, otherwise on the faces.
    const h = settings.numberHeightMm;
    const placeLabel = (text: string, c: Vec2, dir: Vec2) => {
      labels.push({ text, x: c[0], y: c[1], angle: uprightAngle(dir[0], dir[1]), height: h, role: 'edge' });
    };
    for (const f of island) {
      const face = solid.faces[f];
      const pts = result.placed[f];
      face.edgeIds.forEach((eid, k) => {
        const number = pairNumber.get(eid);
        if (number === undefined) return;
        const P = pts[k];
        const Q = pts[(k + 1) % pts.length];
        const L = dist2(P, Q);
        if (L < 1e-6) return;
        const d: Vec2 = [(Q[0] - P[0]) / L, (Q[1] - P[1]) / L];
        const inward: Vec2 = [-d[1], d[0]];
        const tab = tabOfEdge.get(eid);
        if (tab && tab.faceId === f) {
          if (tab.widthMm >= h * 1.4) {
            const c = polygonCentroid(tab.points);
            placeLabel(String(number), c, d);
            return;
          }
        }
        const off = h * 0.9 + 0.4;
        placeLabel(String(number), [(P[0] + Q[0]) / 2 + inward[0] * off, (P[1] + Q[1]) / 2 + inward[1] * off], d);
      });
    }

    if (settings.partLabels) {
      const biggest = [...island].sort((a, b) => solid.faces[b].area - solid.faces[a].area || a - b)[0];
      if (solid.faces[biggest].area > (3 * h) ** 2) {
        const c = polygonCentroid(result.placed[biggest]);
        labels.push({ text: String(pi + 1), x: c[0], y: c[1], angle: 0, height: h * 1.6, role: 'part' });
      }
    }

    // Chain the cut segments into closed outlines.
    const cutPaths = chainSegments(segments);

    const allPoints: Vec2[] = [...faces.flatMap((fc) => fc.points), ...tabs.flatMap((t) => t.points)];
    const b = boundsOf(allPoints);
    const shift = (p: Vec2): Vec2 => [p[0] - b.minX, p[1] - b.minY];
    const shifted = {
      faces: faces.map((fc) => ({ faceId: fc.faceId, points: fc.points.map(shift) })),
      tabs: tabs.map((t) => ({ ...t, points: t.points.map(shift) })),
      cutPaths: cutPaths.map((c) => ({ closed: c.closed, points: c.points.map(shift) })),
      foldLines: foldLines.map((l) => ({ ...l, a: shift(l.a), b: shift(l.b) })),
      labels: labels.map((l) => ({ ...l, x: l.x - b.minX, y: l.y - b.minY })),
      edgeSegments: edgeSegments.map((e) => ({ ...e, a: shift(e.a), b: shift(e.b) })),
    };
    const hull = convexHull(allPoints.map(shift));
    const faceArea = island.reduce((s, f) => s + solid.faces[f].area, 0);
    return {
      id: pi + 1,
      ...shifted,
      hull,
      widthMm: b.maxX - b.minX,
      heightMm: b.maxY - b.minY,
      areaMm2: faceArea,
    };
  });

  if (settings.maxPartSize) {
    const tooLarge = parts.filter((p) => !fitsInBox(p.hull, settings.maxPartSize!.widthMm, settings.maxPartSize!.heightMm)).length;
    if (tooLarge > 0) warnings.push({ code: 'part-too-large', count: tooLarge, message: `${tooLarge} parts are bigger than the page even after splitting. Make the model smaller or the page bigger.` });
  }

  return {
    rule: settings.weightVariant ?? 0,
    missingTabEdgeIds: missingTabEdgeIds.sort((a, b) => a - b),
    parts,
    joinedEdgeIds: [...result.joined].sort((a, b) => a - b),
    edgePairCount: pairNumber.size,
    warnings,
    stats: {
      partCount: parts.length,
      faceCount: solid.faces.length,
      surfaceAreaMm2: solid.faces.reduce((s, f) => s + f.area, 0),
      tabCount: parts.reduce((s, p) => s + p.tabs.length, 0),
      foldCount: result.joined.size,
    },
  };
}

/** Joins directed segments (polylines) end to start into outlines. */
function chainSegments(segments: Vec2[][]): { points: Vec2[]; closed: boolean }[] {
  const eps = 1e-3;
  const unused = segments.map((s) => [...s]);
  const out: { points: Vec2[]; closed: boolean }[] = [];
  while (unused.length > 0) {
    const first = unused.shift()!;
    const chain = [...first];
    for (;;) {
      const end = chain[chain.length - 1];
      if (chain.length > 2 && dist2(end, chain[0]) < eps) break;
      const idx = unused.findIndex((s) => dist2(s[0], end) < eps);
      if (idx < 0) break;
      const [next] = unused.splice(idx, 1);
      chain.push(...next.slice(1));
    }
    const closed = chain.length > 2 && dist2(chain[chain.length - 1], chain[0]) < eps;
    if (closed) chain.pop();
    out.push({ points: chain, closed });
  }
  return out;
}
