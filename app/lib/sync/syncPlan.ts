/**
 * Decides what to send, fetch and delete so that two devices end up with the same saved items. Pure.
 *
 * Three views are compared, per item (a design, a file, a calibration profile):
 *   local   what this browser has now
 *   remote  what the server has (a deleted item stays there as a "tombstone" so other devices learn of it)
 *   synced  what this browser had at the end of its last sync (so "missing here" can mean "deleted here")
 *
 * The newer `updatedAt` wins. A deletion wins over an older edit, an edit made after a deletion wins over the deletion.
 */

export type SyncKind = 'template' | 'asset' | 'htv' | 'calibration' | 'settings' | 'fontpref' | 'designpref' | 'font';

export interface ItemRef {
  kind: SyncKind;
  id: string;
  updatedAt: string;
}

export interface RemoteRef extends ItemRef {
  deleted: boolean;
}

export type SyncAction =
  | { type: 'push'; kind: SyncKind; id: string; updatedAt: string }
  | { type: 'push-delete'; kind: SyncKind; id: string; updatedAt: string }
  | { type: 'pull'; kind: SyncKind; id: string }
  | { type: 'delete-local'; kind: SyncKind; id: string };

export const itemKey = (kind: string, id: string) => `${kind}:${id}`;

const time = (value: string | undefined): number => {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

export function planSync(
  local: readonly ItemRef[],
  remote: readonly RemoteRef[],
  synced: Readonly<Record<string, string>>,
  now: string,
): SyncAction[] {
  const localByKey = new Map(local.map((item) => [itemKey(item.kind, item.id), item]));
  const remoteByKey = new Map(remote.map((item) => [itemKey(item.kind, item.id), item]));
  const keys = [...new Set([...localByKey.keys(), ...remoteByKey.keys()])].sort();
  const actions: SyncAction[] = [];

  for (const key of keys) {
    const mine = localByKey.get(key);
    const theirs = remoteByKey.get(key);
    const lastSynced = synced[key];

    if (mine && theirs) {
      if (theirs.deleted) {
        // Deleted elsewhere: delete here, unless this copy was edited after the deletion.
        if (time(mine.updatedAt) > time(theirs.updatedAt)) actions.push({ type: 'push', kind: mine.kind, id: mine.id, updatedAt: mine.updatedAt });
        else actions.push({ type: 'delete-local', kind: mine.kind, id: mine.id });
      } else if (time(mine.updatedAt) > time(theirs.updatedAt)) {
        actions.push({ type: 'push', kind: mine.kind, id: mine.id, updatedAt: mine.updatedAt });
      } else if (time(mine.updatedAt) < time(theirs.updatedAt)) {
        actions.push({ type: 'pull', kind: mine.kind, id: mine.id });
      }
    } else if (mine) {
      // Only here: new on this device (or the server lost it): send it.
      actions.push({ type: 'push', kind: mine.kind, id: mine.id, updatedAt: mine.updatedAt });
    } else if (theirs && !theirs.deleted) {
      if (lastSynced !== undefined && time(theirs.updatedAt) <= time(lastSynced)) {
        // This device had it and no longer does: it was deleted here. Tell the server.
        actions.push({ type: 'push-delete', kind: theirs.kind, id: theirs.id, updatedAt: now });
      } else {
        // New elsewhere (or edited elsewhere after it was deleted here): fetch it.
        actions.push({ type: 'pull', kind: theirs.kind, id: theirs.id });
      }
    }
    // Only a tombstone on the server and nothing here: nothing to do.
  }
  return actions;
}

/** What to remember after a sync: every item this browser now has, with its time. */
export function nextSyncedState(local: readonly ItemRef[]): Record<string, string> {
  return Object.fromEntries(local.map((item) => [itemKey(item.kind, item.id), item.updatedAt]));
}
