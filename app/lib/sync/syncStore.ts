/**
 * The state of the sync as the screens see it, and what starts a round. One round at a time, also across tabs (Web Locks).
 */

import { createBrowserSyncDeps, syncOnce, type SyncOutcome } from './syncClient';

export type SyncPhase = 'unknown' | 'disabled' | 'syncing' | 'ok' | 'partial' | 'offline' | 'signin' | 'error';

export interface SyncSnapshot {
  phase: SyncPhase;
  lastSyncedAt: string | null;
  outcome: SyncOutcome | null;
}

const INITIAL: SyncSnapshot = { phase: 'unknown', lastSyncedAt: null, outcome: null };
let snapshot: SyncSnapshot = INITIAL;
const listeners = new Set<() => void>();
let running = false;
let lastStart = 0;

function set(next: Partial<SyncSnapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

export const getSyncSnapshot = () => snapshot;
/** What the server renders: always the same object (React requires the snapshot to be stable). */
export const getServerSyncSnapshot = (): SyncSnapshot => INITIAL;
export function subscribeSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Runs one round now (or does nothing if one is already running). `force` skips the "not twice within 5 seconds" guard. */
export async function runSyncNow(force = false): Promise<void> {
  if (running || snapshot.phase === 'disabled') return;
  if (!force && Date.now() - lastStart < 5000) return;
  running = true;
  lastStart = Date.now();
  const previous = snapshot.phase;
  set({ phase: 'syncing' });
  try {
    const round = async () => {
      const outcome = await syncOnce(createBrowserSyncDeps());
      if (outcome.status === 'disabled') {
        set({ phase: 'disabled', outcome });
        return;
      }
      set({ phase: outcome.status === 'ok' ? 'ok' : 'partial', lastSyncedAt: new Date().toISOString(), outcome });
      if (outcome.pulled > 0 || outcome.removedHere > 0) {
        // Other screens read the stores when they hear this (the same event the browser sends for another tab's change).
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('rhinestone-sync-applied'));
      }
    };
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (locks) await locks.request('rhinestone-sync', { ifAvailable: true }, async (lock) => { if (lock) await round(); });
    else await round();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    set({ phase: message === 'Not signed in' ? 'signin' : typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error' });
  } finally {
    running = false;
    if (snapshot.phase === 'syncing') set({ phase: previous === 'unknown' ? 'ok' : previous });
  }
}
