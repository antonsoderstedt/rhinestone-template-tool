import CalibrationSheetGenerator from '../components/CalibrationSheetGenerator';
import CricutTestPack from '../components/CricutTestPack';
import CalibrationWorkflow from '../components/CalibrationWorkflow';
import Link from 'next/link';

export default function SetupPage() {
  return (
    <div className="min-h-screen bg-surface">
      <main className="mx-auto max-w-5xl px-6 py-14 space-y-14">

        {/* ── Header with Back Link ──────────────────────────────────────── */}
        <header>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-accent-600 hover:text-accent-600 mb-4"
          >
            ← Back to Editor
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            Setup & Calibration
          </h1>
          <p className="mt-2 text-base text-ink-muted font-medium">
            System tools for calibrating your Cricut + Magic Flock workflow.
          </p>
          <p className="mt-3 text-sm text-ink-muted leading-relaxed max-w-2xl">
            These tools help you verify your machine settings and calibrate hole sizes
            before cutting production designs.
          </p>
        </header>

        {/* ── Cricut Test Pack ─────────────────────────────────────────────── */}
        <section className="rounded-xl border-2 border-info-500/30 bg-white p-7 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-ink">🎯 Cricut Test Pack</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Start here. Four ready-to-cut SVGs for validating your Cricut + Magic Flock setup.
            </p>
          </div>
          <CricutTestPack />
        </section>

        {/* ── Calibration Workflow ────────────────────────────────────────── */}
        <section className="rounded-xl border border-border bg-white p-7 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-ink">Calibration Workflow</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Record your measured hole diameters after cutting the calibration sheet.
              Apply calibrated values to a test grid and download.
            </p>
          </div>
          <CalibrationWorkflow />
        </section>

        {/* ── Calibration Sheet ────────────────────────────────────────────── */}
        <section className="rounded-xl border border-border bg-white p-7 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-ink">Calibration Sheet</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Hole-diameter variants for SS6–SS12. Cut before any production run.
              Find the diameter that seats stones perfectly for your blade and flock batch.
            </p>
          </div>
          <CalibrationSheetGenerator />
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="pb-4">
          <p className="text-xs text-ink-secondary leading-relaxed">
            All exported SVGs contain real vector <code>&lt;circle&gt;</code> elements dimensioned in mm.
            Stone size values are provisional. Always cut a calibration sheet first and
            update your material profile before production cutting.
          </p>
        </footer>

      </main>
    </div>
  );
}
