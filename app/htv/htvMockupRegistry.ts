import { normalizeGarmentType, type GarmentType, type SelectableGarmentType } from '../components/garmentPreview/garmentCatalog';
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
      'full-front': { x: 182, y: 182, width: 262, height: 290 },
      'left-chest': { x: 314, y: 222, width: 74, height: 74 },
      'right-chest': { x: 236, y: 222, width: 74, height: 74 },
    },
  },
  back: {
    imageSrc: '/press-studio-mockups/hoodie-back.png',
    placements: {
      'full-back': { x: 170, y: 158, width: 286, height: 324 },
    },
  },
  left: {
    imageSrc: '/press-studio-mockups/hoodie-left.png',
    placements: {
      'left-sleeve': { x: 272, y: 168, width: 96, height: 278 },
    },
  },
  right: {
    imageSrc: '/press-studio-mockups/hoodie-right.png',
    placements: {
      'right-sleeve': { x: 258, y: 168, width: 96, height: 278 },
    },
  },
};

const teeMockup: HtvMockupDefinition = {
  front: {
    imageSrc: '/press-studio-mockups/tee-front.png',
    placements: {
      'full-front': { x: 176, y: 162, width: 274, height: 338 },
      'left-chest': { x: 316, y: 214, width: 78, height: 78 },
      'right-chest': { x: 232, y: 214, width: 78, height: 78 },
    },
  },
  back: {
    imageSrc: '/press-studio-mockups/tee-back.png',
    placements: {
      'full-back': { x: 174, y: 156, width: 280, height: 406 },
    },
  },
  left: {
    imageSrc: '/press-studio-mockups/tee-left.png',
    placements: {
      'left-sleeve': { x: 276, y: 154, width: 98, height: 282 },
    },
  },
  right: {
    imageSrc: '/press-studio-mockups/tee-right.png',
    placements: {
      'right-sleeve': { x: 250, y: 154, width: 98, height: 282 },
    },
  },
};

const oversizedTeeMockup: HtvMockupDefinition = {
  front: {
    imageSrc: '/press-studio-mockups/tee-front.png',
    placements: {
      'full-front': { x: 170, y: 170, width: 286, height: 346 },
      'left-chest': { x: 320, y: 220, width: 82, height: 82 },
      'right-chest': { x: 226, y: 220, width: 82, height: 82 },
    },
  },
  back: {
    imageSrc: '/press-studio-mockups/tee-back.png',
    placements: {
      'full-back': { x: 170, y: 178, width: 286, height: 360 },
    },
  },
  left: {
    imageSrc: '/press-studio-mockups/tee-left.png',
    placements: {
      'left-sleeve': { x: 274, y: 154, width: 104, height: 294 },
    },
  },
  right: {
    imageSrc: '/press-studio-mockups/tee-right.png',
    placements: {
      'right-sleeve': { x: 246, y: 154, width: 104, height: 294 },
    },
  },
};

const croppedTeeMockup: HtvMockupDefinition = {
  front: {
    imageSrc: '/press-studio-mockups/tee-front.png',
    placements: {
      'full-front': { x: 184, y: 148, width: 250, height: 208 },
      'left-chest': { x: 308, y: 188, width: 70, height: 70 },
      'right-chest': { x: 240, y: 188, width: 70, height: 70 },
    },
  },
  back: {
    imageSrc: '/press-studio-mockups/tee-back.png',
    placements: {
      'full-back': { x: 186, y: 156, width: 246, height: 218 },
    },
  },
  left: {
    imageSrc: '/press-studio-mockups/tee-left.png',
    placements: {
      'left-sleeve': { x: 280, y: 146, width: 88, height: 232 },
    },
  },
  right: {
    imageSrc: '/press-studio-mockups/tee-right.png',
    placements: {
      'right-sleeve': { x: 254, y: 146, width: 88, height: 232 },
    },
  },
};

const toteMockup: HtvMockupDefinition = {
  front: {
    imageSrc: '/press-studio-mockups/tote-front.png',
    placements: {
      'full-front': { x: 174, y: 228, width: 280, height: 246 },
    },
  },
  back: {
    imageSrc: '/press-studio-mockups/tote-back.png',
    placements: {
      'full-back': { x: 174, y: 228, width: 280, height: 246 },
    },
  },
  left: {
    imageSrc: '/press-studio-mockups/tote-front.png',
    placements: {},
  },
  right: {
    imageSrc: '/press-studio-mockups/tote-back.png',
    placements: {},
  },
};

export const HTV_MOCKUP_IMAGE_SIZE = 627;

export const HTV_MOCKUPS: Record<SelectableGarmentType, HtvMockupDefinition> = {
  tee: teeMockup,
  'oversized-tee': oversizedTeeMockup,
  'cropped-tee': croppedTeeMockup,
  hoodie: hoodIeMockup,
  tote: toteMockup,
};

export function getHtvMockupView(garmentType: GarmentType, view: HtvPlacementView): HtvMockupViewDefinition {
  return HTV_MOCKUPS[normalizeGarmentType(garmentType)][view];
}
