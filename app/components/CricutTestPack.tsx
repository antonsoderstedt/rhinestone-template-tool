'use client';

import { useState, useMemo } from 'react';
import {
  createCricutTestPack,
  createBasicSvgExport,
  checkExportReadiness,
  MAGIC_FLOCK_CRICUT_MAKER_3_RECOMMENDATION,
} from '@/src/lib/rhinestone-engine/index';
import type { StoneSizeId, CricutTestPackItem, ExportReadinessResult } from '@/src/lib/rhinestone-engine/index';
import SvgExportActions from './SvgExportActions';
import MachineCutSettingsCard from './MachineCutSettingsCard';

// ─── Stone size options ───────────────────────────────────────────────────────

const STONE_SIZES: StoneSizeId[] = ['SS6', 'SS8', 'SS10', 'SS12', 'SS16', 'SS20'];

// ─── Per-item type (adds readiness + svg to the engine item) ──────────────────

interface PackItemView extends CricutTestPackItem {
  svg: string;
  readiness: ExportReadinessResult;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CricutTestPack() {
  const [stoneSize, setStoneSize] = useState<StoneSizeId>('SS10');

  /** Build the full pack with SVG and readiness data — deterministic per stoneSize. */
  const items = useMemo<PackItemView[]>(() => {
    const pack = createCricutTestPack({ stoneSize });
    return pack.templates.map((item) => ({
      ...item,
      svg: createBasicSvgExport(item.template, {
        includeGuideBox: true,
        includeLabels: false,
        paddingMm: 5,
        decimalPlaces: 3,
      }),
      readiness: checkExportReadiness(item.template, { requireCalibration: false }),
    }));
  }, [stoneSize]);

  return (
    <div className="flex flex-col gap-6">

      {/* ── Intro ────────────────────────────────────────────────────────── */}
      <div className="rounded-lg bg-info-50 border border-info-500/30 px-5 py-4 text-sm text-info-600 leading-relaxed">
        <p className="font-semibold text-base mb-1">What is the Cricut Test Pack?</p>
        <p>
          A curated set of four SVG templates designed to help you validate your
          Cricut Maker 3 + Magic Flock setup before cutting production designs.
          Download all four, import them into Cricut Design Space, and cut on a
          small scrap of Magic Flock first.
        </p>
        <ol className="mt-2 ml-4 list-decimal space-y-0.5 text-xs text-info-600">
          <li>Cut the <strong>Calibration Sheet</strong> — find the correct hole diameter for your blade and flock batch.</li>
          <li>Cut the <strong>Grid</strong> — verify stone seating and spacing.</li>
          <li>Cut <strong>SMOOCH</strong> — test text density.</li>
          <li>Cut the <strong>Diamond</strong> — test outline shape accuracy at corners.</li>
        </ol>
      </div>

      {/* ── Machine cut settings (separate from the template cards below) ──── */}
      <MachineCutSettingsCard recommendation={MAGIC_FLOCK_CRICUT_MAKER_3_RECOMMENDATION} />

      {/* ── Stone size selector ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-ink-secondary" htmlFor="pack-stone-size">
          Stone size for this pack:
        </label>
        <select
          id="pack-stone-size"
          value={stoneSize}
          onChange={(e) => setStoneSize(e.target.value as StoneSizeId)}
          className="rounded border border-border-strong bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-400"
        >
          {STONE_SIZES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-xs text-ink-secondary">(calibration sheet always covers all sizes)</span>
      </div>

      {/* ── Template cards ────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <PackItemCard key={item.id} item={item} />
        ))}
      </div>

    </div>
  );
}

// ─── Individual card ──────────────────────────────────────────────────────────

function PackItemCard({ item }: { item: PackItemView }) {
  const { readiness } = item;
  const errors = readiness.issues.filter((i) => i.severity === 'error');

  return (
    <div className="rounded-lg border border-border bg-white overflow-hidden shadow-sm">

      {/* Status strip */}
      <div
        className={`px-4 py-2 text-xs font-semibold flex items-center gap-1.5 ${
          readiness.ready
            ? 'bg-success-500 text-ink-inverse'
            : 'bg-danger-500 text-ink-inverse'
        }`}
      >
        {readiness.ready ? '✓ Ready' : '✗ Has errors'}
      </div>

      {/* Card body */}
      <div className="px-4 py-4 flex flex-col gap-3">
        <div>
          <p className="font-semibold text-ink text-sm">{item.name}</p>
          <p className="text-xs text-ink-muted mt-0.5">{item.description}</p>
        </div>

        {/* Stats */}
        <dl className="grid grid-cols-3 gap-x-3 text-xs">
          <div>
            <dt className="text-ink-secondary uppercase tracking-wide text-[10px]">Stones</dt>
            <dd className="font-semibold text-ink">{readiness.summary.stoneCount}</dd>
          </div>
          <div>
            <dt className="text-ink-secondary uppercase tracking-wide text-[10px]">Width</dt>
            <dd className="font-semibold text-ink">{readiness.summary.widthMm.toFixed(1)} mm</dd>
          </div>
          <div>
            <dt className="text-ink-secondary uppercase tracking-wide text-[10px]">Height</dt>
            <dd className="font-semibold text-ink">{readiness.summary.heightMm.toFixed(1)} mm</dd>
          </div>
        </dl>

        {/* Errors (if any) */}
        {errors.length > 0 && (
          <ul className="text-xs text-danger-600 list-disc pl-4 space-y-0.5">
            {errors.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
        )}

        {/* Download / copy */}
        <SvgExportActions
          svg={item.svg}
          filename={item.recommendedFilename}
          disabled={!readiness.ready}
        />
      </div>
    </div>
  );
}
