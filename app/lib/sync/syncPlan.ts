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

export type SyncKind = 'template' | 'asset' | 'htv' | 'papercraft' | 'calibration' | 'settings' | 'fontpref' | 'designpref' | 'font';

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

/** The kinds this build knows how to read and write. Anything else on the server or in the saved state belongs to another version. */
export const KNOWN_KINDS: readonly SyncKind[] = ['template', 'asset', 'htv', 'papercraft', 'calibration', 'settings', 'fontpref', 'designpref', 'font'];
export const isKnownKind = (kind: string): kind is SyncKind => (KNOWN_KINDS as readonly string[]).includes(kind);

/**
 * Items that exist once and are never deleted: the workspace settings, the language and the unit. A deletion of one of them can
 * only be a mistake (for example another version of the app that does not list them), so it is ignored and never sent.
 */
export const isPermanentItem = (kind: string, id: string) => kind === 'settings' && (id === 'workspace' || id === 'language' || id === 'unit');

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
  // Items of a kind this build does not know are left alone (they are another version's).
  const remoteByKey = new Map(remote.filter((item) => isKnownKind(item.kind)).map((item) => [itemKey(item.kind, item.id), item]));
  const keys = [...new Set([...localByKey.keys(), ...remoteByKey.keys()])].sort();
  const actions: SyncAction[] = [];

  for (const key of keys) {
    const mine = localByKey.get(key);
    const theirs = remoteByKey.get(key);
    const lastSynced = synced[key];

    if (theirs?.deleted && isPermanentItem(theirs.kind, theirs.id)) {
      // A deletion of something that is never deleted. Keep the local value; send it again (with the time of now, so that it
      // wins over the deletion) unless it is the untouched default.
      if (mine && time(mine.updatedAt) > 0) actions.push({ type: 'push', kind: mine.kind, id: mine.id, updatedAt: now });
      continue;
    }

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
      if (lastSynced !== undefined && time(theirs.updatedAt) <= time(lastSynced) && !isPermanentItem(theirs.kind, theirs.id)) {
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
