/** Talks to the statistics and tracking API of the private site (`worker/track.ts`). Everything takes the fetch function, so it can be tested. */

import { withBasePath } from '@/src/lib/rhinestone-engine/deploy/basePath';
import type { TrackingConfig } from '@/src/lib/tracking/trackingConfig';

/** `unavailable`: this site has no tracking server (GitHub Pages, local development without the Worker). `signin`: Access refused. */
export type TrackingFailure = 'unavailable' | 'signin' | 'error';
export type TrackingResult<T> = { ok: true; value: T } | { ok: false; reason: TrackingFailure; message?: string };

export interface Stats {
  days: number;
  since: string;
  retentionDays: number;
  ownEvents: boolean;
  /** Every event in the database, whatever the period. */
  stored: number;
  oldest: string | null;
  totals: { events: number; sessions: number; users: number; pageViews: number; exports: number };
  perDay: { day: string; events: number; sessions: number }[];
  byEvent: { name: string; count: number }[];
  byStudio: { studio: string; events: number; sessions: number }[];
  topPages: { path: string; views: number }[];
  topLabels: { name: string; label: string; count: number }[];
}

type Failed = { ok: false; reason: TrackingFailure; message?: string };

export async function failureOf(response: Response): Promise<Failed> {
  const reason: TrackingFailure = response.status === 401 || response.status === 403 ? 'signin' : response.status === 404 ? 'unavailable' : 'error';
  try {
    const body = (await response.json()) as { error?: string };
    return { ok: false, reason, message: body.error };
  } catch {
    return { ok: false, reason };
  }
}

const isJson = (response: Response) => (response.headers.get('content-type') ?? '').includes('application/json');

export async function getJson<T>(path: string, pick: (body: unknown) => T | null, fetcher: typeof fetch): Promise<TrackingResult<T>> {
  try {
    const response = await fetcher(withBasePath(path), { cache: 'no-store', credentials: 'same-origin' });
    // A static host answers an unknown path with its 404 page (HTML): there is no tracking server here.
    if (response.ok && !isJson(response)) return { ok: false, reason: 'unavailable' };
    if (!response.ok) return await failureOf(response);
    const value = pick(await response.json());
    return value === null ? { ok: false, reason: 'error' } : { ok: true, value };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export function fetchStats(days: number, fetcher: typeof fetch = fetch): Promise<TrackingResult<Stats>> {
  return getJson(`/api/admin/stats?days=${days}`, (body) => {
    const b = body as Partial<Stats> | null;
    return b && typeof b === 'object' && b.totals && Array.isArray(b.perDay) && Array.isArray(b.byEvent) ? (b as Stats) : null;
  }, fetcher);
}

export function fetchTrackingSettings(fetcher: typeof fetch = fetch): Promise<TrackingResult<TrackingConfig>> {
  return getJson('/api/admin/tracking', (body) => {
    const settings = (body as { settings?: TrackingConfig } | null)?.settings;
    return settings && typeof settings === 'object' ? settings : null;
  }, fetcher);
}

export async function saveTrackingSettings(settings: TrackingConfig, fetcher: typeof fetch = fetch): Promise<TrackingResult<TrackingConfig>> {
  try {
    const response = await fetcher(withBasePath('/api/admin/tracking'), { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(settings) });
    if (!response.ok) return await failureOf(response);
    const body = (await response.json()) as { settings?: TrackingConfig };
    return { ok: true, value: body.settings ?? settings };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

export async function clearEvents(fetcher: typeof fetch = fetch): Promise<TrackingResult<number>> {
  try {
    const response = await fetcher(withBasePath('/api/admin/events'), { method: 'DELETE', credentials: 'same-origin' });
    if (!response.ok) return await failureOf(response);
    const body = (await response.json()) as { removed?: number };
    return { ok: true, value: body.removed ?? 0 };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
