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
} from '@/src/lib/rhinestone-engine/index';
import type { StoneSizeId, ExportReadinessResult } from '@/src/lib/rhinestone-engine/index';
import ExportReadinessPanel from './ExportReadinessPanel';
import SvgExportActions from './SvgExportActions';

// ─── Constants ────────────────────────────────────────────────────────────────

const PROFILE_ID = 'magic-flock-cricut-maker';

// Only show standard sizes in calibration workflow, not rhinestone font sizes
const STONE_SIZES: StoneSizeId[] = ['SS6', 'SS8', 'SS10', 'SS12'];

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

      {/* ── Explanation ──────────────────────────────────────────────────── */}
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-5 py-4 text-sm text-amber-900 leading-relaxed">
        <p className="font-semibold mb-1">How to calibrate</p>
        <ol className="ml-4 list-decimal space-y-1 text-xs">
          <li>Download and cut the <strong>Calibration Sheet</strong> on a scrap of Magic Flock.</li>
          <li>Place stones in each hole and find which diameter seats correctly.</li>
          <li>Enter those measured hole diameters below (one per stone size).</li>
          <li>Use the calibrated preview grid to verify before production.</li>
        </ol>
        <p className="mt-2 text-xs text-amber-700">
          ⚠ Calibration values are stored in-memory only. They reset when you reload the page.
          Saved material profiles with persistent calibration will come in a future update.
        </p>
      </div>

      {/* ── Input fields ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-700">Enter calibrated hole diameters (mm)</h3>
          <button
            onClick={handleReset}
            className="text-xs text-zinc-500 hover:text-zinc-800 underline underline-offset-2"
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
                <label className="text-xs font-medium text-zinc-600" htmlFor={`hole-${size}`}>
                  {size} <span className="text-zinc-400">({physicalDiameter(size)} mm stone)</span>
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
                      ? 'border-red-400 bg-red-50 focus:ring-red-300'
                      : 'border-zinc-300 focus:ring-zinc-400'
                  }`}
                />
                {!invalid && diff !== null && (
                  <span className={`text-xs ${Math.abs(diff) < 0.001 ? 'text-zinc-400' : diff > 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                    {diff > 0 ? '+' : ''}{diff.toFixed(3)} mm vs recommended
                  </span>
                )}
                {invalid && (
                  <span className="text-xs text-red-500">Enter a value &gt; 0</span>
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
            <tr className="bg-zinc-100 text-zinc-500 uppercase tracking-wide text-[10px]">
              <th className="text-left px-3 py-2">Size</th>
              <th className="text-right px-3 py-2">Stone Ø</th>
              <th className="text-right px-3 py-2">Recommended hole</th>
              <th className="text-right px-3 py-2">Calibrated hole</th>
              <th className="text-right px-3 py-2">Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {STONE_SIZES.map((size) => {
              const rec  = recommended(size);
              const num  = parseFloat(holeMap[size]);
              const invalid = isNaN(num) || num <= 0;
              const diff = !invalid ? num - rec : null;
              return (
                <tr key={size} className="hover:bg-zinc-50">
                  <td className="px-3 py-2 font-semibold text-zinc-800">{size}</td>
                  <td className="px-3 py-2 text-right text-zinc-600">{physicalDiameter(size)} mm</td>
                  <td className="px-3 py-2 text-right text-zinc-600">{rec.toFixed(2)} mm</td>
                  <td className="px-3 py-2 text-right font-medium text-zinc-900">
                    {invalid ? <span className="text-red-500">—</span> : `${num.toFixed(2)} mm`}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono ${
                    diff === null ? 'text-zinc-400' :
                    Math.abs(diff) < 0.001 ? 'text-zinc-400' :
                    diff > 0 ? 'text-amber-600' : 'text-blue-600'
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
        <h3 className="text-sm font-semibold text-zinc-700 mb-3">
          Calibrated SS10 Test Grid (5×3)
        </h3>

        {!calibResult.ok ? (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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
