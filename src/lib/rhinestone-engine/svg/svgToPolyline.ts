/**
 * SVG Upload v1 — SVG primitives to Polylines converter
 *
 * Converts supported SVG elements into Polyline objects that can be passed
 * directly to createPolylineRhinestoneTemplate.
 *
 * Supported primitives:
 *   line, polyline, polygon, rect, circle, ellipse
 *   path (M/m/L/l/H/h/V/v/Z/z only — no Bezier curves)
 *
 * Not supported in v1:
 *   - transform attributes (throws with a clear message)
 *   - Bezier curve path commands C/c/S/s/Q/q/T/t/A/a (throws)
 *   - External resource references (blocked by validateSafeSvgInput)
 *
 * The uploaded SVG string is NEVER rendered or passed to dangerouslySetInnerHTML.
 */

import type { Polyline, PolylinePoint } from '../path/polyline';
import { roundMm } from '../geometry/rounding';
import { validateSafeSvgInput, extractSvgElements } from './svgParser';

// ─── Options ──────────────────────────────────────────────────────────────────

export interface SvgToPolylineOptions {
  /** Number of line segments used to approximate a circle. Default: 64. */
  circleSegments?: number;
  /** Number of line segments used to approximate an ellipse. Default: 64. */
  ellipseSegments?: number;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Parses "x1,y1 x2,y2 ..." into PolylinePoint[]. */
function parsePointsAttr(pointsStr: string): PolylinePoint[] {
  const nums = (
    pointsStr.match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? []
  ).map(Number);
  const pts: PolylinePoint[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: nums[i]!, y: nums[i + 1]! });
  }
  return pts;
}

/** Approximates a circle as a closed polygon of `segments` points. */
function approximateCircle(
  cx: number,
  cy: number,
  r: number,
  segments: number,
): PolylinePoint[] {
  const pts: PolylinePoint[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (2 * Math.PI * i) / segments;
    pts.push({
      x: roundMm(cx + r * Math.cos(angle), 4),
      y: roundMm(cy + r * Math.sin(angle), 4),
    });
  }
  return pts;
}

/** Approximates an ellipse as a closed polygon of `segments` points. */
function approximateEllipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  segments: number,
): PolylinePoint[] {
  const pts: PolylinePoint[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (2 * Math.PI * i) / segments;
    pts.push({
      x: roundMm(cx + rx * Math.cos(angle), 4),
      y: roundMm(cy + ry * Math.sin(angle), 4),
    });
  }
  return pts;
}

/**
 * Parses the `d` attribute of a simple SVG path into Polyline objects.
 *
 * Only M/m/L/l/H/h/V/v/Z/z commands are supported.
 * Encounters with any other command (C, S, Q, T, A, etc.) throw immediately.
 */
