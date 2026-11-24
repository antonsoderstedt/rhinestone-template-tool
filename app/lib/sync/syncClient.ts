/**
 * One round of syncing this browser with the server. The parts that touch the world (the server, this device's stores, the saved
 * state) are passed in, so the logic can be tested with two pretend devices and an in-memory server.
 */

import { withBasePath } from '@/src/lib/rhinestone-engine/deploy/basePath';
import { nextSyncedState, planSync, itemKey, type ItemRef, type RemoteRef, type SyncAction, type SyncKind } from './syncPlan';
import { applyRemoteItem, deleteLocalItem, listLocalItems, readLocalItemData } from './localItems';

export interface SyncDeps {
  /** null when this site has no sync server (GitHub Pages, local development). */
  fetchManifest(): Promise<RemoteRef[] | null>;
  putItem(kind: SyncKind, id: string, updatedAt: string, data: string | null): Promise<void>;
  getItem(kind: SyncKind, id: string): Promise<{ data: string; updatedAt: string } | null>;
  listLocal(): ItemRef[];
  readLocal(kind: SyncKind, id: string): string | null;
  applyLocal(kind: SyncKind, id: string, data: string, updatedAt: string): boolean;
  deleteLocal(kind: SyncKind, id: string): boolean;
  loadSynced(): Record<string, string>;
  saveSynced(state: Record<string, string>): void;
  now(): string;
}

export interface SyncOutcome {
  status: 'disabled' | 'ok' | 'partial';
  pushed: number;
  pulled: number;
  removedHere: number;
  removedThere: number;
  failed: number;
}

const EMPTY: SyncOutcome = { status: 'disabled', pushed: 0, pulled: 0, removedHere: 0, removedThere: 0, failed: 0 };

export async function syncOnce(deps: SyncDeps): Promise<SyncOutcome> {
  const remote = await deps.fetchManifest();
  if (remote === null) return EMPTY;

  const synced = deps.loadSynced();
  const actions = planSync(deps.listLocal(), remote, synced, deps.now());
  const outcome: SyncOutcome = { ...EMPTY, status: 'ok' };
  const keepSynced: Record<string, string> = {};

  for (const action of actions) {
    try {
      await run(action, deps, outcome);
    } catch {
      outcome.failed++;
      // A deletion that could not be sent must be remembered, or the item would come back from the server next time.
      if (action.type === 'push-delete') {
        const key = itemKey(action.kind, action.id);
        if (synced[key] !== undefined) keepSynced[key] = synced[key]!;
      }
    }
  }

  deps.saveSynced({ ...nextSyncedState(deps.listLocal()), ...keepSynced });
  if (outcome.failed > 0) outcome.status = 'partial';
  return outcome;
}

async function run(action: SyncAction, deps: SyncDeps, outcome: SyncOutcome): Promise<void> {
  switch (action.type) {
    case 'push': {
      const data = deps.readLocal(action.kind, action.id);
      if (data === null) return;
      await deps.putItem(action.kind, action.id, action.updatedAt, data);
      outcome.pushed++;
      return;
    }
    case 'push-delete':
      await deps.putItem(action.kind, action.id, action.updatedAt, null);
      outcome.removedThere++;
      return;
    case 'pull': {
      const item = await deps.getItem(action.kind, action.id);
      if (item === null || !deps.applyLocal(action.kind, action.id, item.data, item.updatedAt)) throw new Error('Could not take the item');
      outcome.pulled++;
      return;
    }
    case 'delete-local':
      if (!deps.deleteLocal(action.kind, action.id)) throw new Error('Could not delete the item');
      outcome.removedHere++;
  }
}

// ─── The real thing ───────────────────────────────────────────────────────────

export const SYNC_STATE_STORAGE_KEY = 'rhinestone-sync-state-v1';

const itemUrl = (kind: string, id: string, extra = '') =>
  withBasePath(`/api/sync/item?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}${extra}`);

export function createBrowserSyncDeps(fetcher: typeof fetch = fetch): SyncDeps {
  return {
    async fetchManifest() {
      const response = await fetcher(withBasePath('/api/sync/manifest'), { cache: 'no-store', credentials: 'same-origin' });
      if (response.status === 404) return null;
      if (!response.ok || !(response.headers.get('content-type') ?? '').includes('application/json')) {
        if (response.status === 401 || response.status === 403) throw new Error('Not signed in');
        return null;
      }
      const body = (await response.json()) as { items?: RemoteRef[] };
      return Array.isArray(body.items) ? body.items : null;
    },
    async putItem(kind, id, updatedAt, data) {
      const deleted = data === null;
      const response = await fetcher(itemUrl(kind, id, `&updatedAt=${encodeURIComponent(updatedAt)}${deleted ? '&deleted=1' : ''}`), {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'text/plain; charset=utf-8' },
        body: deleted ? '' : data,
      });
      if (!response.ok && response.status !== 409) throw new Error(`Upload failed (${response.status})`);
    },
    async getItem(kind, id) {
      const response = await fetcher(itemUrl(kind, id), { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) return null;
      const updatedAt = response.headers.get('x-sync-updated-at');
      return updatedAt ? { data: await response.text(), updatedAt } : null;
    },
    listLocal: listLocalItems,
    readLocal: readLocalItemData,
    applyLocal: applyRemoteItem,
    deleteLocal: deleteLocalItem,
    loadSynced() {
      try {
        const raw = globalThis.localStorage?.getItem(SYNC_STATE_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as { items?: Record<string, string> }) : null;
        return parsed && typeof parsed.items === 'object' && parsed.items ? parsed.items : {};
      } catch {
        return {};
      }
    },
    saveSynced(state) {
      try {
        globalThis.localStorage?.setItem(SYNC_STATE_STORAGE_KEY, JSON.stringify({ version: 1, syncedAt: new Date().toISOString(), items: state }));
      } catch {
        /* storage full: the next round just compares again */
      }
    },
    now: () => new Date().toISOString(),
  };
}
