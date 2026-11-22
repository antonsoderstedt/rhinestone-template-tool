/**
 * A design made of several parts.
 *
 * The tool on screen produces one piece at a time (a name, a number, a logo). "Add to design" keeps that piece as a part:
 * its stones are frozen and it can be moved and removed on its own, while the tool goes on to make the next piece. The
 * design that is exported, estimated and checked is every part plus the piece being worked on.
 *
 * Pure functions on plain data. Lengths in millimetres.
 */

import type { RhinestoneTemplate, Stone } from '@/src/lib/rhinestone-engine/index';

export interface DesignPart {
  id: string;
  name: string;
  /** Where the part is: the stones' own coordinates plus this offset. */
  offsetX: number;
  offsetY: number;
  /** The part's stones as they were when it was added (before the offset). */
  stones: Stone[];
}

export interface Point2 {
  x: number;
  y: number;
}

export const PART_ID_PREFIX = 'part';

export function translateStones<T extends { center: { x: number; y: number } }>(stones: readonly T[], dx: number, dy: number): T[] {
  if (dx === 0 && dy === 0) return stones.map((stone) => ({ ...stone, center: { ...stone.center } }));
  return stones.map((stone) => ({ ...stone, center: { x: round(stone.center.x + dx), y: round(stone.center.y + dy) } }));
}

/** A template moved by (dx, dy), cut shapes included. A new object; the input is left alone. */
export function translateTemplate(template: RhinestoneTemplate, dx: number, dy: number): RhinestoneTemplate {
  if (dx === 0 && dy === 0) return template;
  return {
    ...template,
    stones: translateStones(template.stones, dx, dy),
    cutShapes: template.cutShapes?.map((shape) => ({ ...shape, x: round(shape.x + dx), y: round(shape.y + dy) })),
  };
}

const round = (value: number) => Math.round(value * 1e4) / 1e4;

/** The stones of a part where they are shown: offset applied, ids made unique to the part, tagged with its id. */
export function placedPartStones(part: DesignPart): Stone[] {
  return part.stones.map((stone) => ({
    ...stone,
    id: `${part.id}:${stone.id}`,
    center: { x: round(stone.center.x + part.offsetX), y: round(stone.center.y + part.offsetY) },
    metadata: { ...stone.metadata, partId: part.id },
  }));
}

export function partsStones(parts: readonly DesignPart[]): Stone[] {
  return parts.flatMap(placedPartStones);
}

/** The whole design: the piece being worked on (`working`, already in place) with every part added. */
export function composeDesign(working: RhinestoneTemplate | null, parts: readonly DesignPart[], name: string): RhinestoneTemplate | null {
  if (parts.length === 0) return working;
  const base: RhinestoneTemplate = working ?? { id: 'composed-design', name, unit: 'mm', stones: [] };
  return { ...base, name, stones: [...base.stones, ...partsStones(parts)] };
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundsOfStones(stones: readonly Stone[]): Bounds | null {
  if (stones.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stone of stones) {
    const r = stone.holeDiameterMm / 2;
    minX = Math.min(minX, stone.center.x - r);
    minY = Math.min(minY, stone.center.y - r);
    maxX = Math.max(maxX, stone.center.x + r);
    maxY = Math.max(maxY, stone.center.y + r);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Where the next piece goes so that it does not land on what is already there: directly below the parts, left edges
 * aligned, with a gap. `working` is the piece that was just kept (it becomes a part), so the next one starts below it.
 */
export function offsetBelow(existing: readonly Stone[], nextTop: number, nextLeft: number, gapMm = 10): Point2 {
  const bounds = boundsOfStones(existing);
  if (!bounds) return { x: 0, y: 0 };
  return { x: round(bounds.minX - nextLeft), y: round(bounds.maxY + gapMm - nextTop) };
}

let counter = 0;
/** A part id that does not collide with the ones already in use. */
export function nextPartId(parts: readonly DesignPart[]): string {
  const used = new Set(parts.map((part) => part.id));
  let id: string;
  do {
    counter += 1;
    id = `${PART_ID_PREFIX}-${counter}`;
  } while (used.has(id));
  return id;
}

export type PartTransform = 'rotate-cw' | 'rotate-ccw' | 'flip-horizontal' | 'flip-vertical';

/**
 * Rotates a quarter turn or mirrors the stones about the middle of their bounding box, so the part stays where it is.
 * Stones are round, so nothing else changes: sizes and spacing are exactly as before.
 */
export function transformStones(stones: readonly Stone[], op: PartTransform): Stone[] {
  const bounds = boundsOfStones(stones);
  if (!bounds) return [];
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  return stones.map((stone) => {
    const dx = stone.center.x - cx;
    const dy = stone.center.y - cy;
    let x = dx;
    let y = dy;
    switch (op) {
      case 'rotate-cw': x = -dy; y = dx; break;
      case 'rotate-ccw': x = dy; y = -dx; break;
      case 'flip-horizontal': x = -dx; break;
      case 'flip-vertical': y = -dy; break;
    }
    return { ...stone, center: { x: round(cx + x), y: round(cy + y) } };
  });
}
