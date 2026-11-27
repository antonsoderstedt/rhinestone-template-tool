import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TRACKING,
  cleanPath,
  configFromStored,
  isGa4Id,
  isGtmId,
  parseTrackingConfig,
  publicConfigOf,
  sanitizeBatch,
  sanitizeEvent,
  studioOfPath,
  trackingBlocked,
} from '../src/lib/tracking/trackingConfig';

describe('ids', () => {
  it('knows a GA4 and a GTM id', () => {
    expect(isGa4Id('G-ABCD123456')).toBe(true);
    expect(isGa4Id('UA-12345-1')).toBe(false);
    expect(isGa4Id('g-abcd123456')).toBe(false);
    expect(isGtmId('GTM-ABC123')).toBe(true);
    expect(isGtmId('GTM-')).toBe(false);
    expect(isGtmId('G-ABCD123456')).toBe(false);
    expect(isGa4Id('G-ABCD"><script>')).toBe(false);
  });
});

describe('parseTrackingConfig', () => {
  it('uses the defaults for an empty object, and trims and upper-cases ids', () => {
    expect(parseTrackingConfig({})).toEqual({ ok: true, config: DEFAULT_TRACKING });
    const r = parseTrackingConfig({ ga4Id: ' g-abcd1234 ', gtmId: 'gtm-abc123', retentionDays: 30 });
    expect(r.ok && r.config).toMatchObject({ ga4Id: 'G-ABCD1234', gtmId: 'GTM-ABC123', retentionDays: 30 });
  });

  it('refuses bad ids, odd flags and a retention outside 7–730 days', () => {
    for (const bad of [
      { ga4Id: 'nope' },
      { gtmId: 'GTM-' },
      { ga4Id: 5 },
      { ownEvents: 'yes' },
      { respectDoNotTrack: 1 },
      { retentionDays: 3 },
      { retentionDays: 800 },
      { retentionDays: 30.5 },
      { retentionDays: '30' },
      null,
      [],
      'x',
    ]) {
      expect(parseTrackingConfig(bad).ok, JSON.stringify(bad)).toBe(false);
    }
  });

  it('reads stored settings, falling back to the defaults for anything broken', () => {
    expect(configFromStored(null)).toEqual(DEFAULT_TRACKING);
    expect(configFromStored('not json')).toEqual(DEFAULT_TRACKING);
    expect(configFromStored(JSON.stringify({ ga4Id: 'bad' }))).toEqual(DEFAULT_TRACKING);
    expect(configFromStored(JSON.stringify({ ...DEFAULT_TRACKING, gtmId: 'GTM-ABC123' })).gtmId).toBe('GTM-ABC123');
  });

  it('gives browsers the ids and the flags, not the retention', () => {
    expect(publicConfigOf({ ...DEFAULT_TRACKING, ga4Id: 'G-ABCD1234' })).toEqual({ ownEvents: true, ga4Id: 'G-ABCD1234', gtmId: '', respectDoNotTrack: true });
  });
});

describe('trackingBlocked', () => {
  it('blocks Do Not Track and Global Privacy Control only when the owner respects them', () => {
    expect(trackingBlocked({ respectDoNotTrack: true }, { doNotTrack: '1' })).toBe(true);
    expect(trackingBlocked({ respectDoNotTrack: true }, { globalPrivacyControl: true })).toBe(true);
    expect(trackingBlocked({ respectDoNotTrack: true }, { doNotTrack: '0' })).toBe(false);
    expect(trackingBlocked({ respectDoNotTrack: true }, {})).toBe(false);
    expect(trackingBlocked({ respectDoNotTrack: false }, { doNotTrack: '1', globalPrivacyControl: true })).toBe(false);
  });
});

describe('paths', () => {
  it('works out the studio of a page', () => {
    expect(studioOfPath('/')).toBe('home');
    expect(studioOfPath('')).toBe('home');
    expect(studioOfPath('/papercraft')).toBe('papercraft');
    expect(studioOfPath('/papercraft/draw/')).toBe('papercraft');
    expect(studioOfPath('/htv')).toBe('htv');
    expect(studioOfPath('/editor/')).toBe('rhinestone');
    expect(studioOfPath('/designs')).toBe('rhinestone');
    expect(studioOfPath('/settings')).toBe('settings');
    expect(studioOfPath('/admin')).toBe('admin');
    expect(studioOfPath('/whatever?x=1')).toBe('other');
    expect(studioOfPath('/papercraft?x=1#y')).toBe('papercraft');
  });

  it('keeps only the path', () => {
    expect(cleanPath('/papercraft/?model=1#top')).toBe('/papercraft');
    expect(cleanPath('editor')).toBe('/editor');
    expect(cleanPath('/')).toBe('/');
    expect(cleanPath(`/${'a'.repeat(300)}`).length).toBe(120);
  });
});

describe('sanitizeEvent', () => {
  const good = { name: 'export', path: '/htv/?x=1', label: ' svg ', props: { studio: 'htv', n: 3, ok: true }, session: 'abcdef12-3456' };

  it('keeps a good event, cleaned', () => {
    expect(sanitizeEvent(good)).toEqual({ name: 'export', path: '/htv', label: 'svg', props: { studio: 'htv', n: 3, ok: true }, session: 'abcdef12-3456' });
  });

  it('drops an event with a bad name, and a non-object', () => {
    for (const bad of [{ ...good, name: 'Export' }, { ...good, name: '' }, { ...good, name: 'a b' }, { ...good, name: 'x'.repeat(41) }, { path: '/' }, null, 'x', [], 5]) {
      expect(sanitizeEvent(bad)).toBeNull();
    }
  });

  it('empties a bad session and removes odd props, long texts and surplus props', () => {
    const e = sanitizeEvent({ ...good, session: '<script>', props: { Bad: 1, ok_key: 'x'.repeat(500), obj: {}, nan: Number.NaN, fn: 1, ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`k${i}`, i])) } });
    expect(e?.session).toBe('');
    expect(e?.props.Bad).toBeUndefined();
    expect((e?.props.ok_key as string).length).toBe(100);
    expect(e?.props.obj).toBeUndefined();
    expect(e?.props.nan).toBeUndefined();
    expect(Object.keys(e?.props ?? {}).length).toBeLessThanOrEqual(8);
  });

  it('shortens a long label', () => {
    expect(sanitizeEvent({ ...good, label: 'l'.repeat(200) })?.label.length).toBe(80);
  });
});

describe('sanitizeBatch', () => {
  it('takes 1–20 events and leaves the bad ones out', () => {
    const e = { name: 'page_view', path: '/' };
    expect(sanitizeBatch({ events: [e, { name: 'BAD' }, e] })?.length).toBe(2);
    expect(sanitizeBatch({ events: [] })).toBeNull();
    expect(sanitizeBatch({ events: Array.from({ length: 21 }, () => e) })).toBeNull();
    expect(sanitizeBatch({ events: 'x' })).toBeNull();
    expect(sanitizeBatch(null)).toBeNull();
    expect(sanitizeBatch({})).toBeNull();
  });
});
