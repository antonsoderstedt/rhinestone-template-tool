/**
 * Curating the design and font libraries (ADR 0063). The libraries are static files; this keeps the owner's changes to them, small
 * rows in the database: an item can be hidden, and its name and category can be changed.
 *
 *   GET /api/library/overlay                what the studios apply to their lists: {overlay: {design: {id: {hidden, name, category}}, font: {...}}}
 *   PUT /api/admin/library/overrides        body {kind, ids: [...], patch: {hidden?, name?, category?}}: only the given fields change
 *
 * Nothing here reads a library file. An item that is back to normal (not hidden, no name, no category) has no row.
 *
 * New designs and fonts the owner uploads are kept here too (they are added to the built libraries' lists):
 *
 *   GET    /api/library/file?kind=&id=&v=       one uploaded file: a design as JSON, a font as its bytes (decoded from base64)
 *   PUT    /api/admin/library/item              body {kind, id, name, category, format, family, design, data}: adds an item (the id starts with upload-)
 *   DELETE /api/admin/library/item?kind=&id=    removes an uploaded item and its file
 *
 * Like the catalog the file is stored as text in chunks and never parsed here (10 ms of CPU per request on the free plan); only a font is
 * decoded from base64 when it is asked for, which is why a font is limited to about 1.5 MB.
 */

import { checkAccess } from './access';
import { FONT_CATEGORIES, LIBRARY_ID_PATTERN, LIBRARY_KINDS, isLibraryKind, parseIds, parsePatch, type LibraryOverride } from '../src/lib/library/library';
import { emptyItems, parseItem, type LibraryItems } from '../src/lib/library/libraryItems';
import { chunkText } from './sync';
import type { D1Database, SyncEnv } from './types';

let schemaReady = false;

async function ensureSchema(db: D1Database): Promise<void> {
  if (schemaReady) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS library_overrides (kind TEXT NOT NULL, id TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, name TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL, PRIMARY KEY (kind, id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS library_items (kind TEXT NOT NULL, id TEXT NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '', format TEXT NOT NULL, family TEXT NOT NULL DEFAULT '', design TEXT NOT NULL DEFAULT '', chars INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (kind, id))"),
    db.prepare('CREATE TABLE IF NOT EXISTS library_chunks (kind TEXT NOT NULL, id TEXT NOT NULL, n INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (kind, id, n))'),
  ]);
  schemaReady = true;
}

