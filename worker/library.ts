/**
 * Curating the design and font libraries (ADR 0063). The libraries are static files; this keeps the owner's changes to them, small
 * rows in the database: an item can be hidden, and its name and category can be changed.
 *
 *   GET /api/library/overlay                what the studios apply to their lists: {overlay: {design: {id: {hidden, name, category}}, font: {...}}}
 *   PUT /api/admin/library/overrides        body {kind, ids: [...], patch: {hidden?, name?, category?}}: only the given fields change
 *
 * Nothing here reads a library file. An item that is back to normal (not hidden, no name, no category) has no row.
 */

import { checkAccess } from './access';
import { LIBRARY_KINDS, isLibraryKind, parseIds, parsePatch, type LibraryOverride } from '../src/lib/library/library';
import type { D1Database, SyncEnv } from './types';

let schemaReady = false;

async function ensureSchema(db: D1Database): Promise<void> {
  if (schemaReady) return;
  await db.prepare("CREATE TABLE IF NOT EXISTS library_overrides (kind TEXT NOT NULL, id TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0, name TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL, PRIMARY KEY (kind, id))").run();
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
    return json({ overlay });
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
