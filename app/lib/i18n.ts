'use client';

/**
 * Two languages: English (the text in the source) and Swedish. A string is written in English where it is used,
 * `t('Choose a file')`, and the Swedish dictionary (`i18n/sv.ts`) is looked up by that same text. A string with no Swedish
 * entry shows in English, so a missing translation is never a blank. `{name}` in a string is replaced by a value.
 *
 * The choice is kept in this browser, read after load (the server and the first client render are English, as with the theme).
 */

import { useCallback, useEffect, useState } from 'react';
import { SV } from './i18n/sv';

export type Language = 'en' | 'sv';
export const LANGUAGES: ReadonlyArray<{ id: Language; label: string }> = [
  { id: 'en', label: 'English' },
  { id: 'sv', label: 'Svenska' },
];

const STORAGE_KEY = 'rt-language';
const DEFAULT_LANGUAGE: Language = 'en';

export type TranslateVars = Record<string, string | number>;

/** Pure: the text in a language. */
export function translate(language: Language, text: string, vars?: TranslateVars): string {
  const base = language === 'sv' ? SV[text] ?? text : text;
  return vars ? base.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : base;
}

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'sv';
}

/** What a browser's language list suggests. Not used to choose the language: the app starts in English until the user picks Swedish. */
export function languageFromBrowser(browserLanguages: readonly string[] | undefined): Language {
  return browserLanguages?.some((tag) => tag.toLowerCase().startsWith('sv')) ? 'sv' : 'en';
}

const listeners = new Set<() => void>();

function readStoredLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLanguage(stored)) return stored;
    return DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function setLanguage(next: Language): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // storage disabled: the choice lasts until the page is closed only
  }
  document.documentElement.lang = next;
  listeners.forEach((notify) => notify());
}

/**
 * The language in use. The first render is always the default (English), the same as the server's, and the saved choice is
 * read right after: reading it during the first render made a Swedish reader's page differ from the server's and React gave up
 * on hydrating it (the studio stayed on "Loading…").
 */
export function useLanguage(): Language {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  useEffect(() => {
    const sync = () => setLanguageState(readStoredLanguage());
    queueMicrotask(sync);
    return subscribe(sync);
  }, []);
  return language;
}

/** `const t = useT(); t('Choose a file')`. */
export function useT(): (text: string, vars?: TranslateVars) => string {
  const language = useLanguage();
  return useCallback((text: string, vars?: TranslateVars) => translate(language, text, vars), [language]);
}
