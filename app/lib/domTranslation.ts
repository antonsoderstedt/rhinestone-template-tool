/**
 * The safety net under `t()`: text that is not written through `the t function` (labels in data tables, messages made far from a
 * component) is still translated when it is shown, by looking the exact text up in the dictionary. Only whole-text matches
 * are changed, so nothing the user typed is touched unless it is exactly a known interface text.
 *
 * Pure parts (`shouldSkip`, `translateExact`) are separate from the DOM walking so they can be tested.
 */

import { SV } from './i18n/sv';
import type { Language } from './i18n';

export const TRANSLATED_ATTRIBUTES = ['title', 'aria-label', 'placeholder', 'alt'] as const;

/** The text with its surrounding whitespace kept, translated when the whole trimmed text is a known string. */
export function translateExact(language: Language, text: string): string {
  if (language !== 'sv') return text;
  const trimmed = text.trim();
  if (trimmed.length < 2) return text;
  const hit = SV[trimmed];
  if (hit === undefined || hit === trimmed) return text;
  const start = text.indexOf(trimmed);
  return text.slice(0, start) + hit + text.slice(start + trimmed.length);
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'CODE', 'PRE']);

/** Parts of the page whose text is never interface text. */
export function shouldSkip(element: { tagName?: string; isContentEditable?: boolean; closest?: (selector: string) => unknown } | null): boolean {
  if (!element) return true;
  if (element.tagName && SKIP_TAGS.has(element.tagName.toUpperCase())) return true;
  if (element.isContentEditable) return true;
  return Boolean(element.closest?.('[data-no-translate], textarea, [contenteditable="true"]'));
}
