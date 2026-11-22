/**
 * DXF and EPS export of a rhinestone template, for cutters and programs that do not read SVG.
 *
 * Both are plain-text vector formats: every stone hole is a circle (a DXF CIRCLE, a PostScript arc), nothing is rasterised, and the
 * output is deterministic. Lengths are millimetres. The origin is the bottom-left of the padded design (both formats have y
 * pointing up, SVG has it pointing down, so y is flipped).
 */

import type { RhinestoneTemplate } from '../types/index';

export interface VectorExportOptions {
  /** Empty space around the stones (mm). Default 0. */
  paddingMm?: number;
  /** Decimal places. Default 3. */
  decimalPlaces?: number;
}

interface Frame {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

function frameOf(template: RhinestoneTemplate, padding: number): Frame {
  if (template.stones.length === 0) return { minX: 0, minY: 0, width: template.widthMm ?? 0, height: template.heightMm ?? 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stone of template.stones) {
    const r = stone.holeDiameterMm / 2;
    minX = Math.min(minX, stone.center.x - r);
    minY = Math.min(minY, stone.center.y - r);
    maxX = Math.max(maxX, stone.center.x + r);
    maxY = Math.max(maxY, stone.center.y + r);
  }
  return { minX: minX - padding, minY: minY - padding, width: maxX - minX + padding * 2, height: maxY - minY + padding * 2 };
}

function guard(template: RhinestoneTemplate, name: string) {
  if (template.unit !== 'mm') throw new Error(`${name} requires template.unit === "mm", got "${template.unit}".`);
}

const num = (value: number, dp: number) => {
  const text = value.toFixed(dp);
  return Number(text) === 0 ? '0' : text;
};

/** Stones in a stable order (top to bottom, then left to right) so the same design always gives the same file. */
function ordered(template: RhinestoneTemplate) {
  return [...template.stones].sort((a, b) => a.center.y - b.center.y || a.center.x - b.center.x || a.id.localeCompare(b.id));
}

/** ASCII DXF (AutoCAD R12 style): units in millimetres, one layer `STONES`, one CIRCLE per stone. */
export function createDxfExport(template: RhinestoneTemplate, options: VectorExportOptions = {}): string {
  guard(template, 'createDxfExport');
  const dp = options.decimalPlaces ?? 3;
  const frame = frameOf(template, options.paddingMm ?? 0);
  const lines: string[] = [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$ACADVER', '1', 'AC1009',
    '9', '$INSUNITS', '70', '4',
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'TABLES',
    '0', 'TABLE', '2', 'LAYER', '70', '1',
    '0', 'LAYER', '2', 'STONES', '70', '0', '62', '7', '6', 'CONTINUOUS',
    '0', 'ENDTAB',
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
  ];
  for (const stone of ordered(template)) {
    const x = stone.center.x - frame.minX;
    const y = frame.height - (stone.center.y - frame.minY);
    lines.push('0', 'CIRCLE', '8', 'STONES', '10', num(x, dp), '20', num(y, dp), '30', '0', '40', num(stone.holeDiameterMm / 2, dp));
  }
  lines.push('0', 'ENDSEC', '0', 'EOF');
  return `${lines.join('\n')}\n`;
}

const POINTS_PER_MM = 72 / 25.4;

/** Encapsulated PostScript: a bounding box in points, one stroked circle per stone, hairline stroke. */
export function createEpsExport(template: RhinestoneTemplate, options: VectorExportOptions = {}): string {
  guard(template, 'createEpsExport');
  const dp = options.decimalPlaces ?? 3;
  const frame = frameOf(template, options.paddingMm ?? 0);
  const pt = (mm: number) => num(mm * POINTS_PER_MM, dp);
  const lines: string[] = [
    '%!PS-Adobe-3.0 EPSF-3.0',
    `%%BoundingBox: 0 0 ${Math.ceil(frame.width * POINTS_PER_MM)} ${Math.ceil(frame.height * POINTS_PER_MM)}`,
    `%%HiResBoundingBox: 0 0 ${pt(frame.width)} ${pt(frame.height)}`,
    '%%Creator: Rhinestone Studio',
    `%%Title: ${template.name.replace(/[^\w .-]+/g, '')}`,
    '%%EndComments',
    '0.1 setlinewidth',
    '0 0 0 setrgbcolor',
  ];
  for (const stone of ordered(template)) {
    const x = stone.center.x - frame.minX;
    const y = frame.height - (stone.center.y - frame.minY);
    lines.push(`newpath ${pt(x)} ${pt(y)} ${pt(stone.holeDiameterMm / 2)} 0 360 arc stroke`);
  }
  lines.push('showpage', '%%EOF');
  return `${lines.join('\n')}\n`;
}
