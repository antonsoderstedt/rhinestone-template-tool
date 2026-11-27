'use client';

import { useEffect, useState } from 'react';
import { WorkspaceEmptyState, WorkspaceSurface, workspaceInputClassName } from '../components/workspace/WorkspaceChrome';
import { useT } from '../lib/i18n';
import { fetchTrackingSettings, saveTrackingSettings, type TrackingFailure } from '../lib/tracking/trackingClient';
import { DEFAULT_TRACKING, RETENTION_RANGE, isGa4Id, isGtmId, type TrackingConfig } from '@/src/lib/tracking/trackingConfig';

type Load = { state: 'loading' } | { state: 'ready'; settings: TrackingConfig } | { state: 'failed'; reason: TrackingFailure };

const label = 'mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted';

export default function TrackingAdmin() {
  const t = useT();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [draft, setDraft] = useState<TrackingConfig>(DEFAULT_TRACKING);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchTrackingSettings().then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setDraft(result.value);
        setLoad({ state: 'ready', settings: result.value });
      } else setLoad({ state: 'failed', reason: result.reason });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (load.state === 'loading') return <p className="px-2 text-sm text-ink-secondary" role="status">{t('Loading the settings…')}</p>;
  if (load.state === 'failed') {
    return (
      <WorkspaceEmptyState
        title={load.reason === 'signin' ? t('Sign in to open the tracking settings') : load.reason === 'unavailable' ? t('Tracking needs the private site') : t('The tracking settings could not be loaded')}
        description={
          load.reason === 'signin'
            ? t('Cloudflare Access did not let this request through. Reload the page and sign in.')
            : load.reason === 'unavailable'
              ? t('The settings are kept in the database of your private Cloudflare site. Open the admin panel there (or run scripts/deploy-private.sh --dev locally).')
              : t('Something went wrong when the settings were asked for. Try again in a moment.')
        }
      />
    );
  }

  const ga4 = draft.ga4Id.trim().toUpperCase();
  const gtm = draft.gtmId.trim().toUpperCase();
  const ga4Bad = ga4 !== '' && !isGa4Id(ga4);
  const gtmBad = gtm !== '' && !isGtmId(gtm);
  const retentionBad = !Number.isInteger(draft.retentionDays) || draft.retentionDays < RETENTION_RANGE.min || draft.retentionDays > RETENTION_RANGE.max;
  const changed = JSON.stringify({ ...draft, ga4Id: ga4, gtmId: gtm }) !== JSON.stringify(load.settings);

  const save = async () => {
    if (ga4Bad || gtmBad || retentionBad) return;
    setBusy(true);
    setMessage(null);
    const result = await saveTrackingSettings({ ...draft, ga4Id: ga4, gtmId: gtm });
    setBusy(false);
    if (result.ok) {
      setDraft(result.value);
      setLoad({ state: 'ready', settings: result.value });
      setMessage({ kind: 'ok', text: t('Saved. Browsers pick the new settings up the next time a page is opened.') });
    } else setMessage({ kind: 'error', text: result.message ?? t('Could not save the settings.') });
  };

  return (
    <div className="space-y-6">
      {message && (
        <p role="status" className={`rounded-2xl border px-4 py-3 text-sm ${message.kind === 'ok' ? 'border-success-500/40 bg-success-50 text-success-700' : 'border-danger-500/40 bg-danger-50 text-danger-700'}`}>
          {message.text}
        </p>
      )}

      <WorkspaceSurface className="p-6">
        <h2 className="text-xl font-semibold text-ink">{t('Tracking')}</h2>
        <p className="mt-1 text-sm text-ink-secondary">{t('Choose what is counted when the studios are used on the private site. Nothing is counted on the public GitHub Pages site or when you run the app locally.')}</p>

        <div className="mt-6 space-y-6">
          <div>
            <label className="inline-flex items-center gap-3 text-sm font-medium text-ink">
              <input type="checkbox" className="h-4 w-4" checked={draft.ownEvents} onChange={(e) => setDraft({ ...draft, ownEvents: e.target.checked })} />
              {t('Count events in my own database')}
            </label>
            <p className="ml-7 mt-1 text-sm text-ink-secondary">{t('Pages opened, files exported and catalog templates used. No IP address and no browser details are kept, and the login is stored only as a short one-way code. This is what the Statistics tab shows.')}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="trk-ga4" className={label}>{t('Google Analytics 4 id')}</label>
              <input id="trk-ga4" className={workspaceInputClassName} value={draft.ga4Id} placeholder="G-XXXXXXXXXX" maxLength={20} aria-invalid={ga4Bad} onChange={(e) => setDraft({ ...draft, ga4Id: e.target.value })} />
              {ga4Bad && <p className="mt-1 text-sm text-danger-600">{t('The id looks like G-XXXXXXXXXX.')}</p>}
            </div>
            <div>
              <label htmlFor="trk-gtm" className={label}>{t('Google Tag Manager id')}</label>
              <input id="trk-gtm" className={workspaceInputClassName} value={draft.gtmId} placeholder="GTM-XXXXXXX" maxLength={20} aria-invalid={gtmBad} onChange={(e) => setDraft({ ...draft, gtmId: e.target.value })} />
              {gtmBad && <p className="mt-1 text-sm text-danger-600">{t('The id looks like GTM-XXXXXXX.')}</p>}
            </div>
            <p className="text-sm text-ink-secondary md:col-span-2">
              {t('Leave an id empty to keep that service off. With a Google Analytics id the events are sent to Analytics. With only a Tag Manager id they are pushed to its data layer as events named page_view, export, catalog_template_used and template_saved, for your container to use. If you fill in both, do not also add an Analytics tag in Tag Manager, or every visit is counted twice.')}
            </p>
            {(ga4 !== '' || gtm !== '') && !ga4Bad && !gtmBad && (
              <p className="rounded-2xl border border-warning-500/40 bg-warning-50 px-4 py-3 text-sm text-warning-700 md:col-span-2">
                {t('Google receives the page address and the events, and the visitor’s IP address, as any website that uses its services. Make sure that is allowed for the people who use the site.')}
              </p>
            )}
          </div>

          <div>
            <label className="inline-flex items-center gap-3 text-sm font-medium text-ink">
              <input type="checkbox" className="h-4 w-4" checked={draft.respectDoNotTrack} onChange={(e) => setDraft({ ...draft, respectDoNotTrack: e.target.checked })} />
              {t('Respect “Do Not Track” and Global Privacy Control')}
            </label>
            <p className="ml-7 mt-1 text-sm text-ink-secondary">{t('A browser that asks not to be tracked is not counted anywhere, neither by you nor by Google.')}</p>
          </div>

          <div className="max-w-xs">
            <label htmlFor="trk-days" className={label}>{t('Keep own events for (days)')}</label>
            <input id="trk-days" type="number" min={RETENTION_RANGE.min} max={RETENTION_RANGE.max} step={1} className={workspaceInputClassName} value={Number.isFinite(draft.retentionDays) ? draft.retentionDays : ''} aria-invalid={retentionBad} onChange={(e) => setDraft({ ...draft, retentionDays: e.target.value === '' ? Number.NaN : Number(e.target.value) })} />
            <p className="mt-1 text-sm text-ink-secondary">{retentionBad ? t('Between {min} and {max} days.', { min: RETENTION_RANGE.min, max: RETENTION_RANGE.max }) : t('Older events are deleted by themselves.')}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" disabled={busy || !changed || ga4Bad || gtmBad || retentionBad} onClick={() => void save()} className="rounded-2xl bg-ink px-6 py-3 text-sm font-semibold text-ink-inverse shadow-lg transition hover:bg-sand-800 disabled:opacity-60">
            {busy ? t('Saving…') : t('Save')}
          </button>
        </div>
      </WorkspaceSurface>
    </div>
  );
}
