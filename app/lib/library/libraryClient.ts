/** Talks to the library API of the private site (`worker/library.ts`). Everything takes the fetch function, so it can be tested. */

import { withBasePath } from '@/src/lib/rhinestone-engine/deploy/basePath';
import { LIBRARY_LIMITS, emptyOverlay, parseOverlay, type LibraryKind, type LibraryOverlay, type LibraryPatch } from '@/src/lib/library/library';
import { emptyItems, parseItems, type LibraryItems } from '@/src/lib/library/libraryItems';
import { failureOf, getJson, type TrackingResult } from '../tracking/trackingClient';

/** What the owner has changed in the libraries: the hidden and renamed items, and the designs and fonts they have uploaded. */
export interface LibraryState {
  overlay: LibraryOverlay;
  items: LibraryItems;
}

export const emptyLibraryState = (): LibraryState => ({ overlay: emptyOverlay(), items: emptyItems() });

export const fetchLibrary = (fetcher: typeof fetch = fetch): Promise<TrackingResult<LibraryState>> =>
  getJson('/api/library/overlay', (body) => {
    const b = body as { overlay?: unknown; items?: unknown } | null;
    return b && typeof b.overlay === 'object' && b.overlay !== null ? { overlay: parseOverlay(b.overlay), items: parseItems(b.items) } : null;
  }, fetcher);

export interface UploadPayload {
  kind: LibraryKind;
  id: string;
  name: string;
  category: string;
  format: string;
  family?: string;
  design?: { stones: number; widthMm: number; heightMm: number; stoneMm: number };
  /** A design as compact JSON text, a font as base64. */
  data: string;
}

export async function uploadLibraryItem(payload: UploadPayload, fetcher: typeof fetch = fetch): Promise<TrackingResult<string>> {
  try {
    const response = await fetcher(withBasePath('/api/admin/library/item'), { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) return await failureOf(response);
    return { ok: true, value: payload.id };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function deleteLibraryItem(kind: LibraryKind, id: string, fetcher: typeof fetch = fetch): Promise<TrackingResult<true>> {
  try {
    const response = await fetcher(withBasePath(`/api/admin/library/item?kind=${kind}&id=${encodeURIComponent(id)}`), { method: 'DELETE', credentials: 'same-origin' });
    if (!response.ok) return await failureOf(response);
    return { ok: true, value: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** Changes the given fields of many items; the request is split so that each part is accepted. Stops at the first failure. */
export async function patchLibrary(kind: LibraryKind, ids: readonly string[], patch: LibraryPatch, fetcher: typeof fetch = fetch): Promise<TrackingResult<number>> {
  let changed = 0;
  for (let i = 0; i < ids.length; i += LIBRARY_LIMITS.batch) {
    const part = ids.slice(i, i + LIBRARY_LIMITS.batch);
    try {
      const response = await fetcher(withBasePath('/api/admin/library/overrides'), {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, ids: part, patch }),
      });
      if (!response.ok) return await failureOf(response);
      changed += part.length;
    } catch {
      return { ok: false, reason: 'error' };
    }
  }
  return { ok: true, value: changed };
}

let cached: Promise<LibraryState> | null = null;

/**
 * What the owner has changed, for the studios' lists. Asked once per page load; empty where there is no server (GitHub Pages, local
 * development without the Worker) and when the answer cannot be had, so the library then shows as it was built.
 */
export function loadLibrary(): Promise<LibraryState> {
  if (process.env.NEXT_PUBLIC_SYNC_ENABLED !== '1') return Promise.resolve(emptyLibraryState());
  cached ??= fetchLibrary().then((result) => (result.ok ? result.value : emptyLibraryState()));
  return cached;
}
