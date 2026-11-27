'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import type { SiteMeta } from '@/src/lib/siteMeta/siteMeta';
import { SITE_META_CHANGED, applySiteMeta, cacheSiteMeta, fetchSiteMeta, readCachedSiteMeta } from '../lib/siteMeta/siteMetaClient';

/**
 * Applies the title and description the owner chose in the admin panel. The pages are a static export, so the HTML itself always has
 * the defaults; this changes the tab title and the description tag when the page has loaded (and from the last answer at once, so the
 * title does not flash). Renders nothing, and does nothing where there is no server to ask.
 */
export default function SiteMetaManager() {
  const pathname = usePathname() ?? '/';
  const pathRef = useRef(pathname);
  const metaRef = useRef<SiteMeta | null>(null);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SYNC_ENABLED !== '1') return undefined;
    let cancelled = false;
    const show = (meta: SiteMeta) => {
      metaRef.current = meta;
      applySiteMeta(document, meta, pathRef.current);
    };
    const cached = readCachedSiteMeta(window.localStorage);
    if (cached) show(cached);
    void fetchSiteMeta().then((result) => {
      if (cancelled || !result.ok) return;
      cacheSiteMeta(window.localStorage, result.value);
      show(result.value);
    });
    const onChanged = (event: Event) => {
      const next = (event as CustomEvent<SiteMeta>).detail;
      if (next) show(next);
    };
    window.addEventListener(SITE_META_CHANGED, onChanged);
    // Next puts its own title back when a late part of a page arrives (the studios load in pieces), so the owner's title is
    // put back in turn. Setting the same title again changes nothing, so this cannot loop.
    const watcher = new MutationObserver(() => {
      if (metaRef.current) applySiteMeta(document, metaRef.current, pathRef.current);
    });
    watcher.observe(document.head, { childList: true, characterData: true, subtree: true });
    return () => {
      cancelled = true;
      watcher.disconnect();
      window.removeEventListener(SITE_META_CHANGED, onChanged);
    };
  }, []);

  // A page change: the title of the new page (the settings are already here).
  useEffect(() => {
    pathRef.current = pathname;
    if (metaRef.current) applySiteMeta(document, metaRef.current, pathname);
  }, [pathname]);

  return null;
}
