import CalibrationSheetGenerator from './components/CalibrationSheetGenerator';
import CricutTestPack from './components/CricutTestPack';
import CalibrationWorkflow from './components/CalibrationWorkflow';
import ProjectShell from './components/ProjectShell';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-5xl px-6 py-14 space-y-14">

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            Rhinestone Template Tool
          </h1>
          <p className="mt-2 text-base text-zinc-500 font-medium">
            Generate Cricut-ready rhinestone SVG templates for Magic Flock workflows.
          </p>
          <p className="mt-3 text-sm text-zinc-600 leading-relaxed max-w-2xl">
            Every hole is a real vector circle sized in millimeters. Import into
            Cricut Design Space, cut on Magic Flock, and place your rhinestones.
            Start with the <strong>Cricut Test Pack</strong> to validate your
            machine settings before cutting production designs.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
            ⚠ All stone size values are provisional — cut a calibration sheet before production.
          </div>
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

        {/* ── Project-Aware Generators ─────────────────────────────────────── */}
        <ProjectShell />

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
