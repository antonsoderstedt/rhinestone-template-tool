import type { MachineRecommendation } from '@/src/lib/rhinestone-engine/index';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Displays a material's machine cut settings (blade, pressure, passes, mat,
 * material handling) — kept visually and structurally separate from template
 * settings (hole diameter, edge spacing, stone size, calibration value),
 * which live in CalibrationSheetGenerator / CalibrationWorkflow instead.
 *
 * These are Cricut *machine* settings, not template geometry: changing them
 * never affects hole diameters, spacing, or exported SVG coordinates.
 */
export default function MachineCutSettingsCard({
  recommendation,
}: {
  recommendation: MachineRecommendation;
}) {
  return (
    <div className="rounded-lg border border-accent-500/30 bg-accent-50 px-5 py-4 text-sm">
      <p className="font-semibold text-accent-700 text-base mb-1">
        Machine cut settings — {recommendation.machine}
      </p>
      <p className="text-xs text-accent-700/80 mb-3">
        These are cutter settings, not template settings. They control how your
        machine cuts the material and never change hole diameter, spacing, or
        exported dimensions.
      </p>

      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-accent-700/70 uppercase tracking-wide text-[10px]">Material</dt>
          <dd className="font-semibold text-ink">{recommendation.material}</dd>
        </div>
        <div>
          <dt className="text-accent-700/70 uppercase tracking-wide text-[10px]">Blade</dt>
          <dd className="font-semibold text-ink">{recommendation.blade}</dd>
        </div>
        <div>
          <dt className="text-accent-700/70 uppercase tracking-wide text-[10px]">Custom pressure</dt>
          <dd className="font-semibold text-ink">{recommendation.customPressure}</dd>
        </div>
        <div>
          <dt className="text-accent-700/70 uppercase tracking-wide text-[10px]">Pressure</dt>
          <dd className="font-semibold text-ink">{recommendation.pressureSetting}</dd>
        </div>
        <div>
          <dt className="text-accent-700/70 uppercase tracking-wide text-[10px]">Passes</dt>
          <dd className="font-semibold text-ink">{recommendation.passes}</dd>
        </div>
        <div>
          <dt className="text-accent-700/70 uppercase tracking-wide text-[10px]">Multi-cut</dt>
          <dd className="font-semibold text-ink">{recommendation.multiCut ? 'On' : 'Off'}</dd>
        </div>
        <div>
          <dt className="text-accent-700/70 uppercase tracking-wide text-[10px]">Mirror</dt>
          <dd className="font-semibold text-ink">{recommendation.mirror ? 'Yes' : 'No'}</dd>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-accent-700/70 uppercase tracking-wide text-[10px]">Liner</dt>
          <dd className="text-ink">{recommendation.linerHandling}</dd>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-accent-700/70 uppercase tracking-wide text-[10px]">Mat</dt>
          <dd className="text-ink">{recommendation.mat}</dd>
        </div>
      </dl>

      {recommendation.testCutRequired && (
        <p className="mt-3 text-xs font-medium text-warning-600">
          ⚠ A test cut on scrap material is mandatory before cutting production designs.
        </p>
      )}

      <p className="mt-2 text-xs text-accent-700/80 leading-relaxed">{recommendation.helpText}</p>

      {recommendation.alternativePressure && (
        <div className="mt-3 rounded border border-accent-500/30 bg-white px-3 py-2 text-xs text-ink-secondary">
          <strong className="text-ink">Alternative custom pressure: {recommendation.alternativePressure.customPressure}.</strong>{' '}
          {recommendation.alternativePressure.label}
        </div>
      )}
    </div>
  );
}
