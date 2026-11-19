/**
 * HTV studio status. Reflects only HTV concerns (what will be exported for the
 * active placement). It is deliberately independent of the rhinestone
 * calibration gate: HTV export is not gated by a calibration profile.
 */

import { HTV_PLACEMENT_ZONES, type HtvPlacementZone } from './htvPlacementZones';

export type HtvStatusLevel = 'Ready' | 'Warning' | 'Blocked';

export interface HtvStatusSummary {
  status: HtvStatusLevel;
  guidance: string;
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

export function summarizeHtvStatus(
  layers: readonly HtvStatusLayerLike[],
  activePlacementZone: HtvPlacementZone,
): HtvStatusSummary {
  const activeLayerCount = layers.filter((layer) => layer.placementId === activePlacementZone).length;
  const otherPlacementLayerCount = layers.length - activeLayerCount;
  const zoneLabel = getZoneLabel(activePlacementZone);

  if (activeLayerCount === 0 && otherPlacementLayerCount === 0) {
    return {
      status: 'Warning',
      guidance: 'Nothing to export yet. Add text, artwork or a shape to start your design.',
      activeLayerCount,
      otherPlacementLayerCount,
    };
  }

  if (activeLayerCount === 0) {
    return {
      status: 'Warning',
      guidance: `The ${zoneLabel} placement is empty, so there is nothing to export. ${pluralizeLayer(otherPlacementLayerCount)} sit on other placements; export includes only the active placement.`,
      activeLayerCount,
      otherPlacementLayerCount,
    };
  }

  const otherNote = otherPlacementLayerCount > 0
    ? ` ${pluralizeLayer(otherPlacementLayerCount)} on other placements will not be included in this export.`
    : '';

  return {
    status: 'Ready',
    guidance: `${pluralizeLayer(activeLayerCount)} on the ${zoneLabel} placement ${activeLayerCount === 1 ? 'is' : 'are'} ready to export.${otherNote}`,
    activeLayerCount,
    otherPlacementLayerCount,
  };
}
