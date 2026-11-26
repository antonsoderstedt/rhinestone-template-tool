/**
 * The template catalog: templates the owner uploads in the admin panel and the studios read. One catalog for the whole site
 * (not per user): the site is behind Cloudflare Access, and the Access policy decides who may open the admin panel (ADR 0057).
 *
 *   GET    /api/catalog/templates[?studio=][&all=1]   the templates' details (no files); only published ones unless all=1
 *   GET    /api/catalog/file?id=&part=file|preview    one file, raw, with its name and type in headers
 *   PUT    /api/admin/template                        body: JSON details; creates or changes a template (the file is kept)
 *   PUT    /api/admin/file?id=&part=&name=&type=      body: the file as text (a binary file is sent base64 encoded)
 *   DELETE /api/admin/template?id=                    removes a template and its files
 *
 * Like the sync API the files are stored as text, in chunks that fit a row, and never parsed here (10 ms of CPU per request
 * on the free plan); the details are small JSON.
 */

import { checkAccess } from './access';
import { chunkText } from './sync';
import type { D1Database, SyncEnv } from './types';

export const CATALOG_STUDIOS = ['rhinestone', 'htv', 'papercraft'] as const;
const STUDIO_SET: ReadonlySet<string> = new Set(CATALOG_STUDIOS);
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const FORMAT_PATTERN = /^[a-z0-9]{1,12}$/;
const FILE_NAME_PATTERN = /^[^\u0000-\u001f\\/]{1,200}$/;
const MAX_FILE_CHARS = 30_000_000;
const MAX_PREVIEW_CHARS = 1_500_000;
const MAX_TAGS = 20;
const MAX_FIELDS = 30;

let schemaReady = false;

async function ensureSchema(db: D1Database): Promise<void> {
  if (schemaReady) return;
  await db.batch([
    db.prepare(
      'CREATE TABLE IF NOT EXISTS catalog_templates (id TEXT PRIMARY KEY, studio TEXT NOT NULL, format TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT \'\', category TEXT NOT NULL DEFAULT \'\', tags TEXT NOT NULL DEFAULT \'[]\', licence TEXT NOT NULL DEFAULT \'\', fields TEXT NOT NULL DEFAULT \'{}\', published INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, file_name TEXT, file_type TEXT, file_chars INTEGER NOT NULL DEFAULT 0, preview_name TEXT, preview_type TEXT, preview_chars INTEGER NOT NULL DEFAULT 0)',
    ),
    db.prepare('CREATE TABLE IF NOT EXISTS catalog_chunks (id TEXT NOT NULL, part TEXT NOT NULL, n INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (id, part, n))'),
  ]);
  schemaReady = true;
}

/** For tests. */
export function resetCatalogSchemaFlag(): void {
  schemaReady = false;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

export interface CatalogDetails {
  id: string;
  studio: string;
  format: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  licence: string;
  /** Free fields the owner decides on (source, designer, difficulty, …). */
  fields: Record<string, string>;
  published: boolean;
}

/** Checks the details the admin panel sends. Returns what to store, or the reason it is refused. */
export function parseDetails(raw: unknown): { ok: true; details: CatalogDetails } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'Details must be an object.' };
  const o = raw as Record<string, unknown>;
  const text = (key: string, max: number): string | null => {
    const v = o[key];
    return v === undefined || v === null ? '' : typeof v === 'string' && v.length <= max ? v.trim() : null;
  };
  const id = typeof o.id === 'string' ? o.id : '';
  if (!ID_PATTERN.test(id)) return { ok: false, error: 'Bad id (use a-z, 0-9, dot, dash and underscore).' };
  if (typeof o.studio !== 'string' || !STUDIO_SET.has(o.studio)) return { ok: false, error: 'Bad studio.' };
  if (typeof o.format !== 'string' || !FORMAT_PATTERN.test(o.format)) return { ok: false, error: 'Bad format.' };
  const name = text('name', 120);
  const description = text('description', 4000);
  const category = text('category', 60);
  const licence = text('licence', 200);
  if (!name) return { ok: false, error: 'A template needs a name.' };
  if (description === null || category === null || licence === null) return { ok: false, error: 'A text is too long.' };

  const tags: string[] = [];
  if (o.tags !== undefined) {
    if (!Array.isArray(o.tags) || o.tags.length > MAX_TAGS) return { ok: false, error: 'Bad tags.' };
    for (const tag of o.tags) {
      if (typeof tag !== 'string' || tag.length > 40) return { ok: false, error: 'Bad tags.' };
      const t = tag.trim();
      if (t && !tags.includes(t)) tags.push(t);
    }
  }

  const fields: Record<string, string> = {};
  if (o.fields !== undefined) {
    if (typeof o.fields !== 'object' || o.fields === null || Array.isArray(o.fields)) return { ok: false, error: 'Bad fields.' };
    const entries = Object.entries(o.fields as Record<string, unknown>);
    if (entries.length > MAX_FIELDS) return { ok: false, error: 'Too many fields.' };
    for (const [key, value] of entries) {
      if (!/^[A-Za-z0-9 ._-]{1,40}$/.test(key) || typeof value !== 'string' || value.length > 500) return { ok: false, error: 'Bad fields.' };
      fields[key] = value;
    }
  }

  return { ok: true, details: { id, studio: o.studio, format: o.format, name, description, category, tags, licence, fields, published: o.published === true } };
}

