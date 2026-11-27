'use client';

import { useEffect, useState } from 'react';
import { WorkspaceEmptyState, WorkspaceSurface, workspaceInputClassName } from '../components/workspace/WorkspaceChrome';
import { useT } from '../lib/i18n';
import { SITE_META_CHANGED, cacheSiteMeta, fetchSiteMetaSettings, saveSiteMetaSettings } from '../lib/siteMeta/siteMetaClient';
import type { TrackingFailure } from '../lib/tracking/trackingClient';
import { DEFAULT_SITE_META, META_LIMITS, TITLED_STUDIOS, parseSiteMeta, type SiteMeta, type TitledStudio } from '@/src/lib/siteMeta/siteMeta';

type Load = { state: 'loading' } | { state: 'ready'; settings: SiteMeta } | { state: 'failed'; reason: TrackingFailure };

const label = 'mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted';

export default function MetaAdmin() {
  const t = useT();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [draft, setDraft] = useState<SiteMeta>(DEFAULT_SITE_META);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchSiteMetaSettings().then((result) => {
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
        title={load.reason === 'signin' ? t('Sign in to open the site settings') : load.reason === 'unavailable' ? t('The site settings need the private site') : t('The site settings could not be loaded')}
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

  const parsed = parseSiteMeta(draft);
  const titleEmpty = draft.title.trim() === '';
  const studioLabels: Record<TitledStudio, string> = { rhinestone: t('Rhinestone Studio title'), htv: t('HTV Studio title'), papercraft: t('Papercraft Studio title') };
  const changed = parsed.ok ? JSON.stringify(parsed.meta) !== JSON.stringify(load.settings) : true;

  const save = async () => {
    if (!parsed.ok) return;
    setBusy(true);
    setMessage(null);
    const result = await saveSiteMetaSettings(parsed.meta);
    setBusy(false);
    if (result.ok) {
      setDraft(result.value);
      setLoad({ state: 'ready', settings: result.value });
      cacheSiteMeta(window.localStorage, result.value);
      window.dispatchEvent(new CustomEvent(SITE_META_CHANGED, { detail: result.value }));
      setMessage({ kind: 'ok', text: t('Saved. Open tabs change at once, and other browsers pick the new text up the next time a page is opened.') });
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
        <h2 className="text-xl font-semibold text-ink">{t('Site title and description')}</h2>
        <p className="mt-1 text-sm text-ink-secondary">{t('The title is what the browser tab shows. The description is the short text for the page’s description tag. The pages are built once, so the text is applied by the browser when a page has opened.')}</p>

        <div className="mt-6 space-y-6">
          <div className="max-w-2xl">
            <label htmlFor="meta-title" className={label}>{t('Site title')}</label>
            <input id="meta-title" className={workspaceInputClassName} value={draft.title} maxLength={META_LIMITS.title} aria-invalid={titleEmpty} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <p className="mt-1 text-sm text-ink-secondary">{titleEmpty ? t('The title cannot be empty.') : t('{n} of {max} characters.', { n: draft.title.length, max: META_LIMITS.title })}</p>
          </div>

          <div className="max-w-2xl">
            <label htmlFor="meta-description" className={label}>{t('Description')}</label>
            <textarea id="meta-description" rows={3} className={workspaceInputClassName} value={draft.description} maxLength={META_LIMITS.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            <p className="mt-1 text-sm text-ink-secondary">{t('{n} of {max} characters. Leave it empty to have no description.', { n: draft.description.length, max: META_LIMITS.description })}</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-ink">{t('A title for each studio (optional)')}</h3>
            <p className="mt-1 text-sm text-ink-secondary">{t('Leave a title empty to use the site title on that studio’s pages. This makes the tabs easy to tell apart.')}</p>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              {TITLED_STUDIOS.map((studio) => (
                <div key={studio}>
                  <label htmlFor={`meta-${studio}`} className={label}>{studioLabels[studio]}</label>
                  <input id={`meta-${studio}`} className={workspaceInputClassName} value={draft.studioTitles[studio]} maxLength={META_LIMITS.title} placeholder={draft.title} onChange={(e) => setDraft({ ...draft, studioTitles: { ...draft.studioTitles, [studio]: e.target.value } })} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" disabled={busy || !changed || !parsed.ok} onClick={() => void save()} className="rounded-2xl bg-ink px-6 py-3 text-sm font-semibold text-ink-inverse shadow-lg transition hover:bg-sand-800 disabled:opacity-60">
            {busy ? t('Saving…') : t('Save')}
          </button>
          <button type="button" disabled={busy} onClick={() => setDraft(DEFAULT_SITE_META)} className="rounded-2xl border border-border px-6 py-3 text-sm font-semibold text-ink transition hover:bg-sand-100 disabled:opacity-60">
            {t('Use the original text')}
          </button>
        </div>
      </WorkspaceSurface>
    </div>
  );
}