/** For tests. */
export function resetLibraryState(): void {
  schemaReady = false;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

interface Row { kind: string; id: string; hidden: number; name: string; category: string }
interface ItemRow { kind: string; id: string; name: string; category: string; format: string; family: string; design: string; chars: number; updated_at: string }

const FONT_TYPES: Record<string, string> = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff' };

function itemsOf(rows: readonly ItemRow[]): LibraryItems {
  const items = emptyItems();
  for (const row of rows) {
    if (!isLibraryKind(row.kind)) continue;
    let design: unknown = null;
    try {
      design = row.design ? JSON.parse(row.design) : null;
    } catch {
      design = null;
    }
    items[row.kind].push({ kind: row.kind, id: row.id, name: row.name, category: row.category, format: row.format, chars: row.chars, updatedAt: row.updated_at, family: row.family, design: design as never });
  }
  return items;
}

/** The bytes of a base64 text. Throws on a text that is not base64. */
export function decodeBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function handleLibrary(request: Request, env: SyncEnv, fetcher: typeof fetch = fetch, now: () => string = () => new Date().toISOString()): Promise<Response> {
  const access = await checkAccess(request, env, fetcher);
  if (!access.ok) return json({ error: access.message }, access.status);
  const { pathname } = new URL(request.url);
  const db = env.DB;
  await ensureSchema(db);

  if (pathname === '/api/library/overlay' && request.method === 'GET') {
    const { results } = await db.prepare('SELECT kind, id, hidden, name, category FROM library_overrides').all<Row>();
    const overlay: Record<string, Record<string, LibraryOverride>> = Object.fromEntries(LIBRARY_KINDS.map((kind) => [kind, {}]));
    for (const row of results) {
      if (isLibraryKind(row.kind)) overlay[row.kind]![row.id] = { hidden: row.hidden === 1, name: row.name, category: row.category };
    }
    const { results: itemRows } = await db.prepare('SELECT kind, id, name, category, format, family, design, chars, updated_at FROM library_items ORDER BY name COLLATE NOCASE').all<ItemRow>();
    return json({ overlay, items: itemsOf(itemRows) });
  }

  if (pathname === '/api/library/file' && request.method === 'GET') {
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get('kind');
    const id = searchParams.get('id') ?? '';
    if (!isLibraryKind(kind) || !LIBRARY_ID_PATTERN.test(id)) return json({ error: 'Bad kind or id.' }, 400);
    const row = await db.prepare('SELECT format FROM library_items WHERE kind = ? AND id = ?').bind(kind, id).first<{ format: string }>();
    if (!row) return json({ error: 'Not found.' }, 404);
    const { results } = await db.prepare('SELECT data FROM library_chunks WHERE kind = ? AND id = ? ORDER BY n').bind(kind, id).all<{ data: string }>();
    const text = results.map((r) => r.data).join('');
    // The address carries the time of the last change (`v`), so a browser can keep a file for good: it is new when the item is.
    const headers = { 'cache-control': 'private, max-age=31536000, immutable' };
    if (kind === 'design') return new Response(text, { headers: { ...headers, 'content-type': 'application/json' } });
    try {
      return new Response(decodeBase64(text), { headers: { ...headers, 'content-type': FONT_TYPES[row.format] ?? 'application/octet-stream' } });
    } catch {
      return json({ error: 'The file is damaged.' }, 500);
    }
  }

  if (pathname === '/api/admin/library/item' && request.method === 'PUT') {
    const text = await request.text();
    if (text.length > 2_200_000) return json({ error: 'Too large.' }, 413);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: 'Bad JSON.' }, 400);
    }
    const parsed = parseItem(body);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const { item, data } = parsed;
    const chunks = chunkText(data);
    const time = now();
    await db.batch([
      db.prepare('DELETE FROM library_chunks WHERE kind = ? AND id = ?').bind(item.kind, item.id),
      ...chunks.map((chunk, n) => db.prepare('INSERT INTO library_chunks (kind, id, n, data) VALUES (?, ?, ?, ?)').bind(item.kind, item.id, n, chunk)),
      db
        .prepare(
          'INSERT INTO library_items (kind, id, name, category, format, family, design, chars, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (kind, id) DO UPDATE SET name = excluded.name, category = excluded.category, format = excluded.format, family = excluded.family, design = excluded.design, chars = excluded.chars, updated_at = excluded.updated_at',
        )
        .bind(item.kind, item.id, item.name, item.category, item.format, item.family, item.design ? JSON.stringify(item.design) : '', data.length, time, time),
    ]);
    return json({ ok: true, id: item.id, updatedAt: time, chunks: chunks.length });
  }

  if (pathname === '/api/admin/library/item' && request.method === 'DELETE') {
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get('kind');
    const id = searchParams.get('id') ?? '';
    if (!isLibraryKind(kind) || !LIBRARY_ID_PATTERN.test(id)) return json({ error: 'Bad kind or id.' }, 400);
    await db.batch([
      db.prepare('DELETE FROM library_chunks WHERE kind = ? AND id = ?').bind(kind, id),
      db.prepare('DELETE FROM library_items WHERE kind = ? AND id = ?').bind(kind, id),
      db.prepare('DELETE FROM library_overrides WHERE kind = ? AND id = ?').bind(kind, id),
    ]);
    return json({ ok: true });
  }

  if (pathname === '/api/admin/library/overrides' && request.method === 'PUT') {
    let body: unknown;
    try {
      body = JSON.parse(await request.text());
    } catch {
      return json({ error: 'Bad JSON.' }, 400);
    }
    const o = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
    if (!isLibraryKind(o.kind)) return json({ error: 'Bad kind.' }, 400);
    const ids = parseIds(o.ids);
    if (!ids.ok) return json({ error: ids.error }, 400);
    const parsed = parsePatch(o.patch);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    if (o.kind === 'font' && parsed.patch.category && !(FONT_CATEGORIES as readonly string[]).includes(parsed.patch.category)) return json({ error: 'A font category must be one of the known ones.' }, 400);

    // A new row starts as the library has it, with the given fields; an old row changes only the given fields.
    const { hidden, name, category } = parsed.patch;
    const sets = [hidden !== undefined ? 'hidden = excluded.hidden' : '', name !== undefined ? 'name = excluded.name' : '', category !== undefined ? 'category = excluded.category' : '', 'updated_at = excluded.updated_at'].filter(Boolean).join(', ');
    const time = now();
    await db.batch([
      ...ids.ids.map((id) =>
        db
          .prepare(`INSERT INTO library_overrides (kind, id, hidden, name, category, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (kind, id) DO UPDATE SET ${sets}`)
          .bind(o.kind, id, hidden ? 1 : 0, name ?? '', category ?? '', time),
      ),
      db.prepare("DELETE FROM library_overrides WHERE hidden = 0 AND name = '' AND category = ''"),
    ]);
    return json({ ok: true, changed: ids.ids.length });
  }

  return json({ error: 'Not found.' }, 404);
}
