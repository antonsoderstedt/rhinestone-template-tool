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
  getPreferredTextCoverageMode,
  getPreferredRhinestoneFontStoneSize,
  getSupportedRhinestoneFontStoneSizes,
  getSupportedTextCoverageModes,
  listRhinestoneFonts,
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

  it('declares conservative text coverage policies for bundled fonts', () => {
    expect(getPreferredTextCoverageMode('archivo-black')).toBe('outline');
    expect(getSupportedTextCoverageModes('archivo-black')).toContain('fill');
    expect(getPreferredTextCoverageMode('oswald-condensed')).toBe('outline-fill');
    expect(getSupportedTextCoverageModes('oswald-condensed')).toContain('fill');
    expect(getPreferredTextCoverageMode('pacifico-script')).toBe('outline');
    expect(getSupportedTextCoverageModes('pacifico-script')).toEqual(['outline']);
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

  it('defaults bold bundled fonts to readable outline placement', async () => {
    const template = await createOutlineTextTemplateAsync({
      id: 'bundled-default-outline',
      name: 'Bundled Default Outline',
      text: 'SMOOCH',
      stoneSize: 'SS10',
      fontId: 'archivo-black',
      fontSizeMm: 25,
    });
    expect(template.metadata?.['coverageMode']).toBe('outline');
    expect(template.metadata?.['fillMode']).toBe('outline');
    expect(template.stones.length).toBeGreaterThan(120);
    expect(template.stones.some((stone) => stone.metadata?.collisionSource === 'outline')).toBe(true);
  });

  it('still offers filled typography as opt-in for bold bundled fonts', async () => {
    const template = await createOutlineTextTemplateAsync({
      id: 'bundled-optin-fill',
      name: 'Bundled Opt-in Fill',
      text: 'SMOOCH',
      stoneSize: 'SS10',
      fontId: 'archivo-black',
      fontSizeMm: 25,
      outlineTextStyle: 'filled-typography',
    });
    expect(template.metadata?.['coverageMode']).toBe('outline-fill');
    expect(template.metadata?.['fillMode']).toBe('outline-fill');
    expect(template.metadata?.['fillEdgeInsetMm']).toBe(0);
    expect(template.metadata?.['textPlacementStrategy']).toBe('glyph-scanline-outline-fill-v1');
    expect(template.stones.some((stone) => stone.metadata?.collisionSource === 'outline')).toBe(true);
    expect(template.stones.some((stone) => stone.metadata?.collisionSource === 'fill')).toBe(true);
    expect(template.metadata?.['outlineStoneCount']).toBe(template.stones.filter((stone) => stone.metadata?.collisionSource === 'outline').length);
    expect(template.metadata?.['fillStoneCount']).toBe(template.stones.filter((stone) => stone.metadata?.collisionSource === 'fill').length);
  });

  it('accepts outlineTextStyle as a higher-level API hint for bundled fonts', async () => {
    const template = await createOutlineTextTemplateAsync({
      id: 'bundled-style-fill',
      name: 'Bundled Style Fill',
      text: 'SMOOCH',
      stoneSize: 'SS10',
      fontId: 'archivo-black',
      fontSizeMm: 25,
      outlineTextStyle: 'filled-typography',
    });
    expect(template.metadata?.['outlineTextStyle']).toBe('filled-typography');
    expect(template.metadata?.['coverageMode']).toBe('outline-fill');
    expect(template.metadata?.['fillMode']).toBe('outline-fill');
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
    expect(filled.metadata?.['textPlacementStrategy']).toBe('glyph-scanline-fill-v1');
    expect(filled.stones.length).toBeGreaterThan(60);
    expect(filled.stones.some((stone) => stone.metadata?.collisionSource === 'fill')).toBe(true);
    expect(filled.stones.some((stone) => stone.metadata?.edgeBand === 'edge')).toBe(true);
  });

  it('clamps outline-only bundled fonts back to outline placement even when fill is requested', async () => {
    const template = await createOutlineTextTemplateAsync({
      id: 'script-forced-fill',
      name: 'Script Forced Fill',
      text: 'Sulay',
      stoneSize: 'SS10',
      fontId: 'pacifico-script',
      fontSizeMm: 32,
      coverageMode: 'fill',
      fillMode: 'fill',
    });
    expect(template.metadata?.['coverageMode']).toBe('outline');
    expect(template.metadata?.['fillMode']).toBe('outline');
    expect(template.metadata?.['textPlacementStrategy']).not.toBe('glyph-scanline-fill-v1');
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
    expect(html).toContain('Filled typography');
  });

  it('renders outline-only policy for script fonts in the picker', () => {
    const html = renderToStaticMarkup(createElement(FontPicker, {
      value: 'pacifico-script',
      previewText: 'Sulay',
      status: { status: 'idle', message: null, fontId: 'pacifico-script' },
      onChange: () => undefined,
    }));
    expect(html).toContain('Pacifico');
    expect(html).toContain('Outline only');
  });

  it('exposes curated local rhinestone fonts and their supported sizes', () => {
    const ids = listRhinestoneFonts().map((font) => font.fontId);
    expect(ids).toContain('blessed-ss10');
    expect(ids).toContain('old-english-ss10');
    expect(listRhinestoneFonts().find((font) => font.fontId === 'small-line-ss10')?.style).toBe('Line');
    expect(listRhinestoneFonts().find((font) => font.fontId === 'huge-numbers-ss10')?.style).toBe('Digits');
    expect(listRhinestoneFonts().find((font) => font.fontId === 'small-line-ss10')?.suggestedText).toBe('CHEER');
    expect(listRhinestoneFonts().find((font) => font.fontId === 'huge-numbers-ss10')?.suggestedText).toBe('2026');
    expect(getSupportedRhinestoneFontStoneSizes('old-english-ss10')).toEqual(['SS10', 'SS6']);
    expect(getPreferredRhinestoneFontStoneSize('bride-ss10')).toBe('SS10');
  });
});
