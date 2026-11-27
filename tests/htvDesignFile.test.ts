/* eslint-disable @typescript-eslint/no-explicit-any -- the tests make one thing wrong in an arbitrary JSON object */
import { describe, expect, it } from 'vitest';
import { createHtvTextLayer, createHtvVectorLayer, DEFAULT_HTV_STATE, type HtvState } from '../app/htv/HtvState';
import {
  HTV_DESIGN_FORMAT,
  HTV_DESIGN_SUFFIX,
  HTV_FILE_LIMITS,
  htvDesignFileName,
  isHtvDesignFileName,
  parseHtvDesign,
  serializeHtvDesign,
} from '../app/htv/htvDesignFile';

const square = (size: number) => ({ closed: true, points: [{ x: 0, y: 0 }, { x: size, y: 0 }, { x: size, y: size }, { x: 0, y: size }] });

function sampleState(): HtvState {
  return {
    ...DEFAULT_HTV_STATE,
    projectName: 'Team shirt',
    layers: [
      createHtvTextLayer({ id: 'text-1', text: 'TIGERS', fontId: 'archivo-black', fontSizeMm: 60, x: 10, y: -20, rotationDeg: 5, colorId: 'white', curveAmount: 25, align: 'center' }),
      createHtvVectorLayer({ id: 'svg-1', name: 'Star', polylines: [square(40), square(10)], naturalWidthMm: 40, naturalHeightMm: 40, sourceKind: 'svg-upload', excludedContours: [1], flipX: true, groupId: 'group-1' }),
    ],
    selectedLayerIds: new Set(['text-1']),
    garment: { type: 'hoodie', size: 'L', colorId: 'navy', placementZone: 'left-chest', activePlacementZones: ['full-front', 'left-chest'] },
    canvas: { zoom: 2, panX: 15, panY: -4 },
    history: { past: [{ layers: [], selectedLayerIds: new Set() }], future: [] },
  };
}

/** The file as an object, to make one thing wrong in it. */
const file = (change: (f: Record<string, any>) => void): string => {
  const parsed = JSON.parse(serializeHtvDesign(sampleState())) as Record<string, any>;
  change(parsed);
  return JSON.stringify(parsed);
};

describe('file names', () => {
  it('make a safe name with the suffix, and recognise it', () => {
    expect(htvDesignFileName('Lag Tröja 2026!')).toBe(`lag-troja-2026${HTV_DESIGN_SUFFIX}`);
    expect(htvDesignFileName('???')).toBe('htv-design.htv.json');
    expect(isHtvDesignFileName('a.HTV.JSON')).toBe(true);
    expect(isHtvDesignFileName('a.json')).toBe(false);
    expect(isHtvDesignFileName('a.rhinestone.json')).toBe(false);
  });
});

describe('a design that is saved and opened again', () => {
  const written = serializeHtvDesign(sampleState());
  const read = parseHtvDesign(written);

  it('has the format and version in it, and neither history nor selection', () => {
    const o = JSON.parse(written) as Record<string, unknown>;
    expect(o.format).toBe(HTV_DESIGN_FORMAT);
    expect(o.version).toBe(1);
    expect(o).not.toHaveProperty('history');
    expect(o).not.toHaveProperty('selectedLayerIds');
  });

  it('comes back with the same layers, garment and canvas', () => {
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const original = sampleState();
    expect(read.state.projectName).toBe('Team shirt');
    expect(read.state.layers).toEqual(original.layers);
    expect(read.state.garment).toEqual(original.garment);
    expect(read.state.canvas).toEqual(original.canvas);
  });

  it('starts with no history and nothing selected', () => {
    if (!read.ok) throw new Error('did not read');
    expect(read.state.history).toEqual({ past: [], future: [] });
    expect(read.state.selectedLayerIds.size).toBe(0);
  });

  it('is deterministic: the same design gives the same text', () => {
    expect(serializeHtvDesign(sampleState())).toBe(written);
  });
});

describe('a file that is not an HTV design', () => {
  it('says so for text that is not JSON, JSON of something else, and a newer version', () => {
    expect(parseHtvDesign('not json')).toEqual({ ok: false, reason: 'not-json' });
    expect(parseHtvDesign('[]')).toEqual({ ok: false, reason: 'not-a-design' });
    expect(parseHtvDesign('{"format":"rhinestone-studio-project"}')).toEqual({ ok: false, reason: 'not-a-design' });
    expect(parseHtvDesign(file((f) => { f.version = 2; }))).toEqual({ ok: false, reason: 'newer' });
    expect(parseHtvDesign(file((f) => { delete f.version; }))).toMatchObject({ ok: false, reason: 'invalid' });
  });
});

