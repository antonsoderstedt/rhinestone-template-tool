import { describe, expect, it } from 'vitest';
import { buildColourFilesNote, createHtvColourFiles, createHtvSvgExport } from '../app/htv/htvExport';
import { createHtvVectorLayer, type HtvLayer } from '../app/htv/HtvState';

function box(id: string, colorId: string, x: number, y: number, size = 30): HtvLayer {
  const h = size / 2;
  return {
    ...createHtvVectorLayer({
      id,
      name: id,
      polylines: [{ closed: true, points: [{ x: -h, y: -h }, { x: h, y: -h }, { x: h, y }, { x: -h, y: h }, { x: -h, y: -h }].map((p, i) => (i === 2 ? { x: h, y: h } : p)) }],
      naturalWidthMm: size,
      naturalHeightMm: size,
      placementId: 'full-front',
      sourceKind: 'svg-upload',
    }),
    colorId,
    x,
    y,
  };
}

const root = (svg: string) => /<svg[^>]*width="([\d.]+)mm" height="([\d.]+)mm"/.exec(svg)!.slice(1, 3).map(Number);

describe('one file per vinyl colour (plan G1)', () => {
  it('makes no files for a one-colour design', async () => {
    expect(await createHtvColourFiles([box('a', 'black', 50, 50)], 'Design')).toEqual([]);
  });

  it('makes one file per colour, in layer order, all with the same size', async () => {
    const layers = [box('a', 'red', 40, 50), box('b', 'white', 100, 50), box('c', 'red', 70, 80)];
    const files = await createHtvColourFiles(layers, 'Design', { mirror: true });
    expect(files.map((f) => f.colorId)).toEqual(['red', 'white']);
    expect(files.map((f) => f.layerCount)).toEqual([2, 1]);
    const [first, second] = files.map((f) => root(f.svg));
    expect(first).toEqual(second);
    // The whole design as one file is the same size too: the frame is the whole design.
    const whole = await createHtvSvgExport(layers, 'Design', { mirror: true });
    expect(first).toEqual([whole.widthMm, whole.heightMm].map((n) => Number(n.toFixed(3))));
  });

  it('keeps each layer where it is in the whole design', async () => {
    const layers = [box('a', 'red', 40, 50), box('b', 'white', 100, 50)];
    const files = await createHtvColourFiles(layers, 'Design');
    const whole = await createHtvSvgExport(layers, 'Design');
    const translate = (svg: string) => [...svg.matchAll(/translate\(([-\d.]+) ([-\d.]+)\)/g)].map((m) => `${m[1]} ${m[2]}`);
    expect(translate(files[0]!.svg)[0]).toBe(translate(whole.svg)[0]);
    expect(translate(files[1]!.svg)[0]).toBe(translate(whole.svg)[1]);
  });

  it('ignores hidden layers and says what is what in the note', async () => {
    const hidden = { ...box('h', 'blue', 10, 10), visible: false };
    const files = await createHtvColourFiles([box('a', 'red', 40, 50), hidden, box('b', 'white', 100, 50)], 'Design');
    expect(files.map((f) => f.colorId)).toEqual(['red', 'white']);
    const note = buildColourFilesNote('Design', files, ['d-1-red.svg', 'd-2-white.svg']);
    expect(note).toContain('1. Red: d-1-red.svg (1 layer)');
    expect(note).toContain('2. White: d-2-white.svg (1 layer)');
  });
});
