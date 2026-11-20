import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as opentype from 'opentype.js';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  clearOutlineFontCacheForTests,
  createOutlineTextTemplateAsync,
  isAvailableOutlineFontId,
  loadOutlineFont,
} from '../src/lib/rhinestone-engine/index';

/**
 * A synthetic script-like font with every basic letter and digit but no Å Ä Ö å ä ö or punctuation. It is built
 * here (not read from public/fonts, which is not in the repository) so the test runs the same on CI.
 */
const FONT_ID = 'installed-coverage-test-font';
const BASIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
let fontFile = '';

function squarePath(): opentype.Path {
  const p = new opentype.Path();
  p.moveTo(100, 0);
  p.lineTo(500, 0);
  p.lineTo(500, 700);
  p.lineTo(100, 700);
  p.close();
  return p;
}

function buildFontFile(): string {
  const glyphs = [
    new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: 600, path: new opentype.Path() }),
    new opentype.Glyph({ name: 'space', unicode: 32, advanceWidth: 300, path: new opentype.Path() }),
    ...[...BASIC].map((character) => new opentype.Glyph({
      name: character, unicode: character.codePointAt(0)!, advanceWidth: 600, path: squarePath(),
    })),
  ];
  const font = new opentype.Font({ familyName: 'Coverage Test', styleName: 'Regular', unitsPerEm: 1000, ascender: 800, descender: -200, glyphs });
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), 'font-coverage-')), 'coverage-test.ttf');
  writeFileSync(file, Buffer.from(font.toArrayBuffer()));
  return file;
}

beforeAll(() => {
  fontFile = buildFontFile();
});

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
      fontId: FONT_ID, name: 'Coverage Test', fileName: 'coverage-test.ttf', mimeType: 'font/ttf', sizeBytes: 1,
      sourceKind: 'workspace-installed', category: 'Script', styleLabel: 'Regular', tags: [], favorite: false, archived: false,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', previewFamily: 'Coverage Test',
      previewText: 'Sulay 123', licenseSource: 'test', note: '', preferredTextCoverageMode: 'outline',
      supportedTextCoverageModes: ['outline'], nodeFilePath: fontFile,
    }],
  }));
  clearOutlineFontCacheForTests();
});

describe('font coverage is checked against the typed text', () => {
  it('the test font is registered', () => {
    expect(isAvailableOutlineFontId(FONT_ID)).toBe(true);
  });

  it('still rejects the font for strict callers (HTV), which need the extended set', async () => {
    await expect(loadOutlineFont(FONT_ID)).rejects.toThrow(/missing required characters: Å Ä Ö å ä ö/);
  });

  it('loads for the rhinestone studio when extended characters are allowed to be missing', async () => {
    const loaded = await loadOutlineFont(FONT_ID, { allowMissingExtendedCharacters: true });
    expect(loaded.font).not.toBeNull();
    // the cached parse must not turn the strict rule off for the next caller
    await expect(loadOutlineFont(FONT_ID)).rejects.toThrow(/missing required characters/);
  });

  it('generates stones for text it can draw', async () => {
    const template = await createOutlineTextTemplateAsync({
      id: 't', name: 't', text: 'Sulay 123', stoneSize: 'SS10', fontId: FONT_ID, fontSizeMm: 25,
    });
    expect(template.stones.length).toBeGreaterThan(20);
  });

  it('names the characters it cannot draw instead of rejecting the whole font', async () => {
    await expect(createOutlineTextTemplateAsync({
      id: 't', name: 't', text: 'Åsa', stoneSize: 'SS10', fontId: FONT_ID, fontSizeMm: 25,
    })).rejects.toThrow(/has no glyph for: Å\. Remove it from the text/);
  });
});
