import type { GarmentType } from '../components/garmentPreview/garmentCatalog';
import type { HtvPlacementView, HtvPlacementZone } from './htvPlacementZones';

export interface MockupRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HtvMockupViewDefinition {
  imageSrc: string;
  placements: Partial<Record<HtvPlacementZone, MockupRect>>;
}

export interface HtvMockupDefinition {
  front: HtvMockupViewDefinition;
  back: HtvMockupViewDefinition;
  left: HtvMockupViewDefinition;
  right: HtvMockupViewDefinition;
}

const hoodIeMockup: HtvMockupDefinition = {
  front: {
    imageSrc: '/press-studio-mockups/hoodie-front.png',
    placements: {
      'full-front': { x: 176, y: 146, width: 274, height: 310 },
      'left-chest': { x: 236, y: 168, width: 102, height: 102 },
      'right-chest': { x: 289, y: 168, width: 102, height: 102 },
    },
  },
  back: {
    imageSrc: '/press-studio-mockups/hoodie-back.png',
    placements: {
      'full-back': { x: 165, y: 122, width: 294, height: 332 },
    },
  },
  left: {
    imageSrc: '/press-studio-mockups/hoodie-left.png',
    placements: {
      'left-sleeve': { x: 270, y: 144, width: 122, height: 302 },
    },
  },
  right: {
    imageSrc: '/press-studio-mockups/hoodie-right.png',
    placements: {
      'right-sleeve': { x: 235, y: 144, width: 122, height: 302 },
    },
  },
};

const teeMockup: HtvMockupDefinition = {
  front: {
    imageSrc: '/press-studio-mockups/tee-front.png',
    placements: {
      'full-front': { x: 168, y: 154, width: 290, height: 360 },
      'left-chest': { x: 239, y: 170, width: 110, height: 110 },
      'right-chest': { x: 283, y: 170, width: 110, height: 110 },
    },
  },
  back: {
    imageSrc: '/press-studio-mockups/tee-back.png',
    placements: {
      'full-back': { x: 168, y: 132, width: 290, height: 392 },
    },
  },
  left: {
    imageSrc: '/press-studio-mockups/tee-left.png',
    placements: {
      'left-sleeve': { x: 280, y: 120, width: 108, height: 315 },
    },
  },
  right: {
    imageSrc: '/press-studio-mockups/tee-right.png',
    placements: {
      'right-sleeve': { x: 239, y: 120, width: 108, height: 315 },
    },
  },
};

export const HTV_MOCKUP_IMAGE_SIZE = 627;

export const HTV_MOCKUPS: Record<GarmentType, HtvMockupDefinition> = {
  tshirt: teeMockup,
  hoodie: hoodIeMockup,
};

export function getHtvMockupView(garmentType: GarmentType, view: HtvPlacementView): HtvMockupViewDefinition {
  return HTV_MOCKUPS[garmentType][view];
}
