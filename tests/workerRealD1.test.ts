/**
 * The Worker against a real D1 (ADR 0067). The other Worker tests use a database that only records what is asked, so a wrong column
 * name, a bad `ON CONFLICT`, a batch that is too large or a text that is too long for a row cannot show there. This runs the whole
 * Worker (`worker/index.ts`, the same routing as in production) on Miniflare's D1, which is SQLite in the same runtime as Cloudflare's.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Miniflare } from 'miniflare';
import worker from '../worker/index';
import { resetCatalogSchemaFlag } from '../worker/catalog';
import { resetLibraryState } from '../worker/library';
import { resetSiteMetaState } from '../worker/siteMeta';
import { resetSchemaFlag } from '../worker/sync';
import { resetTrackState } from '../worker/track';
import type { D1Database, SyncEnv } from '../worker/types';

let mf: Miniflare;
let db: D1Database;
let env: SyncEnv;

beforeAll(async () => {
  mf = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response("ok"); } }', d1Databases: { DB: 'real-d1-test' } });
  db = (await mf.getD1Database('DB')) as unknown as D1Database;
  env = { DB: db, ALLOW_UNAUTHENTICATED: 'true' };
  for (const reset of [resetCatalogSchemaFlag, resetLibraryState, resetSiteMetaState, resetSchemaFlag, resetTrackState]) reset();
});

afterAll(async () => {
  await mf.dispose();
});

const call = (path: string, init?: RequestInit, withEnv: SyncEnv = env) => worker.fetch(new Request(`https://x${path}`, init), withEnv);
const send = (method: string, path: string, body?: unknown) => call(path, { method, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
const count = async (table: string, where = '1=1') => (await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).first<{ n: number }>())!.n;
/** A long text that is not one repeated character, so a chunk put in the wrong order would show. */
const longText = (chars: number) => Array.from({ length: Math.ceil(chars / 10) }, (_, i) => String(i).padStart(9, '0') + '|').join('').slice(0, chars);

describe('access', () => {
  it('refuses every route when Access is not configured, and a request without a token when it is', async () => {
    const closed: SyncEnv = { DB: db };
    expect((await call('/api/sync/manifest', undefined, closed)).status).toBe(500);
    const configured: SyncEnv = { DB: db, TEAM_DOMAIN: 'https://team.cloudflareaccess.com', POLICY_AUD: 'aud' };
    for (const path of ['/api/sync/manifest', '/api/catalog/templates', '/api/site/meta', '/api/library/overlay', '/api/track/config', '/api/admin/stats', '/api/admin/metadata']) {
      expect((await call(path, undefined, configured)).status, path).toBe(403);
    }
  });
});

describe('sync', () => {
  it('stores, lists and returns an item, and refuses an older write', async () => {
    const t1 = '2026-11-28T10:00:00.000Z';
    expect((await send('PUT', `/api/sync/item?kind=template&id=heart&updatedAt=${t1}`, '{"stones":1}')).status).toBe(200);
    const manifest = (await (await call('/api/sync/manifest')).json()) as { items: { kind: string; id: string; updatedAt: string; deleted: boolean }[] };
    expect(manifest.items).toContainEqual({ kind: 'template', id: 'heart', updatedAt: t1, deleted: false });
    const got = await call('/api/sync/item?kind=template&id=heart');
    expect(await got.text()).toBe('{"stones":1}');
    expect(got.headers.get('x-sync-updated-at')).toBe(t1);

    const older = await send('PUT', '/api/sync/item?kind=template&id=heart&updatedAt=2026-11-27T10:00:00.000Z', '{"stones":2}');
    expect(older.status).toBe(409);
    expect(await (await call('/api/sync/item?kind=template&id=heart')).text()).toBe('{"stones":1}');
  });

  it('keeps a text of 700 000 characters in three chunks and returns it whole, then replaces it with a shorter one', async () => {
    const text = longText(700_000);
    const put = await send('PUT', '/api/sync/item?kind=asset&id=big&updatedAt=2026-11-28T11:00:00.000Z', text);
    expect(await put.json()).toMatchObject({ ok: true, chunks: 3 });
    expect(await (await call('/api/sync/item?kind=asset&id=big')).text()).toBe(text);
    expect(await count('chunks', "kind = 'asset' AND id = 'big'")).toBe(3);

    await send('PUT', '/api/sync/item?kind=asset&id=big&updatedAt=2026-11-28T12:00:00.000Z', 'short');
    expect(await count('chunks', "kind = 'asset' AND id = 'big'")).toBe(1);
    expect(await (await call('/api/sync/item?kind=asset&id=big')).text()).toBe('short');
  });

  it('marks an item deleted, drops its chunks, and refuses to delete the workspace settings', async () => {
    const del = await send('PUT', '/api/sync/item?kind=asset&id=big&updatedAt=2026-11-28T13:00:00.000Z&deleted=1');
    expect(del.status).toBe(200);
    expect(await count('chunks', "kind = 'asset' AND id = 'big'")).toBe(0);
    expect((await call('/api/sync/item?kind=asset&id=big')).headers.get('x-sync-deleted')).toBe('1');
    expect((await send('PUT', '/api/sync/item?kind=settings&id=workspace&updatedAt=2026-11-28T13:00:00.000Z&deleted=1')).status).toBe(400);
  });
});

