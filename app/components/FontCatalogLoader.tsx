'use client';

import { useEffect } from 'react';
import { setFontCatalog, withBasePath, type FontCatalogFont } from '@/src/lib/rhinestone-engine/index';

/**
 * Fetches the font library's catalog once (a small file; the fonts themselves are fetched when used) and hands it to the font
 * registry. Without a library (nothing was built or published) the catalog is empty and the app has the fonts that ship with it.
 */
export default function FontCatalogLoader() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(withBasePath('/font-library/catalog.json'));
        const catalog = response.ok ? ((await response.json()) as { fonts?: FontCatalogFont[]; aliases?: Record<string, string> }) : null;
        if (cancelled) return;
        setFontCatalog(Array.isArray(catalog?.fonts) ? catalog.fonts : [], catalog?.aliases ?? {});
      } catch {
        // No library here: say so, so that anything waiting for it carries on with the fonts that ship with the app.
        if (!cancelled) setFontCatalog([], {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
