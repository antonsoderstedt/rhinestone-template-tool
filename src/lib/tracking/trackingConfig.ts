/**
 * Tracking: what the owner can switch on (own events in the database, Google Analytics 4, Google Tag Manager) and what an event
 * looks like. Pure functions, shared by the Worker (which validates what it stores) and the browser (which builds what it sends).
 * See docs/decisions/0060-statistics-and-tracking.md.
 */

export interface TrackingConfig {
  /** Keep our own events in the private database. */
  ownEvents: boolean;
  /** Google Analytics 4 measurement id (G-XXXXXXXX), or empty. */
  ga4Id: string;
  /** Google Tag Manager container id (GTM-XXXXXXX), or empty. */
  gtmId: string;
  /** Track nothing when the browser sends Do Not Track or Global Privacy Control. */
  respectDoNotTrack: boolean;
  /** Own events older than this many days are deleted. */
  retentionDays: number;
}

export const DEFAULT_TRACKING: TrackingConfig = { ownEvents: true, ga4Id: '', gtmId: '', respectDoNotTrack: true, retentionDays: 180 };
export const RETENTION_RANGE = { min: 7, max: 730 } as const;

export const isGa4Id = (value: string): boolean => /^G-[A-Z0-9]{4,14}$/.test(value);
export const isGtmId = (value: string): boolean => /^GTM-[A-Z0-9]{4,10}$/.test(value);

export type ConfigResult = { ok: true; config: TrackingConfig } | { ok: false; error: string };

/** Checks the settings the admin panel sends. Ids are trimmed and upper-cased; an empty id switches that service off. */
export function parseTrackingConfig(raw: unknown): ConfigResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'Settings must be an object.' };
  const o = raw as Record<string, unknown>;
  const text = (key: string): string | null => (o[key] === undefined || o[key] === null ? '' : typeof o[key] === 'string' ? (o[key] as string).trim().toUpperCase() : null);
  const flag = (key: string, fallback: boolean): boolean | null => (o[key] === undefined ? fallback : typeof o[key] === 'boolean' ? (o[key] as boolean) : null);

  const ga4Id = text('ga4Id');
  const gtmId = text('gtmId');
  if (ga4Id === null || (ga4Id !== '' && !isGa4Id(ga4Id))) return { ok: false, error: 'The Google Analytics id looks like G-XXXXXXXXXX.' };
  if (gtmId === null || (gtmId !== '' && !isGtmId(gtmId))) return { ok: false, error: 'The Tag Manager id looks like GTM-XXXXXXX.' };
  const ownEvents = flag('ownEvents', DEFAULT_TRACKING.ownEvents);
  const respectDoNotTrack = flag('respectDoNotTrack', DEFAULT_TRACKING.respectDoNotTrack);
  if (ownEvents === null || respectDoNotTrack === null) return { ok: false, error: 'A setting must be on or off.' };

  const days = o.retentionDays === undefined ? DEFAULT_TRACKING.retentionDays : o.retentionDays;
  if (typeof days !== 'number' || !Number.isInteger(days) || days < RETENTION_RANGE.min || days > RETENTION_RANGE.max) {
    return { ok: false, error: `Keep the events for ${RETENTION_RANGE.min} to ${RETENTION_RANGE.max} days.` };
  }
  return { ok: true, config: { ownEvents, ga4Id, gtmId, respectDoNotTrack, retentionDays: days } };
}

/** A settings text read back from the database: anything that does not pass falls back to the defaults. */
export function configFromStored(text: string | null | undefined): TrackingConfig {
  if (!text) return { ...DEFAULT_TRACKING };
  try {
    const parsed = parseTrackingConfig(JSON.parse(text));
    return parsed.ok ? parsed.config : { ...DEFAULT_TRACKING };
  } catch {
    return { ...DEFAULT_TRACKING };
  }
}

/** The part of the settings every visitor's browser needs (the retention is not a browser matter). */
export type PublicTrackingConfig = Pick<TrackingConfig, 'ownEvents' | 'ga4Id' | 'gtmId' | 'respectDoNotTrack'>;

export const publicConfigOf = (config: TrackingConfig): PublicTrackingConfig => ({
  ownEvents: config.ownEvents,
  ga4Id: config.ga4Id,
  gtmId: config.gtmId,
  respectDoNotTrack: config.respectDoNotTrack,
});

