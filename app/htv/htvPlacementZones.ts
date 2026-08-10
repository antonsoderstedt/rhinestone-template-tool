/**
 * HTV placement zones — where on the garment's front the design sits.
 *
 * v1 only covers zones visible on the front-view silhouette (see
 * GarmentSilhouette.tsx, shared with the rhinestone garment preview).
 * Back/sleeve placement would need a back-view illustration, which isn't
 * built yet — a reasonable follow-up, not attempted here.
 */

import type { GarmentType } from '../components/garmentPreview/garmentCatalog';

export type HtvPlacementZone = 'left-chest' | 'center-chest' | 'full-front';

export interface PlacementZoneDefinition {
  id: HtvPlacementZone;
  displayName: string;
  description: string;
}

export const HTV_PLACEMENT_ZONES: readonly PlacementZoneDefinition[] = [
  { id: 'left-chest', displayName: 'Left chest', description: 'Small logo placement, upper-left chest' },
  { id: 'center-chest', displayName: 'Center chest', description: 'Standard centered chest print' },
  { id: 'full-front', displayName: 'Full front', description: 'Large print covering most of the front' },
];

interface ZoneBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Reference zone boxes in the shared 400x480 garment illustration viewBox (see GarmentSilhouette.tsx), sized for the 'M' t-shirt. */
const TSHIRT_ZONE_BOXES: Record<HtvPlacementZone, ZoneBox> = {
  'left-chest': { x: 165, y: 150, width: 55, height: 55 },
  'center-chest': { x: 140, y: 140, width: 120, height: 160 },
  'full-front': { x: 105, y: 165, width: 190, height: 260 },
};

const HOODIE_ZONE_BOXES: Record<HtvPlacementZone, ZoneBox> = {
  'left-chest': { x: 165, y: 175, width: 50, height: 50 },
  'center-chest': { x: 140, y: 165, width: 110, height: 130 },
  'full-front': { x: 105, y: 190, width: 190, height: 230 },
};

export function getPlacementZoneBox(garmentId: GarmentType, zone: HtvPlacementZone): ZoneBox {
  const table = garmentId === 'hoodie' ? HOODIE_ZONE_BOXES : TSHIRT_ZONE_BOXES;
  return table[zone];
}
