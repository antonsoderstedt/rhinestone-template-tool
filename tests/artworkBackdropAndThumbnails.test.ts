import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_EDITOR_STATE } from '../app/editor/EditorState';
import { ARTWORK_LOOKS, generateLookThumbnails, generateSvgArtwork } from '../app/editor/artworkGeneration';
import { createArtworkTemplate, importSvgArtwork } from '../src/lib/rhinestone-engine/index';

const badge = readFileSync(path.resolve(__dirname, 'fixtures/artwork/synthetic/badge-two-colours.svg'), 'utf8');
const tool = { ...DEFAULT_EDITOR_STATE.svgTool, uploadedSvgText: badge, targetWidthMm: 80, stoneSize: 'SS10' as const };

describe('the artwork as drawn, behind the stones', () => {
  it('gives every shape after scaling, in mm, in document order', () => {
    const result = createArtworkTemplate({ id: 'b', name: 'b', shapes: importSvgArtwork(badge).shapes, stoneSize: 'SS10', look: 'outline', widthMm: 80 });
    expect(result.placedShapes).toHaveLength(2);
    expect(result.placedShapes.map((shape) => shape.fill)).toEqual(['#ffaef0', '#1a1033']);
    const xs = result.placedShapes.flatMap((shape) => shape.polylines.flatMap((p) => p.points.map((pt) => pt.x)));
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(80, 0);
    expect(Math.min(...xs)).toBeCloseTo(10, 1); // placed where the stones are
  });

  it('is part of the artwork info the editor uses', () => {
    expect(generateSvgArtwork(tool).info.source).toHaveLength(2);
  });
});

describe('look thumbnails', () => {
  it('shows the artwork in every look, from the real generator', () => {
    const pictures = generateLookThumbnails(tool);
    expect(Object.keys(pictures).sort()).toEqual(ARTWORK_LOOKS.map((l) => l.look).sort());
    const outline = pictures.outline!.dots.length;
    const solid = pictures.solid!.dots.length;
    expect(outline).toBeGreaterThan(20);
    expect(solid).toBeGreaterThan(outline);
    expect(pictures.outline!.dots.length).toBe(generateSvgArtwork(tool, undefined, { look: 'outline' }).template.stones.length);
  });

  it('has none without an uploaded artwork', () => {
    expect(generateLookThumbnails({ ...tool, uploadedSvgText: null })).toEqual({});
  });
});
