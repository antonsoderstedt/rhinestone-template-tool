import { describe, expect, it } from 'vitest';
import { fillDays, groupDays, percent } from '../app/admin/statsView';
import { Tracker, type TrackerDeps } from '../app/lib/tracking/tracker';
import { loadThirdParty, mirrorEvent, type ThirdPartyWindow } from '../app/lib/tracking/thirdParty';
import { clearEvents, fetchStats, fetchTrackingSettings, saveTrackingSettings } from '../app/lib/tracking/trackingClient';
import { DEFAULT_TRACKING, type PublicTrackingConfig, type TrackEvent } from '../src/lib/tracking/trackingConfig';

const ON: PublicTrackingConfig = { ownEvents: true, ga4Id: '', gtmId: '', respectDoNotTrack: true };

function harness(nav: TrackerDeps['nav'] = {}) {
  const sent: TrackEvent[][] = [];
  const mirrored: TrackEvent[] = [];
  const started: PublicTrackingConfig[] = [];
  const timers = new Map<number, () => void>();
  let nextTimer = 1;
  const tracker = new Tracker({
    send: (events) => sent.push(events),
    mirror: (event) => mirrored.push(event),
    startThirdParty: (config) => started.push(config),
    schedule: (fn) => { timers.set(nextTimer, fn); return nextTimer++; },
    cancel: (handle) => { timers.delete(handle as number); },
    path: () => '/papercraft/',
    session: 'abcdef12-3456',
    nav,
  });
  const fire = () => { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } };
  return { tracker, sent, mirrored, started, timers, fire };
}

describe('Tracker', () => {
  it('keeps events until the settings arrive, then sends them in one batch after a short wait', () => {
    const h = harness();
    h.tracker.track('page_view');
    h.tracker.track('export', {}, 'svg');
    expect(h.sent).toHaveLength(0);
    h.tracker.configure(ON);
    expect(h.sent).toHaveLength(0);
    expect(h.timers.size).toBe(1);
    h.fire();
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]!.map((e) => e.name)).toEqual(['page_view', 'export']);
    expect(h.sent[0]![0]).toMatchObject({ path: '/papercraft', session: 'abcdef12-3456' });
  });

  it('batches in groups of 20 when flushed', () => {
    const h = harness();
    h.tracker.configure(ON);
    for (let i = 0; i < 45; i++) h.tracker.track('page_view');
    h.tracker.flush();
    expect(h.sent.map((b) => b.length)).toEqual([20, 20, 5]);
    expect(h.timers.size).toBe(0);
  });

  it('does nothing when the site has no tracking, or everything is off', () => {
    const none = harness();
    none.tracker.track('page_view');
    none.tracker.configure(null);
    none.tracker.track('page_view');
    none.tracker.flush();
    expect(none.sent).toHaveLength(0);

    const off = harness();
    off.tracker.configure({ ...ON, ownEvents: false });
    off.tracker.track('page_view');
    off.tracker.flush();
    expect(off.sent).toHaveLength(0);
    expect(off.mirrored).toHaveLength(0);
    expect(off.started).toHaveLength(0);
  });

  it('tracks nothing for a browser that asks not to be tracked, nor starts Google', () => {
    for (const nav of [{ doNotTrack: '1' }, { globalPrivacyControl: true }]) {
      const h = harness(nav);
      h.tracker.track('page_view');
      h.tracker.configure({ ...ON, ga4Id: 'G-ABCD1234' });
      h.tracker.track('export', {}, 'svg');
      h.tracker.flush();
      expect(h.sent).toHaveLength(0);
      expect(h.mirrored).toHaveLength(0);
      expect(h.started).toHaveLength(0);
    }
  });

  it('tracks a browser with Do Not Track when the owner does not respect it', () => {
    const h = harness({ doNotTrack: '1' });
    h.tracker.configure({ ...ON, respectDoNotTrack: false });
    h.tracker.track('page_view');
    h.tracker.flush();
    expect(h.sent).toHaveLength(1);
  });

  it('starts and feeds Google only when an id is set, also with own events off', () => {
    const h = harness();
    h.tracker.track('page_view');
    h.tracker.configure({ ...ON, ownEvents: false, gtmId: 'GTM-ABC123' });
    h.tracker.track('export', {}, 'svg');
    h.tracker.flush();
    expect(h.started).toHaveLength(1);
    expect(h.mirrored.map((e) => e.name)).toEqual(['page_view', 'export']);
    expect(h.sent).toHaveLength(0);
  });

  it('drops an event with a bad name and takes the path it is given', () => {
    const h = harness();
    h.tracker.configure(ON);
    h.tracker.track('Bad Name');
    h.tracker.track('page_view', {}, '', '/htv/');
    h.tracker.flush();
    expect(h.sent[0]).toHaveLength(1);
    expect(h.sent[0]![0]!.path).toBe('/htv');
  });

  it('keeps a limited number of events before the settings arrive', () => {
    const h = harness();
    for (let i = 0; i < 80; i++) h.tracker.track('page_view');
    h.tracker.configure(ON);
    h.tracker.flush();
    expect(h.sent.flat()).toHaveLength(50);
  });
});

