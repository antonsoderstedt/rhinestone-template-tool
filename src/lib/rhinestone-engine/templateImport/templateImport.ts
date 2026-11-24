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
  /**
   * Scale the drawing to the page width the file states (`width="300mm"` with a viewBox in other units, as CorelDRAW writes
   * it). Off by default: the alphabet readers are built on viewBox units being taken as mm. On for templates a user imports.
   */
  applyPageScale?: boolean;
}

// ─── Configuration ────────────────────────────────────────────────────────────

const DEFAULT_DEDUPLICATE_TOLERANCE = 0.01; // mm
const ELLIPSE_CIRCULARITY_TOLERANCE = 0.15; // Max deviation from 1.0 aspect ratio (was 0.1)
const PATH_CIRCULARITY_TOLERANCE = 0.15;
const MAX_STONES = 50000;

// ─── Stone Size Estimation ────────────────────────────────────────────────────

/**
 * A circle in an imported template can be drawn at the size of the stone or at the size of the hole cut for it (a little
 * larger). Each stone size is matched against both, and the nearest wins; the result is only a fallback label, the circle
 * itself keeps its diameter. Holes are the Magic Flock values; stones the typical sizes.
 */
const STONE_SIZE_TARGETS: Array<{ id: StoneSizeId; stoneMm: number; holeMm: number }> = [
  { id: 'SS6', stoneMm: 2.0, holeMm: 2.54 },
  { id: 'SS8', stoneMm: 2.4, holeMm: 3.0 },
  { id: 'SS10', stoneMm: 2.8, holeMm: 3.43 },
  { id: 'SS12', stoneMm: 3.1, holeMm: 3.8 },
  { id: 'SS16', stoneMm: 3.9, holeMm: 4.394 },
  { id: 'SS20', stoneMm: 4.7, holeMm: 5.283 },
];
const STONE_SIZE_MATCH_TOLERANCE_MM = 0.3;

export function estimateStoneSizeId(diameterMm: number): StoneSizeId | null {
  let bestMatch: StoneSizeId | null = null;
  let minDistance = Infinity;

  for (const { id, stoneMm, holeMm } of STONE_SIZE_TARGETS) {
    const distance = Math.min(Math.abs(diameterMm - stoneMm), Math.abs(diameterMm - holeMm));
    if (distance <= STONE_SIZE_MATCH_TOLERANCE_MM && distance < minDistance) {
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

const IDENTITY_TRANSFORM: SvgTransform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

function combineTransforms(parent: SvgTransform, local: SvgTransform): SvgTransform {
  return {
    a: parent.a * local.a + parent.c * local.b,
    b: parent.b * local.a + parent.d * local.b,
    c: parent.a * local.c + parent.c * local.d,
    d: parent.b * local.c + parent.d * local.d,
    e: parent.a * local.e + parent.c * local.f + parent.e,
    f: parent.b * local.e + parent.d * local.f + parent.f,
  };
}

export function importRhinestoneTemplate(options: TemplateImportOptions): TemplateImportResult {
  const { svgText, deduplicateTolerance = DEFAULT_DEDUPLICATE_TOLERANCE, applyPageScale = false } = options;
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

  // A file that says how big the page is (width="300mm") and draws in other units (viewBox 0 0 30000 29700, as CorelDRAW
  // exports it) is scaled so one unit is what the page says it is. Without a real-world width the units are taken as mm.
  const rootTag = sanitizedSvgText.match(/<\s*svg\b[^>]*>/i)?.[0] ?? '';
  const rootWidth = rootTag.match(/\swidth\s*=\s*["']\s*([\d.]+)\s*(mm|cm|in)\s*["']/i);
  let rootScale = 1;
  if (applyPageScale && rootWidth && viewBox && viewBox.width > 0) {
    const widthMm = parseFloat(rootWidth[1]!) * (rootWidth[2]!.toLowerCase() === 'cm' ? 10 : rootWidth[2]!.toLowerCase() === 'in' ? 25.4 : 1);
    if (Number.isFinite(widthMm) && widthMm > 0) rootScale = widthMm / viewBox.width;
  }

  let elementIndex = 0;
  const transformStack: SvgTransform[] = [rootScale === 1 ? IDENTITY_TRANSFORM : { a: rootScale, b: 0, c: 0, d: rootScale, e: 0, f: 0 }];
  const groupStack: string[] = [];
  const tagPattern = /<\s*(\/?)\s*(g|circle|ellipse|path)\b[^>]*>/gi;

  for (const match of sanitizedSvgText.matchAll(tagPattern)) {
    const rawTag = match[0]!;
    const closing = match[1] === '/';
    const tag = match[2]!.toLowerCase();

    if (tag === 'g') {
      if (closing) {
        if (transformStack.length > 1) {
          transformStack.pop();
          groupStack.pop();
        }
        continue;
      }

      if (/\/\s*>$/.test(rawTag)) {
        continue;
      }

      const attrs = parseSvgAttributes(rawTag);
      const groupTransform = attrs.transform ? parseSvgTransform(attrs.transform) : IDENTITY_TRANSFORM;
      const parentTransform = transformStack[transformStack.length - 1]!;
      transformStack.push(combineTransforms(parentTransform, groupTransform));
      groupStack.push(attrs.id || `group-${groupStack.length}`);
      continue;
    }

    const attrs = parseSvgAttributes(rawTag);
    const elementTransform = attrs.transform ? parseSvgTransform(attrs.transform) : IDENTITY_TRANSFORM;
    const parentTransform = transformStack[transformStack.length - 1]!;
    const combinedTransform = combineTransforms(parentTransform, elementTransform);
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

  if (stones.length === 0) {
    warnings.push('No supported circular stone shapes were found in this SVG.');
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
