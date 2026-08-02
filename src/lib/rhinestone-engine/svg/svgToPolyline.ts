/**
 * SVG Upload v2 — SVG primitives + curves to Polylines converter
 *
 * Converts supported SVG elements into Polyline objects for the rhinestone engine.
 *
 * Supported primitives:
 *   line, polyline, polygon, rect, circle, ellipse
 *   path: M/m/L/l/H/h/V/v/Z/z + C/c/S/s/Q/q/T/t Bezier curves
 *
 * Not supported in v2 (throws with clear message):
 *   - Arc path commands A/a
 *   - skewX / skewY transforms
 *   - External resource references (blocked by validateSafeSvgInput)
 *
 * Supported transforms: translate, scale, rotate, matrix.
 *
 * The uploaded SVG string is NEVER rendered or passed to dangerouslySetInnerHTML.
 */

import type { Polyline, PolylinePoint } from '../path/polyline';
import { roundMm } from '../geometry/rounding';
import { validateSafeSvgInput, extractSvgElements, stripSvgStyleElements } from './svgParser';
import type { PolylineCleanupOptions } from '../path/polylineCleanup';
import { cleanupPolylines } from '../path/polylineCleanup';

// ─── Options ──────────────────────────────────────────────────────────────────

export interface SvgToPolylineOptions {
  /** Segments for circle approximation. Default: 64. */
  circleSegments?: number;
  /** Segments for ellipse approximation. Default: 64. */
  ellipseSegments?: number;
  /**
   * Segments per Bezier curve command (C/S/Q/T).
   * Higher values produce smoother curves. Default: 24.
   */
  curveSegments?: number;
  /**
   * Run the polyline cleanup pipeline after conversion.
   * Removes duplicate points, short segments, and tiny shapes.
   * Default: true.
   */
  cleanup?: boolean;
  /** Options passed to the cleanup pipeline. */
  cleanupOptions?: PolylineCleanupOptions;
}

// ─── Transform types ──────────────────────────────────────────────────────────

/**
 * SVG matrix [a, b, c, d, e, f]:  x' = ax + cy + e;  y' = bx + dy + f
 */
type Matrix = [number, number, number, number, number, number];

function identityMatrix(): Matrix { return [1, 0, 0, 1, 0, 0]; }

/** Standard matrix multiplication A * B. */
function multiplyMatrices(A: Matrix, B: Matrix): Matrix {
  return [
    A[0]*B[0] + A[2]*B[1], A[1]*B[0] + A[3]*B[1],
    A[0]*B[2] + A[2]*B[3], A[1]*B[2] + A[3]*B[3],
    A[0]*B[4] + A[2]*B[5] + A[4], A[1]*B[4] + A[3]*B[5] + A[5],
  ];
}

function applyMatrix(m: Matrix, pt: PolylinePoint): PolylinePoint {
  return {
    x: roundMm(m[0]*pt.x + m[2]*pt.y + m[4], 4),
    y: roundMm(m[1]*pt.x + m[3]*pt.y + m[5], 4),
  };
}

/**
 * Parses a `transform` attribute string into a combined Matrix.
 * Transforms compose left-to-right (first transform in string applied first).
 * Throws for skewX/skewY and malformed input.
 */
function parseTransformString(transformStr: string): Matrix {
  const re = /(translate|scale|rotate|matrix|skewX|skewY)\s*\(([^)]*)\)/gi;
  let result = identityMatrix();
  let m: RegExpExecArray | null;
  while ((m = re.exec(transformStr)) !== null) {
    const fn = m[1]!.toLowerCase();
    const nums = (m[2]!.match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? []).map(Number);
    let tm: Matrix;
    switch (fn) {
      case 'translate': tm = [1,0,0,1, nums[0]??0, nums[1]??0]; break;
      case 'scale': { const sx=nums[0]??1, sy=nums.length>=2?nums[1]!:sx; tm=[sx,0,0,sy,0,0]; break; }
      case 'rotate': {
        const rad = (nums[0]??0) * (Math.PI/180);
        const c=Math.cos(rad), s=Math.sin(rad);
        if (nums.length>=3) {
          const cx=nums[1]!, cy=nums[2]!;
          tm=[c,s,-s,c, cx-cx*c+cy*s, cy-cx*s-cy*c];
        } else { tm=[c,s,-s,c,0,0]; }
        break;
      }
      case 'matrix':
        if (nums.length<6) throw new Error(`Malformed SVG transform matrix: expected 6 params, got ${nums.length}.`);
        tm=[nums[0]!,nums[1]!,nums[2]!,nums[3]!,nums[4]!,nums[5]!]; break;
      default:
        throw new Error(`SVG transform "${fn}" is not supported. Only translate, scale, rotate, and matrix are supported.`);
    }
    // Compose: new matrix applied AFTER current result → tm * result
    result = multiplyMatrices(tm, result);
  }
  return result;
}

