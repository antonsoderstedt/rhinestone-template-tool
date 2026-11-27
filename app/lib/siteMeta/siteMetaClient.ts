/** Talks to the site metadata API of the private site (`worker/siteMeta.ts`) and applies the result to the page. Everything takes the fetch function or the document, so it can be tested. */

import { withBasePath } from '@/src/lib/rhinestone-engine/deploy/basePath';
import { metaFromStored, titleForPath, type SiteMeta } from '@/src/lib/siteMeta/siteMeta';
import { failureOf, getJson, type TrackingResult } from '../tracking/trackingClient';

export const SITE_META_CACHE_KEY = 'rhinestone-site-meta';
/** Sent on the window when the admin panel has saved new settings, so the open tab changes at once. */
export const SITE_META_CHANGED = 'rhinestone-site-meta-changed';

const pickSettings = (body: unknown): SiteMeta | null => {
  const settings = (body as { settings?: unknown } | null)?.settings;
  return settings && typeof settings === 'object' ? metaFromStored(JSON.stringify(settings)) : null;
};

/** What every page applies. */
export const fetchSiteMeta = (fetcher: typeof fetch = fetch): Promise<TrackingResult<SiteMeta>> => getJson('/api/site/meta', pickSettings, fetcher);

export const fetchSiteMetaSettings = (fetcher: typeof fetch = fetch): Promise<TrackingResult<SiteMeta>> => getJson('/api/admin/metadata', pickSettings, fetcher);

export async function saveSiteMetaSettings(settings: SiteMeta, fetcher: typeof fetch = fetch): Promise<TrackingResult<SiteMeta>> {
  try {
    const response = await fetcher(withBasePath('/api/admin/metadata'), { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(settings) });
    if (!response.ok) return await failureOf(response);
    return { ok: true, value: pickSettings(await response.json()) ?? settings };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** The part of a document that is changed: the tab title and the description tag. */
export interface MetaDocument {
  title: string;
  head: { appendChild: (node: never) => unknown };
  querySelector: (selector: string) => { setAttribute: (name: string, value: string) => void; remove: () => void } | null;
  createElement: (tag: 'meta') => { setAttribute: (name: string, value: string) => void };
}

/** Sets the tab title for the page and the description. An empty description removes the tag. */
export function applySiteMeta(doc: MetaDocument, meta: SiteMeta, path: string): void {
  const title = titleForPath(meta, path);
  if (doc.title !== title) doc.title = title;
  const tag = doc.querySelector('meta[name="description"]');
  if (meta.description === '') {
    tag?.remove();
    return;
  }
  if (tag) {
    tag.setAttribute('content', meta.description);
    return;
  }
  const created = doc.createElement('meta');
  created.setAttribute('name', 'description');
  created.setAttribute('content', meta.description);
  doc.head.appendChild(created as never);
}

/** The settings this browser saw last time, so the title is right before the answer arrives. Null when there are none. */
export function readCachedSiteMeta(storage: Pick<Storage, 'getItem'> | null): SiteMeta | null {
  try {
    const text = storage?.getItem(SITE_META_CACHE_KEY);
    return text ? metaFromStored(text) : null;
  } catch {
    return null;
  }
}

export function cacheSiteMeta(storage: Pick<Storage, 'setItem'> | null, meta: SiteMeta): void {
  try {
    storage?.setItem(SITE_META_CACHE_KEY, JSON.stringify(meta));
  } catch {
    // A full or blocked storage only means the title is set a moment later next time.
  }
}
