/**
 * HTV placement zones across the garment mockup views.
 */

import type { GarmentType } from '../components/garmentPreview/garmentCatalog';

export type HtvPlacementZone = 'full-front' | 'left-chest' | 'right-chest' | 'full-back' | 'left-sleeve' | 'right-sleeve';
export type HtvPlacementView = 'front' | 'back' | 'left' | 'right';

export interface PlacementZoneDefinition {
  id: HtvPlacementZone;
  displayName: string;
  description: string;
  view: HtvPlacementView;
}

export const HTV_PLACEMENT_ZONES: readonly PlacementZoneDefinition[] = [
  { id: 'full-front', displayName: 'Full front', description: 'Front · 290 x 360 mm', view: 'front' },
  { id: 'left-chest', displayName: 'Left chest', description: 'Front · 120 x 120 mm', view: 'front' },
  { id: 'right-chest', displayName: 'Right chest', description: 'Front · 120 x 120 mm', view: 'front' },
  { id: 'full-back', displayName: 'Full back', description: 'Back · 290 x 420 mm', view: 'back' },
  { id: 'left-sleeve', displayName: 'Left sleeve', description: 'Left · 90 x 260 mm', view: 'left' },
  { id: 'right-sleeve', displayName: 'Right sleeve', description: 'Right · 90 x 260 mm', view: 'right' },
];

interface ZoneBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Reference zone boxes in the shared garment illustration viewBox. */
const TSHIRT_ZONE_BOXES: Record<HtvPlacementZone, ZoneBox> = {
  'full-front': { x: 105, y: 150, width: 190, height: 260 },
  'left-chest': { x: 155, y: 150, width: 60, height: 60 },
  'right-chest': { x: 185, y: 150, width: 60, height: 60 },
  'full-back': { x: 105, y: 150, width: 190, height: 280 },
  'left-sleeve': { x: 150, y: 150, width: 60, height: 175 },
  'right-sleeve': { x: 190, y: 150, width: 60, height: 175 },
};

const HOODIE_ZONE_BOXES: Record<HtvPlacementZone, ZoneBox> = {
  'full-front': { x: 105, y: 190, width: 190, height: 230 },
  'left-chest': { x: 158, y: 175, width: 56, height: 56 },
  'right-chest': { x: 186, y: 175, width: 56, height: 56 },
  'full-back': { x: 105, y: 150, width: 190, height: 260 },
  'left-sleeve': { x: 142, y: 152, width: 72, height: 185 },
  'right-sleeve': { x: 186, y: 152, width: 72, height: 185 },
};

export function getPlacementZoneBox(garmentId: GarmentType, zone: HtvPlacementZone): ZoneBox {
  const table = garmentId === 'hoodie' ? HOODIE_ZONE_BOXES : TSHIRT_ZONE_BOXES;
  return table[zone];
}

export function getPlacementViewForZone(zone: HtvPlacementZone): HtvPlacementView {
  return HTV_PLACEMENT_ZONES.find((item) => item.id === zone)?.view ?? 'front';
}
