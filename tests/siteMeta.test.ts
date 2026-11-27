import { beforeEach, describe, expect, it } from 'vitest';
import { handleSiteMeta, resetSiteMetaState } from '../worker/siteMeta';
import type { D1Database, D1PreparedStatement } from '../worker/types';
import {
  SITE_META_CACHE_KEY,
  applySiteMeta,
  cacheSiteMeta,
  fetchSiteMeta,
  fetchSiteMetaSettings,
  readCachedSiteMeta,
  saveSiteMetaSettings,
  type MetaDocument,
} from '../app/lib/siteMeta/siteMetaClient';
import { DEFAULT_SITE_META, META_LIMITS, metaFromStored, parseSiteMeta, titleForPath, type SiteMeta } from '../src/lib/siteMeta/siteMeta';

const meta = (over: Partial<SiteMeta> = {}): SiteMeta => ({ ...DEFAULT_SITE_META, studioTitles: { ...DEFAULT_SITE_META.studioTitles }, ...over });

describe('parseSiteMeta', () => {
  it('accepts the defaults and fills in what is missing', () => {
    expect(parseSiteMeta({})).toEqual({ ok: true, meta: DEFAULT_SITE_META });
    expect(parseSiteMeta({ title: 'Studio' })).toEqual({ ok: true, meta: { ...DEFAULT_SITE_META, title: 'Studio' } });
  });

  it('tidies line breaks and runs of spaces', () => {
    const result = parseSiteMeta({ title: '  My \n  studio ', description: 'a\t\tb\n' });
    expect(result).toMatchObject({ ok: true, meta: { title: 'My studio', description: 'a b' } });
  });

  it('keeps studio titles and leaves the others empty', () => {
    const result = parseSiteMeta({ studioTitles: { htv: ' HTV ', rhinestone: '', other: 'ignored' } });
    expect(result).toMatchObject({ ok: true, meta: { studioTitles: { rhinestone: '', htv: 'HTV', papercraft: '' } } });
  });

  it('allows an empty description but not an empty title', () => {
    expect(parseSiteMeta({ description: '' })).toMatchObject({ ok: true, meta: { description: '' } });
    expect(parseSiteMeta({ title: '   ' })).toMatchObject({ ok: false });
  });

  it('refuses the wrong types and too long texts', () => {
    expect(parseSiteMeta(null)).toMatchObject({ ok: false });
    expect(parseSiteMeta([])).toMatchObject({ ok: false });
    expect(parseSiteMeta({ title: 5 })).toMatchObject({ ok: false });
    expect(parseSiteMeta({ studioTitles: { htv: 5 } })).toMatchObject({ ok: false });
    expect(parseSiteMeta({ title: 'x'.repeat(META_LIMITS.title + 1) })).toMatchObject({ ok: false });
    expect(parseSiteMeta({ description: 'x'.repeat(META_LIMITS.description + 1) })).toMatchObject({ ok: false });
    expect(parseSiteMeta({ studioTitles: { papercraft: 'x'.repeat(META_LIMITS.title + 1) } })).toMatchObject({ ok: false });
  });
});

