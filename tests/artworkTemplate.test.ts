import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildArtworkLayers, checkExportReadiness, createArtworkTemplate, importSvgArtwork } from '../src/lib/rhinestone-engine/index';

const fixture = (name: string) => readFileSync(path.join(__dirname, 'fixtures/artwork', name), 'utf8');
const shapesOf = (name: string) => importSvgArtwork(fixture(name)).shapes;
const svgShapes = (body: string, viewBox = '0 0 200 200') => importSvgArtwork(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`).shapes;

describe('buildArtworkLayers', () => {
  it('paints in document order: a later shape covers an earlier one, so the star is not inside the pink layer', () => {
    const { layers } = buildArtworkLayers(shapesOf('synthetic/badge-two-colours.svg'), { widthMm: 100 });
    expect(layers.map((l) => l.colour)).toEqual(['#ffaef0', '#1a1033']);
    const [pink, dark] = layers;
    let both = 0;
    for (let i = 0; i < pink!.mask.data.length; i++) if (pink!.mask.data[i] && dark!.mask.data[i]) both++;
    expect(both).toBe(0);
    expect(dark!.areaMm2).toBeGreaterThan(300);
    expect(pink!.areaMm2).toBeGreaterThan(dark!.areaMm2);
  });

  it('even-odd makes a hole that shows what is underneath', () => {
    const { layers } = buildArtworkLayers(svgShapes('<rect width="200" height="200" fill="#ff0000"/><path fill-rule="evenodd" fill="#0000ff" d="M20 20h160v160h-160z M60 60h80v80h-80z"/>'), { widthMm: 100, ignoreBackground: false });
    const [red, blue] = layers;
    expect(blue!.areaMm2).toBeCloseTo(((160 * 160 - 80 * 80) / (200 * 200)) * 100 * 100, -2);
    expect(red!.areaMm2).toBeGreaterThan(0); // the page shows through the hole and around the frame
  });

  it('leaves out a white page and a first shape that covers the whole artwork, with a reason', () => {
    const white = buildArtworkLayers(shapesOf('synthetic/background-rect.svg'), { widthMm: 100 });
    expect(white.layers.find((l) => l.colour === '#ffffff')).toMatchObject({ role: 'ignore' });
    expect(white.layers.find((l) => l.colour === '#e91e63')).toMatchObject({ role: 'stones' });
    expect(white.warnings.join(' ')).toMatch(/background/i);

    const coloured = buildArtworkLayers(svgShapes('<rect width="200" height="200" fill="#336699"/><circle cx="100" cy="100" r="50" fill="#ffcc00"/>'), { widthMm: 100 });
    expect(coloured.layers.find((l) => l.colour === '#336699')).toMatchObject({ role: 'ignore' });
    expect(coloured.layers.find((l) => l.colour === '#ffcc00')).toMatchObject({ role: 'stones' });
  });

  it('keeps a single-colour artwork, even a white or full-page one', () => {
    expect(buildArtworkLayers(svgShapes('<rect width="200" height="200" fill="#336699"/>'), { widthMm: 100 }).layers[0]!.role).toBe('stones');
  });

  it('scales to the requested width and keeps the aspect ratio; strokes scale with it', () => {
    const r = buildArtworkLayers(svgShapes('<path d="M0 0H100" stroke="#000" stroke-width="10" fill="none"/>', '0 0 100 20'), { widthMm: 50 });
    // the width is what is painted: the line is 100 long plus half its 10 width at each end, so 110 units become 50 mm
    expect(r.scale).toBeCloseTo(50 / 110, 6);
    // the bar plus its two round ends
    expect(r.layers[0]!.areaMm2).toBeCloseTo(100 * (50 / 110) * 10 * (50 / 110) + Math.PI * (5 * (50 / 110)) ** 2, -1);
  });

  it('turns strokes into regions of their own colour', () => {
    const r = buildArtworkLayers(shapesOf('synthetic/stroke-only.svg'), { widthMm: 100 });
    expect(r.layers[0]!.colour).toBe('#000000');
    expect(r.layers[0]!.areaMm2).toBeGreaterThan(500);
  });

  it('is deterministic', () => {
    const a = buildArtworkLayers(shapesOf('synthetic/badge-two-colours.svg'), { widthMm: 80 });
    const b = buildArtworkLayers(shapesOf('synthetic/badge-two-colours.svg'), { widthMm: 80 });
    expect(Array.from(a.layers[1]!.mask.data)).toEqual(Array.from(b.layers[1]!.mask.data));
  });
});

describe('createArtworkTemplate', () => {
  const make = (file: string, look: 'outline' | 'rows' | 'solid', widthMm = 150, extra = {}) =>
    createArtworkTemplate({ id: 't', name: 't', shapes: shapesOf(file), stoneSize: 'SS10', look, widthMm, ...extra });

  it('gives a cuttable template for each look on the owner’s logos', () => {
    for (const file of ['smooch-wordmark.svg', 'smooch-lips.svg']) {
      for (const look of ['outline', 'rows', 'solid'] as const) {
        const r = make(file, look, 200);
        expect(r.template.stones.length, `${file} ${look}`).toBeGreaterThan(50);
        const codes = checkExportReadiness(r.template).issues.map((i) => i.code);
        expect(codes.filter((c) => c.startsWith('STONE_')), `${file} ${look}`).toEqual([]);
      }
    }
  });

  it('more rows means more stones, solid the most', () => {
    const counts = (['outline', 'rows', 'solid'] as const).map((look) => make('smooch-lips.svg', look).template.stones.length);
    expect(counts[0]).toBeLessThan(counts[1]!);
    expect(counts[1]).toBeLessThan(counts[2]!);
  });

  it('respects the row count', () => {
    const rows = new Set(make('smooch-lips.svg', 'rows', 150, { rowCount: 2 }).template.stones.map((s) => s.metadata?.row));
    expect(rows).toEqual(new Set([0, 1]));
  });

  it('records the layer colour of every stone, and gives every stone a unique id', () => {
    const r = make('synthetic/badge-two-colours.svg', 'rows', 120);
    expect(new Set(r.template.stones.map((s) => s.metadata?.layerColour))).toEqual(new Set(['#ffaef0', '#1a1033']));
    expect(new Set(r.template.stones.map((s) => s.id)).size).toBe(r.template.stones.length);
    expect(r.layers.every((l) => l.stones > 0)).toBe(true);
  });

  it('lets a layer be switched off, and a background switched on', () => {
    const off = make('synthetic/badge-two-colours.svg', 'rows', 120, { layerRoles: { '#1a1033': 'ignore' } });
    expect(off.template.stones.every((s) => s.metadata?.layerColour === '#ffaef0')).toBe(true);
    const bg = make('synthetic/background-rect.svg', 'outline', 100, { layerRoles: { '#ffffff': 'stones' } });
    expect(new Set(bg.template.stones.map((s) => s.metadata?.layerColour))).toEqual(new Set(['#ffffff', '#e91e63']));
  });

  it('keeps a stone off the shared edge of two colours: nothing closer than the minimum', () => {
    const r = make('synthetic/badge-two-colours.svg', 'solid', 100);
    expect(checkExportReadiness(r.template).issues.filter((i) => i.code.startsWith('STONE_'))).toEqual([]);
  });

  it('says so when a colour is too small for the stones', () => {
    const r = make('synthetic/thin-letters.svg', 'outline', 20);
    expect(r.warnings.join(' ')).toMatch(/too small or too thin/);
  });

  it('is deterministic', () => {
    expect(make('smooch-wordmark.svg', 'solid', 180).template.stones).toEqual(make('smooch-wordmark.svg', 'solid', 180).template.stones);
  });

  it('sizes the design to the requested width: stones lie within it', () => {
    const stones = make('smooch-lips.svg', 'solid', 100).template.stones;
    const xs = stones.map((s) => s.center.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(100);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(90);
  });
});
