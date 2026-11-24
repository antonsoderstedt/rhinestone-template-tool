import { useSyncExternalStore } from 'react';
import { getFontCatalogRevision, subscribeFontCatalog } from '@/src/lib/rhinestone-engine/index';

/** Changes when the font library has been loaded (or reloaded), so a screen that lists fonts draws again. */
export function useFontCatalogRevision(): number {
  return useSyncExternalStore(subscribeFontCatalog, getFontCatalogRevision, () => 0);
}
