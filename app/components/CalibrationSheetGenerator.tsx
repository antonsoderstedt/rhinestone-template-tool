'use client';

import { useMemo } from 'react';
import {
  createDefaultMagicFlockCalibrationSheet,
  createBasicSvgExport,
  MAGIC_FLOCK_CRICUT_MAKER_PROFILE,
  checkExportReadiness,
  getCalibrationSeries,
  getRecommendedHoleDiameter,
  isHolePresetProvisional,
} from '@/src/lib/rhinestone-engine/index';
import SvgPreview from './SvgPreview';
import SvgExportActions from './SvgExportActions';
import TemplateStatsCard from './TemplateStatsCard';
import ExportReadinessPanel from './ExportReadinessPanel';
import Badge from '@/app/editor/ui/Badge';

function formatMm(value: number): string {
  return value.toFixed(2);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalibrationSheetGenerator() {
  // Calibration sheet generation is deterministic — no user inputs needed.
  const { svgString, stoneCount, readiness, sizeRows } = useMemo(() => {
    const sheet = createDefaultMagicFlockCalibrationSheet();

    const svgString = createBasicSvgExport(sheet, {
      includeGuideBox: true,
      includeLabels: true,
      paddingMm: 5,
      decimalPlaces: 3,
    });

    const readiness = checkExportReadiness(sheet);

    const sizeRows = MAGIC_FLOCK_CRICUT_MAKER_PROFILE.supportedStoneSizes.map((stoneSize) => ({
      stoneSize,
      series: getCalibrationSeries(stoneSize),
      recommended: getRecommendedHoleDiameter(stoneSize),
      provisional: isHolePresetProvisional(stoneSize),
    }));

    return {
      svgString,
      stoneCount: sheet.stones.length,
      readiness,
      sizeRows,
    };
  }, []);

  const filename = 'magic-flock-calibration-sheet.svg';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* ── Warning banner ───────────────────────────────────────────────── */}
      <div className="rounded border border-warning-500/40 bg-warning-50 p-3 text-sm text-warning-600">
        <strong>⚠ Provisional values.</strong> Cut and test this sheet before using
        any stone size for production templates. Hole diameters vary by blade condition,
        mat tackiness, flock batch, and ambient humidity.
      </div>

      {/* ── Explanation ──────────────────────────────────────────────────── */}
      <div className="text-sm text-ink-muted leading-relaxed space-y-2">
        <p>
          This sheet contains five hole diameter test values per stone size, drawn
          from Magic Flock&apos;s own calibration series for each size (not a generic
          offset formula). The <strong>standard</strong> value is Magic Flock&apos;s
          verified default hole diameter for that stone size.
        </p>
        <p>
          Cut the sheet on Magic Flock with your Cricut Maker 3. Place stones in each
          hole. The column where the stone snaps in firmly without tearing is the
          correct diameter for your specific machine and material batch.
        </p>
        <p>
          Record that offset as the <span className="font-mono text-xs">kerfCompensationMm</span> for
          your material profile.
        </p>
      </div>

      {/* ── Per-size calibration values table ────────────────────────────── */}
      <div className="rounded-lg border border-sand-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-sand-50 text-left text-ink-muted">
              <th className="px-3 py-2 font-medium">Stone size</th>
              <th className="px-3 py-2 font-medium">Test values (mm)</th>
              <th className="px-3 py-2 font-medium">Standard</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {sizeRows.map(({ stoneSize, series, recommended, provisional }) => (
              <tr key={stoneSize} className="border-t border-sand-200">
                <td className="px-3 py-2 font-medium text-ink-primary">{stoneSize}</td>
                <td className="px-3 py-2 font-mono text-xs text-ink-secondary">
                  {series.map((v) => formatMm(v)).join(' · ')}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-ink-primary">{formatMm(recommended)}</td>
                <td className="px-3 py-2">
                  {provisional && <Badge tone="warning">Provisional</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SS12 is preliminary only — no verified vendor value exists yet. */}
      {sizeRows.some((row) => row.provisional) && (
        <div className="rounded border border-warning-500/40 bg-warning-50 p-3 text-sm text-warning-600">
          <strong>SS12 has no verified official value yet.</strong> The values above
          are a preliminary starting point only. Cut the calibration sheet and choose
          the smallest hole where the stone brushes in easily and seats/turns correctly,
          then treat that as your own calibrated value — never as an official default.
        </div>
      )}

      <TemplateStatsCard
        stoneCount={stoneCount}
        material={MAGIC_FLOCK_CRICUT_MAKER_PROFILE.name}
        cutter={MAGIC_FLOCK_CRICUT_MAKER_PROFILE.cutter}
        extraStats={[{ label: 'Stone sizes', value: sizeRows.map((r) => r.stoneSize).join(', ') }]}
      />

      <ExportReadinessPanel result={readiness} />

      <SvgPreview svg={svgString} title="Calibration sheet preview" />

      {/* Calibration sheet download is never blocked by calibration warnings alone —
          warnings are expected on a sheet whose purpose is to find the correct values. */}
      <SvgExportActions svg={svgString} filename={filename} />

    </div>
  );
}