describe('metaFromStored and titleForPath', () => {
  it('falls back to the defaults for nothing or for bad text', () => {
    expect(metaFromStored(undefined)).toEqual(DEFAULT_SITE_META);
    expect(metaFromStored('not json')).toEqual(DEFAULT_SITE_META);
    expect(metaFromStored('{"title":""}')).toEqual(DEFAULT_SITE_META);
  });

  it('does not hand out the shared default object', () => {
    metaFromStored(null).studioTitles.htv = 'changed';
    expect(DEFAULT_SITE_META.studioTitles.htv).toBe('');
  });

  it('uses the studio title for that studio and the site title elsewhere', () => {
    const m = meta({ title: 'Site', studioTitles: { rhinestone: '', htv: 'HTV', papercraft: 'Paper' } });
    expect(titleForPath(m, '/htv/')).toBe('HTV');
    expect(titleForPath(m, '/papercraft/draw')).toBe('Paper');
    expect(titleForPath(m, '/editor')).toBe('Site'); // the Rhinestone studio has no title of its own
    expect(titleForPath(m, '/')).toBe('Site');
    expect(titleForPath(m, '/admin')).toBe('Site');
    expect(titleForPath(m, '/settings')).toBe('Site');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Worker

interface Call { query: string; values: unknown[] }

function fakeDb(stored?: string) {
  const calls: Call[] = [];
  const statement = (query: string): D1PreparedStatement => {
    let values: unknown[] = [];
    const self: D1PreparedStatement = {
      bind: (...v) => { values = v; return self; },
      run: async () => { calls.push({ query, values }); return undefined; },
      all: async () => { calls.push({ query, values }); return { results: [] as never[] }; },
      first: async () => { calls.push({ query, values }); return (stored === undefined ? null : { value: stored }) as never; },
    };
    return self;
  };
  const db: D1Database = { prepare: statement, batch: async () => [] };
  return { db, calls };
}

const env = (db: D1Database) => ({ DB: db, ALLOW_UNAUTHENTICATED: 'true' });
const NOW = '2026-11-27T10:00:00.000Z';
const request = (path: string, init?: RequestInit) => new Request(`https://x${path}`, init);
const put = (body: unknown) => request('/api/admin/metadata', { method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body) });

beforeEach(() => resetSiteMetaState());

describe('handleSiteMeta', () => {
  it('refuses a request without an Access token', async () => {
    const { db, calls } = fakeDb();
    const response = await handleSiteMeta(request('/api/site/meta'), { DB: db, TEAM_DOMAIN: 'https://t.cloudflareaccess.com', POLICY_AUD: 'aud' }, fetch, () => NOW);
    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it('gives the defaults when nothing is stored', async () => {
    const { db } = fakeDb();
    const body = await (await handleSiteMeta(request('/api/site/meta'), env(db), fetch, () => NOW)).json();
    expect(body).toEqual({ settings: DEFAULT_SITE_META });
  });

  it('gives the stored text, on the public and on the admin path', async () => {
    const stored = JSON.stringify(meta({ title: 'My studio' }));
    for (const path of ['/api/site/meta', '/api/admin/metadata']) {
      const { db } = fakeDb(stored);
      const body = (await (await handleSiteMeta(request(path), env(db), fetch, () => NOW)).json()) as { settings: SiteMeta };
      expect(body.settings.title).toBe('My studio');
    }
  });

  it('stores what passes, tidied, with the time', async () => {
    const { db, calls } = fakeDb();
    const response = await handleSiteMeta(put({ title: '  Cheer   Studio ', description: 'Hello', studioTitles: { htv: 'Cheer HTV' } }), env(db), fetch, () => NOW);
    expect(response.status).toBe(200);
    const write = calls.find((c) => c.query.startsWith('INSERT INTO site_settings'))!;
    expect(write.values[0]).toBe('metadata');
    expect(JSON.parse(write.values[1] as string)).toEqual({ title: 'Cheer Studio', description: 'Hello', studioTitles: { rhinestone: '', htv: 'Cheer HTV', papercraft: '' } });
    expect(write.values[2]).toBe(NOW);
    expect(((await response.json()) as { settings: SiteMeta }).settings.title).toBe('Cheer Studio');
  });

  it('writes nothing for bad settings or bad JSON', async () => {
    for (const body of [{ title: '' }, { title: 'x'.repeat(200) }, '{oops']) {
      const { db, calls } = fakeDb();
      const response = await handleSiteMeta(put(body), env(db), fetch, () => NOW);
      expect(response.status).toBe(400);
      expect(calls.some((c) => c.query.startsWith('INSERT'))).toBe(false);
    }
  });

  it('only the admin path can write, and unknown paths are 404', async () => {
    const { db, calls } = fakeDb();
    expect((await handleSiteMeta(request('/api/site/meta', { method: 'PUT', body: '{}' }), env(db), fetch, () => NOW)).status).toBe(404);
    expect((await handleSiteMeta(request('/api/site/other'), env(db), fetch, () => NOW)).status).toBe(404);
    expect(calls.some((c) => c.query.startsWith('INSERT'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Browser side

function fakeDocument(initialDescription?: string) {
  const state = { title: 'Original', description: initialDescription as string | undefined, appended: 0 };
  const tag = () => ({
    setAttribute: (name: string, value: string) => { if (name === 'content') state.description = value; },
    remove: () => { state.description = undefined; },
  });
  const doc: MetaDocument = {
    get title() { return state.title; },
    set title(value: string) { state.title = value; },
    head: { appendChild: () => { state.appended += 1; } },
    querySelector: () => (state.description === undefined ? null : tag()),
    createElement: () => ({ setAttribute: (name: string, value: string) => { if (name === 'content') state.description = value; } }),
  };
  return { doc, state };
}

describe('applySiteMeta', () => {
  it('sets the title for the page and updates an existing description', () => {
    const { doc, state } = fakeDocument('old');
    applySiteMeta(doc, meta({ title: 'Site', description: 'New', studioTitles: { rhinestone: '', htv: 'HTV', papercraft: '' } }), '/htv/');
    expect(state.title).toBe('HTV');
    expect(state.description).toBe('New');
    expect(state.appended).toBe(0);
  });

  it('adds the description tag when the page has none', () => {
    const { doc, state } = fakeDocument();
    applySiteMeta(doc, meta({ description: 'Hello' }), '/');
    expect(state.description).toBe('Hello');
    expect(state.appended).toBe(1);
  });

  it('removes the tag when the description is empty, and adds nothing when there is none', () => {
    const a = fakeDocument('old');
    applySiteMeta(a.doc, meta({ description: '' }), '/');
    expect(a.state.description).toBeUndefined();
    const b = fakeDocument();
    applySiteMeta(b.doc, meta({ description: '' }), '/');
    expect(b.state.appended).toBe(0);
  });
});

describe('the saved copy in the browser', () => {
  const store = () => {
    const map = new Map<string, string>();
    return { map, storage: { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } } };
  };

  it('is written and read back', () => {
    const { map, storage } = store();
    expect(readCachedSiteMeta(storage)).toBeNull();
    cacheSiteMeta(storage, meta({ title: 'Mine' }));
    expect(map.has(SITE_META_CACHE_KEY)).toBe(true);
    expect(readCachedSiteMeta(storage)?.title).toBe('Mine');
  });

  it('does not break on a missing or failing storage', () => {
    expect(readCachedSiteMeta(null)).toBeNull();
    expect(() => cacheSiteMeta(null, meta())).not.toThrow();
    expect(() => cacheSiteMeta({ setItem: () => { throw new Error('full'); } }, meta())).not.toThrow();
    expect(readCachedSiteMeta({ getItem: () => { throw new Error('blocked'); } })).toBeNull();
  });
});

describe('the metadata client', () => {
  const answer = (body: unknown, status = 200, type = 'application/json') => (async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': type } })) as unknown as typeof fetch;

  it('reads the settings (and makes them valid)', async () => {
    const result = await fetchSiteMeta(answer({ settings: { title: 'T', description: 'D', studioTitles: { htv: 'H' } } }));
    expect(result).toEqual({ ok: true, value: { title: 'T', description: 'D', studioTitles: { rhinestone: '', htv: 'H', papercraft: '' } } });
    expect(await fetchSiteMetaSettings(answer({ settings: { title: '' } }))).toEqual({ ok: true, value: DEFAULT_SITE_META });
  });

  it('says there is no server on a static host, and when sign-in is needed', async () => {
    expect(await fetchSiteMeta(answer('<html>', 200, 'text/html'))).toEqual({ ok: false, reason: 'unavailable' });
    expect(await fetchSiteMeta(answer({ error: 'no' }, 403))).toMatchObject({ ok: false, reason: 'signin' });
  });

  it('sends the settings and gives back what the server stored', async () => {
    let seen: { url: string; method?: string; body?: unknown } | null = null;
    const fetcher = (async (url: string, init?: RequestInit) => {
      seen = { url, method: init?.method, body: JSON.parse(init?.body as string) };
      return new Response(JSON.stringify({ ok: true, settings: meta({ title: 'Stored' }) }), { headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    const result = await saveSiteMetaSettings(meta({ title: 'Sent' }), fetcher);
    expect(seen).toMatchObject({ url: '/api/admin/metadata', method: 'PUT', body: { title: 'Sent' } });
    expect(result).toMatchObject({ ok: true, value: { title: 'Stored' } });
    expect(await saveSiteMetaSettings(meta(), answer({ error: 'The site title cannot be empty.' }, 400))).toEqual({ ok: false, reason: 'error', message: 'The site title cannot be empty.' });
  });
});
