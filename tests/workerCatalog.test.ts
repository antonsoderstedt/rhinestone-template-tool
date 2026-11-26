import { beforeEach, describe, expect, it } from 'vitest';
import { handleCatalog, parseDetails, resetCatalogSchemaFlag, rowToTemplate } from '../worker/catalog';
import type { D1Database, D1PreparedStatement } from '../worker/types';

interface Call { query: string; values: unknown[] }

/** A database that records what is asked and answers from a script: `first` and `all` give the result of the next matching query. */
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
const TIME = '2026-11-26T10:00:00.000Z';
const now = () => TIME;
const request = (path: string, init?: RequestInit) => new Request(`https://x${path}`, init);
const details = { id: 'my-box', studio: 'papercraft', format: 'obj', name: ' My box ', tags: ['box', ' box ', 'easy'], fields: { Designer: 'Me' }, published: true };

const BASE_ROW = {
  id: 'my-box', studio: 'papercraft', format: 'obj', name: 'My box', description: '', category: '', tags: '["box"]', licence: '', fields: '{"Designer":"Me"}',
  published: 1, created_at: TIME, updated_at: TIME, file_name: 'box.obj', file_type: 'model/obj', file_chars: 12, preview_name: null, preview_type: null, preview_chars: 0,
};

describe('parseDetails', () => {
  it('accepts good details, trims, and drops repeated tags', () => {
    const result = parseDetails(details);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.details.name).toBe('My box');
      expect(result.details.tags).toEqual(['box', 'easy']);
      expect(result.details.published).toBe(true);
    }
  });

  it('refuses a bad id, studio, format, a missing name, and odd shapes', () => {
    for (const bad of [
      { ...details, id: 'Has Space' },
      { ...details, id: '' },
      { ...details, id: '../x' },
      { ...details, studio: 'evil' },
      { ...details, format: 'OBJ' },
      { ...details, name: '   ' },
      { ...details, tags: 'box' },
      { ...details, tags: Array.from({ length: 30 }, (_, i) => `t${i}`) },
      { ...details, fields: ['a'] },
      { ...details, fields: { 'bad key!': 'x' } },
      { ...details, fields: { ok: 5 } },
      { ...details, description: 'x'.repeat(5000) },
      null,
      [],
      'text',
    ]) {
      expect(parseDetails(bad).ok, JSON.stringify(bad)?.slice(0, 60)).toBe(false);
    }
  });

  it('only publishes when published is exactly true', () => {
    const result = parseDetails({ ...details, published: 'yes' });
    expect(result.ok && result.details.published).toBe(false);
  });
});

