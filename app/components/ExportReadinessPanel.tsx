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
          result.ready ? 'bg-success-500 text-ink-inverse' : 'bg-danger-500 text-ink-inverse'
        }`}
      >
        <span className="text-base">{result.ready ? '✓' : '✗'}</span>
        <span>
          {result.ready ? 'Ready for Cricut SVG export' : 'Fix errors before cutting'}
        </span>
      </div>

      {/* ── Summary stats ─────────────────────────────────────────────── */}
      <div className="bg-surface border-b border-border px-4 py-3">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-ink-secondary uppercase tracking-wide text-[10px]">Stones</dt>
            <dd className="font-semibold text-ink text-sm">{result.summary.stoneCount}</dd>
          </div>
          <div>
            <dt className="text-ink-secondary uppercase tracking-wide text-[10px]">Width</dt>
            <dd className="font-semibold text-ink text-sm">{result.summary.widthMm.toFixed(1)} mm</dd>
          </div>
          <div>
            <dt className="text-ink-secondary uppercase tracking-wide text-[10px]">Height</dt>
            <dd className="font-semibold text-ink text-sm">{result.summary.heightMm.toFixed(1)} mm</dd>
          </div>
          <div>
            <dt className="text-ink-secondary uppercase tracking-wide text-[10px]">Cutter</dt>
            <dd className="font-semibold text-ink text-sm truncate">{result.summary.cutter}</dd>
          </div>
        </dl>
      </div>

      {/* ── Issues ────────────────────────────────────────────────────── */}
      {(errors.length > 0 || warnings.length > 0 || infos.length > 0) && (
        <div className="divide-y divide-border">

          {errors.length > 0 && (
            <div className="bg-danger-50 px-4 py-3">
              <p className="text-xs font-semibold text-danger-600 uppercase tracking-wide mb-1.5">
                Errors — must fix before export
              </p>
              <ul className="space-y-1">
                {errors.map((issue, i) => (
                  <li key={i} className="flex gap-2 text-xs text-danger-600">
                    <span className="shrink-0 font-mono text-danger-600">[{issue.code}]</span>
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="bg-warning-50 px-4 py-3">
              <p className="text-xs font-semibold text-warning-600 uppercase tracking-wide mb-1.5">
                Warnings — export allowed, review before cutting
              </p>
              <ul className="space-y-1">
                {warnings.map((issue, i) => (
                  <li key={i} className="flex gap-2 text-xs text-warning-600">
                    <span className="shrink-0 font-mono text-warning-500">[{issue.code}]</span>
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
                  <li key={i} className="flex gap-2 text-xs text-ink-muted">
                    <span className="shrink-0 font-mono text-ink-secondary">[{issue.code}]</span>
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
