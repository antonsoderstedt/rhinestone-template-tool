import ManualGridGenerator from './components/ManualGridGenerator';
import CalibrationSheetGenerator from './components/CalibrationSheetGenerator';
import TextMatrixGenerator from './components/TextMatrixGenerator';
import PolylineLogoGenerator from './components/PolylineLogoGenerator';
import SvgUploadGenerator from './components/SvgUploadGenerator';
import CricutTestPack from './components/CricutTestPack';
import CalibrationWorkflow from './components/CalibrationWorkflow';
import ManualStoneEditor from './components/ManualStoneEditor';

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

        {/* ── Text Matrix Generator ────────────────────────────────────────── */}
        <section className="rounded-xl border border-zinc-200 bg-white p-7 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-zinc-900">Dot Matrix Text</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Convert text into a rhinestone template using the built-in 5×7 dot-matrix alphabet.
            </p>
          </div>
          <TextMatrixGenerator />
        </section>

        {/* ── SVG Upload Generator ─────────────────────────────────────────── */}
        <section className="rounded-xl border border-zinc-200 bg-white p-7 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-zinc-900">SVG Upload</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Upload an SVG file. Supported: line, polyline, polygon, rect, circle, ellipse, and basic paths.
              Curves and transforms are applied. Arc commands (A) must be expanded before upload.
            </p>
          </div>
          <SvgUploadGenerator />
        </section>

        {/* ── Manual Stone Editor ──────────────────────────────────────────── */}
        <section className="rounded-xl border border-zinc-200 bg-white p-7 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-zinc-900">Manual Stone Editor</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Add and remove individual stones from a template. Undo/redo supported.
              Drag, multi-select, and advanced editing will come later.
            </p>
          </div>
          <ManualStoneEditor />
        </section>

        {/* ── Polyline Logo Generator ──────────────────────────────────────── */}
        <section className="rounded-xl border border-zinc-200 bg-white p-7 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-zinc-900">Polyline Logo Generator</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Place stones along a polyline outline. Choose from built-in demo shapes.
              SVG upload with path extraction is built on this same engine.
            </p>
          </div>
          <PolylineLogoGenerator />
        </section>

        {/* ── Manual Grid Generator ────────────────────────────────────────── */}
        <section className="rounded-xl border border-zinc-200 bg-white p-7 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-zinc-900">Manual Grid Generator</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Generate a rectangular grid of stones at a chosen size, column, and row count.
            </p>
          </div>
          <ManualGridGenerator />
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
