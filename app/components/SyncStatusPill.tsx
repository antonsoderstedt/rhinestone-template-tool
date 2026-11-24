'use client';

import { useSyncExternalStore } from 'react';
import { CloudCheck, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react';
import { useT } from '../lib/i18n';
import { getServerSyncSnapshot, getSyncSnapshot, runSyncNow, subscribeSync } from '../lib/sync/syncStore';

/** Shows how the sync is doing, and syncs now when clicked. Shows nothing on a site without a sync server. */
export default function SyncStatusPill({ className = '' }: { className?: string }) {
  const t = useT();
  const sync = useSyncExternalStore(subscribeSync, getSyncSnapshot, getServerSyncSnapshot);
  if (sync.phase === 'unknown' || sync.phase === 'disabled') return null;

  const time = sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const view =
    sync.phase === 'syncing' ? { icon: RefreshCw, spin: true, text: t('Syncing…'), tone: 'text-sky-300' }
    : sync.phase === 'ok' ? { icon: CloudCheck, spin: false, text: t('Synced {time}', { time }), tone: 'text-emerald-300' }
    : sync.phase === 'partial' ? { icon: TriangleAlert, spin: false, text: t('Some items did not sync'), tone: 'text-amber-300' }
    : sync.phase === 'offline' ? { icon: CloudOff, spin: false, text: t('Offline, sync paused'), tone: 'text-zinc-400' }
    : sync.phase === 'signin' ? { icon: CloudOff, spin: false, text: t('Sign in again to sync'), tone: 'text-amber-300' }
    : { icon: TriangleAlert, spin: false, text: t('Sync error'), tone: 'text-red-300' };
  const Icon = view.icon;

  return (
    <button
      type="button"
      onClick={() => void runSyncNow(true)}
      disabled={sync.phase === 'syncing'}
      title={t('Click to sync now')}
      className={`inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium whitespace-nowrap transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:opacity-70 ${view.tone} ${className}`}
    >
      <Icon className={`h-3.5 w-3.5 ${view.spin ? 'animate-spin' : ''}`} aria-hidden="true" />
      {view.text}
    </button>
  );
}