describe('catalog API', () => {
  beforeEach(() => resetCatalogSchemaFlag());

  it('refuses everything without an Access token unless it is the local test setup', async () => {
    const { db } = fakeDb();
    const response = await handleCatalog(request('/api/catalog/templates'), { DB: db, TEAM_DOMAIN: 'https://t.cloudflareaccess.com', POLICY_AUD: 'a' });
    expect(response.status).toBe(403);
    const write = await handleCatalog(request('/api/admin/template', { method: 'PUT', body: JSON.stringify(details) }), { DB: db, TEAM_DOMAIN: 'https://t.cloudflareaccess.com', POLICY_AUD: 'a' });
    expect(write.status).toBe(403);
  });

  it('lists only the published templates unless all=1, and can filter by studio', async () => {
    const queries: string[] = [];
    const { db } = fakeDb({ all: (q) => { queries.push(q); return q.startsWith('SELECT * FROM catalog_templates') ? [BASE_ROW] : []; } });
    const published = await handleCatalog(request('/api/catalog/templates?studio=papercraft'), env(db), fetch, now);
    expect(published.status).toBe(200);
    const body = (await published.json()) as { templates: Array<{ id: string; tags: string[]; fields: Record<string, string>; published: boolean }> };
    expect(body.templates[0]).toMatchObject({ id: 'my-box', tags: ['box'], fields: { Designer: 'Me' }, published: true });
    expect(queries.find((q) => q.startsWith('SELECT *'))).toContain('studio = ? AND published = 1');

    queries.length = 0;
    await handleCatalog(request('/api/catalog/templates?all=1'), env(db), fetch, now);
    expect(queries.find((q) => q.startsWith('SELECT *'))).not.toContain('published');
    expect((await handleCatalog(request('/api/catalog/templates?studio=evil'), env(db), fetch, now)).status).toBe(400);
  });

  it('saves the details of a new template, with the time, and keeps the file columns out of the update', async () => {
    const { db, calls } = fakeDb();
    const response = await handleCatalog(request('/api/admin/template', { method: 'PUT', body: JSON.stringify(details) }), env(db), fetch, now);
    expect(response.status).toBe(200);
    const insert = calls.find((c) => c.query.startsWith('INSERT INTO catalog_templates'))!;
    expect(insert.values.slice(0, 4)).toEqual(['my-box', 'papercraft', 'obj', 'My box']);
    expect(insert.values).toContain(TIME);
    expect(insert.query).not.toMatch(/DO UPDATE SET[^;]*file_name/);
  });

  it('refuses bad details, bad JSON, and moving a template to another studio', async () => {
    const { db } = fakeDb({ first: (q) => (q.startsWith('SELECT studio') ? { studio: 'htv' } : null) });
    expect((await handleCatalog(request('/api/admin/template', { method: 'PUT', body: '{nope' }), env(db), fetch, now)).status).toBe(400);
    expect((await handleCatalog(request('/api/admin/template', { method: 'PUT', body: JSON.stringify({ ...details, id: 'Bad Id' }) }), env(db), fetch, now)).status).toBe(400);
    expect((await handleCatalog(request('/api/admin/template', { method: 'PUT', body: JSON.stringify(details) }), env(db), fetch, now)).status).toBe(400);
  });

  it('stores a file in chunks and notes its name, type and size on the template', async () => {
    const { db, calls } = fakeDb({ first: () => ({ id: 'my-box' }) });
    const body = 'v 0 0 0\n'.repeat(100_000); // 800,000 characters: three chunks
    const response = await handleCatalog(request('/api/admin/file?id=my-box&part=file&name=box.obj&type=model%2Fobj', { method: 'PUT', body }), env(db), fetch, now);
    expect(response.status).toBe(200);
    expect(((await response.json()) as { chunks: number }).chunks).toBe(3);
    expect(calls.filter((c) => c.query.startsWith('INSERT INTO catalog_chunks'))).toHaveLength(3);
    const update = calls.find((c) => c.query.startsWith('UPDATE catalog_templates'))!;
    expect(update.query).toContain('file_name = ?');
    expect(update.values).toEqual(['box.obj', 'model/obj', 800_000, TIME, 'my-box']);
  });

  it('refuses a file for a template that does not exist, and bad names, parts and sizes', async () => {
    const missing = fakeDb();
    expect((await handleCatalog(request('/api/admin/file?id=my-box&part=file&name=a.obj&type=', { method: 'PUT', body: 'x' }), env(missing.db), fetch, now)).status).toBe(404);
    const { db } = fakeDb({ first: () => ({ id: 'my-box' }) });
    expect((await handleCatalog(request('/api/admin/file?id=my-box&part=other&name=a.obj&type=', { method: 'PUT', body: 'x' }), env(db), fetch, now)).status).toBe(400);
    expect((await handleCatalog(request('/api/admin/file?id=my-box&part=file&name=..%2Fa.obj&type=', { method: 'PUT', body: 'x' }), env(db), fetch, now)).status).toBe(400);
    expect((await handleCatalog(request('/api/admin/file?id=my-box&part=preview&name=p.svg&type=image%2Fsvg%2Bxml', { method: 'PUT', body: 'x'.repeat(1_600_000) }), env(db), fetch, now)).status).toBe(413);
  });

  it('serves a file back from its chunks, with the name in a header', async () => {
    const { db } = fakeDb({
      first: () => ({ file_name: 'bär låda.obj', file_type: 'model/obj', preview_name: null, preview_type: null, published: 1 }),
      all: () => [{ data: 'ab' }, { data: 'cd' }],
    });
    const response = await handleCatalog(request('/api/catalog/file?id=my-box&part=file'), env(db), fetch, now);
    expect(await response.text()).toBe('abcd');
    expect(decodeURIComponent(response.headers.get('x-file-name')!)).toBe('bär låda.obj');
    expect(response.headers.get('x-file-type')).toBe('model/obj');
  });

  it('answers 404 for a file that is not there, and deletes the chunks with the template', async () => {
    const { db, calls } = fakeDb();
    expect((await handleCatalog(request('/api/catalog/file?id=my-box&part=preview'), env(db), fetch, now)).status).toBe(404);
    expect((await handleCatalog(request('/api/admin/template?id=my-box', { method: 'DELETE' }), env(db), fetch, now)).status).toBe(200);
    expect(calls.some((c) => c.query.startsWith('DELETE FROM catalog_chunks'))).toBe(true);
    expect(calls.some((c) => c.query.startsWith('DELETE FROM catalog_templates'))).toBe(true);
    expect((await handleCatalog(request('/api/admin/template?id=Bad%20Id', { method: 'DELETE' }), env(db), fetch, now)).status).toBe(400);
  });

  it('turns a row into the shape the admin panel uses, even when the stored JSON is broken', () => {
    const t = rowToTemplate({ ...BASE_ROW, tags: '{broken', fields: 'x', preview_name: 'p.svg', preview_type: 'image/svg+xml', preview_chars: 5 });
    expect(t.tags).toEqual([]);
    expect(t.fields).toEqual({});
    expect(t.preview).toEqual({ name: 'p.svg', type: 'image/svg+xml', chars: 5 });
    expect(t.file).toEqual({ name: 'box.obj', type: 'model/obj', chars: 12 });
  });
});
