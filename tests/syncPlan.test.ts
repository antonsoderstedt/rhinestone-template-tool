import { describe, expect, it } from 'vitest';
import { itemKey, nextSyncedState, planSync, type ItemRef, type RemoteRef } from '../app/lib/sync/syncPlan';

const NOW = '2026-11-24T20:00:00.000Z';
const T1 = '2026-11-24T10:00:00.000Z';
const T2 = '2026-11-24T11:00:00.000Z';
const T3 = '2026-11-24T12:00:00.000Z';
const local = (id: string, updatedAt: string): ItemRef => ({ kind: 'template', id, updatedAt });
const remote = (id: string, updatedAt: string, deleted = false): RemoteRef => ({ kind: 'template', id, updatedAt, deleted });
const synced = (...entries: Array<[string, string]>) => Object.fromEntries(entries.map(([id, at]) => [itemKey('template', id), at]));

describe('planSync', () => {
  it('does nothing when both sides match', () => {
    expect(planSync([local('a', T1)], [remote('a', T1)], synced(['a', T1]), NOW)).toEqual([]);
  });

  it('sends what is new here, and fetches what is new there', () => {
    const actions = planSync([local('mine', T1)], [remote('theirs', T1)], {}, NOW);
    expect(actions).toEqual([
      { type: 'push', kind: 'template', id: 'mine', updatedAt: T1 },
      { type: 'pull', kind: 'template', id: 'theirs' },
    ]);
  });

  it('lets the newer edit win in both directions', () => {
    expect(planSync([local('a', T2)], [remote('a', T1)], synced(['a', T1]), NOW)).toEqual([{ type: 'push', kind: 'template', id: 'a', updatedAt: T2 }]);
    expect(planSync([local('a', T1)], [remote('a', T2)], synced(['a', T1]), NOW)).toEqual([{ type: 'pull', kind: 'template', id: 'a' }]);
  });

  it('tells the server about a deletion made here', () => {
    // It was synced before (T1), it is gone here, and the server still has the same version.
    expect(planSync([], [remote('a', T1)], synced(['a', T1]), NOW)).toEqual([{ type: 'push-delete', kind: 'template', id: 'a', updatedAt: NOW }]);
  });

  it('keeps an edit made elsewhere after the deletion here', () => {
    expect(planSync([], [remote('a', T3)], synced(['a', T1]), NOW)).toEqual([{ type: 'pull', kind: 'template', id: 'a' }]);
  });

  it('deletes here what was deleted elsewhere, unless it was edited after that', () => {
    expect(planSync([local('a', T1)], [remote('a', T2, true)], synced(['a', T1]), NOW)).toEqual([{ type: 'delete-local', kind: 'template', id: 'a' }]);
    expect(planSync([local('a', T3)], [remote('a', T2, true)], synced(['a', T1]), NOW)).toEqual([{ type: 'push', kind: 'template', id: 'a', updatedAt: T3 }]);
  });

  it('ignores a tombstone for something this device never had', () => {
    expect(planSync([], [remote('a', T2, true)], {}, NOW)).toEqual([]);
  });

  it('sends everything again if the server lost it', () => {
    expect(planSync([local('a', T1)], [], synced(['a', T1]), NOW)).toEqual([{ type: 'push', kind: 'template', id: 'a', updatedAt: T1 }]);
  });

  it('keeps kinds apart and is stable in order', () => {
    const actions = planSync([{ kind: 'asset', id: 'x', updatedAt: T1 }, { kind: 'template', id: 'x', updatedAt: T1 }], [], {}, NOW);
    expect(actions.map((a) => `${a.kind}:${a.id}`)).toEqual(['asset:x', 'template:x']);
  });

  it('remembers what this device has after a sync', () => {
    expect(nextSyncedState([local('a', T1), { kind: 'asset', id: 'b', updatedAt: T2 }])).toEqual({ 'template:a': T1, 'asset:b': T2 });
  });

  describe('items that exist once (settings, language, unit) and other versions\' kinds', () => {
    const setting = (id: string, updatedAt: string): ItemRef => ({ kind: 'settings', id, updatedAt });
    const settingRemote = (id: string, updatedAt: string, deleted = false): RemoteRef => ({ kind: 'settings', id, updatedAt, deleted });
    const EPOCH = '1970-01-01T00:00:00.000Z';

    it('never tells the server to delete one, even if it is missing here and was synced before', () => {
      expect(planSync([], [settingRemote('language', T1)], { 'settings:language': T1 }, NOW)).toEqual([{ type: 'pull', kind: 'settings', id: 'language' }]);
    });

    it('ignores a deletion of one: keeps the local value and sends it again so it wins, but not the untouched default', () => {
      expect(planSync([setting('workspace', T1)], [settingRemote('workspace', T3, true)], { 'settings:workspace': T1 }, NOW)).toEqual([{ type: 'push', kind: 'settings', id: 'workspace', updatedAt: NOW }]);
      expect(planSync([setting('workspace', EPOCH)], [settingRemote('workspace', T3, true)], {}, NOW)).toEqual([]);
      expect(planSync([], [settingRemote('unit', T3, true)], {}, NOW)).toEqual([]);
    });

    it('still deletes the choice of an active calibration profile when it was cleared elsewhere', () => {
      expect(planSync([setting('active-calibration', T1)], [settingRemote('active-calibration', T2, true)], { 'settings:active-calibration': T1 }, NOW)).toEqual([{ type: 'delete-local', kind: 'settings', id: 'active-calibration' }]);
    });

    it('leaves items of a kind it does not know alone', () => {
      const unknown = { kind: 'future-kind' as never, id: 'x', updatedAt: T1, deleted: false };
      expect(planSync([], [unknown], {}, NOW)).toEqual([]);
    });
  });
});
