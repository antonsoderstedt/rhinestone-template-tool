/**
 * SVG Transform Parsing and Application
 *
 * Handles SVG transform attribute parsing and application to points.
 * Supports: translate, scale, rotate, matrix.
 */

import type { Point } from '../types/index';

export interface SvgTransform {
  a: number; // scale x / cos(rotate)
  b: number; // skew y / sin(rotate)
  c: number; // skew x / -sin(rotate)
  d: number; // scale y / cos(rotate)
  e: number; // translate x
  f: number; // translate y
}

export function identityTransform(): SvgTransform {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

export function parseSvgTransform(transformAttr: string): SvgTransform {
  let result = identityTransform();

  const transforms = transformAttr.match(/(translate|scale|rotate|matrix)\s*\([^)]+\)/gi);
  if (!transforms) return result;

  for (const t of transforms) {
    const match = t.match(/(translate|scale|rotate|matrix)\s*\(([^)]+)\)/i);
    if (!match) continue;

    const type = match[1]!.toLowerCase();
    const args = match[2]!.split(/[\s,]+/).map(Number).filter(isFinite);

    const transform = identityTransform();

    switch (type) {
      case 'translate':
        transform.e = args[0] || 0;
        transform.f = args[1] || 0;
        break;
      case 'scale':
        transform.a = args[0] || 1;
        transform.d = args[1] !== undefined ? args[1]! : args[0] || 1;
        break;
      case 'rotate':
        if (args.length === 1) {
          const angle = (args[0]! * Math.PI) / 180;
          transform.a = Math.cos(angle);
          transform.b = Math.sin(angle);
          transform.c = -Math.sin(angle);
          transform.d = Math.cos(angle);
        } else if (args.length === 3) {
          const angle = (args[0]! * Math.PI) / 180;
          const cx = args[1]!;
          const cy = args[2]!;
          // Translate to origin, rotate, translate back
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          transform.a = cos;
          transform.b = sin;
          transform.c = -sin;
          transform.d = cos;
          transform.e = -cx * cos + cy * sin + cx;
          transform.f = -cx * sin - cy * cos + cy;
        }
        break;
      case 'matrix':
        if (args.length === 6) {
          transform.a = args[0]!;
          transform.b = args[1]!;
          transform.c = args[2]!;
          transform.d = args[3]!;
          transform.e = args[4]!;
          transform.f = args[5]!;
        }
        break;
    }

    // Compose transforms: result = result * transform
    const a = result.a * transform.a + result.c * transform.b;
    const b = result.b * transform.a + result.d * transform.b;
    const c = result.a * transform.c + result.c * transform.d;
    const d = result.b * transform.c + result.d * transform.d;
    const e = result.a * transform.e + result.c * transform.f + result.e;
    const f = result.b * transform.e + result.d * transform.f + result.f;
    result = { a, b, c, d, e, f };
  }

  return result;
}

export function applySvgTransform(point: Point, transform: SvgTransform): Point {
  return {
    x: transform.a * point.x + transform.c * point.y + transform.e,
    y: transform.b * point.x + transform.d * point.y + transform.f,
  };
}
