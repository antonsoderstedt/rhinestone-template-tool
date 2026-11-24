import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createStoneGridTemplate } from '../src/lib/rhinestone-engine/index';
import { DEFAULT_EDITOR_STATE, type EditorState } from '../app/editor/EditorState';
import DesignPartsPanel from '../app/editor/DesignPartsPanel';

const render = (state: EditorState) => renderToStaticMarkup(createElement(DesignPartsPanel, { state, dispatch: vi.fn() as never }));
const withTemplate = (): EditorState => ({
  ...structuredClone(DEFAULT_EDITOR_STATE),
  activeTool: 'text',
  template: createStoneGridTemplate({ id: 'g', name: 'g', columns: 3, rows: 2, stoneSize: 'SS10', densityPreset: 'standard' }),
});

describe('DesignPartsPanel', () => {
  it('offers Add to design once there is something on the canvas, and explains it the first time', () => {
    const html = render(withTemplate());
    expect(html).toContain('Add to design');
    expect(html).toContain('a name and a number');
    expect(html).not.toContain('Parts of this design');
  });

  it('offers nothing on an empty canvas or with the select tool', () => {
    expect(render({ ...structuredClone(DEFAULT_EDITOR_STATE), activeTool: 'text' })).not.toContain('Add to design');
    expect(render({ ...withTemplate(), activeTool: 'select' })).not.toContain('Add to design');
  });

  it('lists the parts with name, stone count, offsets and remove, and the position of the piece being worked on', () => {
    const state = withTemplate();
    state.parts = [{ id: 'part-1', name: 'Anna', offsetX: 0, offsetY: 0, stones: [{ id: 'a', center: { x: 1, y: 1 }, stoneSize: 'SS10', holeDiameterMm: 3.4 }] }];
    const html = render(state);
    expect(html).toContain('Parts of this design');
    expect(html).toContain('value="Anna"');
    expect(html).toContain('1 stones');
    expect(html).toContain('aria-label="Remove Anna"');
    expect(html).toContain('Position of this piece');
    expect(html).toContain('aria-label="Rotate Anna a quarter turn"');
    expect(html).toContain('aria-label="Flip Anna left to right"');
    expect(html).toContain('aria-label="Duplicate Anna"');
    // nothing to undo yet
    expect(html).toMatch(/aria-label="Undo change to parts"[^>]*disabled/);
    expect(html).not.toContain('a name and a number');
  });
});