function parsePathD(d: string): Polyline[] {
  // Reject Bezier and arc commands up front
  const badCmd = /[CcSsQqTtAa]/.exec(d);
  if (badCmd) {
    throw new Error(
      `SVG Upload v1 does not support path command "${badCmd[0]}". ` +
        `Only M/m/L/l/H/h/V/v/Z/z are supported in v1. ` +
        `Please flatten curves before uploading.`,
    );
  }

  const polylines: Polyline[] = [];
  let currentPts: PolylinePoint[] = [];
  let cx = 0, cy = 0;
  let startX = 0, startY = 0;

  // Tokenise: each command letter followed by its numeric arguments
  const cmdRe = /([MmLlHhVvZz])([^MmLlHhVvZz]*)/g;
  let m: RegExpExecArray | null;

  while ((m = cmdRe.exec(d)) !== null) {
    const cmd = m[1]!;
    const args = (
      m[2]!.match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? []
    ).map(Number);

    switch (cmd) {
      case 'M':
        if (currentPts.length >= 2) polylines.push({ points: [...currentPts] });
        for (let i = 0; i + 1 < args.length; i += 2) {
          cx = args[i]!; cy = args[i + 1]!;
          if (i === 0) { startX = cx; startY = cy; currentPts = [{ x: cx, y: cy }]; }
          else currentPts.push({ x: cx, y: cy });
        }
        break;
      case 'm':
        if (currentPts.length >= 2) polylines.push({ points: [...currentPts] });
        for (let i = 0; i + 1 < args.length; i += 2) {
          cx += args[i]!; cy += args[i + 1]!;
          if (i === 0) { startX = cx; startY = cy; currentPts = [{ x: cx, y: cy }]; }
          else currentPts.push({ x: cx, y: cy });
        }
        break;
      case 'L':
        for (let i = 0; i + 1 < args.length; i += 2) {
          cx = args[i]!; cy = args[i + 1]!;
          currentPts.push({ x: cx, y: cy });
        }
        break;
      case 'l':
        for (let i = 0; i + 1 < args.length; i += 2) {
          cx += args[i]!; cy += args[i + 1]!;
          currentPts.push({ x: cx, y: cy });
        }
        break;
      case 'H':
        for (const x of args) { cx = x; currentPts.push({ x: cx, y: cy }); }
        break;
      case 'h':
        for (const dx of args) { cx += dx; currentPts.push({ x: cx, y: cy }); }
        break;
      case 'V':
        for (const y of args) { cy = y; currentPts.push({ x: cx, y: cy }); }
        break;
      case 'v':
        for (const dy of args) { cy += dy; currentPts.push({ x: cx, y: cy }); }
        break;
      case 'Z':
      case 'z':
        if (currentPts.length >= 2) polylines.push({ points: [...currentPts], closed: true });
        cx = startX; cy = startY;
        currentPts = [];
        break;
    }
  }

  if (currentPts.length >= 2) polylines.push({ points: [...currentPts] });

  return polylines;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Converts a safe SVG string to an array of Polyline objects.
 *
 * Steps:
 * 1. Validate safety — throws if dangerous content is found.
 * 2. Extract supported primitive elements.
 * 3. Convert each element to one or more Polylines.
 * 4. Throw if no usable polylines were found.
 *
 * The returned Polylines can be passed directly to
 * `createPolylineRhinestoneTemplate`.
 *
 * ⚠️  The uploaded SVG string is NEVER rendered or embedded in any output.
 *
 * @throws if the SVG contains unsafe patterns.
 * @throws if a `transform` attribute is encountered.
 * @throws if an unsupported path command (C/Q/A/…) is used.
 * @throws if no supported shapes are found.
 */
export function svgStringToPolylines(
  svgString: string,
  options: SvgToPolylineOptions = {},
): Polyline[] {
  // ── Safety check ─────────────────────────────────────────────────────────
  const safety = validateSafeSvgInput(svgString);
  if (!safety.safe) {
    throw new Error(`Unsafe SVG content: ${safety.issues.join('; ')}`);
  }

  const { circleSegments = 64, ellipseSegments = 64 } = options;
  const elements = extractSvgElements(svgString);
  const polylines: Polyline[] = [];

  for (const el of elements) {
    const a = el.attributes;

    // ── Transform guard ────────────────────────────────────────────────────
    if ('transform' in a) {
      throw new Error(
        'SVG transforms are not supported in v1. ' +
          'Please flatten/expand transforms before upload.',
      );
    }

    switch (el.tagName) {
      case 'line':
        polylines.push({
          points: [
            { x: parseFloat(a.x1 ?? '0'), y: parseFloat(a.y1 ?? '0') },
            { x: parseFloat(a.x2 ?? '0'), y: parseFloat(a.y2 ?? '0') },
          ],
        });
        break;

      case 'polyline': {
        const pts = parsePointsAttr(a.points ?? '');
        if (pts.length >= 2) polylines.push({ points: pts });
        break;
      }

      case 'polygon': {
        const pts = parsePointsAttr(a.points ?? '');
        if (pts.length >= 2) polylines.push({ points: pts, closed: true });
        break;
      }

      case 'rect': {
        const x = parseFloat(a.x ?? '0');
        const y = parseFloat(a.y ?? '0');
        const w = parseFloat(a.width ?? '0');
        const h = parseFloat(a.height ?? '0');
        polylines.push({
          points: [
            { x, y },
            { x: x + w, y },
            { x: x + w, y: y + h },
            { x, y: y + h },
          ],
          closed: true,
        });
        break;
      }

      case 'circle': {
        const cx = parseFloat(a.cx ?? '0');
        const cy = parseFloat(a.cy ?? '0');
        const r  = parseFloat(a.r  ?? '0');
        const pts = approximateCircle(cx, cy, r, circleSegments);
        if (pts.length >= 2) polylines.push({ points: pts, closed: true });
        break;
      }

      case 'ellipse': {
        const cx = parseFloat(a.cx ?? '0');
        const cy = parseFloat(a.cy ?? '0');
        const rx = parseFloat(a.rx ?? '0');
        const ry = parseFloat(a.ry ?? '0');
        const pts = approximateEllipse(cx, cy, rx, ry, ellipseSegments);
        if (pts.length >= 2) polylines.push({ points: pts, closed: true });
        break;
      }

      case 'path': {
        const pathPolylines = parsePathD(a.d ?? '');
        polylines.push(...pathPolylines);
        break;
      }
    }
  }

  // Filter degenerate polylines and check we have at least one
  const valid = polylines.filter((p) => p.points.length >= 2);

  if (valid.length === 0) {
    throw new Error(
      'No supported SVG shapes found. ' +
        'Supported elements: line, polyline, polygon, rect, circle, ellipse, ' +
        'and path (M/m/L/l/H/h/V/v/Z/z only). ' +
        'Ensure your SVG contains at least one supported shape.',
    );
  }

  return valid;
}
