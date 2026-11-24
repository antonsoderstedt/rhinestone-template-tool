'use client';

import { useSyncExternalStore } from 'react';

/** Studios switch to their touch layout below this width (Tailwind's `lg`). */
export const MOBILE_STUDIO_QUERY = '(max-width: 1023px)';

/**
 * Live result of a CSS media query. `false` on the server and during hydration, then the real
 * value, so server and client markup agree.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function useIsMobileStudio(): boolean {
  return useMediaQuery(MOBILE_STUDIO_QUERY);
}
