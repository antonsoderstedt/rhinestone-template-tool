/** Talks to the library API of the private site (`worker/library.ts`). Everything takes the fetch function, so it can be tested. */

import { withBasePath } from '@/src/lib/rhinestone-engine/deploy/basePath';
import { LIBRARY_LIMITS, emptyOverlay, parseOverlay, type LibraryKind, type LibraryOverlay, type LibraryPatch } from '@/src/lib/library/library';
import { failureOf, getJson, type TrackingResult } from '../tracking/trackingClient';

export const fetchLibraryOverlay = (fetcher: typeof fetch = fetch): Promise<TrackingResult<LibraryOverlay>> =>
  getJson('/api/library/overlay', (body) => {
    const overlay = (body as { overlay?: unknown } | null)?.overlay;
    return overlay && typeof overlay === 'object' ? parseOverlay(overlay) : null;
  }, fetcher);

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

let cached: Promise<LibraryOverlay> | null = null;

/**
 * What the owner has hidden or renamed, for the studios' lists. Asked once per page load; empty where there is no server (GitHub
 * Pages, local development without the Worker) and when the answer cannot be had, so the library then shows as it was built.
 */
export function loadLibraryOverlay(): Promise<LibraryOverlay> {
  if (process.env.NEXT_PUBLIC_SYNC_ENABLED !== '1') return Promise.resolve(emptyOverlay());
  cached ??= fetchLibraryOverlay().then((result) => (result.ok ? result.value : emptyOverlay()));
  return cached;
}
