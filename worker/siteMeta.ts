/**
 * Site metadata (ADR 0062): the title and description the owner sets in the admin panel.
 *
 *   GET /api/site/meta       what a browser applies to the page
 *   GET /api/admin/metadata  the settings (the same)
 *   PUT /api/admin/metadata  body: the settings
 *
 * Kept in the `site_settings` table (key `metadata`) next to the tracking settings.
 */

import { checkAccess } from './access';
import { metaFromStored, parseSiteMeta } from '../src/lib/siteMeta/siteMeta';
import type { D1Database, SyncEnv } from './types';

const SETTINGS_KEY = 'metadata';

let schemaReady = false;

async function ensureSchema(db: D1Database): Promise<void> {
  if (schemaReady) return;
  await db.prepare('CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)').run();
  schemaReady = true;
}

/** For tests. */
export function resetSiteMetaState(): void {
  schemaReady = false;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

export async function handleSiteMeta(request: Request, env: SyncEnv, fetcher: typeof fetch = fetch, now: () => string = () => new Date().toISOString()): Promise<Response> {
  const access = await checkAccess(request, env, fetcher);
  if (!access.ok) return json({ error: access.message }, access.status);
  const { pathname } = new URL(request.url);
  const db = env.DB;
  await ensureSchema(db);

  const isRead = (pathname === '/api/site/meta' || pathname === '/api/admin/metadata') && request.method === 'GET';
  if (isRead) {
    const row = await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind(SETTINGS_KEY).first<{ value: string }>();
    return json({ settings: metaFromStored(row?.value) });
  }

  if (pathname === '/api/admin/metadata' && request.method === 'PUT') {
    let body: unknown;
    try {
      body = JSON.parse(await request.text());
    } catch {
      return json({ error: 'Bad JSON.' }, 400);
    }
    const parsed = parseSiteMeta(body);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    await db
      .prepare('INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
      .bind(SETTINGS_KEY, JSON.stringify(parsed.meta), now())
      .run();
    return json({ ok: true, settings: parsed.meta });
  }

  return json({ error: 'Not found.' }, 404);
}
