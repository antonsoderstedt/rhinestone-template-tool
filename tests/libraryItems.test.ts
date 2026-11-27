import { beforeEach, describe, expect, it } from 'vitest';
import { decodeBase64, handleLibrary, resetLibraryState } from '../worker/library';
import type { D1Database, D1PreparedStatement } from '../worker/types';
import { bytesToBase64, fontFormatOf, nameFromFileName, prepareDesign, prepareFont } from '../app/lib/library/prepareUpload';
import { deleteLibraryItem, fetchLibrary, uploadLibraryItem } from '../app/lib/library/libraryClient';
import { emptyOverlay } from '../src/lib/library/library';
import {
  ITEM_LIMITS,
  designsWithUploads,
  fontsWithUploads,
  itemFileUrl,
  parseItem,
  parseItems,
  uniqueUploadId,
  uploadIdFromName,
  type LibraryItem,
} from '../src/lib/library/libraryItems';
import { uploadedRows } from '../app/admin/libraryView';

const DESIGN = { stones: 3, widthMm: 9.3, heightMm: 8.8, stoneMm: 3.3 };
const upload = (over: Record<string, unknown> = {}) => ({ kind: 'design', id: 'upload-heart', name: ' Heart ', category: 'Shapes', format: 'json', design: DESIGN, data: '{"v":1}', ...over });
const item = (over: Partial<LibraryItem> = {}): LibraryItem => ({ kind: 'design', id: 'upload-heart', name: 'Heart', category: 'Shapes', format: 'json', chars: 7, updatedAt: '2026-11-28T10:00:00.000Z', family: '', design: DESIGN, ...over });

describe('ids', () => {
  it('make a readable upload id and keep it free', () => {
    expect(uploadIdFromName('Hjärta & Stjärna!')).toBe('upload-hjarta-stjarna');
    expect(uploadIdFromName('???')).toBe('upload-item');
    expect(uniqueUploadId('Heart', new Set())).toBe('upload-heart');
    expect(uniqueUploadId('Heart', new Set(['upload-heart', 'upload-heart-2']))).toBe('upload-heart-3');
  });
});

describe('parseItem', () => {
  it('accepts a design and tidies the name', () => {
    expect(parseItem(upload())).toEqual({ ok: true, data: '{"v":1}', item: { kind: 'design', id: 'upload-heart', name: 'Heart', category: 'Shapes', format: 'json', family: '', design: DESIGN } });
  });

  it('accepts a font in a known format', () => {
    const font = { kind: 'font', id: 'upload-fancy', name: 'Fancy', category: 'Script', format: 'WOFF', family: ' Fancy  Family ', data: 'AAAA' };
    expect(parseItem(font)).toMatchObject({ ok: true, item: { kind: 'font', format: 'woff', family: 'Fancy Family', design: null } });
  });

  it('refuses what does not fit', () => {
    const bad: Record<string, unknown>[] = [
      { kind: 'colour' },
      { id: 'heart' }, // not an upload id
      { id: 'upload-../x' },
      { name: '   ' },
      { name: 'x'.repeat(200) },
      { data: '' },
      { data: 'x'.repeat(ITEM_LIMITS.designChars + 1) },
      { design: { ...DESIGN, stones: 0 } },
      { design: { ...DESIGN, widthMm: 5000 } },
      { design: undefined },
    ];
    for (const over of bad) expect(parseItem(upload(over)), JSON.stringify(over)).toMatchObject({ ok: false });
    expect(parseItem(null)).toMatchObject({ ok: false });
    const font = { kind: 'font', id: 'upload-f', name: 'F', category: '', data: 'AAAA' };
    expect(parseItem({ ...font, format: 'woff2' })).toMatchObject({ ok: false });
    expect(parseItem({ ...font, format: 'ttf', category: 'Fancy' })).toMatchObject({ ok: false });
    expect(parseItem({ ...font, format: 'ttf', data: 'AAA' })).toMatchObject({ ok: false });
    expect(parseItem({ ...font, format: 'ttf', data: 'A'.repeat(ITEM_LIMITS.fontChars + 4) })).toMatchObject({ ok: false });
  });
});

