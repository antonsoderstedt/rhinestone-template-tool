import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import TextStyleGallery from '../app/editor/controls/TextStyleGallery';
import { DEFAULT_EDITOR_STATE } from '../app/editor/EditorState';

vi.mock('../app/editor/textStyles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../app/editor/textStyles')>();
  return {
    ...actual,
    listTextStyleGroups: () => [
      {
        id: 'traced',
        title: 'Letters traced with stones',
        description: 'many',
        options: Array.from({ length: 200 }, (_, i) => ({
          choice: { kind: 'dots' as const },
          key: `fake:${i}`,
          label: `Font ${i}`,
          note: 'Script',
        })),
      },
    ],
  };
});

describe('TextStyleGallery paging', () => {
  it('draws one page of a very large group, not every look in it', () => {
    const html = renderToStaticMarkup(createElement(TextStyleGallery, { state: DEFAULT_EDITOR_STATE, dispatch: vi.fn() }));
    const items = html.match(/<li/g)?.length ?? 0;
    expect(items).toBeLessThanOrEqual(30);
    expect(html).toContain('Search 200 styles');
    expect(html).toMatch(/Show \d+ more/);
  });
});
