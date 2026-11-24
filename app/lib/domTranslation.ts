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

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
/** A name that is written in lower case in a sentence ("full front"), looked up in the dictionary by its capitalised form. */
const word = (text: string) => lowerFirst(SV[cap(text)] ?? text);
const layers = (n: string) => `${n} ${Number(n) === 1 ? 'lager' : 'lager'}`;

/**
 * Sentences with a number or a name in them that are made in code far from a component (the status chips, the screen reader
 * description of the canvas). Each pattern maps one English shape to its Swedish.
 */
export const SENTENCE_PATTERNS: ReadonlyArray<{ pattern: RegExp; to: (m: RegExpExecArray) => string }> = [
  { pattern: /^(\d+) layers? · (.+)$/, to: (m) => `${layers(m[1]!)} · ${word(m[2]!)}` },
  { pattern: /^(\d+) layers? elsewhere, not exported$/, to: (m) => `${layers(m[1]!)} på andra platser, exporteras inte` },
  { pattern: /^Empty (.+) placement$/, to: (m) => `Tom placering: ${word(m[1]!)}` },
  { pattern: /^(\d+) stones? · grid (on|off)$/, to: (m) => `${m[1]} stenar · rutnät ${m[2] === 'on' ? 'på' : 'av'}` },
  {
    pattern: /^Design canvas\. (\d+) stones?, about (\d+) by (\d+) millimetres\.(?: (\d+) selected\.)?$/,
    to: (m) => `Designyta. ${m[1]} stenar, ungefär ${m[2]} gånger ${m[3]} millimeter.${m[4] ? ` ${m[4]} markerade.` : ''}`,
  },
  { pattern: /^Design canvas\. Nothing here yet\.$/, to: () => 'Designyta. Inget här än.' },
  { pattern: /^Add (.+) to favorites$/, to: (m) => `Lägg till ${m[1]} som favorit` },
  { pattern: /^Remove (.+) from favorites$/, to: (m) => `Ta bort ${m[1]} som favorit` },
  { pattern: /^(\d+)% of this browser's storage is used$/, to: (m) => `${m[1]} % av den här webbläsarens lagring används` },
  { pattern: /^(\d+) stones · (SS\d+)$/, to: (m) => `${m[1]} stenar · ${m[2]}` },
  { pattern: /^Last backed up (.+)$/, to: (m) => `Senast säkerhetskopierad ${m[1]}` },
  { pattern: /^(\d+) minutes? ago$/, to: (m) => `för ${m[1]} min sedan` },
  { pattern: /^(\d+) hours? ago$/, to: (m) => `för ${m[1]} h sedan` },
  { pattern: /^(\d+) days? ago$/, to: (m) => `för ${m[1]} dagar sedan` },
  { pattern: /^(\d+) stones$/, to: (m) => `${m[1]} stenar` },
  { pattern: /^(\d+) stone$/, to: () => '1 sten' },
];

/** The text with its surrounding whitespace kept, translated when the whole trimmed text is a known string. */
export function translateExact(language: Language, text: string): string {
  if (language !== 'sv') return text;
  const trimmed = text.trim();
  if (trimmed.length < 2) return text;
  let hit: string | undefined = SV[trimmed];
  if (hit === undefined) {
    for (const rule of SENTENCE_PATTERNS) {
      const match = rule.pattern.exec(trimmed);
      if (match) {
        hit = rule.to(match);
        break;
      }
    }
  }
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
