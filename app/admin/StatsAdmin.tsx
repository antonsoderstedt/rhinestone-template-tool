'use client';

import { Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { WorkspaceEmptyState, WorkspaceMetricCard, WorkspaceSurface, workspaceSelectClassName } from '../components/workspace/WorkspaceChrome';
import { useT } from '../lib/i18n';
import { clearEvents, fetchStats, type Stats, type TrackingFailure } from '../lib/tracking/trackingClient';
import { fillDays, groupDays, percent } from './statsView';

type Load = { state: 'loading' } | { state: 'ready'; stats: Stats } | { state: 'failed'; reason: TrackingFailure };

const PERIODS = [7, 30, 90, 365] as const;
const label = 'mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted';

function Bars({ rows }: { rows: { key: string; name: string; value: number; extra?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-3 text-sm">
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-ink" title={row.name}>{row.name}</span>
              {row.extra ? <span className="shrink-0 text-xs text-ink-muted">{row.extra}</span> : null}
            </div>
            <div className="mt-1 h-2 rounded-full bg-surface">
              <div className="h-2 rounded-full bg-accent-500" style={{ width: `${percent(row.value, max)}%` }} />
            </div>
          </div>
          <span className="text-right font-semibold tabular-nums text-ink">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}

export default function StatsAdmin() {
  const t = useT();
  const [days, setDays] = useState<number>(30);
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async (period: number) => {
    const result = await fetchStats(period);
    setLoad(result.ok ? { state: 'ready', stats: result.value } : { state: 'failed', reason: result.reason });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchStats(days).then((result) => {
      if (!cancelled) setLoad(result.ok ? { state: 'ready', stats: result.value } : { state: 'failed', reason: result.reason });
    });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const stats = load.state === 'ready' ? load.stats : null;
  const bars = useMemo(() => (stats ? groupDays(fillDays(stats.perDay, stats.since, stats.days), 60) : []), [stats]);

  const studioName = (studio: string): string => {
    switch (studio) {
      case 'rhinestone': return t('Rhinestone Studio');
      case 'htv': return t('HTV Studio');
      case 'papercraft': return t('Papercraft Studio');
      case 'settings': return t('Settings');
      case 'admin': return t('Admin');
      case 'home': return t('Start page');
      default: return t('Other');
    }
  };
  const eventName = (name: string): string => {
    switch (name) {
      case 'page_view': return t('Pages opened');
      case 'export': return t('Files exported');
      case 'catalog_template_used': return t('Catalog templates opened');
      case 'template_saved': return t('Templates saved to the catalog');
      default: return name;
    }
  };

  const clearAll = async () => {
    if (!window.confirm(t('Delete every stored event for good? This cannot be undone.'))) return;
    const result = await clearEvents();
    setMessage(result.ok ? t('Deleted {n} events.', { n: result.value }) : t('Could not delete the events.'));
    await refresh(days);
  };

  if (load.state === 'loading') return <p className="px-2 text-sm text-ink-secondary" role="status">{t('Loading the statistics…')}</p>;
  if (load.state === 'failed') {
    return (
      <WorkspaceEmptyState
        title={load.reason === 'signin' ? t('Sign in to open the statistics') : load.reason === 'unavailable' ? t('The statistics need the private site') : t('The statistics could not be loaded')}
        description={
          load.reason === 'signin'
            ? t('Cloudflare Access did not let this request through. Reload the page and sign in.')
            : load.reason === 'unavailable'
              ? t('Events are kept in the database of your private Cloudflare site. Open the admin panel there (or run scripts/deploy-private.sh --dev locally).')
              : t('Something went wrong when the statistics were asked for. Try again in a moment.')
        }
      />
    );
  }

  const s = load.stats;
  const maxDay = Math.max(1, ...bars.map((d) => d.events));
  const empty = s.totals.events === 0;

  return (
    <div className="space-y-6">
      {message && <p role="status" className="rounded-2xl border border-border/80 bg-surface px-4 py-3 text-sm text-ink">{message}</p>}
      {!s.ownEvents && (
        <p role="status" className="rounded-2xl border border-warning-500/40 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          {t('Own events are switched off, so nothing new is counted. Switch them on under Tracking.')}
        </p>
      )}

      <WorkspaceSurface className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">{t('Statistics')}</h2>
            <p className="mt-1 text-sm text-ink-secondary">{t('Counted by your own site. Nobody is identified: a visit is a random id for one browser tab.')}</p>
          </div>
          <div>
            <label htmlFor="stats-period" className={label}>{t('Period')}</label>
            <select id="stats-period" className={workspaceSelectClassName} value={days} onChange={(e) => { setLoad({ state: 'loading' }); setDays(Number(e.target.value)); }}>
              {PERIODS.map((p) => <option key={p} value={p}>{t('Last {n} days', { n: p })}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <WorkspaceMetricCard label={t('Visits')} value={s.totals.sessions} description={t('Browser tabs that were opened')} />
          <WorkspaceMetricCard label={t('People')} value={s.totals.users} description={t('Different logins')} />
          <WorkspaceMetricCard label={t('Pages opened')} value={s.totals.pageViews} />
          <WorkspaceMetricCard label={t('Files exported')} value={s.totals.exports} />
        </div>

        {empty ? (
          <p className="mt-6 rounded-2xl border border-dashed border-border-strong px-4 py-10 text-center text-sm text-ink-secondary">
            {t('No events in this period yet. They appear here as the studios are used on the private site.')}
          </p>
        ) : (
          <div className="mt-8">
            <h3 className={label}>{t('Events per day')}</h3>
            <div role="img" aria-label={t('Bar chart of events per day, {total} events in all', { total: s.totals.events })} className="flex h-40 items-end gap-[2px] rounded-2xl border border-border/80 bg-surface p-3">
              {bars.map((d) => (
                <div key={d.day} title={`${d.day}: ${d.events} ${t('events')}, ${d.sessions} ${t('visits')}`} className="flex-1 rounded-t bg-accent-500/80" style={{ height: `${Math.max(d.events > 0 ? 3 : 0, percent(d.events, maxDay))}%` }} />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-ink-muted"><span>{bars[0]?.day}</span><span>{bars[bars.length - 1]?.day}</span></div>
          </div>
        )}
      </WorkspaceSurface>

      {!empty && (
        <div className="grid gap-6 lg:grid-cols-2">
          <WorkspaceSurface className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-ink">{t('By studio')}</h3>
            <Bars rows={s.byStudio.map((r) => ({ key: r.studio, name: studioName(r.studio), value: r.events, extra: `${r.sessions} ${t('visits')}` }))} />
          </WorkspaceSurface>
          <WorkspaceSurface className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-ink">{t('What people do')}</h3>
            <Bars rows={s.byEvent.map((r) => ({ key: r.name, name: eventName(r.name), value: r.count }))} />
          </WorkspaceSurface>
          <WorkspaceSurface className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-ink">{t('Most opened pages')}</h3>
            {s.topPages.length === 0 ? <p className="text-sm text-ink-secondary">{t('Nothing yet.')}</p> : <Bars rows={s.topPages.map((r) => ({ key: r.path, name: r.path, value: r.views }))} />}
          </WorkspaceSurface>
          <WorkspaceSurface className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-ink">{t('Most used')}</h3>
            <p className="mb-3 text-sm text-ink-secondary">{t('File types exported and catalog templates opened.')}</p>
            {s.topLabels.length === 0 ? <p className="text-sm text-ink-secondary">{t('Nothing yet.')}</p> : <Bars rows={s.topLabels.map((r) => ({ key: `${r.name}/${r.label}`, name: r.name === 'export' ? `${t('Export')}: ${r.label.toUpperCase()}` : `${eventName(r.name)}: ${r.label}`, value: r.count }))} />}
          </WorkspaceSurface>
        </div>
      )}

      <WorkspaceSurface className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-ink-secondary">
            {t('{n} events are stored{since}. Events older than {days} days are deleted by themselves.', { n: s.stored, since: s.oldest ? ` (${t('the oldest from')} ${s.oldest.slice(0, 10)})` : '', days: s.retentionDays })}
          </p>
          <button type="button" disabled={s.stored === 0} onClick={() => void clearAll()} className="inline-flex items-center gap-2 rounded-xl border border-border/80 px-4 py-2 text-sm font-semibold text-danger-600 transition hover:bg-danger-50 disabled:opacity-50">
            <Trash2 className="h-4 w-4" aria-hidden="true" /> {t('Delete all events')}
          </button>
        </div>
      </WorkspaceSurface>
    </div>
  );
}
