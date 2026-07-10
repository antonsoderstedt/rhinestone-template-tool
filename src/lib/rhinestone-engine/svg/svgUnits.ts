/**
 * SVG root attribute utilities.
 *
 * These functions extract metadata from the root <svg> element (viewBox,
 * width, height). They do not modify coordinates or rescale anything.
 *
 * This is groundwork for future physical-size normalization:
 * when an SVG has a viewBox and explicit width/height in mm, we will be
 * able to map SVG user units to mm automatically. For now, coordinates
 * from the SVG are passed through as-is.
 *
 * Uses no browser DOM APIs — works in Node.js test environments.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SvgViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export interface SvgRootAttributes {
  /** Parsed viewBox values, or null if no viewBox attribute is present. */
  viewBox: SvgViewBox | null;
  /** Raw value of the width attribute on the root <svg>, or null. */
  width: string | null;
  /** Raw value of the height attribute on the root <svg>, or null. */
  height: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the attribute string from the root `<svg>` opening tag, or null. */
function extractSvgTagAttrs(svgString: string): string | null {
  const match = svgString.match(/<svg\b([^>]*?)>/i);
  return match ? (match[1] ?? '') : null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parses the `viewBox` attribute of the root `<svg>` element.
 *
 * Returns `null` if the SVG has no `<svg>` tag or no `viewBox` attribute.
 */
export function parseSvgViewBox(svgString: string): SvgViewBox | null {
  const attrStr = extractSvgTagAttrs(svgString);
  if (attrStr === null) return null;

  const vbMatch = attrStr.match(/\bviewBox\s*=\s*["']([^"']*)["']/i);
  if (!vbMatch) return null;

  const nums = (
    vbMatch[1]!.match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? []
  ).map(Number);
  if (nums.length < 4) return null;

  return { minX: nums[0]!, minY: nums[1]!, width: nums[2]!, height: nums[3]! };
}

/**
 * Returns the `viewBox`, `width`, and `height` attributes of the root
 * `<svg>` element.
 *
 * All values are raw strings (e.g., `"100mm"`, `"50%"`) — no conversion is
 * applied. Returns null for missing attributes.
 */
export function getSvgRootAttributes(svgString: string): SvgRootAttributes {
  const attrStr = extractSvgTagAttrs(svgString);
  if (attrStr === null) {
    return { viewBox: null, width: null, height: null };
  }

  const viewBox = parseSvgViewBox(svgString);

  const widthMatch  = attrStr.match(/(?:^|\s)width\s*=\s*["']([^"']*)["']/i);
  const heightMatch = attrStr.match(/(?:^|\s)height\s*=\s*["']([^"']*)["']/i);

  return {
    viewBox,
    width:  widthMatch  ? widthMatch[1]!  : null,
    height: heightMatch ? heightMatch[1]! : null,
  };
}
