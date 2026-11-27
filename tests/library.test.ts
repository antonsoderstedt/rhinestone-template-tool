import { beforeEach, describe, expect, it } from 'vitest';
import { handleLibrary, resetLibraryState } from '../worker/library';
import type { D1Database, D1PreparedStatement } from '../worker/types';
import { fetchLibraryOverlay, patchLibrary } from '../app/lib/library/libraryClient';
import { EMPTY_FILTER, categoryCounts, filterRows, pageCount, pageOf, shownRows, type LibraryRow } from '../app/admin/libraryView';
import {
  LIBRARY_LIMITS,
  applyDesignOverlay,
  applyFontOverlay,
  emptyOverlay,
  parseIds,
  parseOverlay,
  parsePatch,
  patchOverlay,
  type LibraryOverlay,
} from '../src/lib/library/library';
import { getOutlineFontDefinition, listOutlineFonts, setFontCatalog } from '../src/lib/rhinestone-engine/index';

const overlayOf = (partial: Partial<LibraryOverlay>): LibraryOverlay => ({ ...emptyOverlay(), ...partial });

describe('parsePatch and parseIds', () => {
  it('keeps only the given fields, tidied', () => {
    expect(parsePatch({ hidden: true, name: '  My \n name ', category: 'Cats' })).toEqual({ ok: true, patch: { hidden: true, name: 'My name', category: 'Cats' } });
    expect(parsePatch({ category: '' })).toEqual({ ok: true, patch: { category: '' } });
  });

  it('refuses nothing to change, wrong types and too long texts', () => {
    expect(parsePatch({})).toMatchObject({ ok: false });
    expect(parsePatch(null)).toMatchObject({ ok: false });
    expect(parsePatch({ hidden: 'yes' })).toMatchObject({ ok: false });
    expect(parsePatch({ name: 5 })).toMatchObject({ ok: false });
    expect(parsePatch({ name: 'x'.repeat(LIBRARY_LIMITS.name + 1) })).toMatchObject({ ok: false });
    expect(parsePatch({ category: 'x'.repeat(LIBRARY_LIMITS.category + 1) })).toMatchObject({ ok: false });
  });

  it('accepts 1 to 200 distinct ids of the allowed shape', () => {
    expect(parseIds(['a', 'b', 'a'])).toEqual({ ok: true, ids: ['a', 'b'] });
    expect(parseIds([])).toMatchObject({ ok: false });
    expect(parseIds(Array.from({ length: LIBRARY_LIMITS.batch + 1 }, (_, i) => `id-${i}`))).toMatchObject({ ok: false });
    expect(parseIds(['../x'])).toMatchObject({ ok: false });
    expect(parseIds([5])).toMatchObject({ ok: false });
    expect(parseIds('a')).toMatchObject({ ok: false });
  });
});

describe('the overlay', () => {
  it('reads what the server sent and leaves out what does not fit or is back to normal', () => {
    const overlay = parseOverlay({ design: { a: { hidden: true }, b: { hidden: false, name: '', category: '' }, '../c': { hidden: true } }, font: { f: { name: 'Fancy', category: 'Script' } }, other: {} });
    expect(overlay.design).toEqual({ a: { hidden: true, name: '', category: '' } });
    expect(overlay.font).toEqual({ f: { hidden: false, name: 'Fancy', category: 'Script' } });
    expect(parseOverlay(null)).toEqual(emptyOverlay());
  });

  it('patches the way the Worker does: given fields replace, a normal item has no entry', () => {
    let o = patchOverlay(emptyOverlay(), 'design', ['a', 'b'], { hidden: true });
    expect(o.design).toEqual({ a: { hidden: true, name: '', category: '' }, b: { hidden: true, name: '', category: '' } });
    o = patchOverlay(o, 'design', ['a'], { name: 'A' });
    expect(o.design.a).toEqual({ hidden: true, name: 'A', category: '' });
    o = patchOverlay(o, 'design', ['a', 'b'], { hidden: false, name: '', category: '' });
    expect(o.design).toEqual({});
    expect(emptyOverlay().design).toEqual({}); // nothing was changed in the old one
  });

  it('applies to designs: hidden ones go, the owner’s title and category win', () => {
    const designs = [{ id: 'a', title: 'A', category: 'x' }, { id: 'b', title: 'B', category: 'x' }, { id: 'c', title: 'C', category: 'y' }];
    const o = overlayOf({ design: { a: { hidden: true, name: '', category: '' }, b: { hidden: false, name: 'Bee', category: 'z' } } });
    expect(applyDesignOverlay(designs, o)).toEqual([{ id: 'b', title: 'Bee', category: 'z' }, { id: 'c', title: 'C', category: 'y' }]);
    expect(applyDesignOverlay(designs, emptyOverlay())).toEqual(designs);
  });

  it('applies to fonts: hidden ones stay in the list, marked', () => {
    const fonts = [{ id: 'a', name: 'A', category: 'Script' }, { id: 'b', name: 'B' }];
    const o = overlayOf({ font: { a: { hidden: true, name: 'Aa', category: '' }, b: { hidden: false, name: '', category: 'Bubble' } } });
    expect(applyFontOverlay(fonts, o)).toEqual([{ id: 'a', name: 'Aa', category: 'Script', hidden: true }, { id: 'b', name: 'B', category: 'Bubble' }]);
  });
});

