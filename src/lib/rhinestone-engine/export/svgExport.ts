/**
 * Cricut-safe SVG export for rhinestone templates.
 *
 * Rules enforced here:
 * - Physical dimensions are always in mm — never px.
 * - Every hole is a <circle> element — never rasterized.
 * - No <image>, no <use>, no nested <svg>.
 * - Output is a plain UTF-8 string — no DOM, no canvas.
 * - Output is deterministic: same template + options → byte-identical SVG.
 */

import type { RhinestoneTemplate, ExportOptions, Stone } from '../types/index.js';
import { circleToStoneCircle } from '../geometry/circle.js';
import { calculateBounds, expandBounds } from '../geometry/bounds.js';
import { roundMm } from '../geometry/rounding.js';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Escapes characters that would break SVG/XML: &, <, >, ", '
 * Must be applied to every user-supplied string written into the SVG.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formats a number to `decimalPlaces` decimal places using roundMm,
 * then converts to a string. Suitable for SVG coordinate output.
 */
function formatNumber(value: number, decimalPlaces: number): string {
  return roundMm(value, decimalPlaces).toString();
}

/** Resolves ExportOptions to fully-populated values with defaults applied. */
interface ResolvedOptions {
  includeGuideBox: boolean;
  includeLabels: boolean;
  paddingMm: number;
  decimalPlaces: number;
}

function resolveOptions(options: ExportOptions): ResolvedOptions {
  return {
    includeGuideBox: options.includeGuideBox ?? false,
    includeLabels: options.includeLabels ?? false,
    paddingMm: options.paddingMm ?? 5,
    decimalPlaces: options.decimalPlaces ?? 3,
  };
}

// ─── Stone rendering ──────────────────────────────────────────────────────────

function renderStoneCircle(stone: Stone, dp: number): string {
  const cx = formatNumber(stone.center.x, dp);
  const cy = formatNumber(stone.center.y, dp);
  const r = formatNumber(stone.holeDiameterMm / 2, dp);
  const safeId = escapeXml(stone.id);
  const safeSize = escapeXml(stone.stoneSize);
  const holeDiameter = formatNumber(stone.holeDiameterMm, dp);

  return (
    `    <circle` +
    ` id="stone-${safeId}"` +
    ` cx="${cx}"` +
    ` cy="${cy}"` +
    ` r="${r}"` +
    ` fill="none"` +
    ` stroke="#000000"` +
    ` stroke-width="0.05"` +
    ` data-stone-id="${safeId}"` +
    ` data-stone-size="${safeSize}"` +
    ` data-hole-diameter-mm="${holeDiameter}"` +
    ` />`
  );
}

function renderStoneLabel(stone: Stone, dp: number): string {
  const cx = formatNumber(stone.center.x, dp);
  const cy = formatNumber(stone.center.y, dp);
  const safeSize = escapeXml(stone.stoneSize);
  // Font size: 30 % of hole diameter so it fits inside the circle
  const fontSize = formatNumber(stone.holeDiameterMm * 0.3, dp);
  return (
    `    <text` +
    ` x="${cx}"` +
    ` y="${cy}"` +
    ` text-anchor="middle"` +
    ` dominant-baseline="middle"` +
    ` font-size="${fontSize}mm"` +
    ` fill="#666666"` +
    `>${safeSize}</text>`
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Serialises a RhinestoneTemplate to a Cricut-safe SVG string.
 *
 * Physical rules:
 * - `width` and `height` are expressed in mm units on the root <svg> element.
 * - `viewBox` uses the same mm coordinate space.
 * - Every stone is a `<circle>` — never a path, rect, or raster image.
 *
 * @throws {Error} if `template.unit` is not `"mm"`.
 */
export function createBasicSvgExport(
  template: RhinestoneTemplate,
  options: ExportOptions = {},
): string {
  // ── Guard ──────────────────────────────────────────────────────────────────
  if (template.unit !== 'mm') {
    throw new Error(
      `createBasicSvgExport requires template.unit === "mm", got "${template.unit}". ` +
        `All internal measurements must be in millimeters.`,
    );
  }

  const opts = resolveOptions(options);
  const dp = opts.decimalPlaces;

  // ── Determine canvas size ──────────────────────────────────────────────────
  let minX: number;
  let minY: number;
  let canvasWidth: number;
  let canvasHeight: number;

  if (template.stones.length === 0) {
    // No stones — use declared dimensions if available, otherwise 0×0
    minX = 0;
    minY = 0;
    canvasWidth = template.widthMm ?? 0;
    canvasHeight = template.heightMm ?? 0;
  } else {
    const stoneCircles = template.stones.map(circleToStoneCircle);
    const rawBounds = calculateBounds(stoneCircles);
    const padded = expandBounds(rawBounds, opts.paddingMm);
    minX = padded.minX;
    minY = padded.minY;
    canvasWidth = padded.width;
    canvasHeight = padded.height;
  }

  const fMinX = formatNumber(minX, dp);
  const fMinY = formatNumber(minY, dp);
  const fWidth = formatNumber(canvasWidth, dp);
  const fHeight = formatNumber(canvasHeight, dp);

  const safeTemplateId = escapeXml(template.id);
  const safeTemplateName = escapeXml(template.name);

  // ── Layers ─────────────────────────────────────────────────────────────────
  const lines: string[] = [];

  // Guide box layer
  if (opts.includeGuideBox && template.stones.length > 0) {
    lines.push(`  <g id="guide">`);
    lines.push(
      `    <rect` +
        ` x="${fMinX}"` +
        ` y="${fMinY}"` +
        ` width="${fWidth}"` +
        ` height="${fHeight}"` +
        ` fill="none"` +
        ` stroke="#cccccc"` +
        ` stroke-width="0.1"` +
        ` />`,
    );
    lines.push(`  </g>`);
  } else {
    lines.push(`  <g id="guide" />`);
  }

  // Stones layer
  lines.push(`  <g id="stones">`);
  for (const stone of template.stones) {
    lines.push(renderStoneCircle(stone, dp));
  }
  lines.push(`  </g>`);

  // Labels layer
  if (opts.includeLabels && template.stones.length > 0) {
    lines.push(`  <g id="labels">`);
    for (const stone of template.stones) {
      lines.push(renderStoneLabel(stone, dp));
    }
    lines.push(`  </g>`);
  } else {
    lines.push(`  <g id="labels" />`);
  }

  // ── Assemble SVG ───────────────────────────────────────────────────────────
  const svgLines: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg`,
    `  xmlns="http://www.w3.org/2000/svg"`,
    `  width="${fWidth}mm"`,
    `  height="${fHeight}mm"`,
    `  viewBox="${fMinX} ${fMinY} ${fWidth} ${fHeight}"`,
    `  data-template-id="${safeTemplateId}"`,
    `  data-template-name="${safeTemplateName}"`,
    `  data-unit="mm"`,
    `>`,
    `  <title>${safeTemplateName}</title>`,
    `  <desc>Rhinestone template — ${safeTemplateName} — ${template.stones.length} stone(s)</desc>`,
    ...lines,
    `</svg>`,
  ];

  return svgLines.join('\n');
}
