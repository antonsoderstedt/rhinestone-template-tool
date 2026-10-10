'use client';

/**
 * Light/dark theme for the two studios (Rhinestone Studio, HTV Studio) —
 * one shared preference, since it's the same designer's eyes regardless of
 * which studio they're in. The marketing/shell chrome is intentionally not
 * part of this: it stays a single light theme (see globals.css).
 */

import { useCallback, useSyncExternalStore } from 'react';

export type StudioTheme = 'dark' | 'light';

const STORAGE_KEY = 'rt-studio-theme';
const DEFAULT_THEME: StudioTheme = 'dark';

const listeners = new Set<() => void>();

function readStoredTheme(): StudioTheme {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function getServerSnapshot(): StudioTheme {
  return DEFAULT_THEME;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function writeStoredTheme(next: StudioTheme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private browsing / storage disabled — theme just won't persist.
  }
  listeners.forEach((notify) => notify());
}

/**
 * Reads the theme via useSyncExternalStore (the localStorage value is the
 * external source of truth) rather than useState+useEffect — the server
 * and pre-hydration client snapshot is always the default, so there's no
 * hydration mismatch, and React handles re-rendering once the real
 * (possibly "light") value is read after mount.
 */
export function useStudioTheme(): { theme: StudioTheme; toggleTheme: () => void } {
  const theme = useSyncExternalStore(subscribe, readStoredTheme, getServerSnapshot);

  const toggleTheme = useCallback(() => {
    writeStoredTheme(readStoredTheme() === 'dark' ? 'light' : 'dark');
  }, []);

  return { theme, toggleTheme };
}