/** True when this browser has asked not to be tracked and the owner has chosen to respect that. */
export function trackingBlocked(config: Pick<TrackingConfig, 'respectDoNotTrack'>, nav: { doNotTrack?: string | null; globalPrivacyControl?: boolean }): boolean {
  if (!config.respectDoNotTrack) return false;
  return nav.doNotTrack === '1' || nav.doNotTrack === 'yes' || nav.globalPrivacyControl === true;
}

// ---------------------------------------------------------------------------------------------------------------------
// Events

export type EventValue = string | number | boolean;

export interface TrackEvent {
  /** snake_case, for example page_view, export, catalog_template_used. */
  name: string;
  /** The page the event happened on (no query, no hash). */
  path: string;
  /** One short value to count by: the file format of an export, the id of a template. */
  label: string;
  props: Record<string, EventValue>;
  /** A random id for this tab's visit, to count visits. Not tied to a person. */
  session: string;
}

export const EVENT_LIMITS = { name: 40, path: 120, label: 80, propKeys: 8, propKey: 30, propText: 100, batch: 20, propsJson: 600 } as const;
const NAME_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
const PROP_KEY_PATTERN = /^[a-z][a-z0-9_]{0,29}$/;
const SESSION_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export type Studio = 'rhinestone' | 'htv' | 'papercraft' | 'settings' | 'admin' | 'home' | 'other';

/** Which part of the site a page belongs to. The Worker works this out itself, so a browser cannot make up a studio. */
export function studioOfPath(path: string): Studio {
  const clean = path.split(/[?#]/)[0]!.replace(/\/+$/, '');
  if (clean === '') return 'home';
  const first = clean.split('/')[1] ?? '';
  switch (first) {
    case 'papercraft':
      return 'papercraft';
    case 'htv':
      return 'htv';
    case 'editor':
    case 'rhinestone':
    case 'designs':
    case 'library':
    case 'fonts':
    case 'setup':
      return 'rhinestone';
    case 'settings':
      return 'settings';
    case 'admin':
      return 'admin';
    default:
      return 'other';
  }
}

/** Strips a path to what is worth keeping: no query, no hash, a leading slash, no trailing slash, a limited length. */
export function cleanPath(path: string): string {
  const base = path.split(/[?#]/)[0]!.trim();
  const slashed = base.startsWith('/') ? base : `/${base}`;
  const trimmed = slashed.length > 1 ? slashed.replace(/\/+$/, '') : slashed;
  return trimmed.slice(0, EVENT_LIMITS.path) || '/';
}

/** Checks one event from a browser. Returns what is safe to store, or null when it should be dropped. */
export function sanitizeEvent(raw: unknown): TrackEvent | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.name !== 'string' || !NAME_PATTERN.test(o.name)) return null;

  const path = typeof o.path === 'string' ? cleanPath(o.path) : '/';
  const label = typeof o.label === 'string' ? o.label.trim().slice(0, EVENT_LIMITS.label) : '';
  const session = typeof o.session === 'string' && SESSION_PATTERN.test(o.session) ? o.session : '';

  const props: Record<string, EventValue> = {};
  if (typeof o.props === 'object' && o.props !== null && !Array.isArray(o.props)) {
    for (const [key, value] of Object.entries(o.props as Record<string, unknown>)) {
      if (Object.keys(props).length >= EVENT_LIMITS.propKeys) break;
      if (!PROP_KEY_PATTERN.test(key)) continue;
      if (typeof value === 'string') props[key] = value.slice(0, EVENT_LIMITS.propText);
      else if (typeof value === 'number' && Number.isFinite(value)) props[key] = value;
      else if (typeof value === 'boolean') props[key] = value;
    }
  }
  if (JSON.stringify(props).length > EVENT_LIMITS.propsJson) return null;
  return { name: o.name, path, label, props, session };
}

/** The events of one request: at most EVENT_LIMITS.batch, the bad ones left out. */
export function sanitizeBatch(raw: unknown): TrackEvent[] | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const list = (raw as { events?: unknown }).events;
  if (!Array.isArray(list) || list.length === 0 || list.length > EVENT_LIMITS.batch) return null;
  return list.map(sanitizeEvent).filter((e): e is TrackEvent => e !== null);
}