interface Row {
  id: string;
  studio: string;
  format: string;
  name: string;
  description: string;
  category: string;
  tags: string;
  licence: string;
  fields: string;
  published: number;
  created_at: string;
  updated_at: string;
  file_name: string | null;
  file_type: string | null;
  file_chars: number;
  preview_name: string | null;
  preview_type: string | null;
  preview_chars: number;
}

function safeJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export function rowToTemplate(row: Row) {
  return {
    id: row.id,
    studio: row.studio,
    format: row.format,
    name: row.name,
    description: row.description,
    category: row.category,
    tags: safeJson<string[]>(row.tags, []),
    licence: row.licence,
    fields: safeJson<Record<string, string>>(row.fields, {}),
    published: row.published === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    file: row.file_name ? { name: row.file_name, type: row.file_type ?? '', chars: row.file_chars } : null,
    preview: row.preview_name ? { name: row.preview_name, type: row.preview_type ?? '', chars: row.preview_chars } : null,
  };
}

export async function handleCatalog(request: Request, env: SyncEnv, fetcher: typeof fetch = fetch, now: () => string = () => new Date().toISOString()): Promise<Response> {
  const access = await checkAccess(request, env, fetcher);
  if (!access.ok) return json({ error: access.message }, access.status);
  const url = new URL(request.url);
  const db = env.DB;
  await ensureSchema(db);

  if (url.pathname === '/api/catalog/templates' && request.method === 'GET') {
    const studio = url.searchParams.get('studio');
    if (studio !== null && !STUDIO_SET.has(studio)) return json({ error: 'Bad studio.' }, 400);
    const all = url.searchParams.get('all') === '1';
    const where = [studio ? 'studio = ?' : '', all ? '' : 'published = 1'].filter(Boolean).join(' AND ');
    const statement = db.prepare(`SELECT * FROM catalog_templates ${where ? `WHERE ${where} ` : ''}ORDER BY name COLLATE NOCASE`);
    const { results } = await (studio ? statement.bind(studio) : statement).all<Row>();
    return json({ templates: results.map(rowToTemplate) });
  }

  if (url.pathname === '/api/catalog/file' && request.method === 'GET') {
    const id = url.searchParams.get('id') ?? '';
    const part = url.searchParams.get('part') ?? 'file';
    if (!ID_PATTERN.test(id) || (part !== 'file' && part !== 'preview')) return json({ error: 'Bad id or part.' }, 400);
    const row = await db.prepare('SELECT file_name, file_type, preview_name, preview_type, published FROM catalog_templates WHERE id = ?').bind(id).first<Pick<Row, 'file_name' | 'file_type' | 'preview_name' | 'preview_type' | 'published'>>();
    const name = part === 'file' ? row?.file_name : row?.preview_name;
    if (!row || !name) return json({ error: 'Not found.' }, 404);
    const { results } = await db.prepare('SELECT data FROM catalog_chunks WHERE id = ? AND part = ? ORDER BY n').bind(id, part).all<{ data: string }>();
    return new Response(results.map((r) => r.data).join(''), {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'x-file-name': encodeURIComponent(name),
        'x-file-type': (part === 'file' ? row.file_type : row.preview_type) ?? '',
        'x-catalog-published': row.published === 1 ? '1' : '0',
      },
    });
  }

  if (url.pathname === '/api/admin/template') {
    if (request.method === 'PUT') {
      let body: unknown;
      try {
        body = JSON.parse(await request.text());
      } catch {
        return json({ error: 'Bad JSON.' }, 400);
      }
      const parsed = parseDetails(body);
      if (!parsed.ok) return json({ error: parsed.error }, 400);
      const d = parsed.details;
      const existing = await db.prepare('SELECT studio FROM catalog_templates WHERE id = ?').bind(d.id).first<{ studio: string }>();
      const time = now();
      if (existing && existing.studio !== d.studio) return json({ error: 'A template cannot move to another studio.' }, 400);
      await db
        .prepare(
          'INSERT INTO catalog_templates (id, studio, format, name, description, category, tags, licence, fields, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET format = excluded.format, name = excluded.name, description = excluded.description, category = excluded.category, tags = excluded.tags, licence = excluded.licence, fields = excluded.fields, published = excluded.published, updated_at = excluded.updated_at',
        )
        .bind(d.id, d.studio, d.format, d.name, d.description, d.category, JSON.stringify(d.tags), d.licence, JSON.stringify(d.fields), d.published ? 1 : 0, time, time)
        .run();
      return json({ ok: true, id: d.id, updatedAt: time });
    }

    if (request.method === 'DELETE') {
      const id = url.searchParams.get('id') ?? '';
      if (!ID_PATTERN.test(id)) return json({ error: 'Bad id.' }, 400);
      await db.batch([db.prepare('DELETE FROM catalog_chunks WHERE id = ?').bind(id), db.prepare('DELETE FROM catalog_templates WHERE id = ?').bind(id)]);
      return json({ ok: true });
    }
  }

  if (url.pathname === '/api/admin/file' && request.method === 'PUT') {
    const id = url.searchParams.get('id') ?? '';
    const part = url.searchParams.get('part') ?? 'file';
    const name = url.searchParams.get('name') ?? '';
    const type = url.searchParams.get('type') ?? '';
    if (!ID_PATTERN.test(id) || (part !== 'file' && part !== 'preview')) return json({ error: 'Bad id or part.' }, 400);
    if (!FILE_NAME_PATTERN.test(name) || type.length > 100) return json({ error: 'Bad file name or type.' }, 400);
    const exists = await db.prepare('SELECT id FROM catalog_templates WHERE id = ?').bind(id).first();
    if (!exists) return json({ error: 'Save the template details first.' }, 404);
    const body = await request.text();
    if (body.length > (part === 'file' ? MAX_FILE_CHARS : MAX_PREVIEW_CHARS)) return json({ error: 'Too large.' }, 413);
    const parts = chunkText(body);
    const columns = part === 'file' ? 'file_name = ?, file_type = ?, file_chars = ?' : 'preview_name = ?, preview_type = ?, preview_chars = ?';
    await db.batch([
      db.prepare('DELETE FROM catalog_chunks WHERE id = ? AND part = ?').bind(id, part),
      ...parts.map((chunk, n) => db.prepare('INSERT INTO catalog_chunks (id, part, n, data) VALUES (?, ?, ?, ?)').bind(id, part, n, chunk)),
      db.prepare(`UPDATE catalog_templates SET ${columns}, updated_at = ? WHERE id = ?`).bind(name, type, body.length, now(), id),
    ]);
    return json({ ok: true, chars: body.length, chunks: parts.length });
  }

  return json({ error: 'Not found.' }, 404);
}
