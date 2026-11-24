import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getFontCatalogRevision,
  getOutlineFontDefinition,
  isKnownOutlineFontId,
  isLegacyLibraryCopy,
  listOutlineFonts,
  setFontCatalog,
  subscribeFontCatalog,
} from '../src/lib/rhinestone-engine/index';

afterEach(() => setFontCatalog([], {}));

describe('font library catalog', () => {
  it('adds the library fonts to the list, with a file address each, without touching browser storage', () => {
    const before = listOutlineFonts().length;
    setFontCatalog([{ id: 'lib-one', name: 'Lib One', category: 'Script' }, { id: 'lib-two', name: 'Lib Two' }], {});
    const fonts = listOutlineFonts();
    expect(fonts.length).toBe(before + 2);
    const one = fonts.find((font) => font.fontId === 'lib-one')!;
    expect(one.displayName).toBe('Lib One');
    expect(one.category).toBe('Script');
    expect(one.assetUrl).toMatch(/\/font-library\/f\/lib-one\.woff$/);
    expect(isKnownOutlineFontId('lib-two')).toBe(true);
  });

  it('finds a font by an earlier id (the same font in another file format)', () => {
    setFontCatalog([{ id: 'lib-kept', name: 'Lib' }], { 'lib-old-ttf': 'lib-kept' });
    expect(isKnownOutlineFontId('lib-old-ttf')).toBe(true);
    expect(getOutlineFontDefinition('lib-old-ttf').fontId).toBe('lib-kept');
  });

  it('tells listeners when the catalog has loaded, and counts the loads', () => {
    const listener = vi.fn();
    const stop = subscribeFontCatalog(listener);
    const revision = getFontCatalogRevision();
    setFontCatalog([], {});
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getFontCatalogRevision()).toBe(revision + 1);
    stop();
    setFontCatalog([], {});
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('recognises the copies an older version put in the browser storage', () => {
    expect(isLegacyLibraryCopy({ sourceKind: 'workspace-installed', assetUrl: '/fonts/workspace-installed/installed-x.otf' })).toBe(true);
    expect(isLegacyLibraryCopy({ sourceKind: 'browser-uploaded', assetUrl: '/fonts/workspace-installed/installed-x.otf' })).toBe(false);
    expect(isLegacyLibraryCopy({ sourceKind: 'workspace-installed', assetUrl: 'data:font/woff;base64,AAAA' })).toBe(false);
  });
});
