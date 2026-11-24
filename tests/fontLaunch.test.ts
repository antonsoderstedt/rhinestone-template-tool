import { describe, expect, it } from 'vitest';
import { DEFAULT_PREVIEW_TEXT, buildFontLaunchUrl, getFontLaunchAvailability } from '../app/lib/fontLaunch';

describe('buildFontLaunchUrl', () => {
  it('keeps the typed text and encodes both parts', () => {
    expect(buildFontLaunchUrl('rhinestone', 'installed-a b', 'Go Team & 2026')).toBe(
      '/rhinestone?font=installed-a%20b&text=Go%20Team%20%26%202026',
    );
    expect(buildFontLaunchUrl('htv', 'fredoka-one', 'Hi')).toBe('/htv?font=fredoka-one&text=Hi');
  });

  it('falls back to neutral text, never a personal sample', () => {
    expect(buildFontLaunchUrl('htv', 'x', '   ')).toBe(`/htv?font=x&text=${encodeURIComponent(DEFAULT_PREVIEW_TEXT)}`);
    expect(DEFAULT_PREVIEW_TEXT).toBe('Your Text');
  });
});

describe('getFontLaunchAvailability', () => {
  it('enables both studios for a normal font', () => {
    const result = getFontLaunchAvailability({ isBuiltInSimple: false, fileUnavailable: false });
    expect(result.rhinestone.enabled).toBe(true);
    expect(result.htv.enabled).toBe(true);
  });

  it('disables both when the file cannot be loaded, with a reason', () => {
    const result = getFontLaunchAvailability({ isBuiltInSimple: false, fileUnavailable: true });
    expect(result.rhinestone.enabled).toBe(false);
    expect(result.htv.enabled).toBe(false);
    expect(result.htv.reason).toMatch(/cannot be loaded/);
  });

  it('the built-in simple font works in Rhinestone but not in HTV', () => {
    const result = getFontLaunchAvailability({ isBuiltInSimple: true, fileUnavailable: false });
    expect(result.rhinestone.enabled).toBe(true);
    expect(result.htv.enabled).toBe(false);
    expect(result.htv.reason).toBeTruthy();
  });
});