describe('the lists with uploads', () => {
  it('adds the uploaded designs to the built ones, with the owner’s changes on top', () => {
    const built = [{ id: 'a', title: 'A', category: 'x' }];
    const make = (i: LibraryItem, file: string) => ({ id: i.id, title: i.name, category: i.category, file });
    const list = designsWithUploads(built, { design: [item(), item({ id: 'upload-star', name: 'Star' })], font: [] }, { ...emptyOverlay(), design: { 'upload-star': { hidden: true, name: '', category: '' }, a: { hidden: false, name: 'Aa', category: '' } } }, make as never);
    expect(list.map((d) => d.title)).toEqual(['Aa', 'Heart']);
    expect((list[1] as unknown as { file: string }).file).toBe('/api/library/file?kind=design&id=upload-heart&v=2026-11-28T10%3A00%3A00.000Z');
  });

  it('adds the uploaded fonts with the address of their file, hidden ones marked', () => {
    const f = item({ kind: 'font', id: 'upload-fancy', name: 'Fancy', format: 'woff', design: null, family: 'Fancy' });
    const list = fontsWithUploads<{ id: string; name: string; url?: string }>([{ id: 'lib', name: 'Lib' }], { design: [], font: [f] }, { ...emptyOverlay(), font: { 'upload-fancy': { hidden: true, name: '', category: '' } } }, (i, url) => ({ id: i.id, name: i.name, url }));
    expect(list).toEqual([{ id: 'lib', name: 'Lib' }, { id: 'upload-fancy', name: 'Fancy', url: itemFileUrl(f), hidden: true }]);
  });

  it('leaves out a design with no size, and reads what the server sent', () => {
    const items = parseItems({ design: [{ id: 'upload-a', name: 'A', design: DESIGN, updatedAt: 'x' }, { id: 'upload-b', name: 'B' }, { id: '../c', name: 'C', design: DESIGN }], font: [{ id: 'upload-f', name: 'F', format: 'otf', family: 'Ff' }, 5] });
    expect(items.design.map((d) => d.id)).toEqual(['upload-a']);
    expect(items.font).toMatchObject([{ id: 'upload-f', format: 'otf', family: 'Ff', design: null }]);
    expect(parseItems(undefined)).toEqual({ design: [], font: [] });
  });

  it('shows uploaded items as rows with the default category', () => {
    expect(uploadedRows('design', [item({ category: '' })])).toEqual([{ id: 'upload-heart', name: 'Heart', category: 'Uploaded', detail: '3 · 9.3×8.8 mm', uploaded: true }]);
    expect(uploadedRows('font', [item({ kind: 'font', design: null, category: '', family: 'Fancy' })])[0]).toMatchObject({ category: 'Uploads', detail: 'Fancy' });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Worker

interface Call { query: string; values: unknown[] }

function fakeDb(answers: { first?: unknown; chunks?: string[]; rows?: unknown[] } = {}) {
  const calls: Call[] = [];
  const statement = (query: string): D1PreparedStatement => {
    let values: unknown[] = [];
    const self: D1PreparedStatement = {
      bind: (...v) => { values = v; return self; },
      run: async () => { calls.push({ query, values }); return undefined; },
      all: async () => {
        calls.push({ query, values });
        if (query.includes('FROM library_chunks')) return { results: (answers.chunks ?? []).map((data) => ({ data })) as never[] };
        if (query.includes('FROM library_items')) return { results: (answers.rows ?? []) as never[] };
        return { results: [] as never[] };
      },
      first: async () => { calls.push({ query, values }); return (answers.first ?? null) as never; },
    };
    (self as unknown as { q: string; v: () => unknown[] }).q = query;
    (self as unknown as { q: string; v: () => unknown[] }).v = () => values;
    return self;
  };
  const db: D1Database = {
    prepare: statement,
    batch: async (statements) => {
      for (const s of statements) {
        const x = s as unknown as { q: string; v: () => unknown[] };
        calls.push({ query: x.q, values: x.v() });
      }
      return [];
    },
  };
  return { db, calls };
}

const env = (db: D1Database) => ({ DB: db, ALLOW_UNAUTHENTICATED: 'true' });
const NOW = '2026-11-28T10:00:00.000Z';
const request = (path: string, init?: RequestInit) => new Request(`https://x${path}`, init);
const putItem = (body: unknown) => request('/api/admin/library/item', { method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body) });

beforeEach(() => resetLibraryState());

describe('uploading an item', () => {
  it('stores the file in chunks and the details in one row, never parsing the file', async () => {
    const { db, calls } = fakeDb();
    const data = 'x'.repeat(650_000);
    const response = await handleLibrary(putItem(upload({ data })), env(db), fetch, () => NOW);
    expect(await response.json()).toEqual({ ok: true, id: 'upload-heart', updatedAt: NOW, chunks: 3 });
    expect(calls.filter((c) => c.query.startsWith('INSERT INTO library_chunks'))).toHaveLength(3);
    const row = calls.find((c) => c.query.startsWith('INSERT INTO library_items'))!;
    expect(row.values).toEqual(['design', 'upload-heart', 'Heart', 'Shapes', 'json', '', JSON.stringify(DESIGN), 650_000, NOW, NOW]);
    expect(calls.some((c) => c.query.startsWith('DELETE FROM library_chunks'))).toBe(true);
  });

  it('writes nothing for a bad upload', async () => {
    for (const body of ['{oops', upload({ id: 'heart' }), upload({ data: '' }), 'x'.repeat(2_300_000)]) {
      const { db, calls } = fakeDb();
      const response = await handleLibrary(putItem(body), env(db), fetch, () => NOW);
      expect([400, 413]).toContain(response.status);
      expect(calls.some((c) => c.query.startsWith('INSERT INTO library_'))).toBe(false);
    }
  });
});

describe('asking for a file', () => {
  it('gives a design as JSON', async () => {
    const { db } = fakeDb({ first: { format: 'json' }, chunks: ['{"v":1,', '"s":[]}'] });
    const response = await handleLibrary(request('/api/library/file?kind=design&id=upload-heart&v=x'), env(db), fetch, () => NOW);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('cache-control')).toContain('immutable');
    expect(await response.text()).toBe('{"v":1,"s":[]}');
  });

  it('gives a font as its bytes', async () => {
    const bytes = Uint8Array.from([0x77, 0x4f, 0x46, 0x46, 1, 2, 3, 250, 251, 252]);
    const base64 = bytesToBase64(bytes);
    const { db } = fakeDb({ first: { format: 'woff' }, chunks: [base64.slice(0, 8), base64.slice(8)] });
    const response = await handleLibrary(request('/api/library/file?kind=font&id=upload-fancy'), env(db), fetch, () => NOW);
    expect(response.headers.get('content-type')).toBe('font/woff');
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([...bytes]);
  });

  it('says so for a missing item, a bad id and a damaged font', async () => {
    expect((await handleLibrary(request('/api/library/file?kind=font&id=upload-none'), env(fakeDb().db), fetch, () => NOW)).status).toBe(404);
    expect((await handleLibrary(request('/api/library/file?kind=font&id=../x'), env(fakeDb().db), fetch, () => NOW)).status).toBe(400);
    expect((await handleLibrary(request('/api/library/file?kind=colour&id=a'), env(fakeDb().db), fetch, () => NOW)).status).toBe(400);
    const damaged = fakeDb({ first: { format: 'ttf' }, chunks: ['@@@@'] });
    expect((await handleLibrary(request('/api/library/file?kind=font&id=upload-bad'), env(damaged.db), fetch, () => NOW)).status).toBe(500);
  });

  it('decodes base64 the way a browser encodes it', () => {
    const bytes = Uint8Array.from({ length: 1000 }, (_, i) => (i * 7) % 256);
    expect([...decodeBase64(bytesToBase64(bytes))]).toEqual([...bytes]);
  });
});

describe('the overlay answer and deleting', () => {
  it('lists the uploaded items next to the overlay', async () => {
    const { db } = fakeDb({ rows: [{ kind: 'design', id: 'upload-heart', name: 'Heart', category: 'Shapes', format: 'json', family: '', design: JSON.stringify(DESIGN), chars: 7, updated_at: NOW }] });
    const body = (await (await handleLibrary(request('/api/library/overlay'), env(db), fetch, () => NOW)).json()) as { items: { design: LibraryItem[] } };
    expect(body.items.design[0]).toMatchObject({ id: 'upload-heart', name: 'Heart', design: DESIGN, updatedAt: NOW });
  });

  it('deletes the item, its file and its overrides', async () => {
    const { db, calls } = fakeDb();
    const response = await handleLibrary(request('/api/admin/library/item?kind=font&id=upload-fancy', { method: 'DELETE' }), env(db), fetch, () => NOW);
    expect(response.status).toBe(200);
    const queries = calls.map((c) => c.query);
    expect(queries.filter((q) => q.startsWith('DELETE FROM library_'))).toHaveLength(3);
    expect((await handleLibrary(request('/api/admin/library/item?kind=font&id=../x', { method: 'DELETE' }), env(fakeDb().db), fetch, () => NOW)).status).toBe(400);
  });

  it('only accepts a known font category when a font is changed', async () => {
    const patch = (category: string, kind = 'font') => request('/api/admin/library/overrides', { method: 'PUT', body: JSON.stringify({ kind, ids: ['a'], patch: { category } }) });
    expect((await handleLibrary(patch('Fancy'), env(fakeDb().db), fetch, () => NOW)).status).toBe(400);
    expect((await handleLibrary(patch('Script'), env(fakeDb().db), fetch, () => NOW)).status).toBe(200);
    expect((await handleLibrary(patch('Fancy', 'design'), env(fakeDb().db), fetch, () => NOW)).status).toBe(200);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Browser side

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="300mm" height="200mm" viewBox="0 0 30000 20000"><circle cx="5000" cy="4000" r="165" fill="#ff0000"/><circle cx="5600" cy="4000" r="165" fill="#ff0000"/><circle cx="5300" cy="4520" r="165" fill="#0000ff"/></svg>';

describe('preparing a design', () => {
  it('turns a rhinestone template into compact stones and counts them', () => {
    const prepared = prepareDesign(SVG, 'C:\\files\\my_heart-design.svg');
    expect(prepared).toMatchObject({ ok: true, name: 'my heart design', design: { stones: 3, stoneMm: 3.3 } });
    if (!prepared.ok) return;
    expect(prepared.design.widthMm).toBeCloseTo(9.3, 1);
    expect(JSON.parse(prepared.data)).toMatchObject({ v: 1 });
  });

  it('refuses an SVG with no stones, a broken one and an unsafe one', () => {
    expect(prepareDesign('<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm"><rect width="5" height="5"/></svg>', 'a.svg')).toEqual({ ok: false, reason: 'no-stones' });
    expect(prepareDesign('not an svg', 'a.svg').ok).toBe(false);
    expect(prepareDesign('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="1"/></svg>', 'a.svg')).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('makes a name from a file name', () => {
    expect(nameFromFileName('Big_Star-2.SVG')).toBe('Big Star 2');
    expect(nameFromFileName('.svg')).toBe('Untitled');
  });
});

describe('preparing a font', () => {
  it('knows the formats from the first bytes, not from the name', () => {
    expect(fontFormatOf(Uint8Array.from([0x77, 0x4f, 0x46, 0x46]))).toBe('woff');
    expect(fontFormatOf(Uint8Array.from([0x4f, 0x54, 0x54, 0x4f]))).toBe('otf');
    expect(fontFormatOf(Uint8Array.from([0, 1, 0, 0]))).toBe('ttf');
    expect(fontFormatOf(Uint8Array.from([0x77, 0x4f, 0x46, 0x32]))).toBeNull(); // WOFF2
    expect(fontFormatOf(Uint8Array.from([1, 2]))).toBeNull();
  });

  it('refuses a file that is not a font', () => {
    expect(prepareFont('a.ttf', new TextEncoder().encode('hello world'))).toEqual({ ok: false, reason: 'format' });
    expect(prepareFont('a.woff2', Uint8Array.from([0x77, 0x4f, 0x46, 0x32, 0, 0, 0, 0]))).toEqual({ ok: false, reason: 'format' });
    expect(prepareFont('a.ttf', Uint8Array.from([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toMatchObject({ ok: false, reason: 'unusable' });
  });
});

describe('the upload client', () => {
  const ok = (body: unknown = {}) => (async () => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;

  it('sends an item and deletes one', async () => {
    let seen: { url: string; method?: string; body?: string } | null = null;
    const fetcher = (async (url: string, init?: RequestInit) => { seen = { url, method: init?.method, body: init?.body as string }; return new Response('{}', { headers: { 'content-type': 'application/json' } }); }) as unknown as typeof fetch;
    expect(await uploadLibraryItem({ kind: 'design', id: 'upload-a', name: 'A', category: 'x', format: 'json', design: DESIGN, data: '{}' }, fetcher)).toEqual({ ok: true, value: 'upload-a' });
    expect(seen).toMatchObject({ url: '/api/admin/library/item', method: 'PUT' });
    expect(await deleteLibraryItem('font', 'upload-a b', fetcher)).toEqual({ ok: true, value: true });
    expect(seen).toMatchObject({ url: '/api/admin/library/item?kind=font&id=upload-a%20b', method: 'DELETE' });
  });

  it('reports a refusal with its message', async () => {
    const refuse = (async () => new Response('{"error":"Too large."}', { status: 413, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
    expect(await uploadLibraryItem({ kind: 'font', id: 'upload-a', name: 'A', category: '', format: 'ttf', data: 'AAAA' }, refuse)).toMatchObject({ ok: false, message: 'Too large.' });
  });

  it('reads the uploaded items with the overlay', async () => {
    const result = await fetchLibrary(ok({ overlay: { design: {}, font: {} }, items: { design: [{ id: 'upload-a', name: 'A', design: DESIGN }], font: [] } }));
    expect(result).toMatchObject({ ok: true, value: { items: { design: [{ id: 'upload-a' }] } } });
  });
});