describe('catalog', () => {
  const details = { id: 'my-box', studio: 'papercraft', format: 'obj', name: 'My box', tags: ['box'], fields: { Designer: 'Me' }, published: true };

  it('saves details, then a file in chunks, lists it and returns the file whole', async () => {
    expect((await send('PUT', '/api/admin/template', details)).status).toBe(200);
    const text = longText(650_000);
    const file = await send('PUT', '/api/admin/file?id=my-box&part=file&name=box.obj&type=model%2Fobj', text);
    expect(await file.json()).toMatchObject({ ok: true, chars: 650_000, chunks: 3 });

    const list = (await (await call('/api/catalog/templates?studio=papercraft')).json()) as { templates: { id: string; name: string; fileName: string | null }[] };
    expect(list.templates.map((t) => t.id)).toContain('my-box');
    const served = await call('/api/catalog/file?id=my-box');
    expect(await served.text()).toBe(text);
    expect(decodeURIComponent(served.headers.get('x-file-name')!)).toBe('box.obj');
  });

  it('updates in place, hides an unpublished template from visitors, and refuses a move to another studio', async () => {
    expect((await send('PUT', '/api/admin/template', { ...details, name: 'My new box', published: false })).status).toBe(200);
    expect(await count('catalog_templates', "id = 'my-box'")).toBe(1);
    const visible = (await (await call('/api/catalog/templates?studio=papercraft')).json()) as { templates: { id: string }[] };
    expect(visible.templates.map((t) => t.id)).not.toContain('my-box');
    const all = (await (await call('/api/catalog/templates?studio=papercraft&all=1')).json()) as { templates: { id: string; name: string }[] };
    expect(all.templates.find((t) => t.id === 'my-box')?.name).toBe('My new box');
    expect((await send('PUT', '/api/admin/template', { ...details, studio: 'htv', format: 'svg' })).status).toBe(400);
  });

  it('refuses a file for a template that does not exist, and a delete takes the chunks with it', async () => {
    expect((await send('PUT', '/api/admin/file?id=nope&part=file&name=a.obj&type=x', 'x')).status).toBe(404);
    // Its own template and file, so the test stands alone and the chunks to be removed are known to be there.
    await send('PUT', '/api/admin/template', { ...details, id: 'to-delete' });
    await send('PUT', '/api/admin/file?id=to-delete&part=file&name=d.obj&type=x', longText(650_000));
    await send('PUT', '/api/admin/file?id=to-delete&part=preview&name=d.svg&type=image%2Fsvg%2Bxml', '<svg/>');
    expect(await count('catalog_chunks', "id = 'to-delete'")).toBe(4);
    expect((await send('DELETE', '/api/admin/template?id=to-delete')).status).toBe(200);
    expect(await count('catalog_chunks', "id = 'to-delete'")).toBe(0);
    expect(await count('catalog_templates', "id = 'to-delete'")).toBe(0);
    await send('DELETE', '/api/admin/template?id=my-box');
  });
});

