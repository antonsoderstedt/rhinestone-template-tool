import CalibrationSheetGenerator from '../components/CalibrationSheetGenerator';
import CricutTestPack from '../components/CricutTestPack';
import CalibrationWorkflow from '../components/CalibrationWorkflow';
import WorkspaceModeBanner from '../components/WorkspaceModeBanner';
import WorkspaceQuickActions from '../components/WorkspaceQuickActions';
import { FolderOpen, Gem, Settings2, SwatchBook } from 'lucide-react';
import Link from 'next/link';

export default function SetupPage() {
  return (
    <div className="min-h-screen bg-[var(--studio-bg,#0f0f12)] text-[var(--studio-ink,#f1f0ef)]" data-theme="dark">
      <WorkspaceModeBanner
        mode="Setup & Calibration"
        status="Warning"
        project="Production readiness"
        guidance="Calibration is the gate to production. Cut the calibration sheet and approve the active material profile before export."
        calibrationState={{ label: 'Approval gate', tone: 'warning' }}
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
