'use client';

import { useMemo } from 'react';
import {
  createDefaultMagicFlockCalibrationSheet,
  createBasicSvgExport,
  MAGIC_FLOCK_CRICUT_MAKER_PROFILE,
  checkExportReadiness,
} from '@/src/lib/rhinestone-engine/index';
import SvgPreview from './SvgPreview';
import SvgExportActions from './SvgExportActions';
import TemplateStatsCard from './TemplateStatsCard';
import ExportReadinessPanel from './ExportReadinessPanel';

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalibrationSheetGenerator() {
  // Calibration sheet generation is deterministic — no user inputs needed.
  const { svgString, stoneCount, stoneSizes, readiness } = useMemo(() => {
    const sheet = createDefaultMagicFlockCalibrationSheet();

    const svgString = createBasicSvgExport(sheet, {
      includeGuideBox: true,
      includeLabels: true,
      paddingMm: 5,
      decimalPlaces: 3,
    });

    const uniqueSizes = [...new Set(sheet.stones.map((s) => s.stoneSize))];
    const readiness = checkExportReadiness(sheet);

    return {
      svgString,
      stoneCount: sheet.stones.length,
      stoneSizes: uniqueSizes,
      readiness,
    };
  }, []);

  const filename = 'magic-flock-calibration-sheet.svg';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* ── Warning banner ───────────────────────────────────────────────── */}
      <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        <strong>⚠ Provisional values.</strong> Cut and test this sheet before using
        any stone size for production templates. Hole diameters vary by blade condition,
        mat tackiness, flock batch, and ambient humidity.
      </div>

      {/* ── Explanation ──────────────────────────────────────────────────── */}
      <div className="text-sm text-zinc-600 leading-relaxed space-y-2">
        <p>
          This sheet contains four hole diameter variants per stone size — at
          <span className="font-mono text-xs mx-1">recommended−0.1&nbsp;mm</span>,
          <span className="font-mono text-xs mx-1">recommended</span>,
          <span className="font-mono text-xs mx-1">recommended+0.1&nbsp;mm</span>, and
          <span className="font-mono text-xs mx-1">recommended+0.2&nbsp;mm</span>.
        </p>
        <p>
          Cut the sheet on Magic Flock with your Cricut Maker. Place stones in each
          hole. The column where the stone snaps in firmly without tearing is the
          correct diameter for your specific machine and material batch.
        </p>
        <p>
          Record that offset as the <span className="font-mono text-xs">kerfCompensationMm</span> for
          your material profile.
        </p>
      </div>

      <TemplateStatsCard
        stoneCount={stoneCount}
        material={MAGIC_FLOCK_CRICUT_MAKER_PROFILE.name}
        cutter={MAGIC_FLOCK_CRICUT_MAKER_PROFILE.cutter}
        extraStats={[{ label: 'Stone sizes', value: stoneSizes.join(', ') }]}
      />

      <ExportReadinessPanel result={readiness} />

      <SvgPreview svg={svgString} title="Calibration sheet preview" />

      {/* Calibration sheet download is never blocked by calibration warnings alone —
          warnings are expected on a sheet whose purpose is to find the correct values. */}
      <SvgExportActions svg={svgString} filename={filename} />

    </div>
  );
}
