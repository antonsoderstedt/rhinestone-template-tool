import { beforeEach, describe, expect, it } from 'vitest';
import { handleTrack, hashOwner, resetTrackState } from '../worker/track';
import type { D1Database, D1PreparedStatement } from '../worker/types';
import { DEFAULT_TRACKING } from '../src/lib/tracking/trackingConfig';

interface Call { query: string; values: unknown[] }

function fakeDb(answers: { first?: (query: string, values: unknown[]) => unknown; all?: (query: string, values: unknown[]) => unknown[] } = {}) {
  const calls: Call[] = [];
  const statement = (query: string): D1PreparedStatement => {
    let values: unknown[] = [];
    const self: D1PreparedStatement = {
      bind: (...v) => { values = v; return self; },
      run: async () => { calls.push({ query, values }); return undefined; },
      all: async () => { calls.push({ query, values }); return { results: (answers.all?.(query, values) ?? []) as never[] }; },
      first: async () => { calls.push({ query, values }); return (answers.first?.(query, values) ?? null) as never; },
    };
    (self as unknown as { query: string; values: () => unknown[] }).query = query;
    (self as unknown as { values: () => unknown[] }).values = () => values;
    return self;
  };
  const db: D1Database = {
    prepare: (query) => statement(query),
    batch: async (statements) => {
      for (const s of statements) {
        const x = s as unknown as { query: string; values: () => unknown[] };
        calls.push({ query: x.query, values: x.values() });
      }
      return [];
    },
  };
  return { db, calls };
}

const env = (db: D1Database) => ({ DB: db, ALLOW_UNAUTHENTICATED: 'true' });
const TIME = '2026-11-27T10:00:00.000Z';
const now = () => TIME;
const request = (path: string, init?: RequestInit) => new Request(`https://x${path}`, init);
const post = (path: string, body: unknown) => request(path, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });
const put = (path: string, body: unknown) => request(path, { method: 'PUT', body: JSON.stringify(body) });
const inserts = (calls: Call[]) => calls.filter((c) => c.query.startsWith('INSERT INTO events'));

beforeEach(() => resetTrackState());

describe('access', () => {
  it('refuses a request without an Access token (and nothing is stored)', async () => {
    const { db, calls } = fakeDb();
    const response = await handleTrack(post('/api/track/event', { events: [{ name: 'page_view', path: '/' }] }), { DB: db, TEAM_DOMAIN: 'https://t.cloudflareaccess.com', POLICY_AUD: 'aud' }, fetch, now);
    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
  });
});

describe('GET /api/track/config', () => {
  it('gives the defaults when nothing is stored, without the retention', async () => {
    const { db } = fakeDb();
    const body = await (await handleTrack(request('/api/track/config'), env(db), fetch, now)).json();
    expect(body).toEqual({ ownEvents: true, ga4Id: '', gtmId: '', respectDoNotTrack: true });
  });

  it('gives the stored ids', async () => {
    const { db } = fakeDb({ first: (q) => (q.includes('site_settings') ? { value: JSON.stringify({ ...DEFAULT_TRACKING, ga4Id: 'G-ABCD1234' }) } : null) });
    const body = (await (await handleTrack(request('/api/track/config'), env(db), fetch, now)).json()) as { ga4Id: string };
    expect(body.ga4Id).toBe('G-ABCD1234');
  });
});

describe('POST /api/track/event', () => {
  it('stores the events with the time, the studio from the path and a hashed person', async () => {
    const { db, calls } = fakeDb();
    const response = await handleTrack(post('/api/track/event', { events: [{ name: 'export', path: '/papercraft/draw/', label: 'svg', props: { n: 2 }, session: 'abcdef12-3456' }] }), env(db), fetch, now);
    expect(await response.json()).toEqual({ ok: true, stored: 1 });
    const [row] = inserts(calls);
    const owner = await hashOwner('local-development');
    expect(row!.values).toEqual([TIME, 'export', 'papercraft', '/papercraft/draw', 'svg', '{"n":2}', 'abcdef12-3456', owner]);
    expect(owner).toMatch(/^[0-9a-f]{16}$/);
    expect(owner).not.toContain('local');
  });

  it('works out the studio itself, whatever the browser claims', async () => {
    const { db, calls } = fakeDb();
    await handleTrack(post('/api/track/event', { events: [{ name: 'page_view', path: '/htv', props: { studio: 'papercraft' } }] }), env(db), fetch, now);
    expect(inserts(calls)[0]!.values[2]).toBe('htv');
  });

  it('leaves out bad events, refuses a bad body, a big one and a long batch', async () => {
    const { db, calls } = fakeDb();
    const good = { name: 'page_view', path: '/' };
    expect(await (await handleTrack(post('/api/track/event', { events: [good, { name: 'BAD' }] }), env(db), fetch, now)).json()).toEqual({ ok: true, stored: 1 });
    expect(inserts(calls)).toHaveLength(1);
    expect((await handleTrack(post('/api/track/event', 'not json'), env(db), fetch, now)).status).toBe(400);
    expect((await handleTrack(post('/api/track/event', { events: [] }), env(db), fetch, now)).status).toBe(400);
    expect((await handleTrack(post('/api/track/event', { events: Array.from({ length: 21 }, () => good) }), env(db), fetch, now)).status).toBe(400);
    expect((await handleTrack(post('/api/track/event', 'x'.repeat(20_000)), env(db), fetch, now)).status).toBe(413);
  });

  it('stores nothing when own events are switched off', async () => {
    const { db, calls } = fakeDb({ first: (q) => (q.includes('site_settings') ? { value: JSON.stringify({ ...DEFAULT_TRACKING, ownEvents: false, gtmId: 'GTM-ABC123' }) } : null) });
    const response = await handleTrack(post('/api/track/event', { events: [{ name: 'page_view', path: '/' }] }), env(db), fetch, now);
    expect(await response.json()).toEqual({ ok: true, stored: 0 });
    expect(inserts(calls)).toHaveLength(0);
  });

  it('deletes events older than the retention, at most once an hour', async () => {
    const { db, calls } = fakeDb({ first: (q) => (q.includes('site_settings') ? { value: JSON.stringify({ ...DEFAULT_TRACKING, retentionDays: 30 }) } : null) });
    const body = { events: [{ name: 'page_view', path: '/' }] };
    await handleTrack(post('/api/track/event', body), env(db), fetch, now);
    await handleTrack(post('/api/track/event', body), env(db), fetch, now);
    const deletes = calls.filter((c) => c.query.startsWith('DELETE FROM events WHERE ts'));
    expect(deletes).toHaveLength(1);
    expect(deletes[0]!.values[0]).toBe('2026-10-28T10:00:00.000Z');
  });
});

