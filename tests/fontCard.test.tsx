import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import FontCard from '../app/fonts/FontCard';
import { groupFamilies, type FontEntry } from '../app/fonts/fontFamilies';

const font = (key: string, name: string, over: Partial<FontEntry> = {}): FontEntry => ({
  key, name, familyName: 'Acelon', variantName: name.split('-')[1] ?? '', importSourceLabel: '', category: 'Serif', styleLabel: '', previewFamily: `F_${key}`,
  source: 'workspace-installed', favorite: false, archived: false, tags: [], isBuiltInSimple: false, fontUrl: null, fontWeight: 400, fontStyle: 'normal',
  note: 'From your font library.', licenseSource: '', preferredTextCoverageMode: 'outline', fileName: null, ...over,
});

const render = (fonts: FontEntry[], stones = { on: false, size: 'SS10' as const }) => {
  const [family] = groupFamilies(fonts);
  return renderToStaticMarkup(createElement(FontCard, {
    family: family!, selectedKey: family!.variants[0]!.key, onSelectVariant: vi.fn(), previewText: 'Hej', stones, unavailable: () => false,
    onFavorite: vi.fn(), onArchive: vi.fn(), onTags: vi.fn(), onEditUploaded: vi.fn(), onLaunch: vi.fn(),
  }));
};

describe('FontCard', () => {
  it('shows the family, its category and source, the text in the font, and both studio buttons', () => {
    const html = render([font('a', 'Acelon-Regular')]);
    expect(html).toContain('Acelon');
    expect(html).toContain('Serif');
    expect(html).toContain('Library');
    expect(html).toContain('Hej');
    expect(html).toContain('F_a');
    expect(html).toContain('Rhinestone');
    expect(html).toContain('HTV');
  });

  it('offers a variant choice only when the family has more than one', () => {
    expect(render([font('a', 'Acelon-Regular')])).not.toContain('<select');
    expect(render([font('a', 'Acelon-Regular'), font('b', 'Acelon-Bold')])).toContain('<select');
  });

  it('draws stones (a placeholder until traced) instead of letters when stones are on', () => {
    const html = render([font('a', 'Acelon-Regular')], { on: true, size: 'SS10' });
    expect(html).not.toContain("font-family:&#x27;F_a&#x27;");
    expect(html).toContain('animate-pulse');
  });

  it('lets the user edit only the fonts they uploaded', () => {
    expect(render([font('a', 'Acelon-Regular')])).not.toContain('Production note');
    expect(render([font('m', 'Mine-Regular', { source: 'browser-uploaded' })])).toContain('Production note');
  });
});
