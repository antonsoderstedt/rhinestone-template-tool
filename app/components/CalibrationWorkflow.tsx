'use client';

import { useState, useMemo } from 'react';
import {
  createCalibrationOverrideSet,
  applyCalibrationOverridesToTemplate,
  createStoneGridTemplate,
  createBasicSvgExport,
  checkExportReadiness,
  getRecommendedHoleDiameter,
  getStoneSizeProfile,
  isHolePresetProvisional,
  MAGIC_FLOCK_CRICUT_MAKER_PROFILE,
  MAGIC_FLOCK_CRICUT_MAKER_3_RECOMMENDATION,
} from '@/src/lib/rhinestone-engine/index';
import type { StoneSizeId, ExportReadinessResult } from '@/src/lib/rhinestone-engine/index';
import ExportReadinessPanel from './ExportReadinessPanel';
import SvgExportActions from './SvgExportActions';
import MachineCutSettingsCard from './MachineCutSettingsCard';
import Badge from '@/app/editor/ui/Badge';

// ─── Constants ────────────────────────────────────────────────────────────────

const PROFILE_ID = 'magic-flock-cricut-maker';

// All stone sizes Magic Flock supports (matches MAGIC_FLOCK_CRICUT_MAKER_PROFILE.supportedStoneSizes).
const STONE_SIZES: StoneSizeId[] = [...MAGIC_FLOCK_CRICUT_MAKER_PROFILE.supportedStoneSizes];

/** Returns the recommended hole diameter for a stone size from the engine. */
function recommended(size: StoneSizeId): number {
  return getRecommendedHoleDiameter(size, PROFILE_ID);
}

/** Returns the stone physical diameter for display. */
function physicalDiameter(size: StoneSizeId): number {
  return getStoneSizeProfile(size).stoneDiameterMm;
}

// ─── State type ───────────────────────────────────────────────────────────────

type HoleMap = Record<StoneSizeId, string>; // string for controlled input

