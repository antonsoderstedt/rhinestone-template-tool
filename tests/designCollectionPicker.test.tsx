import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import DesignCollectionPicker, { filterDesigns, type DesignCollectionEntry } from '../app/editor/controls/DesignCollectionPicker';

const design = (id: string, title: string, category: string): DesignCollectionEntry => ({ id, title, category, stones: 100, widthMm: 50, heightMm: 40, stoneMm: 3.3, file: `svg/${id}.svg` });
const DESIGNS = [design('a', 'Angel wings', 'wings'), design('b', 'Fish', 'fishing'), design('c', 'Cheer bow 12', 'Cheer bow'), design('d', 'Cheer bow 13', 'Cheer bow')];

describe('design collection', () => {
  it('searches every word in title or category, and filters by category', () => {
    expect(filterDesigns(DESIGNS, '', 'all')).toHaveLength(4);
    expect(filterDesigns(DESIGNS, 'cheer 12', 'all').map((d) => d.id)).toEqual(['c']);
    expect(filterDesigns(DESIGNS, 'bow', 'all')).toHaveLength(2);
    expect(filterDesigns(DESIGNS, 'fish', 'wings')).toHaveLength(0);
    expect(filterDesigns(DESIGNS, '', 'fishing').map((d) => d.id)).toEqual(['b']);
  });

  it('is a closed button until opened, so nothing is fetched on load', () => {
    const html = renderToStaticMarkup(createElement(DesignCollectionPicker, { onPick: vi.fn() }));
    expect(html).toContain('Browse the design collection');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Search');
  });
});
