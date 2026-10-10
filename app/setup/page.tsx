import CalibrationSheetGenerator from '../components/CalibrationSheetGenerator';
import CricutTestPack from '../components/CricutTestPack';
import CalibrationWorkflow from '../components/CalibrationWorkflow';
import Link from 'next/link';

export default function SetupPage() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-5xl px-6 py-14 space-y-14">

        {/* ── Header with Back Link ──────────────────────────────────────── */}
        <header>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 mb-4"
          >
            ← Back to Editor
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            Setup & Calibration
          </h1>
          <p className="mt-2 text-base text-zinc-500 font-medium">
            System tools for calibrating your Cricut + Magic Flock workflow.
          </p>
          <p className="mt-3 text-sm text-zinc-600 leading-relaxed max-w-2xl">
            These tools help you verify your machine settings and calibrate hole sizes
            before cutting production designs.
          </p>
        </header>

        {/* ── Cricut Test Pack ─────────────────────────────────────────────── */}
        <section className="rounded-xl border-2 border-blue-200 bg-white p-7 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-zinc-900">🎯 Cricut Test Pack</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Start here. Four ready-to-cut SVGs for validating your Cricut + Magic Flock setup.
            </p>
          </div>
          <CricutTestPack />
        </section>

        {/* ── Calibration Workflow ────────────────────────────────────────── */}
        <section className="rounded-xl border border-zinc-200 bg-white p-7 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-zinc-900">Calibration Workflow</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Record your measured hole diameters after cutting the calibration sheet.
              Apply calibrated values to a test grid and download.
            </p>
          </div>
          <CalibrationWorkflow />
        </section>

        {/* ── Calibration Sheet ────────────────────────────────────────────── */}
        <section className="rounded-xl border border-zinc-200 bg-white p-7 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-zinc-900">Calibration Sheet</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Hole-diameter variants for SS6–SS12. Cut before any production run.
              Find the diameter that seats stones perfectly for your blade and flock batch.
            </p>
          </div>
          <CalibrationSheetGenerator />
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="pb-4">
          <p className="text-xs text-zinc-400 leading-relaxed">
            All exported SVGs contain real vector <code>&lt;circle&gt;</code> elements dimensioned in mm.
            Stone size values are provisional. Always cut a calibration sheet first and
            update your material profile before production cutting.
          </p>
        </footer>

      </main>
    </div>
  );
}
