import type { ExportReadinessResult } from '@/src/lib/rhinestone-engine/index';
import { getExportConfidence, summarizeExportStatus } from './summarizeExportStatus';

import { useT } from '../lib/i18n';
interface ExportReadinessPanelProps {
  result: ExportReadinessResult | null;
  showCalibrationStep?: boolean;
}

/**
 * Displays export readiness status for a RhinestoneTemplate.
 *
 * Readiness logic lives entirely in the engine (checkExportReadiness).
 * This component only renders the result — it never recomputes readiness.
 */
export default function ExportReadinessPanel({ result, showCalibrationStep = true }: ExportReadinessPanelProps) {
  const t = useT();
  if (!result) return null;

  const summary = summarizeExportStatus(result);
  const errors = summary.designErrors;
  const warnings = summary.designWarnings;
  const infos = result.issues.filter((i) => i.severity === 'info');
  const nextAction = summary.needsCalibration
    ? 'Approve your material to unlock export.'
    : errors[0]?.suggestion ?? warnings[0]?.suggestion ?? infos[0]?.suggestion ?? 'Review the export checklist and continue only if the file matches your intended cut.';
  const confidence = getExportConfidence(summary);
  const confidenceTextClass = confidence.tone === 'success' ? 'text-success-600' : confidence.tone === 'danger' ? 'text-danger-600' : 'text-warning-600';
  const statusBarClass = confidence.tone === 'success'
    ? 'bg-success-600 text-ink-inverse'
    : confidence.tone === 'danger'
      ? 'bg-danger-600 text-ink-inverse'
      : 'bg-warning-50 text-warning-700 border-b border-warning-500/30';
  const statusIcon = confidence.tone === 'success' ? '✓' : confidence.tone === 'danger' ? '✗' : '!';

  return (
    <div className="rounded-lg border overflow-hidden text-sm">

      {/* ── Status bar ────────────────────────────────────────────────── */}
      <div
        className={`flex items-center gap-2 px-4 py-2.5 font-semibold ${statusBarClass}`}
      >
        <span className="text-base">{statusIcon}</span>
        <span>{confidence.headline}</span>
      </div>

      {/* ── Summary stats ─────────────────────────────────────────────── */}
      <div className="bg-surface border-b border-border px-4 py-3">
        <div className="mb-3 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
          <span>{t('Export confidence')}</span>
          <span className={confidenceTextClass}>{confidence.label}</span>
        </div>

        <div className="rounded-md border border-border bg-surface-raised p-2 text-xs leading-5 text-ink-secondary">
          <div className="font-semibold uppercase tracking-[0.12em] text-ink-muted">{t('Next action')}</div>
          <p className="mt-1 text-sm leading-6 text-ink">{nextAction}</p>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-ink-secondary uppercase tracking-wide text-xs">{t('Stones')}</dt>
            <dd className="font-semibold text-ink text-sm">{result.summary.stoneCount}</dd>
          </div>
          <div>
            <dt className="text-ink-secondary uppercase tracking-wide text-xs">{t('Width')}</dt>
            <dd className="font-semibold text-ink text-sm">{result.summary.widthMm.toFixed(1)} mm</dd>
          </div>
          <div>
            <dt className="text-ink-secondary uppercase tracking-wide text-xs">{t('Height')}</dt>
            <dd className="font-semibold text-ink text-sm">{result.summary.heightMm.toFixed(1)} mm</dd>
          </div>
          <div>
            <dt className="text-ink-secondary uppercase tracking-wide text-xs">{t('Cutter')}</dt>
            <dd className="font-semibold text-ink text-sm truncate">{result.summary.cutter}</dd>
          </div>
        </dl>
      </div>

      {/* ── Issues ────────────────────────────────────────────────────── */}
      {(summary.needsCalibration || errors.length > 0 || warnings.length > 0 || infos.length > 0) && (
        <div className="divide-y divide-border">
          {showCalibrationStep && summary.needsCalibration && (
            <div className="bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5">
                {t('Export step — calibration required')}
              </p>
            </div>
          )}

          {errors.length > 0 && (
            <div className="bg-danger-50 px-4 py-3">
              <p className="text-xs font-semibold text-danger-600 uppercase tracking-wide mb-1.5">
                {t('Errors — must fix before export')}
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
                {t('Warnings — export allowed, review before cutting')}
              </p>
              <ul className="space-y-1">
                {warnings.map((issue, i) => (
                  <li key={i} className="flex gap-2 text-xs text-warning-600">
                    <span className="shrink-0 font-mono text-warning-700">[{issue.code}]</span>
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
