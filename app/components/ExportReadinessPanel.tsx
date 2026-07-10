import type { ExportReadinessResult } from '@/src/lib/rhinestone-engine/index';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExportReadinessPanelProps {
  result: ExportReadinessResult | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Displays the export readiness status for a RhinestoneTemplate.
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
    <div
      className={`rounded border p-3 text-sm ${
        result.ready
          ? 'border-green-300 bg-green-50'
          : 'border-red-300 bg-red-50'
      }`}
    >
      {/* ── Status ──────────────────────────────────────────────────────── */}
      <p
        className={`font-semibold mb-2 ${
          result.ready ? 'text-green-800' : 'text-red-700'
        }`}
      >
        {result.ready
          ? '✓ Ready for Cricut SVG export'
          : '✗ Fix errors before cutting'}
      </p>

      {/* ── Summary stats ───────────────────────────────────────────────── */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-zinc-500">Stones</dt>
          <dd className="font-medium text-zinc-900">{result.summary.stoneCount}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Width</dt>
          <dd className="font-medium text-zinc-900">{result.summary.widthMm.toFixed(1)} mm</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Height</dt>
          <dd className="font-medium text-zinc-900">{result.summary.heightMm.toFixed(1)} mm</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Cutter</dt>
          <dd className="font-medium text-zinc-900">{result.summary.cutter}</dd>
        </div>
      </dl>

      {/* ── Errors ──────────────────────────────────────────────────────── */}
      {errors.length > 0 && (
        <ul className="list-disc pl-4 text-xs space-y-0.5 text-red-700">
          {errors.map((issue, i) => (
            <li key={i}>
              <span className="font-mono">[{issue.code}]</span> {issue.message}
            </li>
          ))}
        </ul>
      )}

      {/* ── Warnings ────────────────────────────────────────────────────── */}
      {warnings.length > 0 && (
        <ul className="list-disc pl-4 text-xs space-y-0.5 text-amber-700 mt-1">
          {warnings.map((issue, i) => (
            <li key={i}>
              <span className="font-mono">[{issue.code}]</span> {issue.message}
            </li>
          ))}
        </ul>
      )}

      {/* ── Info ────────────────────────────────────────────────────────── */}
      {infos.length > 0 && (
        <ul className="list-none text-xs space-y-0.5 text-zinc-500 mt-1">
          {infos.map((issue, i) => (
            <li key={i}>
              <span className="font-mono text-zinc-400">[{issue.code}]</span>{' '}
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
