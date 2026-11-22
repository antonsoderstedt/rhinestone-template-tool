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

import { DEFAULT_EDITOR_STATE, editorReducer } from '../app/editor/EditorState';
import { buildProjectFileFromEditorState, buildEffectiveTemplate } from '../app/editor/projectPersistence';
import { applyDesignColour, selectedColourOf, withStoneColour } from '../app/editor/stoneColours';
import { createBasicSvgExport, createRhinestoneTemplate, parseRhinestoneProject, serializeRhinestoneProject } from '../src/lib/rhinestone-engine/index';

const gridStone = (id: string, x: number, metadata?: Record<string, string>) => ({ id, center: { x, y: 10 }, stoneSize: 'SS10' as const, holeDiameterMm: 3.43, metadata });

describe('colour for text, fonts and single stones (plan B4)', () => {
  it('gives the design colour to stones that have none, and keeps their own', () => {
    const stones = applyDesignColour([gridStone('a', 10), gridStone('b', 20, { stoneColour: '#c8262d' })], '#d4af37');
    expect(stones.map((s) => stoneColourOf(s))).toEqual(['#d4af37', '#c8262d']);
    expect(applyDesignColour([gridStone('a', 10)], null)[0]!.metadata).toBeUndefined();
  });

  it('sets and clears a colour on a copy', () => {
    const original = gridStone('a', 10, { group: 'x' });
    const coloured = withStoneColour(original, '#D4AF37');
    expect(coloured.metadata).toEqual({ group: 'x', stoneColour: '#d4af37' });
    expect(original.metadata).toEqual({ group: 'x' });
    expect(withStoneColour(coloured, null).metadata).toEqual({ group: 'x' });
  });

  it('knows the colour a selection shares', () => {
    const stones = [gridStone('a', 10, { stoneColour: '#d4af37' }), gridStone('b', 20, { stoneColour: '#d4af37' }), gridStone('c', 30)];
    expect(selectedColourOf(stones, new Set(['a', 'b']))).toBe('#d4af37');
    expect(selectedColourOf(stones, new Set(['a', 'c']))).toBeNull();
    expect(selectedColourOf(stones, new Set())).toBeNull();
  });

  it('colours selected stones with one undo step, and only when the stones are editable', () => {
    let state = structuredClone(DEFAULT_EDITOR_STATE);
    state = editorReducer(state, { type: 'SET_TEMPLATE', template: createRhinestoneTemplate({ id: 't', name: 't', stones: [gridStone('a', 10), gridStone('b', 20)] }) });
    expect(editorReducer(state, { type: 'SET_STONES_COLOUR', ids: ['a'], colour: '#d4af37' })).toBe(state);
    state = editorReducer({ ...state, activeTool: 'grid' }, { type: 'CONVERT_TO_EDITABLE' });
    const before = state.history.past.length;
    state = editorReducer(state, { type: 'SET_STONES_COLOUR', ids: ['a'], colour: '#d4af37' });
    expect(state.editableTemplate.stones.map((s) => stoneColourOf(s))).toEqual(['#d4af37', null]);
    expect(state.history.past).toHaveLength(before + 1);
    state = editorReducer(state, { type: 'UNDO' });
    expect(state.editableTemplate.stones.map((s) => stoneColourOf(s))).toEqual([null, null]);
  });

  it('puts the design colour on the exported design, and saves and restores both kinds of colour', () => {
    let state = structuredClone(DEFAULT_EDITOR_STATE);
    state = editorReducer(state, { type: 'SET_TEMPLATE', template: createRhinestoneTemplate({ id: 't', name: 't', stones: [gridStone('a', 10), gridStone('b', 20)] }) });
    state = editorReducer({ ...state, activeTool: 'grid' }, { type: 'CONVERT_TO_EDITABLE' });
    state = editorReducer(state, { type: 'SET_STONES_COLOUR', ids: ['b'], colour: '#c8262d' });
    state = editorReducer(state, { type: 'SET_DESIGN_STONE_COLOUR', colour: '#D4AF37'.toLowerCase() });
    const effective = buildEffectiveTemplate(state)!;
    expect(effective.stones.map((s) => stoneColourOf(s))).toEqual(['#d4af37', '#c8262d']);

    const file = buildProjectFileFromEditorState(state)!;
    const restored = parseRhinestoneProject(serializeRhinestoneProject(file));
    expect(restored.designStoneColour).toBe('#d4af37');
    expect(restored.editableState?.stones.find((s) => s.id === 'b')?.stoneColour).toBe('#c8262d');
    const broken = JSON.parse(serializeRhinestoneProject(file)) as { designStoneColour: string };
    broken.designStoneColour = 'gold';
    expect(() => parseRhinestoneProject(JSON.stringify(broken))).toThrow(/designStoneColour/);
  });

  it('writes the colour as a data attribute, never as the stroke, so the template is still cut as one', () => {
    const template = createRhinestoneTemplate({ id: 't', name: 't', stones: [gridStone('a', 10, { stoneColour: '#d4af37' }), gridStone('b', 20)] });
    const svg = createBasicSvgExport(template);
    expect(svg).toContain('data-stone-colour="#d4af37"');
    expect(svg.match(/data-stone-colour/g)).toHaveLength(1);
    expect(svg).not.toContain('stroke="#d4af37"');
    expect((svg.match(/<circle/g) ?? []).length).toBe(2);
  });
});

import { AB_COLOUR, gemShades } from '../app/editor/stoneColours';

describe('shiny stones (plan B5)', () => {
  it('has a highlight lighter and a rim darker than the body', () => {
    const lum = (hex: string) => 0.299 * parseInt(hex.slice(1, 3), 16) + 0.587 * parseInt(hex.slice(3, 5), 16) + 0.114 * parseInt(hex.slice(5, 7), 16);
    for (const hex of ['#d4af37', '#1c1c21', '#c8262d']) {
      const shades = gemShades(hex);
      expect(lum(shades.highlight)).toBeGreaterThan(lum(shades.body));
      expect(lum(shades.rim)).toBeLessThan(lum(shades.body));
      expect(shades.body).toBe(hex);
    }
  });

  it('offers Crystal AB as a colour', () => {
    expect(STONE_COLOUR_PRESETS.some((preset) => preset.hex === AB_COLOUR && preset.label === 'Crystal AB')).toBe(true);
  });
});
