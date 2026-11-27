/**
 * Statistics and tracking (ADR 0060): our own events in the private database, and the settings for Google Analytics / Tag Manager.
 *
 *   GET    /api/track/config                 what a browser needs: which services are on (no retention)
 *   POST   /api/track/event                  body {events: [...]}; stores the events when own events are on
 *   GET    /api/admin/tracking               all the tracking settings
 *   PUT    /api/admin/tracking               body: the settings
 *   GET    /api/admin/stats?days=            counts over the last days (computed by the database, nothing is parsed here)
 *   DELETE /api/admin/events                 removes every stored event
 *
 * Privacy: an event has no IP address and no user agent. The signed-in person is stored only as a short one-way hash (to count
 * how many people), and the visit as a random id the browser made up for that tab.
 */

import { checkAccess } from './access';
import {
  configFromStored,
  parseTrackingConfig,
  publicConfigOf,
  sanitizeBatch,
  studioOfPath,
  type TrackingConfig,
} from '../src/lib/tracking/trackingConfig';
import type { D1Database, SyncEnv } from './types';

const MAX_BODY_CHARS = 16_000;
const DAY_MS = 86_400_000;
const PRUNE_EVERY_MS = 60 * 60 * 1000;
const CONFIG_TTL_MS = 30_000;
const SETTINGS_KEY = 'tracking';

let schemaReady = false;
let lastPrune = 0;
let configCache: { at: number; config: TrackingConfig } | null = null;

async function ensureSchema(db: D1Database): Promise<void> {
  if (schemaReady) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)"),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, name TEXT NOT NULL, studio TEXT NOT NULL, path TEXT NOT NULL DEFAULT '', label TEXT NOT NULL DEFAULT '', props TEXT NOT NULL DEFAULT '{}', session TEXT NOT NULL DEFAULT '', user TEXT NOT NULL DEFAULT '')",
    ),
    db.prepare('CREATE INDEX IF NOT EXISTS events_ts ON events (ts)'),
    db.prepare('CREATE INDEX IF NOT EXISTS events_name_ts ON events (name, ts)'),
  ]);
  schemaReady = true;
}

