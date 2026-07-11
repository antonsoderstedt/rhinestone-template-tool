import type { ExportReadinessResult } from '@/src/lib/rhinestone-engine/index';

interface ExportReadinessPanelProps {
  result: ExportReadinessResult | null;
}

/**
 * Displays export readiness status for a RhinestoneTemplate.
 *
 * Readiness logic lives entirely in the engine (checkExportReadiness).
 * This component only renders the result — it never recomputes readiness.
 */
export default function ExportReadinessPanel({ result }: ExportReadinessPanelProps) {
  if (!result) return null;

  const errors   = result.issues.filter((i) => i.severity === 'error');
  const warnings = result.issues.filter((i) => i.severity === 'warning');
  const infos    = result.issues.filter((i) => i.severity === 'info');

  return (
    <div className="rounded-lg border overflow-hidden text-sm">

      {/* ── Status bar ────────────────────────────────────────────────── */}
      <div
        className={`flex items-center gap-2 px-4 py-2.5 font-semibold ${
          result.ready ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}
      >
        <span className="text-base">{result.ready ? '✓' : '✗'}</span>
        <span>
          {result.ready ? 'Ready for Cricut SVG export' : 'Fix errors before cutting'}
        </span>
      </div>

      {/* ── Summary stats ─────────────────────────────────────────────── */}
      <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-3">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-zinc-400 uppercase tracking-wide text-[10px]">Stones</dt>
            <dd className="font-semibold text-zinc-900 text-sm">{result.summary.stoneCount}</dd>
          </div>
          <div>
            <dt className="text-zinc-400 uppercase tracking-wide text-[10px]">Width</dt>
            <dd className="font-semibold text-zinc-900 text-sm">{result.summary.widthMm.toFixed(1)} mm</dd>
          </div>
          <div>
            <dt className="text-zinc-400 uppercase tracking-wide text-[10px]">Height</dt>
            <dd className="font-semibold text-zinc-900 text-sm">{result.summary.heightMm.toFixed(1)} mm</dd>
          </div>
          <div>
            <dt className="text-zinc-400 uppercase tracking-wide text-[10px]">Cutter</dt>
            <dd className="font-semibold text-zinc-900 text-sm truncate">{result.summary.cutter}</dd>
          </div>
        </dl>
      </div>

      {/* ── Issues ────────────────────────────────────────────────────── */}
      {(errors.length > 0 || warnings.length > 0 || infos.length > 0) && (
        <div className="divide-y divide-zinc-100">

          {errors.length > 0 && (
            <div className="bg-red-50 px-4 py-3">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1.5">
                Errors — must fix before export
              </p>
              <ul className="space-y-1">
                {errors.map((issue, i) => (
                  <li key={i} className="flex gap-2 text-xs text-red-700">
                    <span className="shrink-0 font-mono text-red-400">[{issue.code}]</span>
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5">
                Warnings — export allowed, review before cutting
              </p>
              <ul className="space-y-1">
                {warnings.map((issue, i) => (
                  <li key={i} className="flex gap-2 text-xs text-amber-700">
                    <span className="shrink-0 font-mono text-amber-500">[{issue.code}]</span>
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {infos.length > 0 && (
            <div className="bg-white px-4 py-3">
              <ul className="space-y-1">
                {infos.map((issue, i) => (
                  <li key={i} className="flex gap-2 text-xs text-zinc-500">
                    <span className="shrink-0 font-mono text-zinc-300">[{issue.code}]</span>
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
