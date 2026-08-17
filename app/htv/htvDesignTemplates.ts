/**
 * Full design templates — small starter compositions (text + shapes,
 * positioned and colored) that drop onto the canvas as a ready-to-tweak
 * group of layers, analogous to Cricut's "Templates" tab.
 */

import { createHtvTextLayer, createHtvVectorLayer, type HtvLayer } from './HtvState';
import { createShapePolylines } from './htvShapeLibrary';

export type HtvDesignTemplateId = 'name-number' | 'badge-circle' | 'star-banner' | 'stacked-monogram';

interface HtvDesignTemplate {
  id: HtvDesignTemplateId;
  displayName: string;
  description: string;
  build: (createLayerId: (prefix: string) => string, fontId: string) => HtvLayer[];
}

export const HTV_DESIGN_TEMPLATES: readonly HtvDesignTemplate[] = [
  {
    id: 'name-number',
    displayName: 'Name + number',
    description: 'Big name over a jersey-style number',
    build: (createLayerId, fontId) => [
      createHtvTextLayer({
        id: createLayerId('text'),
        text: 'NAME',
        fontId,
        fontSizeMm: 32,
        letterSpacingMm: 3,
        align: 'center',
        colorId: 'black',
        x: 0,
        y: -22,
      }),
      createHtvTextLayer({
        id: createLayerId('text'),
        text: '23',
        fontId,
        fontSizeMm: 60,
        letterSpacingMm: 2,
        align: 'center',
        colorId: 'red',
        x: 0,
        y: 24,
      }),
    ],
  },
  {
    id: 'badge-circle',
    displayName: 'Circle badge',
    description: 'Text centered inside a circle',
    build: (createLayerId, fontId) => [
      (() => {
        const { polylines, widthMm, heightMm } = createShapePolylines('circle');
        return createHtvVectorLayer({
          id: createLayerId('shape'),
          name: 'Circle',
          polylines,
          naturalWidthMm: widthMm,
          naturalHeightMm: heightMm,
          sourceKind: 'library-asset',
          colorId: 'navy',
          scale: 2,
        });
      })(),
      createHtvTextLayer({
        id: createLayerId('text'),
        text: 'EST 2026',
        fontId,
        fontSizeMm: 14,
        letterSpacingMm: 1.5,
        align: 'center',
        colorId: 'white',
      }),
    ],
  },
  {
    id: 'star-banner',
    displayName: 'Star + banner',
    description: 'A star with a short text banner underneath',
    build: (createLayerId, fontId) => [
      (() => {
        const { polylines, widthMm, heightMm } = createShapePolylines('star');
        return createHtvVectorLayer({
          id: createLayerId('shape'),
          name: 'Star',
          polylines,
          naturalWidthMm: widthMm,
          naturalHeightMm: heightMm,
          sourceKind: 'library-asset',
          colorId: 'gold',
          y: -14,
        });
      })(),
      createHtvTextLayer({
        id: createLayerId('text'),
        text: 'ALL STAR',
        fontId,
        fontSizeMm: 18,
        letterSpacingMm: 2,
        align: 'center',
        colorId: 'black',
        y: 28,
      }),
    ],
  },
  {
    id: 'stacked-monogram',
    displayName: 'Stacked initials',
    description: 'Three-letter monogram, center letter larger',
    build: (createLayerId, fontId) => [
      createHtvTextLayer({
        id: createLayerId('text'),
        text: 'A',
        fontId,
        fontSizeMm: 26,
        letterSpacingMm: 0,
        align: 'center',
        colorId: 'black',
        x: -26,
      }),
      createHtvTextLayer({
        id: createLayerId('text'),
        text: 'B',
        fontId,
        fontSizeMm: 40,
        letterSpacingMm: 0,
        align: 'center',
        colorId: 'black',
      }),
      createHtvTextLayer({
        id: createLayerId('text'),
        text: 'C',
        fontId,
        fontSizeMm: 26,
        letterSpacingMm: 0,
        align: 'center',
        colorId: 'black',
        x: 26,
      }),
    ],
  },
];

export function getDesignTemplate(id: HtvDesignTemplateId): HtvDesignTemplate | undefined {
  return HTV_DESIGN_TEMPLATES.find((t) => t.id === id);
}
