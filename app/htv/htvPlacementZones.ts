/**
 * HTV placement zones across the garment mockup views.
 */

import { normalizeGarmentType, type GarmentType, type SelectableGarmentType } from '../components/garmentPreview/garmentCatalog';

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

const PROFILE_PLACEMENT_DESCRIPTIONS: Record<SelectableGarmentType, Partial<Record<HtvPlacementZone, string>>> = {
  tee: {
    'full-front': 'Front · 290 x 360 mm',
    'left-chest': 'Front · 120 x 120 mm',
    'right-chest': 'Front · 120 x 120 mm',
    'full-back': 'Back · 290 x 420 mm',
    'left-sleeve': 'Left · 90 x 260 mm',
    'right-sleeve': 'Right · 90 x 260 mm',
  },
  'oversized-tee': {
    'full-front': 'Front · 320 x 380 mm',
    'left-chest': 'Front · 120 x 120 mm',
    'right-chest': 'Front · 120 x 120 mm',
    'full-back': 'Back · 320 x 420 mm',
    'left-sleeve': 'Left · 100 x 280 mm',
    'right-sleeve': 'Right · 100 x 280 mm',
  },
  'cropped-tee': {
    'full-front': 'Front · 260 x 280 mm',
    'left-chest': 'Front · 110 x 110 mm',
    'right-chest': 'Front · 110 x 110 mm',
    'full-back': 'Back · 260 x 300 mm',
    'left-sleeve': 'Left · 85 x 220 mm',
    'right-sleeve': 'Right · 85 x 220 mm',
  },
  hoodie: {
    'full-front': 'Front · 280 x 340 mm',
    'left-chest': 'Front · 110 x 110 mm',
    'right-chest': 'Front · 110 x 110 mm',
    'full-back': 'Back · 290 x 380 mm',
    'left-sleeve': 'Left · 95 x 240 mm',
    'right-sleeve': 'Right · 95 x 240 mm',
  },
  tote: {
    'full-front': 'Front · 280 x 240 mm',
    'full-back': 'Back · 280 x 240 mm',
  },
};

interface ZoneBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Reference zone boxes in the shared garment illustration viewBox. */
const TEE_ZONE_BOXES: Record<HtvPlacementZone, ZoneBox> = {
  'full-front': { x: 112, y: 154, width: 176, height: 242 },
  'left-chest': { x: 218, y: 182, width: 46, height: 46 },
  'right-chest': { x: 136, y: 182, width: 46, height: 46 },
  'full-back': { x: 110, y: 164, width: 180, height: 262 },
  'left-sleeve': { x: 148, y: 170, width: 52, height: 160 },
  'right-sleeve': { x: 200, y: 170, width: 52, height: 160 },
};

const OVERSIZED_TEE_ZONE_BOXES: Record<HtvPlacementZone, ZoneBox> = {
  'full-front': { x: 104, y: 162, width: 192, height: 252 },
  'left-chest': { x: 224, y: 194, width: 48, height: 48 },
  'right-chest': { x: 128, y: 194, width: 48, height: 48 },
  'full-back': { x: 104, y: 176, width: 192, height: 270 },
  'left-sleeve': { x: 142, y: 174, width: 56, height: 168 },
  'right-sleeve': { x: 202, y: 174, width: 56, height: 168 },
};

const CROPPED_TEE_ZONE_BOXES: Record<HtvPlacementZone, ZoneBox> = {
  'full-front': { x: 118, y: 132, width: 168, height: 164 },
  'left-chest': { x: 214, y: 164, width: 42, height: 42 },
  'right-chest': { x: 144, y: 164, width: 42, height: 42 },
  'full-back': { x: 120, y: 142, width: 164, height: 176 },
  'left-sleeve': { x: 150, y: 156, width: 46, height: 132 },
  'right-sleeve': { x: 204, y: 156, width: 46, height: 132 },
};

const HOODIE_ZONE_BOXES: Record<HtvPlacementZone, ZoneBox> = {
  'full-front': { x: 116, y: 190, width: 170, height: 212 },
  'left-chest': { x: 218, y: 200, width: 44, height: 44 },
  'right-chest': { x: 138, y: 200, width: 44, height: 44 },
  'full-back': { x: 112, y: 170, width: 176, height: 236 },
  'left-sleeve': { x: 140, y: 172, width: 58, height: 166 },
  'right-sleeve': { x: 202, y: 172, width: 58, height: 166 },
};

const TOTE_ZONE_BOXES: Record<HtvPlacementZone, ZoneBox> = {
  'full-front': { x: 170, y: 180, width: 188, height: 166 },
  'left-chest': { x: 169, y: 213, width: 288, height: 270 },
  'right-chest': { x: 169, y: 213, width: 288, height: 270 },
  'full-back': { x: 170, y: 180, width: 188, height: 166 },
  'left-sleeve': { x: 169, y: 213, width: 288, height: 270 },
  'right-sleeve': { x: 169, y: 213, width: 288, height: 270 },
};

export function getPlacementsForGarmentType(garmentId: GarmentType): readonly PlacementZoneDefinition[] {
  const normalizedGarmentId = normalizeGarmentType(garmentId);
  const definitions = normalizedGarmentId === 'tote'
    ? HTV_PLACEMENT_ZONES.filter((item) => item.id === 'full-front' || item.id === 'full-back')
    : HTV_PLACEMENT_ZONES;
  return definitions.map((item) => ({
    ...item,
    description: PROFILE_PLACEMENT_DESCRIPTIONS[normalizedGarmentId][item.id] ?? item.description,
  }));
}

export function getPlacementZoneBox(garmentId: GarmentType, zone: HtvPlacementZone): ZoneBox {
  const normalizedGarmentId = normalizeGarmentType(garmentId);
  const table = normalizedGarmentId === 'hoodie'
    ? HOODIE_ZONE_BOXES
    : normalizedGarmentId === 'tote'
      ? TOTE_ZONE_BOXES
      : normalizedGarmentId === 'oversized-tee'
        ? OVERSIZED_TEE_ZONE_BOXES
        : normalizedGarmentId === 'cropped-tee'
          ? CROPPED_TEE_ZONE_BOXES
          : TEE_ZONE_BOXES;
  return table[zone];
}

export function getPlacementViewForZone(zone: HtvPlacementZone): HtvPlacementView {
  return HTV_PLACEMENT_ZONES.find((item) => item.id === zone)?.view ?? 'front';
}
