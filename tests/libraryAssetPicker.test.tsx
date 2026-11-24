import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import LibraryAssetPicker from '../app/editor/controls/LibraryAssetPicker';

describe('choosing artwork from the library', () => {
  it('offers the library next to the file picker, with how many files it holds', () => {
    const html = renderToStaticMarkup(createElement(LibraryAssetPicker, { onPick: vi.fn() }));
    expect(html).toContain('Choose from the library');
    expect(html).toContain('(0)');
    expect(html).toContain('aria-expanded="false"');
  });
});
