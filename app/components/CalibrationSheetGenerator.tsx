'use client';

import { useMemo, useState } from 'react';
import {
  createDefaultMagicFlockCalibrationSheet,
  createBasicSvgExport,
  MAGIC_FLOCK_CRICUT_MAKER_PROFILE,
} from '@/src/lib/rhinestone-engine/index';

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalibrationSheetGenerator() {
  const [copied, setCopied] = useState(false);

  // Calibration sheet generation is deterministic — no user inputs needed.
  const { svgString, stoneCount, stoneSizes } = useMemo(() => {
    const sheet = createDefaultMagicFlockCalibrationSheet();

    const svgString = createBasicSvgExport(sheet, {
      includeGuideBox: true,
      includeLabels: true,
      paddingMm: 5,
      decimalPlaces: 3,
    });

    const uniqueSizes = [...new Set(sheet.stones.map((s) => s.stoneSize))];

    return {
      svgString,
      stoneCount: sheet.stones.length,
      stoneSizes: uniqueSizes,
    };
  }, []);

  const filename = 'magic-flock-calibration-sheet.svg';

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleDownload() {
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(svgString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable in non-secure contexts
    }
  }

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

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        {(
          [
            ['Material', MAGIC_FLOCK_CRICUT_MAKER_PROFILE.name],
            ['Cutter', MAGIC_FLOCK_CRICUT_MAKER_PROFILE.cutter],
            ['Stone sizes', stoneSizes.join(', ')],
            ['Total holes', stoneCount],
          ] as [string, string | number][]
        ).map(([label, value]) => (
          <div key={label}>
            <dt className="text-zinc-500">{label}</dt>
            <dd className="font-semibold text-zinc-900">{value}</dd>
          </div>
        ))}
      </dl>

      {/* ── SVG preview ──────────────────────────────────────────────────── */}
      <div className="overflow-auto rounded border border-zinc-200 bg-zinc-50 p-3">
        <p className="mb-2 text-xs text-zinc-400">
          Preview — dimensions are in mm (not to screen scale)
        </p>
        {/*
          The SVG string is produced entirely by createDefaultMagicFlockCalibrationSheet
          and createBasicSvgExport — both deterministic engine functions.
          No user-uploaded SVG or external files are parsed here.
          dangerouslySetInnerHTML is safe for this controlled, engine-only source.
        */}
        <div
          className="[&_svg]:h-auto [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svgString }}
        />
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleDownload}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500"
        >
          Download SVG
        </button>
        <button
          onClick={() => void handleCopy()}
          className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        >
          {copied ? 'Copied!' : 'Copy SVG'}
        </button>
        <span className="text-xs text-zinc-400">{filename}</span>
      </div>

    </div>
  );
}
