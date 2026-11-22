/**
 * HTV studio status. Reflects only HTV concerns (what will be exported for the
 * active placement). It is deliberately independent of the rhinestone
 * calibration gate: HTV export is not gated by a calibration profile.
 */

import { HTV_PLACEMENT_ZONES, type HtvPlacementZone } from './htvPlacementZones';
import type { HtvSizeSummary } from './htvSizeCheck';

export type HtvStatusLevel = 'Ready' | 'Warning' | 'Blocked';

export interface HtvStatusChip {
  label: string;
  tone: 'neutral' | 'success' | 'warning';
}

export interface HtvStatusSummary {
  status: HtvStatusLevel;
  guidance: string;
  /** The same facts as short chips for the status bar. */
  chips: HtvStatusChip[];
  activeLayerCount: number;
  otherPlacementLayerCount: number;
}

interface HtvStatusLayerLike {
  placementId: HtvPlacementZone;
}

function getZoneLabel(zone: HtvPlacementZone): string {
  return HTV_PLACEMENT_ZONES.find((item) => item.id === zone)?.displayName.toLowerCase() ?? zone;
}

function pluralizeLayer(count: number): string {
  return `${count} layer${count === 1 ? '' : 's'}`;
}

/**
 * @param size Optional size summary (see `summarizeHtvSize`). When the design does not fit its
 *   placement or the mat, the status becomes a warning and says why; otherwise the design size is
 *   appended to the guidance.
 */
export function summarizeHtvStatus(
  layers: readonly HtvStatusLayerLike[],
  activePlacementZone: HtvPlacementZone,
  size?: HtvSizeSummary | null,
): HtvStatusSummary {
  const activeLayerCount = layers.filter((layer) => layer.placementId === activePlacementZone).length;
  const otherPlacementLayerCount = layers.length - activeLayerCount;
  const zoneLabel = getZoneLabel(activePlacementZone);

  if (activeLayerCount === 0 && otherPlacementLayerCount === 0) {
    return {
      status: 'Warning',
      guidance: 'Nothing to export yet. Add text, artwork or a shape to start your design.',
      chips: [{ label: 'Nothing to export yet', tone: 'warning' }],
      activeLayerCount,
      otherPlacementLayerCount,
    };
  }

  if (activeLayerCount === 0) {
    return {
      status: 'Warning',
      guidance: `The ${zoneLabel} placement is empty, so there is nothing to export. ${pluralizeLayer(otherPlacementLayerCount)} sit on other placements; export includes only the active placement.`,
      chips: [{ label: `Empty ${zoneLabel} placement`, tone: 'warning' }, { label: `${pluralizeLayer(otherPlacementLayerCount)} elsewhere, not exported`, tone: 'neutral' }],
      activeLayerCount,
      otherPlacementLayerCount,
    };
  }

  const otherNote = otherPlacementLayerCount > 0
    ? ` ${pluralizeLayer(otherPlacementLayerCount)} on other placements will not be included in this export.`
    : '';

  const sizeIssues = size?.issues ?? [];
  const sizeWarnings = sizeIssues.filter((issue) => issue.severity === 'warning');
  const chips: HtvStatusChip[] = [{ label: `${pluralizeLayer(activeLayerCount)} · ${zoneLabel}`, tone: 'neutral' }];
  if (size?.designSizeMm) chips.push({ label: `${Math.round(size.designSizeMm.widthMm)} × ${Math.round(size.designSizeMm.heightMm)} mm`, tone: 'neutral' });
  const issueIds = new Set(sizeIssues.map((issue) => issue.id));
  if (issueIds.has('exceeds-placement')) chips.push({ label: 'Bigger than the placement area', tone: 'warning' });
  if (issueIds.has('exceeds-mat')) chips.push({ label: 'Too big for a mat', tone: 'warning' });
  else if (issueIds.has('needs-large-mat')) chips.push({ label: 'Needs a 12 × 24 in mat', tone: 'warning' });
  else if (size?.designSizeMm) chips.push({ label: 'Fits a 12 × 12 in mat', tone: 'success' });
  if (otherPlacementLayerCount > 0) chips.push({ label: `${pluralizeLayer(otherPlacementLayerCount)} elsewhere, not exported`, tone: 'neutral' });

  const sizeNote = size?.sizeText ? ` ${size.sizeText}` : '';
  const issueNote = sizeIssues.length > 0 ? ` ${sizeIssues.map((issue) => issue.message).join(' ')}` : '';

  if (sizeWarnings.length > 0) {
    return {
      status: 'Warning',
      // The warning already states the design size, so the plain size sentence is left out here.
      guidance: `${pluralizeLayer(activeLayerCount)} on the ${zoneLabel} placement.${issueNote}${otherNote}`,
      chips,
      activeLayerCount,
      otherPlacementLayerCount,
    };
  }

  return {
    status: 'Ready',
    guidance: `${pluralizeLayer(activeLayerCount)} on the ${zoneLabel} placement ${activeLayerCount === 1 ? 'is' : 'are'} ready to export.${sizeNote}${issueNote}${otherNote}`,
    chips,
    activeLayerCount,
    otherPlacementLayerCount,
  };
}
