import type { Font, Glyph, PathCommand } from 'opentype.js';
import type { Polyline } from '../path/polyline';
import type { OutlineTextAlign } from './outlineTextTemplate';

export interface OpenTypeTextLayoutOptions {
  text: string;
  font: Font;
  fontSizeMm: number;
  align?: OutlineTextAlign;
  letterSpacingMm?: number;
  lineSpacingMm?: number;
}

function interpolateQuadratic(p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, t: number) {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

function interpolateCubic(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
) {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
  };
}

function curveSegments(fontSizeMm: number): number {
  return fontSizeMm > 48 ? 18 : fontSizeMm > 28 ? 12 : 8;
}

function closePolyline(points: Array<{ x: number; y: number }>): Polyline | null {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  if (first.x !== last.x || first.y !== last.y) {
    points.push({ ...first });
  }
  return { points, closed: true };
}

function isSamePoint(a: { x: number; y: number } | null, b: { x: number; y: number } | null): boolean {
  if (!a || !b) return false;
  const epsilon = 0.0001;
  return Math.abs(a.x - b.x) <= epsilon && Math.abs(a.y - b.y) <= epsilon;
}

function commandsToPolylines(commands: PathCommand[], fontSizeMm: number): Polyline[] {
  const polylines: Polyline[] = [];
  let current: Array<{ x: number; y: number }> = [];
  let currentPoint: { x: number; y: number } | null = null;
  let subpathStart: { x: number; y: number } | null = null;
  const segments = curveSegments(fontSizeMm);

  const flushCurrentSubpath = () => {
    if (current.length >= 2) {
      const closed = isSamePoint(current[0] ?? null, current[current.length - 1] ?? null)
        ? closePolyline(current.map((point) => ({ ...point })))
        : { points: current.map((point) => ({ ...point })) };
      if (closed) polylines.push(closed);
    }
    current = [];
    subpathStart = null;
  };

  for (const command of commands) {
    switch (command.type) {
      case 'M': {
        flushCurrentSubpath();
        currentPoint = { x: command.x, y: command.y };
        subpathStart = { ...currentPoint };
        current = [{ ...currentPoint }];
        break;
      }
      case 'L': {
        if (!currentPoint) break;
        currentPoint = { x: command.x, y: command.y };
        current.push({ ...currentPoint });
        break;
      }
      case 'Q': {
        if (!currentPoint) break;
        for (let step = 1; step <= segments; step++) {
          const point = interpolateQuadratic(currentPoint, { x: command.x1, y: command.y1 }, { x: command.x, y: command.y }, step / segments);
          current.push(point);
        }
        currentPoint = { x: command.x, y: command.y };
        break;
      }
      case 'C': {
        if (!currentPoint) break;
        for (let step = 1; step <= segments; step++) {
          const point = interpolateCubic(
            currentPoint,
            { x: command.x1, y: command.y1 },
            { x: command.x2, y: command.y2 },
            { x: command.x, y: command.y },
            step / segments,
          );
          current.push(point);
        }
        currentPoint = { x: command.x, y: command.y };
        break;
      }
      case 'Z': {
        if (!subpathStart) break;
        const closed = closePolyline(current.map((point) => ({ ...point })));
        if (closed) polylines.push(closed);
        current = [];
        currentPoint = subpathStart;
        subpathStart = null;
        break;
      }
      default:
        break;
    }
  }

  flushCurrentSubpath();
  return polylines;
}

function layoutOpenTypeLine(
  font: Font,
  line: string,
  fontSizeMm: number,
  letterSpacingMm: number,
): { polylines: Polyline[]; widthMm: number } {
  const scale = fontSizeMm / font.unitsPerEm;
  let penXUnits = 0;
  const polylines: Polyline[] = [];
  let previousGlyph: Glyph | null = null;
  const characters = [...line];

  for (let i = 0; i < characters.length; i++) {
    const character = characters[i]!;
    const glyph = font.charToGlyph(character);
    const kerningUnits = previousGlyph ? font.getKerningValue(previousGlyph, glyph) : 0;
    penXUnits += kerningUnits;
    const path = glyph.getPath(penXUnits * scale, font.ascender * scale, fontSizeMm);
    polylines.push(...commandsToPolylines(path.commands, fontSizeMm));
    penXUnits += glyph.advanceWidth ?? font.unitsPerEm;
    if (i < characters.length - 1) {
      penXUnits += letterSpacingMm / scale;
    }
    previousGlyph = glyph;
  }

  return {
    polylines,
    widthMm: penXUnits * scale,
  };
}

export function layoutTextToOpenTypePolylines({
  text,
  font,
  fontSizeMm,
  align = 'left',
  letterSpacingMm = 2,
  lineSpacingMm = 8,
}: OpenTypeTextLayoutOptions): Polyline[] {
  const lines = text.split('\n');
  const lineAdvanceMm = fontSizeMm + lineSpacingMm;
  const lineGroups = lines.map((line) => layoutOpenTypeLine(font, line, fontSizeMm, letterSpacingMm));
  const maxWidthMm = Math.max(...lineGroups.map((group) => group.widthMm), 0);
  const allPolylines: Polyline[] = [];

  for (let lineIndex = 0; lineIndex < lineGroups.length; lineIndex++) {
    const group = lineGroups[lineIndex]!;
    const offsetY = lineIndex * lineAdvanceMm;
    let offsetX = 0;
    if (align === 'center') {
      offsetX = (maxWidthMm - group.widthMm) / 2;
    } else if (align === 'right') {
      offsetX = maxWidthMm - group.widthMm;
    }

    for (const polyline of group.polylines) {
      const points = polyline.points.map((point) => ({
        x: point.x + offsetX,
        y: point.y + offsetY,
      }));
      allPolylines.push({ points, closed: polyline.closed });
    }
  }

  return allPolylines.filter((polyline) => polyline.points.length >= 2);
}
