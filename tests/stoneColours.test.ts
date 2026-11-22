import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import StoneColourCounts from '../app/editor/controls/StoneColourCounts';
import {
  STONE_COLOUR_PRESETS,
  countStonesByColour,
  describeStoneColour,
  inkOn,
  isMultiColour,
  stoneColourOf,
} from '../app/editor/stoneColours';
import { createArtworkTemplate, importSvgArtwork } from '../src/lib/rhinestone-engine/index';

const badge = readFileSync(path.resolve(__dirname, 'fixtures/artwork/synthetic/badge-two-colours.svg'), 'utf8');
const stone = (hex?: string) => ({ metadata: hex ? { stoneColour: hex } : {} });

describe('stone colour helpers', () => {
  it('reads valid colours only', () => {
    expect(stoneColourOf(stone('#D4AF37'))).toBe('#d4af37');
    expect(stoneColourOf(stone('gold'))).toBeNull();
    expect(stoneColourOf({})).toBeNull();
  });

  it('counts per colour, biggest first, ignoring stones without one', () => {
    const counts = countStonesByColour([stone('#d4af37'), stone('#1c1c21'), stone('#d4af37'), stone()]);
    expect(counts.map((c) => [c.label, c.count])).toEqual([['Gold', 2], ['Jet black', 1]]);
    expect(describeStoneColour('#123456')).toBe('#123456');
  });

  it('tells a multi-colour design from a one-colour one', () => {
    expect(isMultiColour([stone('#d4af37'), stone('#d4af37')])).toBe(false);
    expect(isMultiColour([stone('#d4af37'), stone('#1c1c21')])).toBe(true);
    expect(isMultiColour([stone(), stone()])).toBe(false);
  });

  it('has unique presets and readable ink', () => {
    expect(new Set(STONE_COLOUR_PRESETS.map((p) => p.hex)).size).toBe(STONE_COLOUR_PRESETS.length);
    expect(inkOn('#f3f4f8')).toBe('#111111');
    expect(inkOn('#1c1c21')).toBe('#ffffff');
  });

  it('shows nothing for a one-colour design and a row per colour otherwise', () => {
    expect(renderToStaticMarkup(createElement(StoneColourCounts, { stones: [stone(), stone()] }))).toBe('');
    const html = renderToStaticMarkup(createElement(StoneColourCounts, { stones: [stone('#d4af37'), stone('#1c1c21'), stone('#1c1c21')] }));
    expect(html).toContain('Gold');
    expect(html).toContain('Jet black');
  });
});

describe('artwork stones carry a colour', () => {
  const shapes = importSvgArtwork(badge).shapes;
  const make = (extra = {}) =>
    createArtworkTemplate({ id: 'b', name: 'b', shapes, stoneSize: 'SS10', look: 'outline', widthMm: 120, ...extra }).template.stones;

  it('uses the colours of the artwork when there are several', () => {
    const colours = new Set(make().map((s) => stoneColourOf(s)));
    expect(colours).toEqual(new Set(['#ffaef0', '#1a1033']));
  });

  it('lets the user choose the colour of each layer', () => {
    const stones = make({ layerStoneColours: { '#ffaef0': '#d4af37' } });
    const counts = countStonesByColour(stones);
    expect(counts.some((c) => c.hex === '#d4af37')).toBe(true);
    expect(counts.some((c) => c.hex === '#ffaef0')).toBe(false);
    expect(counts.some((c) => c.hex === '#1a1033')).toBe(true);
  });

  it('adds no colour to a one-colour artwork unless asked', () => {
    const one = importSvgArtwork('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><rect width="100" height="40" rx="8" fill="#ff0000"/></svg>').shapes;
    const plain = createArtworkTemplate({ id: 'o', name: 'o', shapes: one, stoneSize: 'SS10', look: 'outline', widthMm: 100 }).template.stones;
    expect(plain.every((s) => stoneColourOf(s) === null)).toBe(true);
    const chosen = createArtworkTemplate({ id: 'o', name: 'o', shapes: one, stoneSize: 'SS10', look: 'outline', widthMm: 100, layerStoneColours: { '#ff0000': '#1c1c21' } }).template.stones;
    expect(chosen.every((s) => stoneColourOf(s) === '#1c1c21')).toBe(true);
  });
});
