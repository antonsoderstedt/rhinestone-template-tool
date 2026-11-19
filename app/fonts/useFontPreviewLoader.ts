'use client';

import { useEffect, useState } from 'react';

export interface FontPreviewSpec {
  family: string;
  url: string | null;
  weight?: number;
  style?: 'normal' | 'italic';
}

export type FontPreviewStatus = 'loading' | 'loaded' | 'failed';

// One load per family+url for the whole session, shared by every card that shows it.
const loads = new Map<string, Promise<boolean>>();

function loadFontFace(spec: FontPreviewSpec): Promise<boolean> {
  if (typeof FontFace === 'undefined' || !spec.url) return Promise.resolve(true);
  const key = `${spec.family}|${spec.url.length}|${spec.url.slice(0, 120)}`;
  const existing = loads.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const face = new FontFace(spec.family, `url("${spec.url}")`, {
        weight: String(spec.weight ?? 400),
        style: spec.style ?? 'normal',
      });
      await face.load();
      document.fonts.add(face);
      return true;
    } catch {
      return false;
    }
  })();
  loads.set(key, promise);
  return promise;
}

/**
 * Loads preview fonts only for the cards that are on screen (instead of declaring
 * thousands of `@font-face` rules up front) and reports which ones failed, so the
 * page can say so instead of silently drawing a fallback font.
 */
export function useFontPreviewLoader(specs: readonly FontPreviewSpec[]): Record<string, FontPreviewStatus> {
  const [statuses, setStatuses] = useState<Record<string, FontPreviewStatus>>({});

  useEffect(() => {
    let cancelled = false;
    for (const spec of specs) {
      void loadFontFace(spec).then((ok) => {
        if (cancelled) return;
        const next: FontPreviewStatus = ok ? 'loaded' : 'failed';
        setStatuses((current) => (current[spec.family] === next ? current : { ...current, [spec.family]: next }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [specs]);

  return statuses;
}
