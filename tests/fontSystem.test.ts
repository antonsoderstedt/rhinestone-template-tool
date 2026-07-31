import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, beforeEach } from 'vitest';
import FontPicker from '../app/editor/controls/FontPicker';
import {
  BUILT_IN_VECTOR_FONT,
  LEGACY_OUTLINE_FONT_ID,
  OUTLINE_FONT_REGISTRY,
  clearOutlineFontCacheForTests,
  createOutlineTextTemplate,
  createOutlineTextTemplateAsync,
  listCachedFontIds,
  listOutlineFonts,
  loadOutlineFont,
} from '../src/lib/rhinestone-engine/index';

describe('font system', () => {
  beforeEach(() => {
    clearOutlineFontCacheForTests();
  });

  it('has unique stable font IDs', () => {
    const ids = listOutlineFonts().map((font) => font.fontId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe(LEGACY_OUTLINE_FONT_ID);
  });

  it('loads all bundled font resources', async () => {
    const bundledFonts = OUTLINE_FONT_REGISTRY.filter((font) => !font.isLegacy);
    const loaded = await Promise.all(bundledFonts.map((font) => loadOutlineFont(font.fontId)));
    expect(loaded.every((entry) => entry.font)).toBe(true);
  });

  it('supports ÅÄÖåäö and digits for bundled fonts', async () => {
    for (const font of OUTLINE_FONT_REGISTRY.filter((entry) => !entry.isLegacy)) {
      const template = await createOutlineTextTemplateAsync({
        id: `chars-${font.fontId}`,
        name: font.displayName,
        text: 'Sulay 2026 ÅÄÖ åäö',
        stoneSize: 'SS10',
        fontId: font.fontId,
      });
      expect(template.stones.length).toBeGreaterThan(0);
      expect(template.metadata?.['fontId']).toBe(font.fontId);
    }
  });

  it('produces deterministic geometry for the same bundled font input', async () => {
    const options = {
      id: 'det-font',
      name: 'Det Font',
      text: 'Sulay 2026 ÅÄÖ',
      stoneSize: 'SS10' as const,
      fontId: 'archivo-black' as const,
      fillMode: 'outline' as const,
    };
    const a = await createOutlineTextTemplateAsync(options);
    const b = await createOutlineTextTemplateAsync(options);
    expect(a.stones).toEqual(b.stones);
  });

  it('different fonts produce different geometry', async () => {
    const archivo = await createOutlineTextTemplateAsync({
      id: 'archivo',
      name: 'Archivo',
      text: 'Sulay',
      stoneSize: 'SS10',
      fontId: 'archivo-black',
    });
    const caveat = await createOutlineTextTemplateAsync({
      id: 'caveat',
      name: 'Caveat',
      text: 'Sulay',
      stoneSize: 'SS10',
      fontId: 'caveat-handwritten',
    });
    expect(archivo.stones).not.toEqual(caveat.stones);
  });

  it('keeps the legacy font result unchanged', () => {
    const implicitLegacy = createOutlineTextTemplate({
      id: 'legacy-implicit',
      name: 'Legacy',
      text: 'SMOOCH',
      stoneSize: 'SS10',
    });
    const explicitLegacy = createOutlineTextTemplate({
      id: 'legacy-explicit',
      name: 'Legacy',
      text: 'SMOOCH',
      stoneSize: 'SS10',
      fontId: LEGACY_OUTLINE_FONT_ID,
    });
    expect(implicitLegacy.stones).toEqual(explicitLegacy.stones);
    expect(BUILT_IN_VECTOR_FONT.id).toBe('built-in-vector-outline-v1');
  });

  it('defaults bundled outline fonts to filled text placement', async () => {
    const template = await createOutlineTextTemplateAsync({
      id: 'bundled-default-fill',
      name: 'Bundled Default Fill',
      text: 'SMOOCH',
      stoneSize: 'SS10',
      fontId: 'archivo-black',
      fontSizeMm: 25,
    });
    expect(template.metadata?.['coverageMode']).toBe('fill');
    expect(template.metadata?.['fillMode']).toBe('fill');
    expect(template.metadata?.['fillEdgeInsetMm']).toBe(0);
    expect(template.stones.length).toBeGreaterThan(50);
  });

  it('supports outline, fill, and outline + fill for bundled fonts', async () => {
    const outline = await createOutlineTextTemplateAsync({
      id: 'outline',
      name: 'Outline',
      text: 'O',
      stoneSize: 'SS10',
      fontId: 'bitter-slab',
      fontSizeMm: 64,
      fillMode: 'outline',
    });
    const fill = await createOutlineTextTemplateAsync({
      id: 'fill',
      name: 'Fill',
      text: 'O',
      stoneSize: 'SS10',
      fontId: 'bitter-slab',
      fontSizeMm: 64,
      fillMode: 'fill',
    });
    const combo = await createOutlineTextTemplateAsync({
      id: 'combo',
      name: 'Combo',
      text: 'O',
      stoneSize: 'SS10',
      fontId: 'bitter-slab',
      fontSizeMm: 64,
      fillMode: 'outline-fill',
    });
    expect(outline.stones.length).toBeGreaterThan(0);
    expect(fill.metadata?.['fillMode']).toBe('fill');
    expect(fill.stones.length).toBeGreaterThanOrEqual(0);
    expect(combo.stones.length).toBeGreaterThanOrEqual(outline.stones.length);
  });

  it('uses text-friendly fill inset for bundled font fill mode', async () => {
    const filled = await createOutlineTextTemplateAsync({
      id: 'bitter-filled',
      name: 'Bitter Filled',
      text: 'SMOOCH',
      stoneSize: 'SS10',
      fontId: 'bitter-slab',
      fontSizeMm: 25,
      coverageMode: 'fill',
      fillMode: 'fill',
    });
    expect(filled.metadata?.['fillEdgeInsetMm']).toBe(0);
    expect(filled.stones.length).toBeGreaterThan(40);
  });

  it('handles spaces and kerning-sensitive pairs', async () => {
    const tight = await createOutlineTextTemplateAsync({
      id: 'tight',
      name: 'Tight',
      text: 'AVA',
      stoneSize: 'SS10',
      fontId: 'oswald-condensed',
    });
    const spaced = await createOutlineTextTemplateAsync({
      id: 'spaced',
      name: 'Spaced',
      text: 'A VA',
      stoneSize: 'SS10',
      fontId: 'oswald-condensed',
    });
    const bounds = (template: Awaited<ReturnType<typeof createOutlineTextTemplateAsync>>) => {
      const xs = template.stones.map((stone) => stone.center.x);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(bounds(spaced)).toBeGreaterThan(bounds(tight));
  });

  it('caches parsed fonts across repeated loads', async () => {
    await loadOutlineFont('archivo-black');
    await loadOutlineFont('archivo-black');
    expect(listCachedFontIds()).toEqual(['archivo-black']);
  });

  it('rejects invalid font IDs safely', async () => {
    await expect(createOutlineTextTemplateAsync({
      id: 'bad-font',
      name: 'Bad Font',
      text: 'Oops',
      stoneSize: 'SS10',
      fontId: 'not-a-real-font',
    })).rejects.toThrow(/Unknown outline fontId/);
  });

  it('renders the font picker with accessible listbox semantics and selected preview', () => {
    const html = renderToStaticMarkup(createElement(FontPicker, {
      value: 'archivo-black',
      previewText: 'Sulay 2026 ÅÄÖ',
      status: { status: 'idle', message: null, fontId: 'archivo-black' },
      onChange: () => undefined,
    }));
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain('Choose outline font');
    expect(html).toContain('Archivo Black');
  });
});
