/**
 * Image → vector silhouette tracing.
 *
 * Converts a raster image into closed vector contours (a "silhouette") via
 * marching squares over a thresholded luminance mask, followed by tiny-blob
 * filtering and Ramer-Douglas-Peucker smoothing. Used by the HTV Studio's
 * "convert image to silhouette" tool — the output is a clean cut-ready
 * outline, not a raster trace embedded in the export.
 *
 * Pure, deterministic, mm-based (per engine convention) — no DOM, no
 * canvas, no randomness. Callers decode the source image into raw RGBA
 * pixel data themselves (see `decodeRasterImageDataUrl` in the image module)
 * and pass it in.
 */

import type { Polyline, PolylinePoint } from '../path/polyline';
import { simplifyPolyline } from '../path/polylineCleanup';
import { roundMm } from '../geometry/rounding';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TraceableImageData {
  widthPx: number;
  heightPx: number;
  rgba: ArrayLike<number>;
}

export interface ImageTraceOptions {
  image: TraceableImageData;
  /** Luminance cutoff (0-255). Pixels at or below this are "inside" (foreground) unless `invert`. */
  threshold: number;
  /** When true, pixels at or above the threshold are "inside" instead. Default: false. */
  invert?: boolean;
  targetWidthMm?: number;
  targetHeightMm?: number;
  /** Default: true. */
  preserveAspectRatio?: boolean;
  /**
   * Minimum enclosed area (mm²) for a contour loop to be kept — filters
   * small specks of noise. Default: 1.
   */
  minAreaMm2?: number;
  /**
   * Ramer-Douglas-Peucker tolerance (mm) applied to every contour for
   * smoothing — larger values round off the blocky marching-squares edges
   * more aggressively. Default: 0.35.
   */
  smoothingToleranceMm?: number;
}

export interface ImageTraceResult {
  /** Closed silhouette contours, in mm. Outer boundaries and holes are both present as separate loops — use `signedPolygonArea` (positive = outer winding) to tell them apart if needed. */
  polylines: Polyline[];
  widthMm: number;
  heightMm: number;
  warnings: string[];
}

