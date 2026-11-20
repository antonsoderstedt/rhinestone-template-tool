/**
 * Size checks for the HTV studio: does the design fit the garment placement it
 * is on, and will the cut file fit a Cricut mat? Pure functions, all inputs and
 * outputs in millimetres (inches exist only in the formatted text).
 */

import type { GarmentType } from '../components/garmentPreview/garmentCatalog';
import { getMatFit } from '../components/exportDialogHelpers';
import { DEFAULT_HTV_EXPORT_MARGIN_MM } from './htvExport';
import { computeDesignBounds } from './htvGeometry';
import { getPlacementZoneSizeMm, HTV_PLACEMENT_ZONES, type HtvPlacementZone } from './htvPlacementZones';
import type { HtvLayer } from './HtvState';

export const MM_PER_INCH = 25.4;

/** Slack so a design that is 0.2 mm over because of rounding is not reported as too big. */
const FIT_TOLERANCE_MM = 0.5;

export interface SizeMm {
  widthMm: number;
  heightMm: number;
}

export interface HtvSizeIssue {
  id: 'exceeds-placement' | 'needs-large-mat' | 'exceeds-mat';
  /** `warning` should be fixed before cutting; `info` is good to know. */
  severity: 'warning' | 'info';
  message: string;
}

export interface HtvSizeSummary {
  /** Size of the visible artwork on the active placement, or null when there is none. */
  designSizeMm: SizeMm | null;
  /** Print size of the active placement. */
  zoneSizeMm: SizeMm;
  zoneName: string;
  /** True while text outlines are still loading, so the size is not known yet; no issues are reported then. */
  measuring: boolean;
  issues: HtvSizeIssue[];
  /** One sentence with the sizes in mm and inches, for status text. Empty when there is no artwork. */
  sizeText: string;
}

function trimNumber(value: number): string {
  return Number(value.toFixed(1)).toString();
}

export function mmToInches(mm: number): number {
  return mm / MM_PER_INCH;
}

/** `290 × 360 mm (11.4 × 14.2 in)` */
export function formatSizeMmAndInches(size: SizeMm): string {
  return `${trimNumber(size.widthMm)} × ${trimNumber(size.heightMm)} mm (${trimNumber(mmToInches(size.widthMm))} × ${trimNumber(mmToInches(size.heightMm))} in)`;
}

/** `292 mm (11.5 in)` */
export function formatLengthMmAndInches(mm: number): string {
  return `${trimNumber(mm)} mm (${trimNumber(mmToInches(mm))} in)`;
}

export interface ZoneFit {
  fits: boolean;
  /** How far the design sticks out beyond the placement, in mm (0 when it fits that way). */
  overWidthMm: number;
  overHeightMm: number;
}

export function checkZoneFit(design: SizeMm, zone: SizeMm): ZoneFit {
  const overWidthMm = Math.max(0, design.widthMm - zone.widthMm);
  const overHeightMm = Math.max(0, design.heightMm - zone.heightMm);
  return {
    fits: overWidthMm <= FIT_TOLERANCE_MM && overHeightMm <= FIT_TOLERANCE_MM,
    overWidthMm,
    overHeightMm,
  };
}

function zoneName(zone: HtvPlacementZone): string {
  return HTV_PLACEMENT_ZONES.find((item) => item.id === zone)?.displayName.toLowerCase() ?? zone;
}

function describeOverflow(fit: ZoneFit): string {
  const parts: string[] = [];
  if (fit.overWidthMm > FIT_TOLERANCE_MM) parts.push(`${trimNumber(fit.overWidthMm)} mm too wide`);
  if (fit.overHeightMm > FIT_TOLERANCE_MM) parts.push(`${trimNumber(fit.overHeightMm)} mm too tall`);
  return parts.join(' and ');
}

/**
 * Issues for a design of `designSizeMm` on a placement of `zoneSizeMm` that will be cut with a
 * `weedMarginMm` border around it. Used both for the live status (approximate design size) and the
 * export dialog (exact size from the export).
 */
export function findHtvSizeIssues(args: {
  designSizeMm: SizeMm;
  zoneSizeMm: SizeMm;
  zoneName: string;
  weedMarginMm: number;
}): HtvSizeIssue[] {
  const { designSizeMm, zoneSizeMm, weedMarginMm } = args;
  const issues: HtvSizeIssue[] = [];

  const zoneFit = checkZoneFit(designSizeMm, zoneSizeMm);
  if (!zoneFit.fits) {
    issues.push({
      id: 'exceeds-placement',
      severity: 'warning',
      message: `Your design is ${formatSizeMmAndInches(designSizeMm)}, but the ${args.zoneName} area is ${formatSizeMmAndInches(zoneSizeMm)} — it is ${describeOverflow(zoneFit)}. Make it smaller or move it to a larger placement.`,
    });
  }

  const cutFile: SizeMm = {
    widthMm: designSizeMm.widthMm + weedMarginMm * 2,
    heightMm: designSizeMm.heightMm + weedMarginMm * 2,
  };
  const mat = getMatFit(cutFile.widthMm, cutFile.heightMm);
  if (mat.status === 'fits-12x24') {
    issues.push({
      id: 'needs-large-mat',
      severity: 'info',
      message: `The cut file is ${formatSizeMmAndInches(cutFile)}, which needs a 12 × 24 in Cricut mat${mat.needsRotation ? ' (turn the design 90° in Design Space)' : ''}.`,
    });
  } else if (mat.status === 'too-large') {
    issues.push({
      id: 'exceeds-mat',
      severity: 'warning',
      message: `The cut file is ${formatSizeMmAndInches(cutFile)}, which is larger than a 12 × 24 in Cricut mat (about 292 × 597 mm usable). Make the design smaller or cut it in parts.`,
    });
  }

  return issues;
}

/**
 * Live size summary for the active placement's layers.
 *
 * @param measuredTextSizes Real outline sizes of text layers, by layer id (see `useMeasuredTextSizes`).
 *   A visible text layer without an entry is still loading; the summary then has `measuring: true`
 *   and no issues, instead of warning about a guessed size.
 */
export function summarizeHtvSize(
  layers: readonly HtvLayer[],
  placementZone: HtvPlacementZone,
  garmentType: GarmentType,
  weedMarginMm: number = DEFAULT_HTV_EXPORT_MARGIN_MM,
  measuredTextSizes: ReadonlyMap<string, { width: number; height: number }> = new Map(),
): HtvSizeSummary {
  const zoneSizeMm = getPlacementZoneSizeMm(garmentType, placementZone);
  const name = zoneName(placementZone);
  const placementLayers = layers.filter((layer) => layer.placementId === placementZone);
  const stillMeasuring = placementLayers.some(
    (layer) => layer.visible && layer.type === 'text' && layer.text.trim() !== '' && !measuredTextSizes.has(layer.id),
  );
  const empty: HtvSizeSummary = { designSizeMm: null, zoneSizeMm, zoneName: name, measuring: false, issues: [], sizeText: '' };
  if (stillMeasuring) return { ...empty, measuring: true };

  const bounds = computeDesignBounds(placementLayers, measuredTextSizes);
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return empty;

  const designSizeMm = { widthMm: bounds.width, heightMm: bounds.height };
  return {
    ...empty,
    designSizeMm,
    issues: findHtvSizeIssues({ designSizeMm, zoneSizeMm, zoneName: name, weedMarginMm }),
    sizeText: `Design size ${formatSizeMmAndInches(designSizeMm)} on a ${formatSizeMmAndInches(zoneSizeMm)} ${name} area.`,
  };
}