// ─── Curve flattening ─────────────────────────────────────────────────────────

function flattenCubicBezier(p0:PolylinePoint, p1:PolylinePoint, p2:PolylinePoint, p3:PolylinePoint, seg:number): PolylinePoint[] {
  return Array.from({length:seg}, (_,i) => {
    const t=(i+1)/seg, mt=1-t;
    return {
      x: roundMm(mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x, 4),
      y: roundMm(mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y, 4),
    };
  });
}

function flattenQuadraticBezier(p0:PolylinePoint, p1:PolylinePoint, p2:PolylinePoint, seg:number): PolylinePoint[] {
  return Array.from({length:seg}, (_,i) => {
    const t=(i+1)/seg, mt=1-t;
    return {
      x: roundMm(mt*mt*p0.x + 2*mt*t*p1.x + t*t*p2.x, 4),
      y: roundMm(mt*mt*p0.y + 2*mt*t*p1.y + t*t*p2.y, 4),
    };
  });
}

// ─── Path parser ──────────────────────────────────────────────────────────────

function parsePathD(d: string, curveSegments: number): Polyline[] {
  if (/[Aa]/.test(d)) {
    throw new Error('SVG arc commands (A/a) are not supported in v2. Please expand arcs before upload.');
  }
  const polylines: Polyline[] = [];
  let currentPts: PolylinePoint[] = [];
  let cx=0, cy=0, startX=0, startY=0;
  let lastCubicCtrl: PolylinePoint|null = null;
  let lastQuadCtrl:  PolylinePoint|null = null;

  const cmdRe = /([MmLlHhVvZzCcSsQqTt])([^MmLlHhVvZzCcSsQqTt]*)/g;
  let m: RegExpExecArray|null;
  while ((m=cmdRe.exec(d))!==null) {
    const cmd=m[1]!, args=(m[2]!.match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g)??[]).map(Number);
    switch (cmd) {
      case 'M': if(currentPts.length>=2)polylines.push({points:[...currentPts]}); for(let i=0;i+1<args.length;i+=2){cx=args[i]!;cy=args[i+1]!;if(i===0){startX=cx;startY=cy;currentPts=[{x:cx,y:cy}];}else currentPts.push({x:cx,y:cy});} lastCubicCtrl=null;lastQuadCtrl=null; break;
      case 'm': if(currentPts.length>=2)polylines.push({points:[...currentPts]}); for(let i=0;i+1<args.length;i+=2){cx+=args[i]!;cy+=args[i+1]!;if(i===0){startX=cx;startY=cy;currentPts=[{x:cx,y:cy}];}else currentPts.push({x:cx,y:cy});} lastCubicCtrl=null;lastQuadCtrl=null; break;
      case 'L': for(let i=0;i+1<args.length;i+=2){cx=args[i]!;cy=args[i+1]!;currentPts.push({x:cx,y:cy});} lastCubicCtrl=null;lastQuadCtrl=null; break;
      case 'l': for(let i=0;i+1<args.length;i+=2){cx+=args[i]!;cy+=args[i+1]!;currentPts.push({x:cx,y:cy});} lastCubicCtrl=null;lastQuadCtrl=null; break;
      case 'H': for(const x of args){cx=x;currentPts.push({x:cx,y:cy});} lastCubicCtrl=null;lastQuadCtrl=null; break;
      case 'h': for(const dx of args){cx+=dx;currentPts.push({x:cx,y:cy});} lastCubicCtrl=null;lastQuadCtrl=null; break;
      case 'V': for(const y of args){cy=y;currentPts.push({x:cx,y:cy});} lastCubicCtrl=null;lastQuadCtrl=null; break;
      case 'v': for(const dy of args){cy+=dy;currentPts.push({x:cx,y:cy});} lastCubicCtrl=null;lastQuadCtrl=null; break;
      case 'Z': case 'z': if(currentPts.length>=2)polylines.push({points:[...currentPts],closed:true}); cx=startX;cy=startY;currentPts=[];lastCubicCtrl=null;lastQuadCtrl=null; break;
      case 'C': for(let i=0;i+5<args.length;i+=6){const p1={x:args[i]!,y:args[i+1]!},p2={x:args[i+2]!,y:args[i+3]!},end={x:args[i+4]!,y:args[i+5]!};currentPts.push(...flattenCubicBezier({x:cx,y:cy},p1,p2,end,curveSegments));cx=end.x;cy=end.y;lastCubicCtrl=p2;lastQuadCtrl=null;} break;
      case 'c': for(let i=0;i+5<args.length;i+=6){const p1={x:cx+args[i]!,y:cy+args[i+1]!},p2={x:cx+args[i+2]!,y:cy+args[i+3]!},end={x:cx+args[i+4]!,y:cy+args[i+5]!};currentPts.push(...flattenCubicBezier({x:cx,y:cy},p1,p2,end,curveSegments));cx=end.x;cy=end.y;lastCubicCtrl=p2;lastQuadCtrl=null;} break;
      case 'S': for(let i=0;i+3<args.length;i+=4){const p1=lastCubicCtrl?{x:2*cx-lastCubicCtrl.x,y:2*cy-lastCubicCtrl.y}:{x:cx,y:cy},p2={x:args[i]!,y:args[i+1]!},end={x:args[i+2]!,y:args[i+3]!};currentPts.push(...flattenCubicBezier({x:cx,y:cy},p1,p2,end,curveSegments));cx=end.x;cy=end.y;lastCubicCtrl=p2;lastQuadCtrl=null;} break;
      case 's': for(let i=0;i+3<args.length;i+=4){const p1=lastCubicCtrl?{x:2*cx-lastCubicCtrl.x,y:2*cy-lastCubicCtrl.y}:{x:cx,y:cy},p2={x:cx+args[i]!,y:cy+args[i+1]!},end={x:cx+args[i+2]!,y:cy+args[i+3]!};currentPts.push(...flattenCubicBezier({x:cx,y:cy},p1,p2,end,curveSegments));cx=end.x;cy=end.y;lastCubicCtrl=p2;lastQuadCtrl=null;} break;
      case 'Q': for(let i=0;i+3<args.length;i+=4){const ctrl={x:args[i]!,y:args[i+1]!},end={x:args[i+2]!,y:args[i+3]!};currentPts.push(...flattenQuadraticBezier({x:cx,y:cy},ctrl,end,curveSegments));cx=end.x;cy=end.y;lastQuadCtrl=ctrl;lastCubicCtrl=null;} break;
      case 'q': for(let i=0;i+3<args.length;i+=4){const ctrl={x:cx+args[i]!,y:cy+args[i+1]!},end={x:cx+args[i+2]!,y:cy+args[i+3]!};currentPts.push(...flattenQuadraticBezier({x:cx,y:cy},ctrl,end,curveSegments));cx=end.x;cy=end.y;lastQuadCtrl=ctrl;lastCubicCtrl=null;} break;
      case 'T': for(let i=0;i+1<args.length;i+=2){const ctrl:PolylinePoint=lastQuadCtrl?{x:2*cx-lastQuadCtrl.x,y:2*cy-lastQuadCtrl.y}:{x:cx,y:cy};const end={x:args[i]!,y:args[i+1]!};currentPts.push(...flattenQuadraticBezier({x:cx,y:cy},ctrl,end,curveSegments));cx=end.x;cy=end.y;lastQuadCtrl=ctrl;lastCubicCtrl=null;} break;
      case 't': for(let i=0;i+1<args.length;i+=2){const ctrl:PolylinePoint=lastQuadCtrl?{x:2*cx-lastQuadCtrl.x,y:2*cy-lastQuadCtrl.y}:{x:cx,y:cy};const end={x:cx+args[i]!,y:cy+args[i+1]!};currentPts.push(...flattenQuadraticBezier({x:cx,y:cy},ctrl,end,curveSegments));cx=end.x;cy=end.y;lastQuadCtrl=ctrl;lastCubicCtrl=null;} break;
    }
  }
  if(currentPts.length>=2)polylines.push({points:[...currentPts]});
  return polylines;
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────

