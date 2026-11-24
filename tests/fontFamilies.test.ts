import { describe, expect, it } from 'vitest';
import { DEFAULT_FONT_FILTERS, categoryCounts, filterFamilies, groupFamilies, sortFamilies, type FontEntry } from '../app/fonts/fontFamilies';

const font = (over: Partial<FontEntry> & { key: string; name: string }): FontEntry => ({
  familyName: over.name.split('-')[0]!, variantName: '', importSourceLabel: '', category: 'Display', styleLabel: '', previewFamily: `F_${over.key}`,
  source: 'workspace-installed', favorite: false, archived: false, tags: [], isBuiltInSimple: false, fontUrl: null, fontWeight: 400, fontStyle: 'normal',
  note: '', licenseSource: '', preferredTextCoverageMode: 'outline', fileName: null, ...over,
});

const FONTS = [
  font({ key: 'a-bold', name: 'Acelon-Bold', variantName: 'Bold', category: 'Serif' }),
  font({ key: 'a-reg', name: 'Acelon-Regular', variantName: 'Regular', category: 'Serif', tags: ['wedding'] }),
  font({ key: 'b', name: 'Bubbly', category: 'Bubble', favorite: true }),
  font({ key: 'c', name: 'Cheer', category: 'Varsity', archived: true }),
  font({ key: 'mine', name: 'Mine', source: 'browser-uploaded', category: 'Script' }),
];

describe('font families', () => {
  const families = groupFamilies(FONTS);

  it('groups variants of the same family and puts Regular first', () => {
    const acelon = families.find((family) => family.name === 'Acelon')!;
    expect(acelon.variants.map((v) => v.key)).toEqual(['a-reg', 'a-bold']);
    expect(acelon.tags).toEqual(['wedding']);
    expect(families).toHaveLength(4);
  });

  it('does not mix fonts of different sources even with the same family name', () => {
    const mixed = groupFamilies([font({ key: 'x', name: 'Same' }), font({ key: 'y', name: 'Same', source: 'browser-uploaded' })]);
    expect(mixed).toHaveLength(2);
  });

  it('hides archived families unless asked, and filters by words, category, source and favourites', () => {
    expect(filterFamilies(families, DEFAULT_FONT_FILTERS).map((f) => f.name).sort()).toEqual(['Acelon', 'Bubbly', 'Mine']);
    expect(filterFamilies(families, { ...DEFAULT_FONT_FILTERS, showArchived: true })).toHaveLength(4);
    expect(filterFamilies(families, { ...DEFAULT_FONT_FILTERS, query: 'wedding' }).map((f) => f.name)).toEqual(['Acelon']);
    expect(filterFamilies(families, { ...DEFAULT_FONT_FILTERS, query: 'acelon bold' }).map((f) => f.name)).toEqual(['Acelon']);
    expect(filterFamilies(families, { ...DEFAULT_FONT_FILTERS, category: 'Bubble' }).map((f) => f.name)).toEqual(['Bubbly']);
    expect(filterFamilies(families, { ...DEFAULT_FONT_FILTERS, source: 'browser-uploaded' }).map((f) => f.name)).toEqual(['Mine']);
    expect(filterFamilies(families, { ...DEFAULT_FONT_FILTERS, favoritesOnly: true }).map((f) => f.name)).toEqual(['Bubbly']);
  });

  it('sorts by name, by category, or favourites first', () => {
    const shown = filterFamilies(families, DEFAULT_FONT_FILTERS);
    expect(sortFamilies(shown, 'name').map((f) => f.name)).toEqual(['Acelon', 'Bubbly', 'Mine']);
    expect(sortFamilies(shown, 'favorites')[0]!.name).toBe('Bubbly');
    expect(sortFamilies(shown, 'category').map((f) => f.category)).toEqual(['Bubble', 'Script', 'Serif']);
  });

  it('counts categories under the other filters, ignoring the category itself', () => {
    expect(categoryCounts(families, { ...DEFAULT_FONT_FILTERS, category: 'Bubble' })).toEqual(expect.arrayContaining([{ category: 'Serif', count: 1 }, { category: 'Bubble', count: 1 }]));
    expect(categoryCounts(families, { ...DEFAULT_FONT_FILTERS, source: 'browser-uploaded' })).toEqual([{ category: 'Script', count: 1 }]);
  });
});
