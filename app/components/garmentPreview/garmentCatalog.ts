/**
 * Garment mockup catalog — pure data, no rendering.
 *
 * v1 uses flat vector illustrations rather than photo mockups (see chat
 * decision log). Print-area dimensions are reasonable placeholder estimates
 * for previewing scale/placement, not manufacturing specs — swap in real
 * per-garment measurements once real mockup photography replaces the flat
 * illustrations.
 */

export type GarmentType = 'tshirt' | 'tee' | 'oversized-tee' | 'cropped-tee' | 'hoodie' | 'tote';
export type SelectableGarmentType = Exclude<GarmentType, 'tshirt'>;
export type GarmentFamily = 'tee' | 'hoodie' | 'tote';
export type GarmentSize = 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'OS';

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
  id: SelectableGarmentType;
  family: GarmentFamily;
  displayName: string;
  availableSizes: readonly GarmentSize[];
  printAreaMmBySize: Record<GarmentSize, PrintAreaMm>;
}

export const GARMENT_SIZES: readonly GarmentSize[] = ['S', 'M', 'L', 'XL', 'XXL', 'OS'];

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
  OS: { widthMm: 300, heightMm: 400 },
};

const OVERSIZED_TEE_PRINT_AREA_MM: Record<GarmentSize, PrintAreaMm> = {
  S: { widthMm: 300, heightMm: 380 },
  M: { widthMm: 320, heightMm: 400 },
  L: { widthMm: 340, heightMm: 420 },
  XL: { widthMm: 360, heightMm: 440 },
  XXL: { widthMm: 380, heightMm: 460 },
  OS: { widthMm: 320, heightMm: 400 },
};

const CROPPED_TEE_PRINT_AREA_MM: Record<GarmentSize, PrintAreaMm> = {
  S: { widthMm: 240, heightMm: 260 },
  M: { widthMm: 255, heightMm: 275 },
  L: { widthMm: 270, heightMm: 290 },
  XL: { widthMm: 285, heightMm: 305 },
  XXL: { widthMm: 300, heightMm: 320 },
  OS: { widthMm: 255, heightMm: 275 },
};

const HOODIE_PRINT_AREA_MM: Record<GarmentSize, PrintAreaMm> = {
  S: { widthMm: 260, heightMm: 340 },
  M: { widthMm: 280, heightMm: 360 },
  L: { widthMm: 300, heightMm: 380 },
  XL: { widthMm: 320, heightMm: 400 },
  XXL: { widthMm: 340, heightMm: 420 },
  OS: { widthMm: 280, heightMm: 360 },
};

const TOTE_PRINT_AREA_MM: Record<GarmentSize, PrintAreaMm> = {
  S: { widthMm: 290, heightMm: 300 },
  M: { widthMm: 290, heightMm: 300 },
  L: { widthMm: 290, heightMm: 300 },
  XL: { widthMm: 290, heightMm: 300 },
  XXL: { widthMm: 290, heightMm: 300 },
  OS: { widthMm: 290, heightMm: 300 },
};

export const GARMENTS: readonly GarmentDefinition[] = [
  { id: 'tee', family: 'tee', displayName: 'Tee', availableSizes: ['S', 'M', 'L', 'XL', 'XXL'], printAreaMmBySize: TSHIRT_PRINT_AREA_MM },
  { id: 'oversized-tee', family: 'tee', displayName: 'Oversized tee', availableSizes: ['S', 'M', 'L', 'XL', 'XXL'], printAreaMmBySize: OVERSIZED_TEE_PRINT_AREA_MM },
  { id: 'cropped-tee', family: 'tee', displayName: 'Cropped tee', availableSizes: ['S', 'M', 'L', 'XL', 'XXL'], printAreaMmBySize: CROPPED_TEE_PRINT_AREA_MM },
  { id: 'hoodie', family: 'hoodie', displayName: 'Hoodie', availableSizes: ['S', 'M', 'L', 'XL', 'XXL'], printAreaMmBySize: HOODIE_PRINT_AREA_MM },
  { id: 'tote', family: 'tote', displayName: 'Canvas tote', availableSizes: ['OS'], printAreaMmBySize: TOTE_PRINT_AREA_MM },
];

export function normalizeGarmentType(id: GarmentType): SelectableGarmentType {
  return id === 'tshirt' ? 'tee' : id;
}

export function getGarmentDefinition(id: GarmentType): GarmentDefinition {
  const found = GARMENTS.find((g) => g.id === normalizeGarmentType(id));
  if (!found) throw new Error(`Unknown garment type: ${id}`);
  return found;
}

export function getPrintAreaMm(garmentId: GarmentType, size: GarmentSize): PrintAreaMm {
  return getGarmentDefinition(garmentId).printAreaMmBySize[size];
}

export function getGarmentColor(colorId: string): GarmentColorSwatch {
  return GARMENT_COLORS.find((c) => c.id === colorId) ?? GARMENT_COLORS[0]!;
}
