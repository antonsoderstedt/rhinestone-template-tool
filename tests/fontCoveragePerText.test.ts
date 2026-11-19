import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearOutlineFontCacheForTests,
  createOutlineTextTemplateAsync,
  isAvailableOutlineFontId,
  loadOutlineFont,
} from '../src/lib/rhinestone-engine/index';

// An imported script font that has every basic letter and digit but no Å Ä Ö å ä ö.
const SCRIPT_FONT_ID = 'installed-always-script-font-imported';

const FONT_FILE = path.join(process.cwd(), 'public/fonts/workspace-installed/installed-always-script-font-imported.ttf');

beforeEach(() => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    },
    configurable: true,
    writable: true,
  });
  store.set('rhinestone-workspace-vault', JSON.stringify({
    uploadedFonts: [{
      fontId: SCRIPT_FONT_ID, name: 'Always Script', fileName: 'always-script.ttf', mimeType: 'font/ttf', sizeBytes: 1,
      sourceKind: 'workspace-installed', category: 'Script', styleLabel: 'Regular', tags: [], favorite: false, archived: false,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', previewFamily: 'Always Script',
      previewText: 'Sulay 123', licenseSource: 'test', note: '', preferredTextCoverageMode: 'outline',
      supportedTextCoverageModes: ['outline'], nodeFilePath: FONT_FILE,
    }],
  }));
  clearOutlineFontCacheForTests();
});

describe('font coverage is checked against the typed text', () => {
  it('the test font exists', () => {
    expect(isAvailableOutlineFontId(SCRIPT_FONT_ID)).toBe(true);
  });

  it('still rejects the font for strict callers (HTV), which need the extended set', async () => {
    clearOutlineFontCacheForTests();
    await expect(loadOutlineFont(SCRIPT_FONT_ID)).rejects.toThrow(/missing required characters: Å Ä Ö å ä ö/);
  });

  it('loads for the rhinestone studio when extended characters are allowed to be missing', async () => {
    clearOutlineFontCacheForTests();
    const loaded = await loadOutlineFont(SCRIPT_FONT_ID, { allowMissingExtendedCharacters: true });
    expect(loaded.font).not.toBeNull();
    // the cached parse must not turn the strict rule off for the next caller
    await expect(loadOutlineFont(SCRIPT_FONT_ID)).rejects.toThrow(/missing required characters/);
  });

  it('generates stones for text it can draw', async () => {
    const template = await createOutlineTextTemplateAsync({
      id: 't', name: 't', text: 'Sulay 123', stoneSize: 'SS10', fontId: SCRIPT_FONT_ID, fontSizeMm: 25,
    });
    expect(template.stones.length).toBeGreaterThan(20);
  });

  it('names the characters it cannot draw instead of rejecting the whole font', async () => {
    await expect(createOutlineTextTemplateAsync({
      id: 't', name: 't', text: 'Åsa', stoneSize: 'SS10', fontId: SCRIPT_FONT_ID, fontSizeMm: 25,
    })).rejects.toThrow(/has no glyph for: Å\. Remove it from the text/);
  });
});
