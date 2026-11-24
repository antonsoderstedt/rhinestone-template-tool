'use client';

import { useEffect } from 'react';
import { hashText } from '../lib/sync/localItems';
import { runSyncNow } from '../lib/sync/syncStore';

const POLL_MS = 60_000;
const WATCH_MS = 8_000;
const QUIET_MS = 4_000;
const WATCHED_KEYS = ['rhinestone-template-library', 'rhinestone-workspace-vault', 'rhinestone-active-calibration-profile', 'rt-language', 'rt-unit'];
/** Above this many characters only the size and the end of a store are looked at (settings and calibration are at the end). */
const FULL_HASH_LIMIT = 6_000_000;

/**
 * A fingerprint of the stores that are synced. When it changes, something was saved. A change that keeps the size (a setting going
 * from 6 to 9) is caught because the content is hashed.
 */
function fingerprint(): string {
  try {
    return WATCHED_KEYS.map((key) => {
      const raw = globalThis.localStorage?.getItem(key) ?? '';
      return `${raw.length}.${hashText(raw.length <= FULL_HASH_LIMIT ? raw : raw.slice(-200_000))}`;
    }).join(':');
  } catch {
    return '';
  }
}

/**
 * Starts syncing in the background: once the page has loaded, when the tab is shown again, when the connection returns, every
 * minute, and a few seconds after something is saved. It does nothing on a site without a sync server (the GitHub Pages site,
 * `next dev`): it is switched on at build time with NEXT_PUBLIC_SYNC_ENABLED=1.
 */
export default function SyncManager() {
  useEffect(() => {
    // Only the build made for the private deployment has a sync server (scripts/deploy-private.sh sets this).
    if (process.env.NEXT_PUBLIC_SYNC_ENABLED !== '1') return undefined;
    const start = window.setTimeout(() => void runSyncNow(true), 1500);
    const onVisible = () => { if (document.visibilityState === 'visible') void runSyncNow(); };
    const onOnline = () => void runSyncNow(true);
    const poll = window.setInterval(() => void runSyncNow(), POLL_MS);

    let seen = fingerprint();
    let quiet: number | undefined;
    const watch = window.setInterval(() => {
      const now = fingerprint();
      if (now === seen) return;
      seen = now;
      window.clearTimeout(quiet);
      quiet = window.setTimeout(() => {
        void runSyncNow(true).then(() => { seen = fingerprint(); });
      }, QUIET_MS);
    }, WATCH_MS);

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(quiet);
      window.clearInterval(poll);
      window.clearInterval(watch);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, []);
  return null;
}