describe('third parties', () => {
  const host = (win: ThirdPartyWindow) => {
    const scripts: string[] = [];
    return { scripts, host: { win, nowMs: 1_700_000_000_000, addScript: (src: string) => scripts.push(src) } };
  };

  it('does nothing without a valid id', () => {
    const win: ThirdPartyWindow = {};
    const h = host(win);
    expect(loadThirdParty({ ga4Id: '', gtmId: '' }, h.host)).toEqual({ ga4: false, gtm: false });
    expect(loadThirdParty({ ga4Id: 'x"><script>', gtmId: 'GTM' }, h.host)).toEqual({ ga4: false, gtm: false });
    expect(h.scripts).toEqual([]);
    expect(win.dataLayer).toBeUndefined();
  });

  it('loads Tag Manager as Google describes it', () => {
    const win: ThirdPartyWindow = {};
    const h = host(win);
    expect(loadThirdParty({ ga4Id: '', gtmId: 'GTM-ABC123' }, h.host)).toEqual({ ga4: false, gtm: true });
    expect(h.scripts).toEqual(['https://www.googletagmanager.com/gtm.js?id=GTM-ABC123']);
    expect(win.dataLayer).toEqual([{ 'gtm.start': 1_700_000_000_000, event: 'gtm.js' }]);
    expect(win.gtag).toBeUndefined();
  });

  it('loads Analytics with gtag and no automatic page view', () => {
    const win: ThirdPartyWindow = {};
    const h = host(win);
    expect(loadThirdParty({ ga4Id: 'G-ABCD1234', gtmId: '' }, h.host)).toEqual({ ga4: true, gtm: false });
    expect(h.scripts).toEqual(['https://www.googletagmanager.com/gtag/js?id=G-ABCD1234']);
    const layer = win.dataLayer as unknown[];
    expect(layer).toHaveLength(2);
    // gtag.js reads `arguments` objects, not arrays.
    expect(Array.isArray(layer[0])).toBe(false);
    expect(Array.from(layer[0] as ArrayLike<unknown>)[0]).toBe('js');
    expect(Array.from(layer[1] as ArrayLike<unknown>)).toEqual(['config', 'G-ABCD1234', { send_page_view: false }]);
  });

  const event: TrackEvent = { name: 'export', path: '/htv', label: 'svg', props: { n: 2, event: 'sneaky' }, session: '' };

  it('sends an event to Analytics when it is on, otherwise to the dataLayer', () => {
    const win: ThirdPartyWindow = {};
    const h = host(win);
    const started = loadThirdParty({ ga4Id: 'G-ABCD1234', gtmId: 'GTM-ABC123' }, h.host);
    mirrorEvent(started, win, event);
    const layer = win.dataLayer as unknown[];
    expect(Array.from(layer[layer.length - 1] as ArrayLike<unknown>)).toEqual(['event', 'export', { n: 2, event: 'sneaky', page_path: '/htv', label: 'svg' }]);

    const win2: ThirdPartyWindow = {};
    const started2 = loadThirdParty({ ga4Id: '', gtmId: 'GTM-ABC123' }, host(win2).host);
    mirrorEvent(started2, win2, event);
    expect((win2.dataLayer as unknown[]).pop()).toEqual({ n: 2, event: 'export', page_path: '/htv', label: 'svg' });
  });

  it('sends nothing when no service started', () => {
    const win: ThirdPartyWindow = { dataLayer: [] };
    mirrorEvent({ ga4: false, gtm: false }, win, event);
    expect(win.dataLayer).toEqual([]);
  });
});

