import ManualGridGenerator from './components/ManualGridGenerator';
import CalibrationSheetGenerator from './components/CalibrationSheetGenerator';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-3xl px-6 py-12 space-y-10">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Rhinestone Template Tool
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Precision SVG templates for Cricut Maker + Magic Flock
          </p>
          <p className="mt-4 text-sm text-zinc-600 leading-relaxed">
            Generate Cricut-safe SVG cut files for rhinestone templates. Every hole is
            a real vector circle sized in millimeters — no rasterization, no guesswork.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
            ⚠ Run a calibration cut before production. Stone size values are provisional.
          </div>
        </header>

        {/* ── Manual Grid Generator ────────────────────────────────────────── */}
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-zinc-800">
            Manual Grid Generator
          </h2>
          <p className="mb-5 text-xs text-zinc-500">
            Choose a stone size, columns, and rows — then download or copy the
            Cricut-safe SVG.
          </p>
          <ManualGridGenerator />
        </section>

        {/* ── Calibration Sheet ────────────────────────────────────────────── */}
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-base font-semibold text-zinc-800">
            Calibration Sheet
          </h2>
          <p className="mb-5 text-xs text-zinc-500">
            Cut this sheet to find the correct hole diameter for your machine, blade,
            and Magic Flock batch. Do this before any production run.
          </p>
          <CalibrationSheetGenerator />
        </section>

        {/* ── Footer note ─────────────────────────────────────────────────── */}
        <footer>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Always cut a calibration sheet first. Record the correct hole diameter
            variant for each stone size, then update your material profile accordingly.
            Skipping calibration risks holes that are too large (stones fall out) or
            too small (stones won&apos;t seat), and material tearing.
          </p>
        </footer>

      </main>
    </div>
  );
}

