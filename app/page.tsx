import ManualGridGenerator from './components/ManualGridGenerator';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-3xl px-6 py-12">

        {/* Header */}
        <header className="mb-10">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Rhinestone Template Tool
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Precision SVG templates for Cricut Maker + Magic Flock
          </p>
          <p className="mt-4 text-sm text-zinc-600 leading-relaxed">
            Generate a rhinestone grid template from the engine. Configure stone size,
            columns, and rows — then download or copy a Cricut-safe SVG with every hole
            as a real vector circle, dimensioned in millimeters.
          </p>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
            ⚠ Stone size values are provisional — calibrate before cutting production runs
          </div>
        </header>

        {/* Generator */}
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-base font-semibold text-zinc-800">
            Manual Grid Generator
          </h2>
          <ManualGridGenerator />
        </section>

      </main>
    </div>
  );
}