function defaultHoleMap(): HoleMap {
  return {
    SS6:  recommended('SS6').toString(),
    SS8:  recommended('SS8').toString(),
    SS10: recommended('SS10').toString(),
    SS12: recommended('SS12').toString(),
    SS16: recommended('SS16').toString(),
    SS20: recommended('SS20').toString(),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalibrationWorkflow() {
  const [holeMap, setHoleMap] = useState<HoleMap>(defaultHoleMap);

  /** Parsed numeric values — NaN if input is invalid. */
  const parsed = useMemo<Record<StoneSizeId, number>>(
    () => ({
      SS6:  parseFloat(holeMap.SS6),
      SS8:  parseFloat(holeMap.SS8),
      SS10: parseFloat(holeMap.SS10),
      SS12: parseFloat(holeMap.SS12),
      SS16: parseFloat(holeMap.SS16),
      SS20: parseFloat(holeMap.SS20),
    }),
    [holeMap],
  );

  const anyInvalid = STONE_SIZES.some((s) => isNaN(parsed[s]) || parsed[s] <= 0);

  /** Calibrated SS10 test grid with overrides applied. */
  type CalibResult =
    | { ok: true; svg: string; readiness: ExportReadinessResult }
    | { ok: false; error: string };

  const calibResult = useMemo<CalibResult>(() => {
    if (anyInvalid) return { ok: false, error: 'Enter valid hole diameters above.' };
    try {
      const overrideSet = createCalibrationOverrideSet({
        id: 'workflow-overrides',
        name: 'My Calibrated Values',
        materialProfileId: PROFILE_ID,
        overrides: STONE_SIZES.map((s) => ({
          stoneSize: s,
          holeDiameterMm: parsed[s],
        })),
      });

      const base = createStoneGridTemplate({
        id: 'calib-preview',
        name: 'Calibrated SS10 Test Grid',
        stoneSize: 'SS10',
        columns: 5,
        rows: 3,
        materialProfileId: PROFILE_ID,
      });

      const calibrated = applyCalibrationOverridesToTemplate(base, overrideSet);
      const readiness = checkExportReadiness(calibrated, { requireCalibration: false });
      const svg = createBasicSvgExport(calibrated, {
        includeGuideBox: true,
        includeLabels: false,
        paddingMm: 5,
        decimalPlaces: 3,
      });
      return { ok: true, svg, readiness };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }, [parsed, anyInvalid]);

  function handleChange(size: StoneSizeId, value: string) {
    setHoleMap((prev) => ({ ...prev, [size]: value }));
  }

  function handleReset() {
    setHoleMap(defaultHoleMap());
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Machine cut settings (separate from template settings below) ──── */}
      <MachineCutSettingsCard recommendation={MAGIC_FLOCK_CRICUT_MAKER_3_RECOMMENDATION} />

      {/* ── Explanation ──────────────────────────────────────────────────── */}
      <div className="rounded-lg bg-warning-50 border border-warning-500/30 px-5 py-4 text-sm text-warning-600 leading-relaxed">
        <p className="font-semibold mb-1">Template settings — how to calibrate hole diameter</p>
        <ol className="ml-4 list-decimal space-y-1 text-xs">
          <li>Download and cut the <strong>Calibration Sheet</strong> on a scrap of Magic Flock.</li>
          <li>Place stones in each hole and find which diameter seats correctly.</li>
          <li>Enter those measured hole diameters below (one per stone size).</li>
          <li>Use the calibrated preview grid to verify before production.</li>
        </ol>
        <p className="mt-2 text-xs text-warning-600">
          ⚠ Calibration values are stored in-memory only. They reset when you reload the page.
          Saved material profiles with persistent calibration will come in a future update.
        </p>
      </div>

      {/* ── Input fields ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-ink-secondary">Enter calibrated hole diameters (mm)</h3>
          <button
            onClick={handleReset}
            className="text-xs text-ink-muted hover:text-ink underline underline-offset-2"
          >
            Reset to recommended
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STONE_SIZES.map((size) => {
            const val = holeMap[size];
            const num = parseFloat(val);
            const invalid = isNaN(num) || num <= 0;
            const rec = recommended(size);
            const diff = !invalid ? (num - rec) : null;
            return (
              <div key={size} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-ink-muted flex items-center gap-1.5" htmlFor={`hole-${size}`}>
                  {size} <span className="text-ink-secondary">({physicalDiameter(size)} mm stone)</span>
                  {isHolePresetProvisional(size, PROFILE_ID) && <Badge tone="warning">Provisional</Badge>}
                </label>
                <input
                  id={`hole-${size}`}
                  type="number"
                  min={0.1}
                  step={0.05}
                  value={val}
                  onChange={(e) => handleChange(size, e.target.value)}
                  className={`rounded border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 ${
                    invalid
                      ? 'border-danger-500 bg-danger-50 focus:ring-danger-400'
                      : 'border-border-strong focus:ring-accent-400'
                  }`}
                />
                {!invalid && diff !== null && (
                  <span className={`text-xs ${Math.abs(diff) < 0.001 ? 'text-ink-secondary' : diff > 0 ? 'text-warning-600' : 'text-info-600'}`}>
                    {diff > 0 ? '+' : ''}{diff.toFixed(3)} mm vs recommended
                  </span>
                )}
                {invalid && (
                  <span className="text-xs text-danger-500">Enter a value &gt; 0</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Comparison table ─────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-sand-100 text-ink-muted uppercase tracking-wide text-[10px]">
              <th className="text-left px-3 py-2">Size</th>
              <th className="text-right px-3 py-2">Stone Ø</th>
              <th className="text-right px-3 py-2">Recommended hole</th>
              <th className="text-right px-3 py-2">Calibrated hole</th>
              <th className="text-right px-3 py-2">Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {STONE_SIZES.map((size) => {
              const rec  = recommended(size);
              const num  = parseFloat(holeMap[size]);
              const invalid = isNaN(num) || num <= 0;
              const diff = !invalid ? num - rec : null;
              return (
                <tr key={size} className="hover:bg-sand-50">
                  <td className="px-3 py-2 font-semibold text-ink">
                    <span className="flex items-center gap-1.5">
                      {size}
                      {isHolePresetProvisional(size, PROFILE_ID) && <Badge tone="warning">Provisional</Badge>}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-ink-muted">{physicalDiameter(size)} mm</td>
                  <td className="px-3 py-2 text-right text-ink-muted">{rec.toFixed(2)} mm</td>
                  <td className="px-3 py-2 text-right font-medium text-ink">
                    {invalid ? <span className="text-danger-500">—</span> : `${num.toFixed(2)} mm`}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${
                    diff === null ? 'text-ink-secondary' :
                    Math.abs(diff) < 0.001 ? 'text-ink-secondary' :
                    diff > 0 ? 'text-warning-600' : 'text-info-600'
                  }`}>
                    {diff === null ? '—' : `${diff >= 0 ? '+' : ''}${diff.toFixed(3)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Calibrated preview ───────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-ink-secondary mb-3">
          Calibrated SS10 Test Grid (5×3)
        </h3>

        {!calibResult.ok ? (
          <div className="rounded border border-danger-500/30 bg-danger-50 p-3 text-sm text-danger-600">
            {calibResult.error}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <ExportReadinessPanel result={calibResult.readiness} />
            <SvgExportActions
              svg={calibResult.svg}
              filename={`rhinestone-calibrated-ss10-5x3.svg`}
              disabled={!calibResult.readiness.ready}
            />
          </div>
        )}
      </div>

    </div>
  );
}
