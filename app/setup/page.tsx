'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock3, FolderOpen, Gem, Settings2, ShieldAlert, SwatchBook } from 'lucide-react';
import CalibrationSheetGenerator from '../components/CalibrationSheetGenerator';
import CricutTestPack from '../components/CricutTestPack';
import CalibrationWorkflow from '../components/CalibrationWorkflow';
import WorkspaceModeBanner from '../components/WorkspaceModeBanner';
import WorkspaceQuickActions from '../components/WorkspaceQuickActions';
import { getCalibrationGateSummary } from '../lib/workspaceRecovery';
import { readActiveCalibrationProfileId, readWorkspaceVault } from '../lib/workspaceVault';

export default function SetupPage() {
  const [vault, setVault] = useState(() => readWorkspaceVault());
  const [activeProfileId, setActiveProfileId] = useState<string | null>(() => readActiveCalibrationProfileId());

  useEffect(() => {
    const sync = () => {
      setVault(readWorkspaceVault());
      setActiveProfileId(readActiveCalibrationProfileId());
    };

    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  const gateSummary = useMemo(() => getCalibrationGateSummary(vault, activeProfileId), [activeProfileId, vault]);
  const gateTone = gateSummary.workflowState === 'Ready'
    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
    : 'border-amber-400/30 bg-amber-500/10 text-amber-100';
  const StatusIcon = gateSummary.workflowState === 'Ready' ? CheckCircle2 : ShieldAlert;

  return (
    <div className="min-h-screen bg-[var(--studio-bg,#0f0f12)] text-[var(--studio-ink,#f1f0ef)]" data-theme="dark">
      <WorkspaceModeBanner
        mode="Setup & Calibration"
        status={gateSummary.workflowState === 'Ready' ? 'Ready' : 'Warning'}
        project="Production readiness"
        guidance={gateSummary.workflowState === 'Ready'
          ? 'The active material profile has been approved. Keep the calibration gate visible before any export or production cut.'
          : 'Calibration is the gate to production. Cut the calibration sheet and approve the active material profile before export.'}
        calibrationState={{ label: gateSummary.activeProfileApproved ? 'Approved' : 'Approval gate', tone: gateSummary.activeProfileApproved ? 'success' : 'warning' }}
      />
      <main className="mx-auto max-w-5xl px-6 py-14 space-y-14">
        <WorkspaceQuickActions
          actions={[
            { label: 'Resume autosave', description: 'Jump back into the most recent draft in the studio.', href: '/rhinestone', icon: Gem, tone: 'brand' },
            { label: 'Saved work', description: 'Open archived or active designs before the next cut.', href: '/designs', icon: FolderOpen, tone: 'neutral' },
            { label: 'HTV studio', description: 'Review garment placements and vinyl cut work.', href: '/htv', icon: SwatchBook, tone: 'neutral' },
            { label: 'Production settings', description: 'Tune machine, material, and export defaults.', href: '/settings', icon: Settings2, tone: 'default' },
          ]}
        />

        <section className={`rounded-2xl border p-5 ${gateTone}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-current/80">Production gate</div>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--studio-ink,#f1f0ef)]">Cut, measure, approve, then produce.</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-current/30 bg-black/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-current">
              <StatusIcon className="h-3.5 w-3.5" />
              {gateSummary.workflowState === 'Ready' ? 'Ready' : 'Pending'}
            </div>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--studio-ink-secondary,#a8a29e)]">
            {gateSummary.nextStep}
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-[1.4rem] border border-current/15 bg-black/5 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-current/75">Active profile</div>
              <div className="mt-2 text-lg font-semibold text-[var(--studio-ink,#f1f0ef)]">{gateSummary.activeProfileName ?? 'No active profile'}</div>
              <div className="mt-2 text-xs text-[var(--studio-ink-secondary,#a8a29e)]">
                {gateSummary.activeProfileApproved ? 'Approved and ready for production' : 'Waiting on approval'}
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-current/15 bg-black/5 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-current/75">Approved</div>
              <div className="mt-2 text-2xl font-semibold text-[var(--studio-ink,#f1f0ef)]">{gateSummary.approvedCalibrationCount}</div>
              <div className="mt-2 text-xs text-[var(--studio-ink-secondary,#a8a29e)]">Material profiles verified for production</div>
            </div>

            <div className="rounded-[1.4rem] border border-current/15 bg-black/5 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-current/75">Last approval</div>
              <div className="mt-2 flex items-center gap-2 text-lg font-semibold text-[var(--studio-ink,#f1f0ef)]">
                {gateSummary.lastApprovedAt ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                {gateSummary.lastApprovedAt ? new Date(gateSummary.lastApprovedAt).toLocaleDateString() : 'Not yet'}
              </div>
              <div className="mt-2 text-xs text-[var(--studio-ink-secondary,#a8a29e)]">Keep the calibration gate visible before each new material batch</div>
            </div>
          </div>
        </section>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 mb-4"
          >
            ← Back to home
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--studio-ink,#f1f0ef)]">
            Setup & Calibration
          </h1>
          <p className="mt-2 text-base text-[var(--studio-ink-secondary,#a8a29e)] font-medium">
            Calibrate hole sizes, validate machine output, and approve your material profile before production.
          </p>
        </header>

        {/* ── Cricut Test Pack ─────────────────────────────────────────────── */}
        <section className="rounded-xl border border-[var(--studio-border,rgba(255,255,255,0.08))] bg-[var(--studio-surface,#1a1a1f)] p-7 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-[var(--studio-ink,#f1f0ef)]">🎯 Cricut Test Pack</h2>
            <p className="mt-1 text-sm text-[var(--studio-ink-secondary,#a8a29e)]">
              Start here. Four ready-to-cut SVGs for validating your Cricut + Magic Flock setup.
            </p>
          </div>
          <CricutTestPack />
        </section>

        {/* ── Calibration Workflow ────────────────────────────────────────── */}
        <section className="rounded-xl border border-[var(--studio-border,rgba(255,255,255,0.08))] bg-[var(--studio-surface,#1a1a1f)] p-7 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-[var(--studio-ink,#f1f0ef)]">Calibration Workflow</h2>
            <p className="mt-1 text-sm text-[var(--studio-ink-secondary,#a8a29e)]">
              Record your measured hole diameters after cutting the calibration sheet.
              Apply calibrated values to a test grid and download.
            </p>
          </div>
          <CalibrationWorkflow />
        </section>

        {/* ── Calibration Sheet ────────────────────────────────────────────── */}
        <section className="rounded-xl border border-[var(--studio-border,rgba(255,255,255,0.08))] bg-[var(--studio-surface,#1a1a1f)] p-7 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-[var(--studio-ink,#f1f0ef)]">Calibration Sheet</h2>
            <p className="mt-1 text-sm text-[var(--studio-ink-secondary,#a8a29e)]">
              Hole-diameter variants for SS6–SS12. Cut before any production run.
              Find the diameter that seats stones perfectly for your blade and flock batch.
            </p>
          </div>
          <CalibrationSheetGenerator />
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="pb-4">
          <p className="text-xs text-[var(--studio-ink-muted,#6b7280)] leading-relaxed">
            All exported SVGs contain real vector <code className="text-violet-400">&lt;circle&gt;</code> elements dimensioned in mm.
            Stone size values are provisional. Always cut a calibration sheet first and
            approve your material profile before production cutting.
          </p>
        </footer>

      </main>
    </div>
  );
}