describe('a design with something wrong in it', () => {
  const invalid = (change: (f: Record<string, any>) => void) => parseHtvDesign(file(change));
  const text = (f: Record<string, any>) => f.layers[0] as Record<string, any>;
  const shape = (f: Record<string, any>) => f.layers[1] as Record<string, any>;

  it('is refused when a layer value is the wrong type or out of range', () => {
    const changes: ((f: Record<string, any>) => void)[] = [
      (f) => { text(f).x = 'far'; },
      (f) => { text(f).x = 1e9; },
      (f) => { text(f).x = null; },
      (f) => { text(f).scale = 0; },
      (f) => { text(f).scale = 5000; },
      (f) => { text(f).placementId = 'neck'; },
      (f) => { text(f).colorId = ''; },
      (f) => { text(f).id = '../etc'; },
      (f) => { text(f).text = 'x'.repeat(HTV_FILE_LIMITS.text + 1); },
      (f) => { text(f).fontSizeMm = -3; },
      (f) => { text(f).align = 'justify'; },
      (f) => { text(f).curveAmount = 500; },
      (f) => { text(f).groupId = 5; },
      (f) => { text(f).type = 'raster'; },
      (f) => { f.layers[1].id = f.layers[0].id; },
      (f) => { f.layers.push(5); },
      (f) => { f.layers = 'none'; },
      (f) => { f.layers = Array.from({ length: HTV_FILE_LIMITS.layers + 1 }, (_, i) => ({ ...f.layers[0], id: `t-${i}` })); },
    ];
    for (const change of changes) expect(invalid(change), String(change)).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('is refused when a shape is damaged or too large', () => {
    const changes: ((f: Record<string, any>) => void)[] = [
      (f) => { shape(f).polylines = 'x'; },
      (f) => { shape(f).polylines = [{ points: 'x' }]; },
      (f) => { shape(f).polylines[0].points[0] = { x: 'a', y: 1 }; },
      (f) => { shape(f).polylines[0].points[0].y = 1e9; },
      (f) => { shape(f).polylines[0].points[0] = null; },
      (f) => { shape(f).sourceKind = 'camera'; },
      (f) => { shape(f).naturalWidthMm = -1; },
      (f) => { shape(f).excludedContours = [7]; },
      (f) => { shape(f).excludedContours = [0.5]; },
      (f) => { shape(f).polylines = Array.from({ length: HTV_FILE_LIMITS.polylines + 1 }, () => square(1)); },
    ];
    for (const change of changes) expect(invalid(change), String(change)).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('is refused when the points of all shapes together are too many', () => {
    const points = Array.from({ length: 50_000 }, (_, i) => ({ x: i % 100, y: Math.floor(i / 100) }));
    const result = invalid((f) => { f.layers = Array.from({ length: 9 }, (_, i) => ({ ...shape(f), id: `s-${i}`, polylines: [{ points, closed: true }], excludedContours: [] })); });
    expect(result).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('keeps going with a bad garment or canvas, using the defaults for what is wrong', () => {
    const result = invalid((f) => {
      f.garment = { type: 'cape', size: 'XXXL', colorId: 5, placementZone: 'neck', activePlacementZones: ['nowhere', 'left-sleeve', 'left-sleeve'] };
      f.canvas = { zoom: 'big', panX: 1e12 };
      f.projectName = 42;
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.garment).toEqual({ type: 'tee', size: 'M', colorId: 'white', placementZone: 'full-front', activePlacementZones: ['left-sleeve', 'full-front'] });
    expect(result.state.canvas).toEqual({ zoom: 1, panX: 0, panY: 0 });
    expect(result.state.projectName).toBe('Untitled HTV Design');
  });

  it('calls the old garment name tshirt a tee', () => {
    const result = invalid((f) => { f.garment.type = 'tshirt'; });
    expect(result.ok && result.state.garment.type).toBe('tee');
  });

  it('builds the state from the checked values only, so extra properties do not come along', () => {
    const result = invalid((f) => { text(f).__proto__ = { polluted: true }; text(f).extra = 'x'; f.extraTop = 1; });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.layers[0]).not.toHaveProperty('extra');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('opens a design with no layers', () => {
    const result = invalid((f) => { f.layers = []; });
    expect(result.ok && result.state.layers).toEqual([]);
  });
});