describe('the statistics panel helpers', () => {
  it('fills the days without events with zeros', () => {
    const days = fillDays([{ day: '2026-11-25', events: 4, sessions: 2 }], '2026-11-24T10:00:00.000Z', 3);
    expect(days.map((d) => d.day)).toEqual(['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27']);
    expect(days.map((d) => d.events)).toEqual([0, 4, 0, 0]);
  });

  it('adds days up into fewer bars when there are many', () => {
    const days = Array.from({ length: 10 }, (_, i) => ({ day: `2026-11-${String(i + 1).padStart(2, '0')}`, events: 1, sessions: 1 }));
    expect(groupDays(days, 20)).toBe(days);
    const grouped = groupDays(days, 4);
    expect(grouped).toHaveLength(4);
    expect(grouped.reduce((s, d) => s + d.events, 0)).toBe(10);
    expect(grouped[0]!.day).toBe('2026-11-01');
  });

  it('works out a share', () => {
    expect(percent(1, 4)).toBe(25);
    expect(percent(5, 4)).toBe(100);
    expect(percent(1, 0)).toBe(0);
  });
});

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('the admin client', () => {
  it('reads the statistics', async () => {
    const stats = { days: 30, totals: { events: 1 }, perDay: [], byEvent: [] };
    const result = await fetchStats(30, async (url) => { expect(String(url)).toBe('/api/admin/stats?days=30'); return jsonResponse(stats); });
    expect(result).toEqual({ ok: true, value: stats });
  });

  it('says unavailable for a static host that answers with a page, signin for 403, error otherwise', async () => {
    expect(await fetchStats(30, async () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }))).toEqual({ ok: false, reason: 'unavailable' });
    expect(await fetchStats(30, async () => jsonResponse({ error: 'no' }, 403))).toMatchObject({ ok: false, reason: 'signin' });
    expect(await fetchStats(30, async () => jsonResponse({}, 500))).toMatchObject({ ok: false, reason: 'error' });
    expect(await fetchStats(30, async () => jsonResponse({ nonsense: true }))).toEqual({ ok: false, reason: 'error' });
    expect(await fetchStats(30, async () => { throw new Error('offline'); })).toEqual({ ok: false, reason: 'error' });
  });

  it('reads and saves the settings, passing the server message on', async () => {
    expect(await fetchTrackingSettings(async () => jsonResponse({ settings: DEFAULT_TRACKING }))).toEqual({ ok: true, value: DEFAULT_TRACKING });
    const saved = await saveTrackingSettings(DEFAULT_TRACKING, async (_url, init) => {
      expect(init?.method).toBe('PUT');
      expect(JSON.parse(init?.body as string)).toEqual(DEFAULT_TRACKING);
      return jsonResponse({ ok: true, settings: DEFAULT_TRACKING });
    });
    expect(saved).toEqual({ ok: true, value: DEFAULT_TRACKING });
    expect(await saveTrackingSettings(DEFAULT_TRACKING, async () => jsonResponse({ error: 'The Google Analytics id looks like G-XXXXXXXXXX.' }, 400))).toEqual({ ok: false, reason: 'error', message: 'The Google Analytics id looks like G-XXXXXXXXXX.' });
  });

  it('deletes the events and says how many', async () => {
    expect(await clearEvents(async (_url, init) => { expect(init?.method).toBe('DELETE'); return jsonResponse({ ok: true, removed: 5 }); })).toEqual({ ok: true, value: 5 });
    expect(await clearEvents(async () => jsonResponse({}, 500))).toMatchObject({ ok: false });
  });
});
