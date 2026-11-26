import type { BuildStep } from '../types';

/**
 * The order to build a model in. A part is glued to the parts built before it along the edges that carry the same number; the order starts with the part that is glued to the most
 * others (the base) and then always takes the part with the most glued edges to what is built already, so every step is a part that has something to be glued to. Parts that are
 * not glued to the rest (a separate piece) start again with the biggest one left. Pure and deterministic: ties go to the bigger part, then the lower number.
 *
 * `pairs` are the glued edge pairs: the number printed on both edges, and the two parts the edges are on (the same part for a seam within a part).
 */
export function buildOrderOf(parts: readonly { id: number; areaMm2: number }[], pairs: readonly { number: number; a: number; b: number }[]): BuildStep[] {
  const area = new Map(parts.map((p) => [p.id, p.areaMm2]));
  const seams = new Map<number, number[]>();
  const between = new Map<string, number[]>();
  const degree = new Map<number, Set<number>>();
  for (const p of parts) {
    seams.set(p.id, []);
    degree.set(p.id, new Set());
  }
  for (const pair of pairs) {
    if (!area.has(pair.a) || !area.has(pair.b)) continue;
    if (pair.a === pair.b) {
      seams.get(pair.a)!.push(pair.number);
      continue;
    }
    for (const [x, y] of [[pair.a, pair.b], [pair.b, pair.a]]) {
      const key = `${x}:${y}`;
      const list = between.get(key);
      if (list) list.push(pair.number);
      else between.set(key, [pair.number]);
      degree.get(x)!.add(y);
    }
  }
  const remaining = new Set(parts.map((p) => p.id));
  const built = new Set<number>();
  const order: BuildStep[] = [];
  const edgesTo = (id: number) => {
    let n = 0;
    for (const b of built) n += between.get(`${id}:${b}`)?.length ?? 0;
    return n;
  };
  while (remaining.size > 0) {
    let best = -1;
    let bestKey: [number, number, number] = [-1, -1, -1];
    for (const id of [...remaining].sort((x, y) => x - y)) {
      const key: [number, number, number] = built.size === 0 ? [degree.get(id)!.size, area.get(id)!, 0] : [edgesTo(id), area.get(id)!, 0];
      // With nothing glued to what is built, the part is the start of a separate piece: the biggest goes first.
      const effective: [number, number, number] = built.size > 0 && key[0] === 0 ? [0, area.get(id)!, 0] : key;
      if (best < 0 || effective[0] > bestKey[0] || (effective[0] === bestKey[0] && effective[1] > bestKey[1] + 1e-9)) {
        best = id;
        bestKey = effective;
      }
    }
    const joins: BuildStep['joins'] = [];
    for (const other of [...built].sort((x, y) => x - y)) {
      const edges = between.get(`${best}:${other}`);
      if (edges?.length) joins.push({ partId: other, edges: [...edges].sort((x, y) => x - y) });
    }
    order.push({ step: order.length + 1, partId: best, seams: [...seams.get(best)!].sort((x, y) => x - y), joins });
    built.add(best);
    remaining.delete(best);
  }
  return order;
}