/** For tests. */
export function resetTrackState(): void {
  schemaReady = false;
  lastPrune = 0;
  configCache = null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

async function loadConfig(db: D1Database, nowMs: number): Promise<TrackingConfig> {
  if (configCache && nowMs - configCache.at < CONFIG_TTL_MS) return configCache.config;
  const row = await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind(SETTINGS_KEY).first<{ value: string }>();
  const config = configFromStored(row?.value);
  configCache = { at: nowMs, config };
  return config;
}

/** A short one-way fingerprint of the signed-in person, to count people without storing who they are. */
export async function hashOwner(owner: string): Promise<string> {
  const bytes = new TextEncoder().encode(`rhinestone-studio:${owner}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function pruneOld(db: D1Database, config: TrackingConfig, nowMs: number): Promise<void> {
  if (nowMs - lastPrune < PRUNE_EVERY_MS) return;
  lastPrune = nowMs;
  const cutoff = new Date(nowMs - config.retentionDays * DAY_MS).toISOString();
  await db.prepare('DELETE FROM events WHERE ts < ?').bind(cutoff).run();
}

interface Count { n: number }

export async function handleTrack(request: Request, env: SyncEnv, fetcher: typeof fetch = fetch, now: () => string = () => new Date().toISOString()): Promise<Response> {
  const access = await checkAccess(request, env, fetcher);
  if (!access.ok) return json({ error: access.message }, access.status);
  const url = new URL(request.url);
  const db = env.DB;
  await ensureSchema(db);
  const time = now();
  const nowMs = Date.parse(time);

  if (url.pathname === '/api/track/config' && request.method === 'GET') {
    return json(publicConfigOf(await loadConfig(db, nowMs)));
  }

  if (url.pathname === '/api/track/event' && request.method === 'POST') {
    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) return json({ error: 'Too large.' }, 413);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: 'Bad JSON.' }, 400);
    }
    const events = sanitizeBatch(body);
    if (!events) return json({ error: 'Bad events.' }, 400);
    const config = await loadConfig(db, nowMs);
    if (!config.ownEvents || events.length === 0) return json({ ok: true, stored: 0 });

    const user = await hashOwner(access.owner);
    await db.batch(
      events.map((e) =>
        db
          .prepare('INSERT INTO events (ts, name, studio, path, label, props, session, user) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(time, e.name, studioOfPath(e.path), e.path, e.label, JSON.stringify(e.props), e.session, user),
      ),
    );
    await pruneOld(db, config, nowMs);
    return json({ ok: true, stored: events.length });
  }

  if (url.pathname === '/api/admin/tracking') {
    if (request.method === 'GET') return json({ settings: await loadConfig(db, nowMs) });
    if (request.method === 'PUT') {
      let body: unknown;
      try {
        body = JSON.parse(await request.text());
      } catch {
        return json({ error: 'Bad JSON.' }, 400);
      }
      const parsed = parseTrackingConfig(body);
      if (!parsed.ok) return json({ error: parsed.error }, 400);
      await db
        .prepare('INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
        .bind(SETTINGS_KEY, JSON.stringify(parsed.config), time)
        .run();
      configCache = { at: nowMs, config: parsed.config };
      lastPrune = 0; // a shorter retention should take effect at the next event
      return json({ ok: true, settings: parsed.config });
    }
  }

  if (url.pathname === '/api/admin/stats' && request.method === 'GET') {
    const asked = Number(url.searchParams.get('days') ?? '30');
    const days = Number.isInteger(asked) && asked >= 1 && asked <= 365 ? asked : 30;
    const since = new Date(nowMs - days * DAY_MS).toISOString();
    const config = await loadConfig(db, nowMs);
    await pruneOld(db, config, nowMs);

    const [totals, perDay, byEvent, byStudio, topPages, topLabels, oldest] = await Promise.all([
      db
        .prepare("SELECT COUNT(*) AS events, COUNT(DISTINCT NULLIF(session, '')) AS sessions, COUNT(DISTINCT NULLIF(user, '')) AS users, SUM(name = 'page_view') AS pageViews, SUM(name = 'export') AS exports FROM events WHERE ts >= ?")
        .bind(since)
        .first<{ events: number; sessions: number; users: number; pageViews: number | null; exports: number | null }>(),
      db
        .prepare("SELECT substr(ts, 1, 10) AS day, COUNT(*) AS events, COUNT(DISTINCT NULLIF(session, '')) AS sessions FROM events WHERE ts >= ? GROUP BY day ORDER BY day")
        .bind(since)
        .all<{ day: string; events: number; sessions: number }>(),
      db.prepare('SELECT name, COUNT(*) AS count FROM events WHERE ts >= ? GROUP BY name ORDER BY count DESC, name LIMIT 40').bind(since).all<{ name: string; count: number }>(),
      db
        .prepare("SELECT studio, COUNT(*) AS events, COUNT(DISTINCT NULLIF(session, '')) AS sessions FROM events WHERE ts >= ? GROUP BY studio ORDER BY events DESC")
        .bind(since)
        .all<{ studio: string; events: number; sessions: number }>(),
      db
        .prepare("SELECT path, COUNT(*) AS views FROM events WHERE ts >= ? AND name = 'page_view' GROUP BY path ORDER BY views DESC, path LIMIT 20")
        .bind(since)
        .all<{ path: string; views: number }>(),
      db
        .prepare("SELECT name, label, COUNT(*) AS count FROM events WHERE ts >= ? AND label != '' AND name != 'page_view' GROUP BY name, label ORDER BY count DESC, name, label LIMIT 40")
        .bind(since)
        .all<{ name: string; label: string; count: number }>(),
      db.prepare('SELECT MIN(ts) AS oldest, COUNT(*) AS n FROM events').first<{ oldest: string | null; n: number }>(),
    ]);

    return json({
      days,
      since,
      retentionDays: config.retentionDays,
      ownEvents: config.ownEvents,
      stored: oldest?.n ?? 0,
      oldest: oldest?.oldest ?? null,
      totals: {
        events: totals?.events ?? 0,
        sessions: totals?.sessions ?? 0,
        users: totals?.users ?? 0,
        pageViews: totals?.pageViews ?? 0,
        exports: totals?.exports ?? 0,
      },
      perDay: perDay.results,
      byEvent: byEvent.results,
      byStudio: byStudio.results,
      topPages: topPages.results,
      topLabels: topLabels.results,
    });
  }

  if (url.pathname === '/api/admin/events' && request.method === 'DELETE') {
    const before = await db.prepare('SELECT COUNT(*) AS n FROM events').first<Count>();
    await db.prepare('DELETE FROM events').run();
    return json({ ok: true, removed: before?.n ?? 0 });
  }

  return json({ error: 'Not found.' }, 404);
}
