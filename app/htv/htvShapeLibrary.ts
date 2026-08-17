/**
 * Basic shapes library for HTV Studio — parametric vector shapes (analogous
 * to Cricut Design Space's "Shapes" panel) that drop onto the canvas as
 * ordinary HtvVectorLayer geometry. Pure geometry generation, no state.
 */

import type { Polyline, PolylinePoint } from '@/src/lib/rhinestone-engine/index';
import { centerPolylines } from './htvGeometry';

export type HtvShapeId =
  | 'circle'
  | 'oval'
  | 'square'
  | 'rectangle'
  | 'triangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'octagon'
  | 'star'
  | 'heart'
  | 'cross';

export const HTV_SHAPES: readonly { id: HtvShapeId; displayName: string }[] = [
  { id: 'circle', displayName: 'Circle' },
  { id: 'oval', displayName: 'Oval' },
  { id: 'square', displayName: 'Square' },
  { id: 'rectangle', displayName: 'Rectangle' },
  { id: 'triangle', displayName: 'Triangle' },
  { id: 'diamond', displayName: 'Diamond' },
  { id: 'pentagon', displayName: 'Pentagon' },
  { id: 'hexagon', displayName: 'Hexagon' },
  { id: 'octagon', displayName: 'Octagon' },
  { id: 'star', displayName: 'Star' },
  { id: 'heart', displayName: 'Heart' },
  { id: 'cross', displayName: 'Cross' },
];

const SHAPE_SIZE_MM = 40;

function regularPolygonPoints(sides: number, radius: number, rotationDeg: number): PolylinePoint[] {
  const rotationRad = (rotationDeg * Math.PI) / 180;
  return Array.from({ length: sides }, (_, i) => {
    const angle = rotationRad + (i / sides) * Math.PI * 2;
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  });
}

function starPoints(spikes: number, outerRadius: number, innerRadius: number, rotationDeg: number): PolylinePoint[] {
  const rotationRad = (rotationDeg * Math.PI) / 180;
  const step = Math.PI / spikes;
  return Array.from({ length: spikes * 2 }, (_, i) => {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = rotationRad + i * step;
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  });
}

/** Parametric heart curve, sampled into a closed polygon. */
function heartPoints(radius: number, steps = 64): PolylinePoint[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = (i / steps) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    return { x: (x / 16) * radius, y: (y / 17) * radius };
  });
}

function crossPolylinePoints(radius: number): PolylinePoint[] {
  const arm = radius * 0.36;
  const outer = radius;
  return [
    { x: -arm, y: -outer }, { x: arm, y: -outer }, { x: arm, y: -arm },
    { x: outer, y: -arm }, { x: outer, y: arm }, { x: arm, y: arm },
    { x: arm, y: outer }, { x: -arm, y: outer }, { x: -arm, y: arm },
    { x: -outer, y: arm }, { x: -outer, y: -arm }, { x: -arm, y: -arm },
  ];
}

function shapePoints(shapeId: HtvShapeId, r: number): PolylinePoint[] {
  switch (shapeId) {
    case 'circle':
      return regularPolygonPoints(64, r, 0);
    case 'oval':
      return regularPolygonPoints(64, r, 0).map((p) => ({ x: p.x * 1.5, y: p.y * 0.85 }));
    case 'square':
      return [{ x: -r, y: -r }, { x: r, y: -r }, { x: r, y: r }, { x: -r, y: r }];
    case 'rectangle':
      return [{ x: -r * 1.4, y: -r * 0.75 }, { x: r * 1.4, y: -r * 0.75 }, { x: r * 1.4, y: r * 0.75 }, { x: -r * 1.4, y: r * 0.75 }];
    case 'triangle':
      return regularPolygonPoints(3, r, -90);
    case 'diamond':
      return regularPolygonPoints(4, r, -90);
    case 'pentagon':
      return regularPolygonPoints(5, r, -90);
    case 'hexagon':
      return regularPolygonPoints(6, r, -90);
    case 'octagon':
      return regularPolygonPoints(8, r, -90 + 22.5);
    case 'star':
      return starPoints(5, r, r * 0.42, -90);
    case 'heart':
      return heartPoints(r);
    case 'cross':
      return crossPolylinePoints(r);
    default:
      return regularPolygonPoints(64, r, 0);
  }
}

export function createShapePolylines(shapeId: HtvShapeId): { polylines: Polyline[]; widthMm: number; heightMm: number } {
  const raw: Polyline[] = [{ points: shapePoints(shapeId, SHAPE_SIZE_MM / 2), closed: true }];
  return centerPolylines(raw);
}

export function getShapeDisplayName(shapeId: HtvShapeId): string {
  return HTV_SHAPES.find((s) => s.id === shapeId)?.displayName ?? shapeId;
}
