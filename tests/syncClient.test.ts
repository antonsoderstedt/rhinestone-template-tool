import { describe, expect, it } from 'vitest';
import { syncOnce, type SyncDeps } from '../app/lib/sync/syncClient';
import type { ItemRef, RemoteRef, SyncKind } from '../app/lib/sync/syncPlan';

/** A server that keeps items and tombstones in memory. */
class FakeServer {
  items = new Map<string, { updatedAt: string; deleted: boolean; data: string | null }>();
  fail = false;
  manifest(): RemoteRef[] {
    return [...this.items].map(([key, v]) => { const [kind, ...id] = key.split(':'); return { kind: kind as SyncKind, id: id.join(':'), updatedAt: v.updatedAt, deleted: v.deleted }; });
  }
}

/** One pretend browser: its saved items (id -> {updatedAt, data}) and its remembered state. */
class FakeDevice {
  local = new Map<string, { updatedAt: string; data: string }>();
  synced: Record<string, string> = {};
  clock = '2026-11-24T12:00:00.000Z';
  failPuts = false;
  constructor(private server: FakeServer | null) {}

  save(kind: SyncKind, id: string, updatedAt: string, text: string) { this.local.set(`${kind}:${id}`, { updatedAt, data: JSON.stringify({ text, updatedAt, id }) }); }
  remove(kind: SyncKind, id: string) { this.local.delete(`${kind}:${id}`); }
  text(kind: SyncKind, id: string) { const v = this.local.get(`${kind}:${id}`); return v ? (JSON.parse(v.data) as { text: string }).text : null; }

  deps(): SyncDeps {
    const server = this.server;
    return {
      fetchManifest: async () => { if (!server) return null; if (server.fail) throw new Error('offline'); return server.manifest(); },
      putItem: async (kind, id, updatedAt, data) => {
        if (this.failPuts) throw new Error('boom');
        const key = `${kind}:${id}`; const current = server!.items.get(key);
        if (current && Date.parse(current.updatedAt) > Date.parse(updatedAt)) return;
        server!.items.set(key, { updatedAt, deleted: data === null, data });
      },
      getItem: async (kind, id) => server!.items.get(`${kind}:${id}`)?.data ?? null,
      listLocal: () => [...this.local].map(([key, v]): ItemRef => { const [kind, ...id] = key.split(':'); return { kind: kind as SyncKind, id: id.join(':'), updatedAt: v.updatedAt }; }),
      readLocal: (kind, id) => this.local.get(`${kind}:${id}`)?.data ?? null,
      applyLocal: (kind, id, data) => { const parsed = JSON.parse(data) as { updatedAt: string }; this.local.set(`${kind}:${id}`, { updatedAt: parsed.updatedAt, data }); return true; },
      deleteLocal: (kind, id) => { this.local.delete(`${kind}:${id}`); return true; },
      loadSynced: () => this.synced,
      saveSynced: (state) => { this.synced = state; },
      now: () => this.clock,
    };
  }
}

describe('syncing two devices through a server', () => {
  it('is disabled without a server and leaves everything alone', async () => {
    const device = new FakeDevice(null);
    device.save('template', 'a', '2026-11-24T10:00:00.000Z', 'x');
    const outcome = await syncOnce(device.deps());
    expect(outcome.status).toBe('disabled');
    expect(device.synced).toEqual({});
  });

  it('carries a new design from the computer to the phone', async () => {
    const server = new FakeServer();
    const computer = new FakeDevice(server);
    const phone = new FakeDevice(server);
    computer.save('template', 'heart', '2026-11-24T10:00:00.000Z', 'Heart');
    expect((await syncOnce(computer.deps())).pushed).toBe(1);
    expect((await syncOnce(phone.deps())).pulled).toBe(1);
    expect(phone.text('template', 'heart')).toBe('Heart');
  });

  it('carries an edit, then a deletion, and the phone follows both', async () => {
    const server = new FakeServer();
    const computer = new FakeDevice(server);
    const phone = new FakeDevice(server);
    computer.save('template', 'heart', '2026-11-24T10:00:00.000Z', 'Heart');
    await syncOnce(computer.deps());
    await syncOnce(phone.deps());

    computer.save('template', 'heart', '2026-11-24T11:00:00.000Z', 'Heart v2');
    await syncOnce(computer.deps());
    await syncOnce(phone.deps());
    expect(phone.text('template', 'heart')).toBe('Heart v2');

    computer.remove('template', 'heart');
    computer.clock = '2026-11-24T13:00:00.000Z';
    const sent = await syncOnce(computer.deps());
    expect(sent.removedThere).toBe(1);
    const received = await syncOnce(phone.deps());
    expect(received.removedHere).toBe(1);
    expect(phone.text('template', 'heart')).toBeNull();

    // And nobody brings it back.
    await syncOnce(computer.deps());
    await syncOnce(phone.deps());
    expect(computer.local.size).toBe(0);
    expect(phone.local.size).toBe(0);
  });

  it('keeps the newer of two edits made on different devices', async () => {
    const server = new FakeServer();
    const a = new FakeDevice(server);
    const b = new FakeDevice(server);
    a.save('asset', 'logo', '2026-11-24T10:00:00.000Z', 'v1');
    await syncOnce(a.deps());
    await syncOnce(b.deps());
    a.save('asset', 'logo', '2026-11-24T11:00:00.000Z', 'from A');
    b.save('asset', 'logo', '2026-11-24T12:00:00.000Z', 'from B (later)');
    await syncOnce(a.deps());
    await syncOnce(b.deps());
    await syncOnce(a.deps());
    expect(a.text('asset', 'logo')).toBe('from B (later)');
    expect(b.text('asset', 'logo')).toBe('from B (later)');
  });

  it('does not bring a deleted item back when the deletion could not be sent yet', async () => {
    const server = new FakeServer();
    const computer = new FakeDevice(server);
    computer.save('htv', 'tee', '2026-11-24T10:00:00.000Z', 'Tee');
    await syncOnce(computer.deps());
    computer.remove('htv', 'tee');
    computer.failPuts = true;
    expect((await syncOnce(computer.deps())).status).toBe('partial');
    computer.failPuts = false;
    await syncOnce(computer.deps());
    expect(computer.local.size).toBe(0);
    expect(server.items.get('htv:tee')?.deleted).toBe(true);
  });

  it('reports a failed round without losing what was synced before', async () => {
    const server = new FakeServer();
    const device = new FakeDevice(server);
    device.save('template', 'a', '2026-11-24T10:00:00.000Z', 'A');
    await syncOnce(device.deps());
    const before = { ...device.synced };
    server.fail = true;
    await expect(syncOnce(device.deps())).rejects.toThrow('offline');
    expect(device.synced).toEqual(before);
  });
});
