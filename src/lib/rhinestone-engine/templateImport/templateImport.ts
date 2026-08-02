/**
 * Rhinestone Template Import
 *
 * Imports SVG files containing pre-placed rhinestones as individual editable stones.
 * This is NOT the SVG shape-to-rhinestones converter — this imports existing templates
 * where each stone is already represented as a circle, ellipse, or circular path.
 *
 * Preserves:
 * - Stone positions
 * - Stone sizes (diameters)
 * - Colors (fill/stroke)
 * - Groups (as metadata)
 * - Import order
 *
 * Security: Uses the same safe SVG parser as SVG upload.
 * No scripts, no external resources, no DOM rendering.
 */

import { parseSvgAttributes, validateSafeSvgInput, stripSvgStyleElements } from '../svg/svgParser';
import { applySvgTransform, parseSvgTransform, type SvgTransform } from '../svg/svgTransform';
import type { Point, StoneSizeId } from '../types/index';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportedStone {
  center: Point;
  diameterMm: number;
  fill: string | null;
  stroke: string | null;
  group: string | null;
  originalIndex: number;
}

export interface TemplateImportResult {
  stones: ImportedStone[];
  widthMm: number;
  heightMm: number;
  detectedDiameters: number[];
  detectedColors: string[];
  ignoredElements: number;
  warnings: string[];
}

export interface TemplateImportOptions {
  svgText: string;
  deduplicateTolerance?: number;
}

// ─── Configuration ────────────────────────────────────────────────────────────

const DEFAULT_DEDUPLICATE_TOLERANCE = 0.01; // mm
const ELLIPSE_CIRCULARITY_TOLERANCE = 0.15; // Max deviation from 1.0 aspect ratio (was 0.1)
const PATH_CIRCULARITY_TOLERANCE = 0.15;
const MAX_STONES = 50000;

// ─── Stone Size Estimation ────────────────────────────────────────────────────

const STONE_SIZE_TOLERANCES: Array<{ id: StoneSizeId; diameterMm: number; tolerance: number }> = [
  { id: 'SS6', diameterMm: 2.0, tolerance: 0.3 },
  { id: 'SS8', diameterMm: 2.5, tolerance: 0.3 },
  { id: 'SS10', diameterMm: 2.8, tolerance: 0.3 },
  { id: 'SS12', diameterMm: 3.2, tolerance: 0.3 },
  { id: 'SS16', diameterMm: 4.394, tolerance: 0.4 }, // TRW Clean Stone
  { id: 'SS20', diameterMm: 5.283, tolerance: 0.4 }, // TRW Clean Stone
];

export function estimateStoneSizeId(diameterMm: number): StoneSizeId | null {
  let bestMatch: StoneSizeId | null = null;
  let minDistance = Infinity;
  
  for (const { id, diameterMm: target, tolerance } of STONE_SIZE_TOLERANCES) {
    const distance = Math.abs(diameterMm - target);
    if (distance <= tolerance && distance < minDistance) {
      bestMatch = id;
      minDistance = distance;
    }
  }
  
  return bestMatch;
}

// ─── SVG Unit Conversion ──────────────────────────────────────────────────────

function parseViewBox(viewBoxAttr: string | undefined): { width: number; height: number; minX: number; minY: number } | null {
  if (!viewBoxAttr) return null;
  const parts = viewBoxAttr.trim().split(/\s+/);
  if (parts.length !== 4) return null;
  const [minX, minY, width, height] = parts.map(Number);
  if (parts.some((p) => !isFinite(Number(p)))) return null;
  return { minX: minX!, minY: minY!, width: width!, height: height! };
}

function svgLengthToMm(value: string, viewBoxDimension: number | null): number {
  const match = value.trim().match(/^([\d.]+)(px|pt|pc|mm|cm|in)?$/);
  if (!match) return 0;

  const num = parseFloat(match[1]!);
  const unit = match[2] || 'px';

  switch (unit) {
    case 'mm':
      return num;
    case 'cm':
      return num * 10;
    case 'in':
      return num * 25.4;
    case 'pt':
      return num * 0.352778;
    case 'pc':
      return num * 4.23333;
    case 'px':
    default:
      // Assume 96 DPI if no viewBox
      if (viewBoxDimension !== null) {
        return num;
      }
      return num * 0.264583; // 96 DPI to mm
  }
}

// ─── Circle Detection ─────────────────────────────────────────────────────────

