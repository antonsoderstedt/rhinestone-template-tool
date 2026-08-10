/**
 * Garment mockup catalog — pure data, no rendering.
 *
 * v1 uses flat vector illustrations rather than photo mockups (see chat
 * decision log). Print-area dimensions are reasonable placeholder estimates
 * for previewing scale/placement, not manufacturing specs — swap in real
 * per-garment measurements once real mockup photography replaces the flat
 * illustrations.
 */

export type GarmentType = 'tshirt' | 'hoodie';
export type GarmentSize = 'S' | 'M' | 'L' | 'XL' | 'XXL';

export interface GarmentColorSwatch {
  id: string;
  name: string;
  hex: string;
  /** Which shading overlay reads correctly on this base color — dark fabric gets a light highlight overlay, light fabric gets a dark shadow overlay. */
  shade: 'light' | 'dark';
}

export interface PrintAreaMm {
  widthMm: number;
  heightMm: number;
}

export interface GarmentDefinition {
  id: GarmentType;
  displayName: string;
  printAreaMmBySize: Record<GarmentSize, PrintAreaMm>;
}

export const GARMENT_SIZES: readonly GarmentSize[] = ['S', 'M', 'L', 'XL', 'XXL'];

export const GARMENT_COLORS: readonly GarmentColorSwatch[] = [
  { id: 'white', name: 'White', hex: '#f7f6f3', shade: 'light' },
  { id: 'black', name: 'Black', hex: '#1c1c1e', shade: 'dark' },
  { id: 'heather-gray', name: 'Heather gray', hex: '#9ca0a8', shade: 'light' },
  { id: 'navy', name: 'Navy', hex: '#1e2a47', shade: 'dark' },
  { id: 'red', name: 'Red', hex: '#a8241f', shade: 'dark' },
  { id: 'forest-green', name: 'Forest green', hex: '#22402c', shade: 'dark' },
  { id: 'maroon', name: 'Maroon', hex: '#5a1c2c', shade: 'dark' },
  { id: 'royal-blue', name: 'Royal blue', hex: '#28438f', shade: 'dark' },
];

const TSHIRT_PRINT_AREA_MM: Record<GarmentSize, PrintAreaMm> = {
  S: { widthMm: 280, heightMm: 380 },
  M: { widthMm: 300, heightMm: 400 },
  L: { widthMm: 320, heightMm: 420 },
  XL: { widthMm: 340, heightMm: 440 },
  XXL: { widthMm: 360, heightMm: 460 },
};

const HOODIE_PRINT_AREA_MM: Record<GarmentSize, PrintAreaMm> = {
  S: { widthMm: 260, heightMm: 340 },
  M: { widthMm: 280, heightMm: 360 },
  L: { widthMm: 300, heightMm: 380 },
  XL: { widthMm: 320, heightMm: 400 },
  XXL: { widthMm: 340, heightMm: 420 },
};

export const GARMENTS: readonly GarmentDefinition[] = [
  { id: 'tshirt', displayName: 'T-shirt', printAreaMmBySize: TSHIRT_PRINT_AREA_MM },
  { id: 'hoodie', displayName: 'Hoodie', printAreaMmBySize: HOODIE_PRINT_AREA_MM },
];

export function getGarmentDefinition(id: GarmentType): GarmentDefinition {
  const found = GARMENTS.find((g) => g.id === id);
  if (!found) throw new Error(`Unknown garment type: ${id}`);
  return found;
}

export function getPrintAreaMm(garmentId: GarmentType, size: GarmentSize): PrintAreaMm {
  return getGarmentDefinition(garmentId).printAreaMmBySize[size];
}

export function getGarmentColor(colorId: string): GarmentColorSwatch {
  return GARMENT_COLORS.find((c) => c.id === colorId) ?? GARMENT_COLORS[0]!;
}