describe('a hidden library font in the engine', () => {
  it('is left out of the pickers but is still found by a saved design', () => {
    setFontCatalog([{ id: 'lib-shown', name: 'Shown' }, { id: 'lib-hidden', name: 'Hidden', hidden: true }], {});
    try {
      const ids = listOutlineFonts().map((f) => f.fontId);
      expect(ids).toContain('lib-shown');
      expect(ids).not.toContain('lib-hidden');
      expect(getOutlineFontDefinition('lib-hidden').fontId).toBe('lib-hidden');
      expect(getOutlineFontDefinition('lib-hidden').displayName).toBe('Hidden');
    } finally {
      setFontCatalog([], {});
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Worker

interface Call { query: string; values: unknown[] }

function fakeDb(rows: unknown[] = []) {
  const calls: Call[] = [];
  const statement = (query: string): D1PreparedStatement => {
    let values: unknown[] = [];
    const self: D1PreparedStatement = {
      bind: (...v) => { values = v; return self; },
      run: async () => { calls.push({ query, values }); return undefined; },
      all: async () => { calls.push({ query, values }); return { results: rows as never[] }; },
      first: async () => { calls.push({ query, values }); return null as never; },
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
const put = (body: unknown) => request('/api/admin/library/overrides', { method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body) });
const writes = (calls: Call[]) => calls.filter((c) => c.query.startsWith('INSERT INTO library_overrides'));

beforeEach(() => resetLibraryState());

describe('handleLibrary', () => {
  it('refuses a request without an Access token', async () => {
    const { db, calls } = fakeDb();
    const response = await handleLibrary(request('/api/library/overlay'), { DB: db, TEAM_DOMAIN: 'https://t.cloudflareaccess.com', POLICY_AUD: 'aud' }, fetch, () => NOW);
    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it('gives the overlay grouped by kind', async () => {
    const { db } = fakeDb([
      { kind: 'design', id: 'a', hidden: 1, name: '', category: '' },
      { kind: 'font', id: 'f', hidden: 0, name: 'Fancy', category: 'Script' },
      { kind: 'other', id: 'x', hidden: 1, name: '', category: '' },
    ]);
    const body = await (await handleLibrary(request('/api/library/overlay'), env(db), fetch, () => NOW)).json();
    expect(body).toEqual({ overlay: { design: { a: { hidden: true, name: '', category: '' } }, font: { f: { hidden: false, name: 'Fancy', category: 'Script' } } } });
  });

  it('changes only the given fields, for every id, and cleans up items that are back to normal', async () => {
    const { db, calls } = fakeDb();
    const response = await handleLibrary(put({ kind: 'design', ids: ['a', 'b'], patch: { hidden: true } }), env(db), fetch, () => NOW);
    expect(await response.json()).toEqual({ ok: true, changed: 2 });
    const inserts = writes(calls);
    expect(inserts).toHaveLength(2);
    expect(inserts[0]!.query).toContain('hidden = excluded.hidden');
    expect(inserts[0]!.query).not.toContain('name = excluded.name');
    expect(inserts[0]!.values).toEqual(['design', 'a', 1, '', '', NOW]);
    expect(calls.some((c) => c.query.startsWith('DELETE FROM library_overrides'))).toBe(true);
  });

  it('updates a name and a category without touching hidden', async () => {
    const { db, calls } = fakeDb();
    await handleLibrary(put({ kind: 'font', ids: ['f'], patch: { name: 'Fancy', category: 'Script' } }), env(db), fetch, () => NOW);
    const [row] = writes(calls);
    expect(row!.query).toContain('name = excluded.name');
    expect(row!.query).toContain('category = excluded.category');
    expect(row!.query).not.toContain('hidden = excluded.hidden');
    expect(row!.values).toEqual(['font', 'f', 0, 'Fancy', 'Script', NOW]);
  });

  it('writes nothing for a bad request', async () => {
    const bodies: unknown[] = [
      '{oops',
      { kind: 'colour', ids: ['a'], patch: { hidden: true } },
      { kind: 'design', ids: [], patch: { hidden: true } },
      { kind: 'design', ids: ['a b'], patch: { hidden: true } },
      { kind: 'design', ids: ['a'], patch: {} },
      { kind: 'design', ids: ['a'], patch: { name: 5 } },
    ];
    for (const body of bodies) {
      const { db, calls } = fakeDb();
      const response = await handleLibrary(put(body), env(db), fetch, () => NOW);
      expect(response.status).toBe(400);
      expect(writes(calls)).toHaveLength(0);
    }
  });

  it('knows no other path or method', async () => {
    const { db } = fakeDb();
    expect((await handleLibrary(request('/api/library/other'), env(db), fetch, () => NOW)).status).toBe(404);
    expect((await handleLibrary(request('/api/library/overlay', { method: 'PUT', body: '{}' }), env(db), fetch, () => NOW)).status).toBe(404);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Client

const answer = (body: unknown, status = 200, type = 'application/json') => (async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': type } })) as unknown as typeof fetch;

describe('the library client', () => {
  it('reads the overlay (and drops what does not fit)', async () => {
    const result = await fetchLibraryOverlay(answer({ overlay: { design: { a: { hidden: true }, '../b': { hidden: true } }, font: {} } }));
    expect(result).toEqual({ ok: true, value: { design: { a: { hidden: true, name: '', category: '' } }, font: {} } });
    expect(await fetchLibraryOverlay(answer('<html>', 200, 'text/html'))).toEqual({ ok: false, reason: 'unavailable' });
    expect(await fetchLibraryOverlay(answer({ error: 'no' }, 403))).toMatchObject({ ok: false, reason: 'signin' });
  });

  it('splits a long list of ids into requests the Worker accepts, and stops at the first failure', async () => {
    const ids = Array.from({ length: 450 }, (_, i) => `id-${i}`);
    const sizes: number[] = [];
    const ok = (async (_url: string, init?: RequestInit) => {
      sizes.push((JSON.parse(init?.body as string) as { ids: string[] }).ids.length);
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    expect(await patchLibrary('design', ids, { hidden: true }, ok)).toEqual({ ok: true, value: 450 });
    expect(sizes).toEqual([200, 200, 50]);

    let calls = 0;
    const failing = (async () => (++calls === 2 ? new Response('{"error":"Bad."}', { status: 400, headers: { 'content-type': 'application/json' } }) : new Response('{}', { headers: { 'content-type': 'application/json' } }))) as unknown as typeof fetch;
    expect(await patchLibrary('font', ids, { name: 'x' }, failing)).toMatchObject({ ok: false, message: 'Bad.' });
    expect(calls).toBe(2);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The list in the admin panel

const rows: LibraryRow[] = [
  { id: 'cat-1', name: 'Cat one', category: 'animals', detail: '' },
  { id: 'cat-2', name: 'Cat two', category: 'animals', detail: '' },
  { id: 'star-1', name: 'Star', category: 'shapes', detail: '' },
];

describe('libraryView', () => {
  const overlay = overlayOf({ design: { 'cat-2': { hidden: true, name: '', category: '' }, 'star-1': { hidden: false, name: 'Shiny star', category: 'sky' } } });
  const shown = shownRows(rows, overlay, 'design');

  it('shows the owner’s name and category and what has changed', () => {
    expect(shown.map((r) => [r.shownName, r.shownCategory, r.hidden, r.changed])).toEqual([
      ['Cat one', 'animals', false, false],
      ['Cat two', 'animals', true, true],
      ['Shiny star', 'sky', false, true],
    ]);
  });

  it('filters by text (also the old name and the id), category and status', () => {
    const ids = (f: Partial<typeof EMPTY_FILTER>) => filterRows(shown, { ...EMPTY_FILTER, ...f }).map((r) => r.id);
    expect(ids({})).toEqual(['cat-1', 'cat-2', 'star-1']);
    expect(ids({ query: 'SHINY' })).toEqual(['star-1']);
    expect(ids({ query: 'star' })).toEqual(['star-1']); // the library's own name
    expect(ids({ query: 'cat-2' })).toEqual(['cat-2']);
    expect(ids({ category: 'animals' })).toEqual(['cat-1', 'cat-2']);
    expect(ids({ status: 'hidden' })).toEqual(['cat-2']);
    expect(ids({ status: 'visible' })).toEqual(['cat-1', 'star-1']);
    expect(ids({ status: 'changed' })).toEqual(['cat-2', 'star-1']);
  });

  it('counts the categories, the biggest first', () => {
    expect(categoryCounts(shown)).toEqual([{ category: 'animals', count: 2 }, { category: 'sky', count: 1 }]);
  });

  it('cuts into pages and keeps the page inside the list', () => {
    const many = Array.from({ length: 120 }, (_, i) => i);
    expect(pageCount(120, 50)).toBe(3);
    expect(pageCount(0, 50)).toBe(1);
    expect(pageOf(many, 2, 50)).toHaveLength(20);
    expect(pageOf(many, 9, 50)[0]).toBe(100);
    expect(pageOf(many, -3, 50)[0]).toBe(0);
  });
});
