'use client';

import { useEffect } from 'react';
import { applyFontOverlay } from '@/src/lib/library/library';
import { setFontCatalog, withBasePath, type FontCatalogFont } from '@/src/lib/rhinestone-engine/index';
import { loadLibraryOverlay } from '../lib/library/libraryClient';

/**
 * Fetches the font library's catalog once (a small file; the fonts themselves are fetched when used) and hands it to the font
 * registry, with the owner's changes from the admin panel (hidden fonts, names, categories) on top. Without a library (nothing was built or published) the catalog is empty and the app has the fonts that ship with it.
 */
export default function FontCatalogLoader() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [response, overlay] = await Promise.all([fetch(withBasePath('/font-library/catalog.json')), loadLibraryOverlay()]);
        const catalog = response.ok ? ((await response.json()) as { fonts?: FontCatalogFont[]; aliases?: Record<string, string> }) : null;
        if (cancelled) return;
        setFontCatalog(Array.isArray(catalog?.fonts) ? applyFontOverlay(catalog.fonts, overlay) : [], catalog?.aliases ?? {});
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