describe('library', () => {
  const DESIGN = { stones: 3, widthMm: 9.3, heightMm: 8.8, stoneMm: 3.3 };
  const font = { kind: 'font', id: 'upload-fancy', name: 'Fancy', category: 'Script', format: 'ttf', family: 'Fancy', data: Buffer.from('not really a font but bytes').toString('base64') };

  it('stores an uploaded design and font, lists them, and serves the files', async () => {
    const design = { kind: 'design', id: 'upload-heart', name: 'Heart', category: 'Shapes', format: 'json', design: DESIGN, data: longText(650_000) };
    expect(await (await send('PUT', '/api/admin/library/item', design)).json()).toMatchObject({ ok: true, chunks: 3 });
    expect((await send('PUT', '/api/admin/library/item', font)).status).toBe(200);

    const overlay = (await (await call('/api/library/overlay')).json()) as { items: Record<string, { id: string; design: unknown }[]> };
    expect(overlay.items.design!.map((i) => i.id)).toEqual(['upload-heart']);
    expect(overlay.items.design![0]!.design).toEqual(DESIGN);
    expect(overlay.items.font!.map((i) => i.id)).toEqual(['upload-fancy']);
    expect(await (await call('/api/library/file?kind=design&id=upload-heart')).text()).toBe(design.data);
    const bytes = new Uint8Array(await (await call('/api/library/file?kind=font&id=upload-fancy')).arrayBuffer());
    expect(Buffer.from(bytes).toString()).toBe('not really a font but bytes');
  });

  it('changes a library item with one patch, keeps the rest on a later patch, and clears a row that says nothing', async () => {
    const patch = (ids: string[], p: Record<string, unknown>) => send('PUT', '/api/admin/library/overrides', { kind: 'design', ids, patch: p });
    expect((await patch(['a', 'b'], { hidden: true })).status).toBe(200);
    expect(await count('library_overrides', "kind = 'design'")).toBe(2);
    await patch(['a'], { name: 'Renamed' });
    const row = await db.prepare("SELECT hidden, name FROM library_overrides WHERE kind = 'design' AND id = 'a'").first<{ hidden: number; name: string }>();
    expect(row).toEqual({ hidden: 1, name: 'Renamed' });
    await patch(['a', 'b'], { hidden: false });
    await patch(['a'], { name: '' });
    expect(await count('library_overrides')).toBe(0);
  });

  it('deletes an upload with its chunks and overrides, and refuses to delete a built item', async () => {
    await send('PUT', '/api/admin/library/overrides', { kind: 'design', ids: ['upload-heart'], patch: { hidden: true } });
    expect((await send('DELETE', '/api/admin/library/item?kind=design&id=upload-heart')).status).toBe(200);
    expect(await count('library_chunks', "id = 'upload-heart'")).toBe(0);
    expect(await count('library_overrides', "id = 'upload-heart'")).toBe(0);
    expect((await send('DELETE', '/api/admin/library/item?kind=design&id=some-built-design')).status).toBe(400);
    expect((await call('/api/library/file?kind=design&id=upload-heart')).status).toBe(404);
  });
});

describe('site text and statistics', () => {
  it('keeps the site text and returns the default for a stored value that is bad', async () => {
    expect((await send('PUT', '/api/admin/metadata', { title: 'My studio', description: 'Hello', studioTitles: { htv: 'HTV' } })).status).toBe(200);
    expect(await (await call('/api/site/meta')).json()).toMatchObject({ settings: { title: 'My studio', studioTitles: { htv: 'HTV', rhinestone: '' } } });
    expect((await send('PUT', '/api/admin/metadata', { title: '' })).status).toBe(400);
    await db.prepare("UPDATE site_settings SET value = '{bad' WHERE key = 'metadata'").run();
    expect(await (await call('/api/site/meta')).json()).toMatchObject({ settings: { title: 'Rhinestone Template Tool' } });
  });

  it('stores events, counts them, prunes by retention and clears them', async () => {
    const events = { events: [{ name: 'page_view', path: '/htv/', session: 'abcdef123456' }, { name: 'export', path: '/rhinestone/', label: 'svg', session: 'abcdef123456' }, { name: 'bad name!' }] };
    expect(await (await send('POST', '/api/track/event', events)).json()).toEqual({ ok: true, stored: 2 });
    const stats = (await (await call('/api/admin/stats?days=7')).json()) as { totals: Record<string, number>; byStudio: { studio: string }[] };
    expect(stats.totals).toMatchObject({ events: 2, sessions: 1, users: 1, pageViews: 1, exports: 1 });
    expect(stats.byStudio.map((s) => s.studio).sort()).toEqual(['htv', 'rhinestone']);

    // An old event is removed by the next write once the retention is short.
    await db.prepare("INSERT INTO events (ts, name, studio, path, label, props, session, user) VALUES ('2020-01-01T00:00:00.000Z', 'page_view', 'htv', '/', '', '{}', '', '')").run();
    expect((await send('PUT', '/api/admin/tracking', { ownEvents: true, retentionDays: 30 })).status).toBe(200);
    await send('POST', '/api/track/event', { events: [{ name: 'page_view', path: '/' }] });
    expect(await count('events', "ts < '2021-01-01'")).toBe(0);

    const cleared = (await (await send('DELETE', '/api/admin/events')).json()) as { removed: number };
    expect(cleared.removed).toBeGreaterThan(0);
    expect(await count('events')).toBe(0);
  });

  it('stores nothing when the own statistics are switched off', async () => {
    await send('PUT', '/api/admin/tracking', { ownEvents: false });
    expect(await (await send('POST', '/api/track/event', { events: [{ name: 'page_view', path: '/' }] })).json()).toEqual({ ok: true, stored: 0 });
    expect(await count('events')).toBe(0);
  });
});

describe('the database after all of it', () => {
  it('has every table the Worker needs, so the schema statements are valid SQLite', async () => {
    const { results } = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '_cf%' AND name NOT LIKE 'sqlite%' ORDER BY name").all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual(['catalog_chunks', 'catalog_templates', 'chunks', 'events', 'items', 'library_chunks', 'library_items', 'library_overrides', 'site_settings']);
  });
});
