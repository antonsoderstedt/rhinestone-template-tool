import ClipperLib from 'clipper-lib';
import type { Polyline, PolylinePoint } from '../path/polyline';
import { roundMm } from '../geometry/rounding';
import type { PolygonBounds } from './polygonFill';
import { calculatePolygonBounds, pointInPolygon } from './polygonFill';

const CLIPPER_SCALE = 1000;

type ClipperPoint = { X: number; Y: number };
type ClipperPath = ClipperPoint[];

export interface ClosedLoop {
  points: PolylinePoint[];
  bounds: PolygonBounds;
  isHole: boolean;
}

function mmToClipper(value: number): number {
  return Math.round(value * CLIPPER_SCALE);
}

function clipperToMm(value: number): number {
  return roundMm(value / CLIPPER_SCALE, 4);
}

function signedArea(points: PolylinePoint[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const current = points[i]!;
    const next = points[(i + 1) % points.length]!;
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function stripClosingPoint(points: PolylinePoint[]): PolylinePoint[] {
  if (points.length < 2) return points;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (Math.abs(first.x - last.x) < 0.0001 && Math.abs(first.y - last.y) < 0.0001) {
    return points.slice(0, -1);
  }
  return points;
}

function toClosedLoop(points: PolylinePoint[]): ClosedLoop | null {
  const stripped = stripClosingPoint(points);
  if (stripped.length < 3) return null;
  return {
    points: stripped,
    bounds: calculatePolygonBounds(stripped),
    isHole: false,
  };
}

function clipperPathToClosedLoop(path: ClipperPath): ClosedLoop | null {
  const points = path.map((point) => ({ x: clipperToMm(point.X), y: clipperToMm(point.Y) }));
  return toClosedLoop(points);
}

function reverseIfNeeded(points: PolylinePoint[], clockwise: boolean): PolylinePoint[] {
  const area = signedArea(points);
  const isClockwise = area < 0;
  return isClockwise === clockwise ? points : [...points].reverse();
}

function loopReferencePoint(loop: ClosedLoop): PolylinePoint {
  const point = loop.points[0]!;
  return { x: point.x + 0.001, y: point.y + 0.001 };
}

function classifyLoopParity(loop: ClosedLoop, loops: readonly ClosedLoop[]): boolean {
  let containingCount = 0;
  const reference = loopReferencePoint(loop);
  for (const other of loops) {
    if (other === loop) continue;
    if (pointInPolygon(reference, other.points)) {
      containingCount += 1;
    }
  }
  return containingCount % 2 === 1;
}

export function normalizeClosedPolylines(polylines: readonly Polyline[]): ClosedLoop[] {
  const loops = polylines
    .filter((polyline) => polyline.closed)
    .map((polyline) => toClosedLoop(polyline.points))
    .filter((loop): loop is ClosedLoop => Boolean(loop));

  return loops.map((loop) => {
    const isHole = classifyLoopParity(loop, loops);
    return {
      ...loop,
      isHole,
      points: reverseIfNeeded(loop.points, isHole),
      bounds: calculatePolygonBounds(reverseIfNeeded(loop.points, isHole)),
    };
  });
}

export function offsetClosedLoops(loops: readonly ClosedLoop[], deltaMm: number): ClosedLoop[] {
  if (loops.length === 0) return [];
  const offsetter = new ClipperLib.ClipperOffset(2, 0.25 * CLIPPER_SCALE);
  const paths = loops.map((loop) => loop.points.map((point) => ({ X: mmToClipper(point.x), Y: mmToClipper(point.y) })));
  offsetter.AddPaths(paths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  const solution: ClipperPath[] = [];
  offsetter.Execute(solution, mmToClipper(deltaMm));
  const offsetLoops = solution.map(clipperPathToClosedLoop).filter((loop): loop is ClosedLoop => Boolean(loop));
  return normalizeClosedPolylines(offsetLoops.map((loop) => ({ points: loop.points, closed: true })));
}

export function pointInClosedLoops(point: PolylinePoint, loops: readonly ClosedLoop[]): boolean {
  let insideCount = 0;
  for (const loop of loops) {
    if (pointInPolygon(point, loop.points)) {
      insideCount += 1;
    }
  }
  return insideCount % 2 === 1;
}

export function pointToLoopEdgeDistance(point: PolylinePoint, loop: ClosedLoop): number {
  let minDistance = Infinity;
  const points = loop.points;
  for (let i = 0; i < points.length; i++) {
    const start = points[i]!;
    const end = points[(i + 1) % points.length]!;
    const abx = end.x - start.x;
    const aby = end.y - start.y;
    const len2 = abx * abx + aby * aby;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * abx + (point.y - start.y) * aby) / len2));
    const px = start.x + t * abx;
    const py = start.y + t * aby;
    minDistance = Math.min(minDistance, Math.hypot(point.x - px, point.y - py));
  }
  return minDistance;
}

export function pointHasEdgeClearance(point: PolylinePoint, loops: readonly ClosedLoop[], insetMm: number): boolean {
  return loops.every((loop) => pointToLoopEdgeDistance(point, loop) >= insetMm);
}

export function collectClosedLoopBounds(loops: readonly ClosedLoop[]): PolygonBounds {
  if (loops.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const loop of loops) {
    minX = Math.min(minX, loop.bounds.minX);
    minY = Math.min(minY, loop.bounds.minY);
    maxX = Math.max(maxX, loop.bounds.maxX);
    maxY = Math.max(maxY, loop.bounds.maxY);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function closedLoopsToPolylines(loops: readonly ClosedLoop[]): Polyline[] {
  return loops.map((loop) => ({ points: loop.points.map((point) => ({ ...point })), closed: true }));
}

export function sortLoopsDeterministically(loops: readonly ClosedLoop[]): ClosedLoop[] {
  return [...loops].sort((a, b) => {
    const areaDiff = Math.abs(signedArea(b.points)) - Math.abs(signedArea(a.points));
    if (Math.abs(areaDiff) > 0.0001) return areaDiff;
    if (Math.abs(a.bounds.minY - b.bounds.minY) > 0.0001) return a.bounds.minY - b.bounds.minY;
    return a.bounds.minX - b.bounds.minX;
  });
}
