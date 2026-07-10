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