function isCircularEllipse(rx: number, ry: number): boolean {
  if (rx <= 0 || ry <= 0) return false;
  const aspectRatio = Math.max(rx, ry) / Math.min(rx, ry);
  return aspectRatio <= 1 + ELLIPSE_CIRCULARITY_TOLERANCE;
}

function isCircularPathBounds(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  const aspectRatio = Math.max(width, height) / Math.min(width, height);
  return aspectRatio <= 1 + PATH_CIRCULARITY_TOLERANCE;
}

// ─── Path Bounds Calculation ──────────────────────────────────────────────────

function getPathBounds(d: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let currentX = 0, currentY = 0;

  const commands = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g);
  if (!commands) return null;

  for (const cmd of commands) {
    const type = cmd[0]!;
    const args = cmd.slice(1).trim().split(/[\s,]+/).map(Number).filter(isFinite);

    switch (type.toUpperCase()) {
      case 'M':
      case 'L':
        currentX = type === type.toUpperCase() ? args[0]! : currentX + args[0]!;
        currentY = type === type.toUpperCase() ? args[1]! : currentY + args[1]!;
        minX = Math.min(minX, currentX);
        minY = Math.min(minY, currentY);
        maxX = Math.max(maxX, currentX);
        maxY = Math.max(maxY, currentY);
        break;
      case 'H':
        currentX = type === 'H' ? args[0]! : currentX + args[0]!;
        minX = Math.min(minX, currentX);
        maxX = Math.max(maxX, currentX);
        break;
      case 'V':
        currentY = type === 'V' ? args[0]! : currentY + args[0]!;
        minY = Math.min(minY, currentY);
        maxY = Math.max(maxY, currentY);
        break;
      case 'C':
        for (let i = 0; i < args.length; i += 6) {
          const x1 = type === 'C' ? args[i]! : currentX + args[i]!;
          const y1 = type === 'C' ? args[i + 1]! : currentY + args[i + 1]!;
          const x2 = type === 'C' ? args[i + 2]! : currentX + args[i + 2]!;
          const y2 = type === 'C' ? args[i + 3]! : currentY + args[i + 3]!;
          currentX = type === 'C' ? args[i + 4]! : currentX + args[i + 4]!;
          currentY = type === 'C' ? args[i + 5]! : currentY + args[i + 5]!;
          minX = Math.min(minX, x1, x2, currentX);
          minY = Math.min(minY, y1, y2, currentY);
          maxX = Math.max(maxX, x1, x2, currentX);
          maxY = Math.max(maxY, y1, y2, currentY);
        }
        break;
      case 'Q':
        for (let i = 0; i < args.length; i += 4) {
          const x1 = type === 'Q' ? args[i]! : currentX + args[i]!;
          const y1 = type === 'Q' ? args[i + 1]! : currentY + args[i + 1]!;
          currentX = type === 'Q' ? args[i + 2]! : currentX + args[i + 2]!;
          currentY = type === 'Q' ? args[i + 3]! : currentY + args[i + 3]!;
          minX = Math.min(minX, x1, currentX);
          minY = Math.min(minY, y1, currentY);
          maxX = Math.max(maxX, x1, currentX);
          maxY = Math.max(maxY, y1, currentY);
        }
        break;
      case 'A':
        // Approximate arc bounds by endpoints
        for (let i = 0; i < args.length; i += 7) {
          currentX = type === 'A' ? args[i + 5]! : currentX + args[i + 5]!;
          currentY = type === 'A' ? args[i + 6]! : currentY + args[i + 6]!;
          minX = Math.min(minX, currentX);
          minY = Math.min(minY, currentY);
          maxX = Math.max(maxX, currentX);
          maxY = Math.max(maxY, currentY);
        }
        break;
    }
  }

  if (!isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

// ─── Element Extraction ───────────────────────────────────────────────────────

function extractCircleStone(
  tag: string,
  attrs: Record<string, string>,
  transform: SvgTransform,
  viewBoxWidth: number | null,
  index: number,
  groupPath: string | null
): ImportedStone | null {
  const cx = svgLengthToMm(attrs.cx || '0', viewBoxWidth);
  const cy = svgLengthToMm(attrs.cy || '0', viewBoxWidth);
  const r = svgLengthToMm(attrs.r || '0', viewBoxWidth);

  if (r <= 0 || !isFinite(cx) || !isFinite(cy)) return null;

  const center = applySvgTransform({ x: cx, y: cy }, transform);
  const diameterMm = 2 * r * Math.sqrt(Math.abs(transform.a * transform.d - transform.b * transform.c));

  return {
    center,
    diameterMm,
    fill: (attrs.fill && attrs.fill !== 'none') ? attrs.fill : null,
    stroke: (attrs.stroke && attrs.stroke !== 'none') ? attrs.stroke : null,
    group: groupPath,
    originalIndex: index,
  };
}

function extractEllipseStone(
  tag: string,
  attrs: Record<string, string>,
  transform: SvgTransform,
  viewBoxWidth: number | null,
  index: number,
  groupPath: string | null
): ImportedStone | null {
  const cx = svgLengthToMm(attrs.cx || '0', viewBoxWidth);
  const cy = svgLengthToMm(attrs.cy || '0', viewBoxWidth);
  const rx = svgLengthToMm(attrs.rx || '0', viewBoxWidth);
  const ry = svgLengthToMm(attrs.ry || '0', viewBoxWidth);

  if (!isCircularEllipse(rx, ry)) return null;
  if (!isFinite(cx) || !isFinite(cy)) return null;

  const center = applySvgTransform({ x: cx, y: cy }, transform);
  const avgRadius = (rx + ry) / 2;
  const diameterMm = 2 * avgRadius * Math.sqrt(Math.abs(transform.a * transform.d - transform.b * transform.c));

  return {
    center,
    diameterMm,
    fill: (attrs.fill && attrs.fill !== 'none') ? attrs.fill : null,
    stroke: (attrs.stroke && attrs.stroke !== 'none') ? attrs.stroke : null,
    group: groupPath,
    originalIndex: index,
  };
}

function extractPathStone(
  tag: string,
  attrs: Record<string, string>,
  transform: SvgTransform,
  viewBoxWidth: number | null,
  index: number,
  groupPath: string | null
): ImportedStone | null {
  const d = attrs.d;
  if (!d) return null;

  const bounds = getPathBounds(d);
  if (!bounds) return null;

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  if (!isCircularPathBounds(width, height)) return null;

  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const avgDiameter = (width + height) / 2;

  const center = applySvgTransform({ x: cx, y: cy }, transform);
  const diameterMm = avgDiameter * Math.sqrt(Math.abs(transform.a * transform.d - transform.b * transform.c));

  return {
    center,
    diameterMm,
    fill: (attrs.fill && attrs.fill !== 'none') ? attrs.fill : null,
    stroke: (attrs.stroke && attrs.stroke !== 'none') ? attrs.stroke : null,
    group: groupPath,
    originalIndex: index,
  };
}

// ─── Main Import Function ─────────────────────────────────────────────────────

export function importRhinestoneTemplate(options: TemplateImportOptions): TemplateImportResult {
  const { svgText, deduplicateTolerance = DEFAULT_DEDUPLICATE_TOLERANCE } = options;
  const sanitizedSvgText = stripSvgStyleElements(svgText);

  const safety = validateSafeSvgInput(sanitizedSvgText);
  if (!safety.safe) {
    throw new Error(`Unsafe SVG: ${safety.issues.join(', ')}`);
  }

  const warnings: string[] = [];
  const stones: ImportedStone[] = [];
  let ignoredElements = 0;

  // Parse viewBox
  const viewBoxMatch = sanitizedSvgText.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  const viewBox = viewBoxMatch ? parseViewBox(viewBoxMatch[1]) : null;
  const viewBoxWidth = viewBox?.width ?? null;

  // Extract elements (simplified regex-based approach)
  let elementIndex = 0;
  const transformStack: SvgTransform[] = [{ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }];
  const groupStack: string[] = [];

  const lines = sanitizedSvgText.split('\n');
  for (const line of lines) {
    // Handle group start
    const groupMatch = line.match(/<g\s+([^>]+)>/i);
    if (groupMatch) {
      const attrs = parseSvgAttributes(groupMatch[1]!);
      const groupTransform = attrs.transform ? parseSvgTransform(attrs.transform) : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
      const parentTransform = transformStack[transformStack.length - 1]!;
      const combinedTransform = {
        a: parentTransform.a * groupTransform.a + parentTransform.c * groupTransform.b,
        b: parentTransform.b * groupTransform.a + parentTransform.d * groupTransform.b,
        c: parentTransform.a * groupTransform.c + parentTransform.c * groupTransform.d,
        d: parentTransform.b * groupTransform.c + parentTransform.d * groupTransform.d,
        e: parentTransform.a * groupTransform.e + parentTransform.c * groupTransform.f + parentTransform.e,
        f: parentTransform.b * groupTransform.e + parentTransform.d * groupTransform.f + parentTransform.f,
      };
      transformStack.push(combinedTransform);
      groupStack.push(attrs.id || `group-${groupStack.length}`);
      continue;
    }

    // Handle group end
    if (line.includes('</g>')) {
      transformStack.pop();
      groupStack.pop();
      continue;
    }

    // Handle circle, ellipse, path
    const shapeMatch = line.match(/<(circle|ellipse|path)\s+([^>]+)>/i);
    if (shapeMatch) {
      const tag = shapeMatch[1]!.toLowerCase();
      const attrs = parseSvgAttributes(shapeMatch[2]!);
      const elementTransform = attrs.transform ? parseSvgTransform(attrs.transform) : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
      const parentTransform = transformStack[transformStack.length - 1]!;
      const combinedTransform = {
        a: parentTransform.a * elementTransform.a + parentTransform.c * elementTransform.b,
        b: parentTransform.b * elementTransform.a + parentTransform.d * elementTransform.b,
        c: parentTransform.a * elementTransform.c + parentTransform.c * elementTransform.d,
        d: parentTransform.b * elementTransform.c + parentTransform.d * elementTransform.d,
        e: parentTransform.a * elementTransform.e + parentTransform.c * elementTransform.f + parentTransform.e,
        f: parentTransform.b * elementTransform.e + parentTransform.d * elementTransform.f + parentTransform.f,
      };

      const groupPath = groupStack.length > 0 ? groupStack.join('/') : null;

      let stone: ImportedStone | null = null;
      if (tag === 'circle') {
        stone = extractCircleStone(tag, attrs, combinedTransform, viewBoxWidth, elementIndex, groupPath);
      } else if (tag === 'ellipse') {
        stone = extractEllipseStone(tag, attrs, combinedTransform, viewBoxWidth, elementIndex, groupPath);
      } else if (tag === 'path') {
        stone = extractPathStone(tag, attrs, combinedTransform, viewBoxWidth, elementIndex, groupPath);
      }

      if (stone) {
        stones.push(stone);
      } else {
        ignoredElements++;
      }

      elementIndex++;

      if (stones.length > MAX_STONES) {
        warnings.push(`Maximum stone count (${MAX_STONES}) exceeded. Import truncated.`);
        break;
      }
    }
  }

  // Deduplicate
  const uniqueStones: ImportedStone[] = [];
  for (const stone of stones) {
    const isDuplicate = uniqueStones.some(
      (existing) =>
        Math.abs(existing.center.x - stone.center.x) < deduplicateTolerance &&
        Math.abs(existing.center.y - stone.center.y) < deduplicateTolerance
    );
    if (!isDuplicate) {
      uniqueStones.push(stone);
    }
  }

  if (uniqueStones.length < stones.length) {
    warnings.push(`Removed ${stones.length - uniqueStones.length} duplicate stones`);
  }

  // Calculate bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let minCenterX = Infinity, minCenterY = Infinity;
  
  for (const stone of uniqueStones) {
    const r = stone.diameterMm / 2;
    minX = Math.min(minX, stone.center.x - r);
    minY = Math.min(minY, stone.center.y - r);
    maxX = Math.max(maxX, stone.center.x + r);
    maxY = Math.max(maxY, stone.center.y + r);
    minCenterX = Math.min(minCenterX, stone.center.x);
    minCenterY = Math.min(minCenterY, stone.center.y);
  }

  const widthMm = uniqueStones.length > 0 ? maxX - minX : 0;
  const heightMm = uniqueStones.length > 0 ? maxY - minY : 0;

  // Normalize to origin (move leftmost stone center to x=0, topmost to y=0)
  for (const stone of uniqueStones) {
    stone.center.x -= minCenterX;
    stone.center.y -= minCenterY;
  }

  // Collect unique diameters and colors
  const diameterSet = new Set<number>();
  const colorSet = new Set<string>();
  for (const stone of uniqueStones) {
    diameterSet.add(Math.round(stone.diameterMm * 100) / 100);
    const color = stone.fill || stone.stroke;
    if (color) colorSet.add(color);
  }

  return {
    stones: uniqueStones,
    widthMm,
    heightMm,
    detectedDiameters: Array.from(diameterSet).sort((a, b) => a - b),
    detectedColors: Array.from(colorSet),
    ignoredElements,
    warnings,
  };
}
