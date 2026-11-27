/**
 * The one function the app calls to record something: `track('export', {}, 'svg')`. It is a no-op everywhere except the private
 * site (NEXT_PUBLIC_SYNC_ENABLED=1, set by scripts/deploy-private.sh), on the server, and until the owner has switched tracking on.
 */

import { withBasePath } from '@/src/lib/rhinestone-engine/deploy/basePath';
import type { EventValue, PublicTrackingConfig, TrackEvent } from '@/src/lib/tracking/trackingConfig';
import { loadThirdParty, mirrorEvent, type ThirdPartyWindow } from './thirdParty';
import { Tracker } from './tracker';

const SESSION_KEY = 'rt-track-session';
let tracker: Tracker | null = null;

const enabled = () => typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SYNC_ENABLED === '1';

/** A random id for this tab's visit (kept for the tab only; not tied to a person). */
function sessionId(): string {
  try {
    const kept = window.sessionStorage.getItem(SESSION_KEY);
    if (kept) return kept;
    const made = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    window.sessionStorage.setItem(SESSION_KEY, made);
    return made;
  } catch {
    return `s-${Date.now().toString(36)}`;
  }
}

function build(): Tracker {
  const win = window as unknown as ThirdPartyWindow;
  let started = { ga4: false, gtm: false };
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  const instance = new Tracker({
    send: (events: TrackEvent[]) => {
      void fetch(withBasePath('/api/track/event'), {
        method: 'POST',
        keepalive: true,
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ events }),
      }).catch(() => undefined);
    },
    mirror: (event) => mirrorEvent(started, win, event),
    startThirdParty: (config: PublicTrackingConfig) => {
      started = loadThirdParty(config, {
        win,
        nowMs: Date.now(),
        addScript: (src) => {
          const script = document.createElement('script');
          script.async = true;
          script.src = src;
          document.head.appendChild(script);
        },
      });
    },
    schedule: (fn, ms) => window.setTimeout(fn, ms),
    cancel: (handle) => window.clearTimeout(handle as number),
    path: () => window.location.pathname,
    session: sessionId(),
    nav: { doNotTrack: nav.doNotTrack ?? (window as unknown as { doNotTrack?: string }).doNotTrack ?? null, globalPrivacyControl: nav.globalPrivacyControl },
  });
  return instance;
}

function get(): Tracker | null {
  if (!enabled()) return null;
  tracker ??= build();
  return tracker;
}

/** `path` is for a page view, where the router knows the new page before the address bar does. */
export function track(name: string, props: Record<string, EventValue> = {}, label = '', path?: string): void {
  get()?.track(name, props, label, path);
}

/** The file type of an export, for the statistics: `track('export', {}, 'svg')`. */
export function trackExport(fileName: string, props: Record<string, EventValue> = {}): void {
  const dot = fileName.lastIndexOf('.');
  const format = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : 'file';
  track('export', props, /^[a-z0-9]{1,12}$/.test(format) ? format : 'file');
}

/** Called once by TrackingManager: reads the settings and starts (or not). */
export async function startTracking(fetcher: typeof fetch = fetch): Promise<void> {
  const instance = get();
  if (!instance) return;
  try {
    const response = await fetcher(withBasePath('/api/track/config'), { cache: 'no-store', credentials: 'same-origin' });
    const isJson = (response.headers.get('content-type') ?? '').includes('application/json');
    if (!response.ok || !isJson) return instance.configure(null);
    instance.configure((await response.json()) as PublicTrackingConfig);
  } catch {
    instance.configure(null);
  }
}

export function flushTracking(): void {
  tracker?.flush();
}
