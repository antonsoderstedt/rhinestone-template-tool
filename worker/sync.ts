/**
 * The sync API: one row per saved item (a design, a file, a calibration profile), kept per Access user.
 *
 *   GET  /api/sync/manifest                       what the server has (no data)
 *   GET  /api/sync/item?kind=&id=                 one item's data, raw, with its time in headers
 *   PUT  /api/sync/item?kind=&id=&updatedAt=[&deleted=1]   the body is the item's data, raw
 *
 * The data is stored as text and never parsed here (a Worker on the free plan has 10 ms of CPU per request): big items are cut
 * into chunks that fit a database row. A deletion is kept as an item without data, so the other devices learn of it.
 */

import { checkAccess } from './access';
import type { D1Database, SyncEnv } from './types';

export const SYNC_KINDS = ['template', 'asset', 'htv', 'papercraft', 'calibration', 'settings', 'fontpref', 'designpref', 'font'] as const;
const KIND_SET: ReadonlySet<string> = new Set(SYNC_KINDS);
const ID_PATTERN = /^[A-Za-z0-9._:~-]{1,160}$/;
const CHUNK_CHARS = 300_000;
const MAX_BODY_CHARS = 30_000_000;

let schemaReady = false;

async function ensureSchema(db: D1Database): Promise<void> {
  if (schemaReady) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS items (owner TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, chunks INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (owner, kind, id))'),
    db.prepare('CREATE TABLE IF NOT EXISTS chunks (owner TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, n INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (owner, kind, id, n))'),
  ]);
  schemaReady = true;
}

/** For tests. */
export function resetSchemaFlag(): void {
  schemaReady = false;
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
}

function isTimestamp(value: string | null): value is string {
  return value !== null && value.length <= 40 && Number.isFinite(Date.parse(value));
}

export function chunkText(text: string, size = CHUNK_CHARS): string[] {
  if (text.length === 0) return [''];
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
  return parts;
}

export async function handleSync(request: Request, env: SyncEnv, fetcher: typeof fetch = fetch): Promise<Response> {
  const access = await checkAccess(request, env, fetcher);
  if (!access.ok) return json({ error: access.message }, access.status);
  const owner = access.owner;
  const url = new URL(request.url);
  const db = env.DB;
  await ensureSchema(db);

  if (url.pathname === '/api/sync/manifest' && request.method === 'GET') {
    const { results } = await db.prepare('SELECT kind, id, updated_at, deleted FROM items WHERE owner = ?').bind(owner).all<{ kind: string; id: string; updated_at: string; deleted: number }>();
    return json({ items: results.map((row) => ({ kind: row.kind, id: row.id, updatedAt: row.updated_at, deleted: row.deleted === 1 })) });
  }

  if (url.pathname === '/api/sync/item') {
    const kind = url.searchParams.get('kind') ?? '';
    const id = url.searchParams.get('id') ?? '';
    if (!KIND_SET.has(kind) || !ID_PATTERN.test(id)) return json({ error: 'Bad kind or id.' }, 400);

    if (request.method === 'GET') {
      const item = await db.prepare('SELECT updated_at, deleted, chunks FROM items WHERE owner = ? AND kind = ? AND id = ?').bind(owner, kind, id).first<{ updated_at: string; deleted: number; chunks: number }>();
      if (!item) return json({ error: 'Not found.' }, 404);
      const { results } = await db.prepare('SELECT data FROM chunks WHERE owner = ? AND kind = ? AND id = ? ORDER BY n').bind(owner, kind, id).all<{ data: string }>();
      return new Response(results.map((row) => row.data).join(''), {
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-sync-updated-at': item.updated_at, 'x-sync-deleted': item.deleted === 1 ? '1' : '0' },
      });
    }

    if (request.method === 'PUT') {
      const updatedAt = url.searchParams.get('updatedAt');
      if (!isTimestamp(updatedAt)) return json({ error: 'Bad updatedAt.' }, 400);
      const deleted = url.searchParams.get('deleted') === '1';
      // The workspace settings, the language and the unit exist once and are never deleted.
      if (deleted && kind === 'settings' && ['workspace', 'language', 'unit'].includes(id)) return json({ error: 'This item cannot be deleted.' }, 400);
      const body = deleted ? '' : await request.text();
      if (body.length > MAX_BODY_CHARS) return json({ error: 'Too large.' }, 413);

      const existing = await db.prepare('SELECT updated_at FROM items WHERE owner = ? AND kind = ? AND id = ?').bind(owner, kind, id).first<{ updated_at: string }>();
      if (existing && Date.parse(existing.updated_at) > Date.parse(updatedAt)) {
        return json({ error: 'The server has a newer version.', current: existing.updated_at }, 409);
      }

      const parts = deleted ? [] : chunkText(body);
      await db.batch([
        db.prepare('DELETE FROM chunks WHERE owner = ? AND kind = ? AND id = ?').bind(owner, kind, id),
        ...parts.map((part, n) => db.prepare('INSERT INTO chunks (owner, kind, id, n, data) VALUES (?, ?, ?, ?, ?)').bind(owner, kind, id, n, part)),
        db.prepare('INSERT INTO items (owner, kind, id, updated_at, deleted, chunks) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (owner, kind, id) DO UPDATE SET updated_at = excluded.updated_at, deleted = excluded.deleted, chunks = excluded.chunks')
          .bind(owner, kind, id, updatedAt, deleted ? 1 : 0, parts.length),
      ]);
      return json({ ok: true, updatedAt, chunks: parts.length });
    }
  }

  return json({ error: 'Not found.' }, 404);
}