function parsePointsAttr(pointsStr: string): PolylinePoint[] {
  const nums = (pointsStr.match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? []).map(Number);
  const pts: PolylinePoint[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i]!, y: nums[i + 1]! });
  return pts;
}

function approximateCircle(cx:number, cy:number, r:number, seg:number): PolylinePoint[] {
  return Array.from({length:seg}, (_,i) => {
    const a=(2*Math.PI*i)/seg;
    return { x: roundMm(cx+r*Math.cos(a),4), y: roundMm(cy+r*Math.sin(a),4) };
  });
}

function approximateEllipse(cx:number, cy:number, rx:number, ry:number, seg:number): PolylinePoint[] {
  return Array.from({length:seg}, (_,i) => {
    const a=(2*Math.PI*i)/seg;
    return { x: roundMm(cx+rx*Math.cos(a),4), y: roundMm(cy+ry*Math.sin(a),4) };
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Converts a safe SVG string to Polylines for the rhinestone engine.
 *
 * Supported: line, polyline, polygon, rect, circle, ellipse,
 *            path (M/m/L/l/H/h/V/v/Z/z/C/c/S/s/Q/q/T/t).
 * Transforms (translate, scale, rotate, matrix) are applied to points.
 *
 * The uploaded SVG is NEVER rendered or embedded in any output.
 *
 * @throws if unsafe patterns are detected.
 * @throws if arc commands (A/a) are used.
 * @throws if an unsupported or malformed transform is encountered.
 * @throws if no supported shapes are found.
 */
export function svgStringToPolylines(
  svgString: string,
  options: SvgToPolylineOptions = {},
): Polyline[] {
  const sanitizedSvgString = stripSvgStyleElements(svgString);
  const safety = validateSafeSvgInput(sanitizedSvgString);
  if (!safety.safe) {
    throw new Error(`Unsafe SVG content: ${safety.issues.join('; ')}`);
  }

  const { circleSegments = 64, ellipseSegments = 64, curveSegments = 24 } = options;
  const elements = extractSvgElements(sanitizedSvgString);
  const polylines: Polyline[] = [];

  for (const el of elements) {
    const a = el.attributes;

    // Parse transform (throws on unsupported/malformed)
    const tm = 'transform' in a ? parseTransformString(a.transform!) : null;

    const elPolys: Polyline[] = [];

    switch (el.tagName) {
      case 'line':
        elPolys.push({ points: [
          { x: parseFloat(a.x1 ?? '0'), y: parseFloat(a.y1 ?? '0') },
          { x: parseFloat(a.x2 ?? '0'), y: parseFloat(a.y2 ?? '0') },
        ]});
        break;
      case 'polyline': { const pts=parsePointsAttr(a.points??''); if(pts.length>=2)elPolys.push({points:pts}); break; }
      case 'polygon':  { const pts=parsePointsAttr(a.points??''); if(pts.length>=2)elPolys.push({points:pts,closed:true}); break; }
      case 'rect': {
        const x=parseFloat(a.x??'0'),y=parseFloat(a.y??'0'),w=parseFloat(a.width??'0'),h=parseFloat(a.height??'0');
        elPolys.push({points:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],closed:true}); break;
      }
      case 'circle': {
        const pts=approximateCircle(parseFloat(a.cx??'0'),parseFloat(a.cy??'0'),parseFloat(a.r??'0'),circleSegments);
        if(pts.length>=2)elPolys.push({points:pts,closed:true}); break;
      }
      case 'ellipse': {
        const pts=approximateEllipse(parseFloat(a.cx??'0'),parseFloat(a.cy??'0'),parseFloat(a.rx??'0'),parseFloat(a.ry??'0'),ellipseSegments);
        if(pts.length>=2)elPolys.push({points:pts,closed:true}); break;
      }
      case 'path':
        elPolys.push(...parsePathD(a.d??'', curveSegments)); break;
    }

    // Apply transform to all element polylines
    for (const poly of elPolys) {
      polylines.push(tm
        ? { points: poly.points.map(pt => applyMatrix(tm, pt)), closed: poly.closed }
        : poly,
      );
    }
  }

  const valid = polylines.filter(p => p.points.length >= 2);

  if (valid.length === 0) {
    throw new Error(
      'No supported SVG shapes found. ' +
        'Supported elements: line, polyline, polygon, rect, circle, ellipse, ' +
        'and path (M/m/L/l/H/h/V/v/Z/z/C/c/S/s/Q/q/T/t). ' +
        'Arc commands (A/a) are not yet supported — expand them before uploading.',
    );
  }

  // Run cleanup pipeline (enabled by default)
  if (options.cleanup !== false) {
    return cleanupPolylines(valid, options.cleanupOptions ?? {});
  }

  return valid;
}
