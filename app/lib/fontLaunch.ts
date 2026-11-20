/** Neutral sample text for font previews and for fonts launched without typed text. */
export const DEFAULT_PREVIEW_TEXT = 'Your Text';

export type FontLaunchStudio = 'rhinestone' | 'htv';

/** `/rhinestone?font=…&text=…` — both studios read `font` and `text` and generate the design on arrival. */
export function buildFontLaunchUrl(studio: FontLaunchStudio, fontKey: string, text: string): string {
  const typed = text.trim();
  return `/${studio}?font=${encodeURIComponent(fontKey)}&text=${encodeURIComponent(typed.length > 0 ? typed : DEFAULT_PREVIEW_TEXT)}`;
}

export interface FontLaunchAvailability {
  rhinestone: { enabled: boolean; reason?: string };
  htv: { enabled: boolean; reason?: string };
}

/**
 * Which studios a font can be sent to. A font whose file cannot be loaded cannot
 * be used anywhere; the built-in simple font draws stones but has no outline file,
 * which HTV needs.
 */
export function getFontLaunchAvailability(font: { isBuiltInSimple: boolean; fileUnavailable: boolean }): FontLaunchAvailability {
  if (font.fileUnavailable) {
    const reason = 'This font file cannot be loaded, so it cannot be used.';
    return { rhinestone: { enabled: false, reason }, htv: { enabled: false, reason } };
  }
  return {
    rhinestone: { enabled: true },
    htv: font.isBuiltInSimple
      ? { enabled: false, reason: 'HTV needs a font with an outline file. Pick another font.' }
      : { enabled: true },
  };
}
