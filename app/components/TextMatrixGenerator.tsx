'use client';

import { useState, useMemo } from 'react';
import {
  createDotMatrixTextTemplate,
  validateRhinestoneTemplate,
  createBasicSvgExport,
} from '@/src/lib/rhinestone-engine/index';
import type { StoneSizeId, TemplateValidationResult } from '@/src/lib/rhinestone-engine/index';
import SvgPreview from './SvgPreview';
import SvgExportActions from './SvgExportActions';
import TemplateStatsCard from './TemplateStatsCard';
import ValidationIssuesList from './ValidationIssuesList';

// ─── Constants ────────────────────────────────────────────────────────────────

const STONE_SIZES: StoneSizeId[] = ['SS6', 'SS8', 'SS10', 'SS12'];

// ─── Types ────────────────────────────────────────────────────────────────────

type GeneratorResult =
  | {
      ok: true;
      svgString: string;
      stoneCount: number;
      validation: TemplateValidationResult;
    }
  | { ok: false; error: string };

// ─── Component ────────────────────────────────────────────────────────────────

export default function TextMatrixGenerator() {
  const [text, setText] = useState('SMOOCH');
  const [stoneSize, setStoneSize] = useState<StoneSizeId>('SS10');
  const [includeGuideBox, setIncludeGuideBox] = useState(true);
  const [includeLabels, setIncludeLabels] = useState(false);
  const [paddingMm, setPaddingMm] = useState(5);

  const result = useMemo<GeneratorResult>(() => {
    try {
      const template = createDotMatrixTextTemplate({
        id: `text-dot-matrix-${stoneSize.toLowerCase()}`,
        name: `Dot Matrix Text — ${stoneSize}`,
        text,
        stoneSize,
      });

      const validation = validateRhinestoneTemplate(template);

      const svgString = createBasicSvgExport(template, {
        includeGuideBox,
        includeLabels,
        paddingMm,
        decimalPlaces: 3,
      });

      return { ok: true, svgString, stoneCount: template.stones.length, validation };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [text, stoneSize, includeGuideBox, includeLabels, paddingMm]);

  const filename = `rhinestone-text-dot-matrix-${stoneSize.toLowerCase()}.svg`;

  return (
    <div className="flex flex-col gap-6">

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-sm font-medium text-zinc-700">Text</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Enter text (A–Z, 0–9, punctuation). New line = new row."
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-zinc-400 resize-y"
          />
          <span className="text-xs text-zinc-400">
            Dot Matrix 5×7 — uppercase A–Z, 0–9, . , ! ? - _  • Press Enter for a new line
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Stone Size</span>
          <select
            value={stoneSize}
            onChange={(e) => setStoneSize(e.target.value as StoneSizeId)}
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            {STONE_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Padding (mm)</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={paddingMm}
            onChange={(e) => setPaddingMm(Math.max(0, Number(e.target.value)))}
            className="rounded border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeGuideBox}
            onChange={(e) => setIncludeGuideBox(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          <span className="text-sm font-medium text-zinc-700">Include guide box</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeLabels}
            onChange={(e) => setIncludeLabels(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          <span className="text-sm font-medium text-zinc-700">Include labels</span>
        </label>

      </div>

      {/* ── Error state ──────────────────────────────────────────────────── */}
      {!result.ok && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <strong>Error:</strong> {result.error}
        </div>
      )}

      {result.ok && (
        <>
          <ValidationIssuesList
            valid={result.validation.valid}
            issues={result.validation.issues}
          />

          <TemplateStatsCard
            stoneSize={stoneSize}
            stoneCount={result.stoneCount}
            extraStats={[
              { label: 'Text', value: text.replace(/\n/g, ' ↵ ') },
              { label: 'Font mode', value: 'Dot Matrix 5×7' },
            ]}
          />

          <SvgPreview svg={result.svgString} title="Text template preview" />

          <SvgExportActions svg={result.svgString} filename={filename} />
        </>
      )}
    </div>
  );
}
