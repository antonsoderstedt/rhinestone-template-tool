'use client';

import { useEffect } from 'react';
import { fontsWithUploads } from '@/src/lib/library/libraryItems';
import { setFontCatalog, withBasePath, type FontCatalogFont } from '@/src/lib/rhinestone-engine/index';
import { loadLibrary } from '../lib/library/libraryClient';

/**
 * Fetches the font library's catalog once (a small file; the fonts themselves are fetched when used) and hands it to the font
 * registry, with the owner's changes from the admin panel (hidden fonts, names, categories, uploaded fonts) on top. Without a library
 * (nothing was built or published) the catalog is empty and the app has the fonts that ship with it.
 */
export default function FontCatalogLoader() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [response, library] = await Promise.all([fetch(withBasePath('/font-library/catalog.json')), loadLibrary()]);
        const catalog = response.ok ? ((await response.json()) as { fonts?: FontCatalogFont[]; aliases?: Record<string, string> }) : null;
        if (cancelled) return;
        // The fonts uploaded in the admin panel are added even where the built library is missing.
        const built = Array.isArray(catalog?.fonts) ? catalog.fonts : [];
        setFontCatalog(fontsWithUploads<FontCatalogFont>(built, library.items, library.overlay, (item, url) => ({ id: item.id, name: item.name, family: item.family || item.name, category: item.category || 'Uploads', url })), catalog?.aliases ?? {});
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
