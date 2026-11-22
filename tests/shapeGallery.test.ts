import { describe, expect, it } from 'vitest';
import { GALLERY_SHAPES } from '../app/lib/shapeGallery';
import { checkExportReadiness, createArtworkTemplate, findUnsafeSvgContent, importSvgArtwork } from '../src/lib/rhinestone-engine/index';

const NOT_CUTTABLE = new Set(['STONE_OVERLAP', 'STONE_COLLISION', 'STONE_TIGHT_GAP', 'NO_STONES']);

describe('ready-made shapes', () => {
  it('has unique ids and labels', () => {
    expect(new Set(GALLERY_SHAPES.map((s) => s.id)).size).toBe(GALLERY_SHAPES.length);
    expect(new Set(GALLERY_SHAPES.map((s) => s.label)).size).toBe(GALLERY_SHAPES.length);
  });

  for (const shape of GALLERY_SHAPES) {
    it(`${shape.label}: is safe, imports, and every look is cuttable at 100 mm`, () => {
      expect(findUnsafeSvgContent(shape.svg)).toEqual([]);
      const shapes = importSvgArtwork(shape.svg).shapes;
      expect(shapes.length).toBeGreaterThan(0);
      for (const look of ['outline', 'rows', 'solid'] as const) {
        const result = createArtworkTemplate({ id: 's', name: 's', shapes, stoneSize: 'SS10', look, widthMm: 100 });
        expect(result.template.stones.length, look).toBeGreaterThan(20);
        const bad = checkExportReadiness(result.template).issues.filter((i) => NOT_CUTTABLE.has(i.code));
        expect(bad.map((i) => i.code), look).toEqual([]);
      }
    });
  }

  it('draws a crescent that is not a full disc and not empty', () => {
    const crescent = GALLERY_SHAPES.find((s) => s.id === 'crescent')!;
    const disc = GALLERY_SHAPES.find((s) => s.id === 'circle')!;
    const make = (svg: string) => createArtworkTemplate({ id: 'c', name: 'c', shapes: importSvgArtwork(svg).shapes, stoneSize: 'SS10', look: 'solid', widthMm: 100 }).template.stones.length;
    expect(make(crescent.svg)).toBeLessThan(make(disc.svg));
    expect(make(crescent.svg)).toBeGreaterThan(40);
  });
});
