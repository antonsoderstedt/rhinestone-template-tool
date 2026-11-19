'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FolderOpen, ShieldAlert } from 'lucide-react';
import { EMPTY_WORKSPACE_VAULT, readWorkspaceVault } from '../lib/workspaceVault';
import { getRecoveryActionPlan, getWorkspaceRecoverySummary } from '../lib/workspaceRecovery';

export default function WorkspaceRecoveryPanel() {
  const [vault, setVault] = useState(EMPTY_WORKSPACE_VAULT);
  const [summary, setSummary] = useState(() => getWorkspaceRecoverySummary(EMPTY_WORKSPACE_VAULT, false));
  const actionPlan = useMemo(() => getRecoveryActionPlan(vault, summary.hasAutosave), [summary.hasAutosave, vault]);

  useEffect(() => {
    const sync = () => {
      const vault = readWorkspaceVault();
      const rawAutosave = window.localStorage.getItem('rhinestone-template-library-autosave');
      const nextSummary = getWorkspaceRecoverySummary(vault, Boolean(rawAutosave && rawAutosave.trim().length > 0));
      queueMicrotask(() => {
        setVault(vault);
        setSummary(nextSummary);
      });
    };

    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  const statusConfig = useMemo(() => {
    if (summary.workflowStatus === 'Ready') {
      return {
        badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        icon: CheckCircle2,
        text: 'Ready for the next production pass',
      };
    }

    if (summary.workflowStatus === 'Blocked') {
      return {
        badge: 'border-rose-200 bg-rose-50 text-rose-700',
        icon: ShieldAlert,
        text: 'Needs a saved recovery step before production',
      };
    }

    return {
      badge: 'border-amber-200 bg-amber-50 text-amber-700',
      icon: AlertTriangle,
      text: 'Calibration is the main production gate',
    };
  }, [summary.workflowStatus]);

  const StatusIcon = statusConfig.icon;

  return (
    <div className="rounded-[2rem] border border-border/80 bg-[rgba(255,255,255,0.9)] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">Recovery & status</div>
          <h3 className="mt-2 text-xl font-semibold text-ink">Current workflow snapshot</h3>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusConfig.badge}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {summary.workflowStatus}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[1.2rem] border border-border bg-surface px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">Saved work</div>
          <div className="mt-2 text-2xl font-semibold text-ink">{summary.totalSavedDesigns}</div>
          <div className="mt-1 text-xs text-ink-secondary">{summary.rhinestoneSavedCount} rhinestone · {summary.htvSavedCount} HTV</div>
        </div>

        <div className="rounded-[1.2rem] border border-border bg-surface px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">Calibration</div>
          <div className="mt-2 text-2xl font-semibold text-ink">{summary.approvedCalibrationCount}</div>
          <div className="mt-1 text-xs text-ink-secondary">
            {summary.activeCalibrationProfileName ? `Active: ${summary.activeCalibrationProfileName}` : 'No approved profile yet'}
          </div>
        </div>

        <div className="rounded-[1.2rem] border border-border bg-surface px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">Autosave</div>
          <div className="mt-2 text-2xl font-semibold text-ink">{summary.hasAutosave ? 'Ready' : 'None'}</div>
          <div className="mt-1 text-xs text-ink-secondary">{summary.hasAutosave ? 'Recent recovery is available' : 'No local emergency draft'}</div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-7 text-ink-secondary">{statusConfig.text}</p>

      <div className="mt-4 flex flex-wrap gap-3">
        <Link href={actionPlan.href} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-ink-inverse">
          <FolderOpen className="h-4 w-4" />
          {actionPlan.label}
        </Link>
        <Link href={summary.hasAutosave ? '/rhinestone' : '/setup'} className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink-secondary transition hover:text-ink">
          {summary.hasAutosave ? 'Resume draft' : 'Review calibration'}
        </Link>
      </div>
      <p className="mt-3 text-xs leading-6 text-ink-secondary">{actionPlan.description}</p>
    </div>
  );
}