// ─── Pixel sampling ───────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Luminance of pixel (x,y), alpha-composited against a white background — matches the rhinestone raster-artwork tool's convention so both tools threshold identically. */
function luminanceAt(image: TraceableImageData, x: number, y: number): number {
  const offset = (y * image.widthPx + x) * 4;
  const alpha = clamp(image.rgba[offset + 3] ?? 255, 0, 255) / 255;
  const r = 255 - (255 - (image.rgba[offset] ?? 255)) * alpha;
  const g = 255 - (255 - (image.rgba[offset + 1] ?? 255)) * alpha;
  const b = 255 - (255 - (image.rgba[offset + 2] ?? 255)) * alpha;
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function buildMask(image: TraceableImageData, threshold: number, invert: boolean): Uint8Array {
  const mask = new Uint8Array(image.widthPx * image.heightPx);
  for (let y = 0; y < image.heightPx; y++) {
    for (let x = 0; x < image.widthPx; x++) {
      const luminance = luminanceAt(image, x, y);
      const active = invert ? luminance >= threshold : luminance <= threshold;
      mask[y * image.widthPx + x] = active ? 1 : 0;
    }
  }
  return mask;
}

// ─── Marching squares ─────────────────────────────────────────────────────────

interface GridPoint {
  x: number;
  y: number;
}

type EdgeLabel = 'T' | 'R' | 'B' | 'L';

/**
 * Directed segment table for binary marching squares, keyed by
 * `TL*8 + TR*4 + BR*2 + BL*1`. Each pair is `[from, to]`, oriented so that
 * walking the cell corners clockwise (TL→TR→BR→BL→TL) — a 0→1 transition
 * is where the contour "enters" a cell edge, 1→0 is where it "exits" —
 * gives every traced loop a consistent winding direction. This is what
 * makes an outer boundary and a hole inside it come out with opposite
 * signed area: the "inside" region is always on the same side of travel.
 * Cases 5 and 10 are the ambiguous saddle points (diagonal corners share a
 * value) — resolved by pairing each diagonal corner with its own enter/exit
 * edges, a standard fixed convention.
 */
const CASE_EDGES: readonly (readonly [EdgeLabel, EdgeLabel])[][] = [
  /* 0 */ [],
  /* 1 */ [['B', 'L']],
  /* 2 */ [['R', 'B']],
  /* 3 */ [['R', 'L']],
  /* 4 */ [['T', 'R']],
  /* 5 */ [['T', 'R'], ['B', 'L']],
  /* 6 */ [['T', 'B']],
  /* 7 */ [['T', 'L']],
  /* 8 */ [['L', 'T']],
  /* 9 */ [['B', 'T']],
  /* 10 */ [['L', 'T'], ['R', 'B']],
  /* 11 */ [['R', 'T']],
  /* 12 */ [['L', 'R']],
  /* 13 */ [['B', 'R']],
  /* 14 */ [['L', 'B']],
  /* 15 */ [],
];

function edgeMidpoint(i: number, j: number, edge: EdgeLabel): GridPoint {
  switch (edge) {
    case 'T':
      return { x: i + 0.5, y: j };
    case 'R':
      return { x: i + 1, y: j + 0.5 };
    case 'B':
      return { x: i + 0.5, y: j + 1 };
    case 'L':
      return { x: i, y: j + 0.5 };
  }
}

function pointKey(p: GridPoint): string {
  return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
}

/**
 * Traces every closed contour in a binary mask via marching squares over a
 * zero-padded corner grid (the padding guarantees every contour is closed —
 * none can run off the mask's edge). Returns contours in mask-pixel space
 * (pixel (x,y)'s sample sits at grid point (x,y); a 1-cell padding border
 * is subtracted back out before returning).
 */
function traceMaskContours(mask: Uint8Array, width: number, height: number): GridPoint[][] {
  const paddedWidth = width + 2;
  const paddedHeight = height + 2;
  const valueAt = (i: number, j: number): number => {
    const px = i - 1;
    const py = j - 1;
    if (px < 0 || py < 0 || px >= width || py >= height) return 0;
    return mask[py * width + px]!;
  };

  interface Segment {
    a: GridPoint;
    b: GridPoint;
  }
  const segments: Segment[] = [];

  for (let j = 0; j < paddedHeight - 1; j++) {
    for (let i = 0; i < paddedWidth - 1; i++) {
      const tl = valueAt(i, j);
      const tr = valueAt(i + 1, j);
      const br = valueAt(i + 1, j + 1);
      const bl = valueAt(i, j + 1);
      const caseIndex = tl * 8 + tr * 4 + br * 2 + bl * 1;
      const edgePairs = CASE_EDGES[caseIndex]!;
      for (const [e1, e2] of edgePairs) {
        segments.push({ a: edgeMidpoint(i, j, e1), b: edgeMidpoint(i, j, e2) });
      }
    }
  }

  // Segments are directed (see CASE_EDGES) so every interior point is the
  // tail ("a") of exactly one segment and the head ("b") of exactly one
  // other — forward-following from any starting segment traces a single
  // consistently-wound loop, with no ambiguity about which branch to take.
  const byStartPoint = new Map<string, number>();
  segments.forEach((segment, index) => {
    byStartPoint.set(pointKey(segment.a), index);
  });

  const visited = new Array<boolean>(segments.length).fill(false);
  const loops: GridPoint[][] = [];

  for (let startIndex = 0; startIndex < segments.length; startIndex++) {
    if (visited[startIndex]) continue;

    const startPoint = segments[startIndex]!.a;
    const loop: GridPoint[] = [startPoint];
    let currentIndex = startIndex;

    // Walk the chain until we return to the loop's start point.
    // Padding guarantees closure; the safety cap just prevents an infinite
    // loop if a future edit to the case table ever breaks that guarantee.
    for (let steps = 0; steps < segments.length + 1; steps++) {
      visited[currentIndex] = true;
      const segment = segments[currentIndex]!;
      if (pointKey(segment.b) === pointKey(startPoint)) break;
      loop.push(segment.b);

      const nextIndex = byStartPoint.get(pointKey(segment.b));
      if (nextIndex === undefined || visited[nextIndex]) break;
      currentIndex = nextIndex;
    }

    if (loop.length >= 3) {
      loops.push(loop.map((p) => ({ x: p.x - 1, y: p.y - 1 })));
    }
  }

  return loops;
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

/** Shoelace formula. Positive for counter-clockwise loops in a y-down (image) coordinate system, matching outer-boundary winding from this module's trace direction. */
export function signedPolygonArea(points: readonly PolylinePoint[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function resolveTargetSizeMm(
  image: TraceableImageData,
  targetWidthMm: number | undefined,
  targetHeightMm: number | undefined,
  preserveAspectRatio: boolean,
): { widthMm: number; heightMm: number } {
  const sourceAspect = image.widthPx / image.heightPx;
  const hasWidth = typeof targetWidthMm === 'number' && Number.isFinite(targetWidthMm) && targetWidthMm > 0;
  const hasHeight = typeof targetHeightMm === 'number' && Number.isFinite(targetHeightMm) && targetHeightMm > 0;

  if (!hasWidth && !hasHeight) {
    return { widthMm: image.widthPx, heightMm: image.heightPx };
  }
  if (hasWidth && hasHeight) {
    if (!preserveAspectRatio) return { widthMm: targetWidthMm!, heightMm: targetHeightMm! };
    const widthLimitedHeight = targetWidthMm! / sourceAspect;
    if (widthLimitedHeight <= targetHeightMm!) return { widthMm: targetWidthMm!, heightMm: widthLimitedHeight };
    return { widthMm: targetHeightMm! * sourceAspect, heightMm: targetHeightMm! };
  }
  if (hasWidth) return { widthMm: targetWidthMm!, heightMm: targetWidthMm! / sourceAspect };
  return { widthMm: targetHeightMm! * sourceAspect, heightMm: targetHeightMm! };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Traces a raster image into closed vector silhouette contours.
 *
 * @throws if image dimensions are invalid or `rgba` length doesn't match.
 */
export function traceImageSilhouette(options: ImageTraceOptions): ImageTraceResult {
  const { image } = options;
  if (!Number.isFinite(image.widthPx) || image.widthPx <= 0 || !Number.isFinite(image.heightPx) || image.heightPx <= 0) {
    throw new Error('traceImageSilhouette: image.widthPx and image.heightPx must be positive finite numbers.');
  }
  if ((image.rgba?.length ?? 0) !== image.widthPx * image.heightPx * 4) {
    throw new Error('traceImageSilhouette: image.rgba length must equal widthPx * heightPx * 4.');
  }

  const threshold = clamp(options.threshold, 0, 255);
  const invert = options.invert ?? false;
  const preserveAspectRatio = options.preserveAspectRatio ?? true;
  const minAreaMm2 = options.minAreaMm2 ?? 1;
  const smoothingToleranceMm = options.smoothingToleranceMm ?? 0.35;

  const { widthMm, heightMm } = resolveTargetSizeMm(image, options.targetWidthMm, options.targetHeightMm, preserveAspectRatio);
  const scaleX = widthMm / image.widthPx;
  const scaleY = heightMm / image.heightPx;

  const mask = buildMask(image, threshold, invert);
  const rawLoops = traceMaskContours(mask, image.widthPx, image.heightPx);

  const warnings: string[] = [];
  const polylines: Polyline[] = [];

  for (const loop of rawLoops) {
    const mmPoints: PolylinePoint[] = loop.map((p) => ({ x: roundMm(p.x * scaleX, 4), y: roundMm(p.y * scaleY, 4) }));
    const area = Math.abs(signedPolygonArea(mmPoints));
    if (area < minAreaMm2) continue;

    const closedPolyline: Polyline = { points: [...mmPoints, mmPoints[0]!], closed: true };
    const smoothed = smoothingToleranceMm > 0 ? simplifyPolyline(closedPolyline, smoothingToleranceMm) : closedPolyline;
    if (smoothed.points.length >= 4) {
      polylines.push(smoothed);
    }
  }

  if (polylines.length === 0) {
    warnings.push('No shape passed the current threshold. Try lowering the minimum blob size, adjusting the threshold, or enabling invert.');
  }

  return { polylines, widthMm: roundMm(widthMm, 3), heightMm: roundMm(heightMm, 3), warnings };
}
