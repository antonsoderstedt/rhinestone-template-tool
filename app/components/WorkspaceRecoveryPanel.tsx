'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FolderOpen, Ruler } from 'lucide-react';
import { EMPTY_WORKSPACE_VAULT, readWorkspaceVault } from '../lib/workspaceVault';
import { getWorkspaceRecoverySummary, hasAnythingToRecover, type WorkspaceRecoverySummary } from '../lib/workspaceRecovery';

/** "Pick up where you left off": shown only when there is a draft or saved work, so a new visitor sees nothing here. */
export default function WorkspaceRecoveryPanel() {
  const [summary, setSummary] = useState<WorkspaceRecoverySummary>(() => getWorkspaceRecoverySummary(EMPTY_WORKSPACE_VAULT, false));

  useEffect(() => {
    const sync = () => {
      const vault = readWorkspaceVault();
      const rawAutosave = window.localStorage.getItem('rhinestone-template-library-autosave');
      const next = getWorkspaceRecoverySummary(vault, Boolean(rawAutosave && rawAutosave.trim().length > 0));
      queueMicrotask(() => setSummary(next));
    };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  if (!hasAnythingToRecover(summary)) return null;

  const calibrated = summary.approvedCalibrationCount > 0;
  return (
    <section aria-label="Pick up where you left off" className="rounded-[2rem] border border-border/80 bg-[rgba(255,255,255,0.9)] p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-ink">Pick up where you left off</h2>
      <div className="mt-4 flex flex-wrap gap-3">
        {summary.hasAutosave && (
          <Link href="/rhinestone" className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-ink-inverse">
            <FolderOpen className="h-4 w-4" aria-hidden="true" />
            Open your last draft
          </Link>
        )}
        {summary.totalSavedDesigns > 0 && (
          <Link href="/designs" className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink-secondary transition hover:text-ink">
            My Designs ({summary.totalSavedDesigns})
          </Link>
        )}
      </div>
      <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-ink-secondary">
        <Ruler className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {calibrated ? (
          <span>Calibrated{summary.activeCalibrationProfileName ? `: ${summary.activeCalibrationProfileName}` : ''}.</span>
        ) : (
          <span>
            Your material is not calibrated yet. <Link href="/setup" className="font-semibold text-accent-600 underline-offset-2 hover:underline">Calibrate it</Link> once so the holes match your stones.
          </span>
        )}
      </p>
    </section>
  );
}