describe('/api/admin/tracking', () => {
  it('saves valid settings, normalised, and uses them straight away', async () => {
    const { db, calls } = fakeDb();
    const response = await handleTrack(put('/api/admin/tracking', { ...DEFAULT_TRACKING, ga4Id: ' g-abcd1234 ', retentionDays: 90 }), env(db), fetch, now);
    expect(response.status).toBe(200);
    const saved = calls.find((c) => c.query.startsWith('INSERT INTO site_settings'))!;
    expect(saved.values[0]).toBe('tracking');
    expect(JSON.parse(saved.values[1] as string)).toMatchObject({ ga4Id: 'G-ABCD1234', retentionDays: 90 });
    const config = (await (await handleTrack(request('/api/track/config'), env(db), fetch, now)).json()) as { ga4Id: string };
    expect(config.ga4Id).toBe('G-ABCD1234');
  });

  it('refuses bad settings and bad JSON, and stores nothing', async () => {
    const { db, calls } = fakeDb();
    expect((await handleTrack(put('/api/admin/tracking', { ga4Id: 'nope' }), env(db), fetch, now)).status).toBe(400);
    expect((await handleTrack(request('/api/admin/tracking', { method: 'PUT', body: '{' }), env(db), fetch, now)).status).toBe(400);
    expect(calls.some((c) => c.query.startsWith('INSERT INTO site_settings'))).toBe(false);
  });

  it('reads the settings', async () => {
    const { db } = fakeDb();
    const body = (await (await handleTrack(request('/api/admin/tracking'), env(db), fetch, now)).json()) as { settings: unknown };
    expect(body.settings).toEqual(DEFAULT_TRACKING);
  });
});

describe('/api/admin/stats', () => {
  it('asks the database for the period and returns the counts', async () => {
    const { db, calls } = fakeDb({
      first: (q) => {
        if (q.includes('FROM events WHERE ts >=')) return { events: 12, sessions: 3, users: 1, pageViews: 9, exports: null };
        if (q.includes('MIN(ts)')) return { oldest: '2026-11-01T00:00:00.000Z', n: 40 };
        return null;
      },
      all: (q) => (q.includes('GROUP BY name ORDER') ? [{ name: 'page_view', count: 9 }] : q.includes('GROUP BY day') ? [{ day: '2026-11-26', events: 12, sessions: 3 }] : []),
    });
    const body = (await (await handleTrack(request('/api/admin/stats?days=7'), env(db), fetch, now)).json()) as Record<string, unknown>;
    expect(body.days).toBe(7);
    expect(body.since).toBe('2026-11-20T10:00:00.000Z');
    expect(body.totals).toEqual({ events: 12, sessions: 3, users: 1, pageViews: 9, exports: 0 });
    expect(body.stored).toBe(40);
    expect(body.byEvent).toEqual([{ name: 'page_view', count: 9 }]);
    expect(body.perDay).toEqual([{ day: '2026-11-26', events: 12, sessions: 3 }]);
    expect(calls.filter((c) => c.query.includes('ts >=')).every((c) => c.values[0] === '2026-11-20T10:00:00.000Z')).toBe(true);
  });

  it('falls back to 30 days for a bad period', async () => {
    const { db } = fakeDb();
    for (const days of ['0', '400', 'abc', '2.5']) {
      const body = (await (await handleTrack(request(`/api/admin/stats?days=${days}`), env(db), fetch, now)).json()) as { days: number };
      expect(body.days).toBe(30);
    }
  });

  it('answers with zeros for an empty database', async () => {
    const { db } = fakeDb();
    const body = (await (await handleTrack(request('/api/admin/stats'), env(db), fetch, now)).json()) as { totals: unknown; stored: number };
    expect(body.totals).toEqual({ events: 0, sessions: 0, users: 0, pageViews: 0, exports: 0 });
    expect(body.stored).toBe(0);
  });
});

describe('DELETE /api/admin/events', () => {
  it('removes every event and says how many', async () => {
    const { db, calls } = fakeDb({ first: (q) => (q.startsWith('SELECT COUNT(*)') ? { n: 7 } : null) });
    const body = await (await handleTrack(request('/api/admin/events', { method: 'DELETE' }), env(db), fetch, now)).json();
    expect(body).toEqual({ ok: true, removed: 7 });
    expect(calls.some((c) => c.query === 'DELETE FROM events')).toBe(true);
  });
});

it('answers 404 for an unknown path', async () => {
  const { db } = fakeDb();
  expect((await handleTrack(request('/api/track/nothing'), env(db), fetch, now)).status).toBe(404);
});
