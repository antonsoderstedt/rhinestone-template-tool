/**
 * Pure geometry helpers for the built-in starter templates (hearts, stars,
 * borders, …). All coordinates are millimetres. Output is deterministic: the
 * same input always yields the same points, rounded to 3 decimals.
 */

export interface StarterPoint {
  x: number;
  y: number;
}

const DECIMALS = 3;

function round(value: number): number {
  const factor = 10 ** DECIMALS;
  // `+ 0` normalises -0 to 0 so the output serialises identically everywhere.
  return Math.round(value * factor) / factor + 0;
}

function distance(a: StarterPoint, b: StarterPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Places points along a closed polygon, edge by edge. Every vertex gets a
 * point (so corners and star tips stay sharp) and each edge is divided into
 * equal steps close to `targetSpacingMm`.
 */
export function samplePolygonEdges(vertices: readonly StarterPoint[], targetSpacingMm: number): StarterPoint[] {
  if (vertices.length < 3) throw new Error('A polygon needs at least 3 vertices.');
  if (!(targetSpacingMm > 0)) throw new Error('targetSpacingMm must be greater than 0.');

  const points: StarterPoint[] = [];
  vertices.forEach((start, index) => {
    const end = vertices[(index + 1) % vertices.length]!;
    const steps = Math.max(1, Math.round(distance(start, end) / targetSpacingMm));
    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      points.push({ x: round(start.x + (end.x - start.x) * t), y: round(start.y + (end.y - start.y) * t) });
    }
  });
  return points;
}

/**
 * Places points at equal arc-length intervals along a closed curve given as a
 * dense polyline. The count is chosen so the loop closes with even spacing.
 */
export function sampleClosedCurve(curve: readonly StarterPoint[], targetSpacingMm: number): StarterPoint[] {
  if (curve.length < 3) throw new Error('A curve needs at least 3 points.');
  if (!(targetSpacingMm > 0)) throw new Error('targetSpacingMm must be greater than 0.');

  const cumulative: number[] = [0];
  for (let index = 1; index <= curve.length; index += 1) {
    cumulative.push(cumulative[index - 1]! + distance(curve[index - 1]!, curve[index % curve.length]!));
  }
  const perimeter = cumulative[cumulative.length - 1]!;
  const count = Math.max(3, Math.round(perimeter / targetSpacingMm));
  const step = perimeter / count;

  const points: StarterPoint[] = [];
  let segment = 0;
  for (let index = 0; index < count; index += 1) {
    const target = index * step;
    while (segment < curve.length - 1 && cumulative[segment + 1]! < target) segment += 1;
    const from = curve[segment]!;
    const to = curve[(segment + 1) % curve.length]!;
    const span = cumulative[segment + 1]! - cumulative[segment]!;
    const t = span === 0 ? 0 : (target - cumulative[segment]!) / span;
    points.push({ x: round(from.x + (to.x - from.x) * t), y: round(from.y + (to.y - from.y) * t) });
  }
  return points;
}

/** Smallest centre-to-centre distance between any two points (Infinity for < 2 points). */
export function minPairwiseDistance(points: readonly StarterPoint[]): number {
  let smallest = Number.POSITIVE_INFINITY;
  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      smallest = Math.min(smallest, distance(points[first]!, points[second]!));
    }
  }
  return smallest;
}

/**
 * Sharp corners and cusps bring neighbouring stones closer than their spacing
 * along the path. Widens the spacing in small, fixed steps until no two stones
 * are closer than `minCenterDistanceMm`. Deterministic.
 */
export function sampleWithMinCenterDistance(
  sample: (spacingMm: number) => StarterPoint[],
  startSpacingMm: number,
  minCenterDistanceMm: number,
  stepMm = 0.25,
): StarterPoint[] {
  let spacing = startSpacingMm;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const points = sample(spacing);
    if (minPairwiseDistance(points) >= minCenterDistanceMm) return points;
    spacing += stepMm;
  }
  throw new Error('Could not place stones without overlap; the shape is too small for this stone size.');
}

/** Translates points so the top-left of their bounding box sits at (offsetMm, offsetMm). */
export function moveToOrigin(points: readonly StarterPoint[], offsetMm: number): StarterPoint[] {
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  return points.map((point) => ({ x: round(point.x - minX + offsetMm), y: round(point.y - minY + offsetMm) }));
}

/** Heart outline, `widthMm` wide, as a dense closed polyline (y grows downwards). */
export function heartCurve(widthMm: number): StarterPoint[] {
  const samples = 720;
  const scale = widthMm / 32; // the classic heart curve spans 32 units horizontally
  const curve: StarterPoint[] = [];
  for (let index = 0; index < samples; index += 1) {
    const t = (index / samples) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    curve.push({ x: x * scale, y: -y * scale });
  }
  return curve;
}

/** Circle outline with the given diameter as a dense closed polyline. */
export function circleCurve(diameterMm: number): StarterPoint[] {
  const samples = 720;
  const radius = diameterMm / 2;
  return Array.from({ length: samples }, (_, index) => {
    const t = (index / samples) * Math.PI * 2;
    return { x: radius * Math.cos(t), y: radius * Math.sin(t) };
  });
}

/** Five-point star vertices (outer tips and inner corners alternate), tip pointing up. */
export function starVertices(outerRadiusMm: number, innerRatio = 0.5): StarterPoint[] {
  const vertices: StarterPoint[] = [];
  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outerRadiusMm : outerRadiusMm * innerRatio;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    vertices.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
  }
  return vertices;
}

export function rectangleVertices(widthMm: number, heightMm: number): StarterPoint[] {
  return [
    { x: 0, y: 0 },
    { x: widthMm, y: 0 },
    { x: widthMm, y: heightMm },
    { x: 0, y: heightMm },
  ];
}

export function diamondVertices(widthMm: number, heightMm: number): StarterPoint[] {
  return [
    { x: widthMm / 2, y: 0 },
    { x: widthMm, y: heightMm / 2 },
    { x: widthMm / 2, y: heightMm },
    { x: 0, y: heightMm / 2 },
  ];
}
