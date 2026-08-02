/**
 * SVG Upload v1 — Safe SVG Parser
 *
 * ⚠️  This is NOT a full SVG renderer or parser.
 * It is a minimal, security-conscious extractor for supported SVG primitive
 * elements (line, polyline, polygon, rect, circle, ellipse, path).
 *
 * Guarantees:
 * - Never executes scripts
 * - Never fetches external resources
 * - Never renders the uploaded SVG
 * - Uses no browser DOM APIs (works in Node.js test environments)
 *
 * Unknown or unsupported elements are silently ignored.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedSvgElement {
  tagName: string;
  attributes: Record<string, string>;
}

export interface SvgSafetyResult {
  safe: boolean;
  issues: string[];
}

export type SvgUploadSuggestedMode = 'outline' | 'outline-fill';

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPPORTED_ELEMENT_TAGS = new Set([
  'line', 'polyline', 'polygon', 'rect', 'circle', 'ellipse', 'path',
]);

/**
 * Patterns that indicate the SVG is potentially dangerous.
 * Any match marks the SVG as unsafe and the issue label is reported.
 */
const UNSAFE_PATTERNS: Array<[RegExp, string]> = [
  [/<script/i, '<script'],
  [/<foreignObject/i, '<foreignObject'],
  [/\bonload\s*=/i, 'onload='],
  [/\bonclick\s*=/i, 'onclick='],
  [/javascript:/i, 'javascript:'],
  [/\bhref\s*=/i, 'href='],
  [/xlink:href\s*=/i, 'xlink:href='],
  [/<image/i, '<image'],
  [/<style/i, '<style'],
  [/data:/i, 'data:'],
  [/@import/i, '@import'],
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parses SVG attribute key-value pairs from a tag string or an attribute string.
 *
 * Accepts both:
 * - A full opening tag:  `<circle cx="10" cy="20" r="5" />`
 * - A bare attribute string:  `cx="10" cy="20" r="5"`
 *
 * Attribute names are lowercased. Values from either double or single quotes
 * are extracted. Attributes without a value are ignored.
 */
export function parseSvgAttributes(input: string): Record<string, string> {
  const attrs: Record<string, string> = {};

  // Strip tag name if this looks like a full opening tag
  const attrStr = input.trimStart().startsWith('<')
    ? input.replace(/^<\s*[\w][\w\-:.]*/, '').replace(/\s*\/?>?\s*$/, '')
    : input;

  const re = /([\w\-:.]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(attrStr)) !== null) {
    const name = m[1]!.toLowerCase();
    const value = m[2] !== undefined ? m[2] : (m[3] ?? '');
    attrs[name] = value;
  }

  return attrs;
}

/**
 * Checks an SVG string for known dangerous patterns.
 *
 * Returns `{ safe: true, issues: [] }` when the SVG passes all checks.
 * Returns `{ safe: false, issues: [...] }` when any dangerous pattern is found.
 *
 * This check must be performed before any further processing of uploaded SVG.
 */
export function validateSafeSvgInput(svgString: string): SvgSafetyResult {
  const issues: string[] = [];
  for (const [re, label] of UNSAFE_PATTERNS) {
    if (re.test(svgString)) {
      issues.push(`Unsafe pattern detected: "${label}"`);
    }
  }
  return { safe: issues.length === 0, issues };
}

export function stripSvgStyleElements(svgString: string): string {
  return svgString.replace(/<style\b[\s\S]*?<\/style>/gi, '');
}

function extractStyleBlocks(svgString: string): string[] {
  return Array.from(svgString.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi), (match) => match[1] ?? '');
}

function collectClassPresentationValues(svgString: string, property: 'fill' | 'stroke'): Map<string, string> {
  const classValues = new Map<string, string>();
  const propertyPattern = new RegExp(`\\.${String.raw`([_a-zA-Z][\w-]*)`}\\s*\\{[\\s\\S]*?\\b${property}\\s*:\\s*([^;\\}]+)`, 'gi');

  for (const styleBlock of extractStyleBlocks(svgString)) {
    let match: RegExpExecArray | null;
    while ((match = propertyPattern.exec(styleBlock)) !== null) {
      classValues.set(match[1]!, match[2]!.trim().toLowerCase());
    }
  }

  return classValues;
}

function getInlineStyleProperty(styleValue: string | undefined, property: 'fill' | 'stroke'): string | undefined {
  if (!styleValue) return undefined;
  const match = styleValue.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'i'));
  return match?.[1]?.trim().toLowerCase();
}

function getClassPropertyValue(className: string | undefined, values: Map<string, string>): string | undefined {
  if (!className) return undefined;
  for (const token of className.split(/\s+/)) {
    const value = values.get(token);
    if (value !== undefined) return value;
  }
  return undefined;
}

function resolvePresentationProperty(
  attrs: Record<string, string>,
  property: 'fill' | 'stroke',
  classValues: Map<string, string>,
): string | undefined {
  return attrs[property]?.trim().toLowerCase()
    ?? getInlineStyleProperty(attrs.style, property)
    ?? getClassPropertyValue(attrs.class, classValues);
}

function isClosedSvgElement(tagName: string, attrs: Record<string, string>): boolean {
  switch (tagName) {
    case 'rect':
    case 'circle':
    case 'ellipse':
    case 'polygon':
      return true;
    case 'path':
      return /[Zz]/.test(attrs.d ?? '');
    default:
      return false;
  }
}

export function suggestSvgUploadMode(svgString: string): SvgUploadSuggestedMode {
  const fillValues = collectClassPresentationValues(svgString, 'fill');
  const strokeValues = collectClassPresentationValues(svgString, 'stroke');
  const elements = extractSvgElements(stripSvgStyleElements(svgString));

  for (const element of elements) {
    if (!isClosedSvgElement(element.tagName, element.attributes)) continue;

    const fill = resolvePresentationProperty(element.attributes, 'fill', fillValues);
    const stroke = resolvePresentationProperty(element.attributes, 'stroke', strokeValues);

    if (fill === 'none') continue;
    if (fill === undefined && stroke !== undefined && stroke !== 'none') continue;

    return 'outline-fill';
  }

  return 'outline';
}

/**
 * Extracts all supported primitive elements from an SVG string.
 *
 * Supported tags: line, polyline, polygon, rect, circle, ellipse, path.
 * All other tags are silently ignored.
 *
 * Does NOT call validateSafeSvgInput — callers must validate first.
 */
export function extractSvgElements(svgString: string): ParsedSvgElement[] {
  const elements: ParsedSvgElement[] = [];

  // Matches self-closing and regular opening tags for supported elements.
  // [^>] matches any char including \n, so multi-line attribute lists work.
  const re = /<([\w][\w\-:.]*)\b([^>]*?)\s*\/?>/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(svgString)) !== null) {
    const tagName = m[1]!.toLowerCase();
    if (SUPPORTED_ELEMENT_TAGS.has(tagName)) {
      elements.push({
        tagName,
        attributes: parseSvgAttributes(m[2] ?? ''),
      });
    }
  }

  return elements;
}
