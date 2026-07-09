'use client';

import { useState, useMemo } from 'react';
import {
  createStoneGridTemplate,
  validateRhinestoneTemplate,
  createBasicSvgExport,
} from '@/src/lib/rhinestone-engine/index';
import type { StoneSizeId, TemplateValidationResult } from '@/src/lib/rhinestone-engine/index';

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

export default function ManualGridGenerator() {
  // Form state
  const [stoneSize, setStoneSize] = useState<StoneSizeId>('SS10');
  const [columns, setColumns] = useState(5);
  const [rows, setRows] = useState(3);
  const [includeGuideBox, setIncludeGuideBox] = useState(true);
  const [includeLabels, setIncludeLabels] = useState(true);
  const [paddingMm, setPaddingMm] = useState(5);

  // Transient UI state
  const [copied, setCopied] = useState(false);

  // Derived: template + validation + SVG — recomputed whenever form values change
  const result = useMemo<GeneratorResult>(() => {
    try {
      const template = createStoneGridTemplate({
        id: `grid-${stoneSize.toLowerCase()}-${columns}x${rows}`,
        name: `${stoneSize} Grid ${columns}×${rows}`,
        stoneSize,
        columns,
        rows,
      });

      const validation = validateRhinestoneTemplate(template);

      // createBasicSvgExport only accepts unit="mm" templates — guaranteed by
      // createStoneGridTemplate, but validateRhinestoneTemplate would catch any
      // issue before we reach here.
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
  }, [stoneSize, columns, rows, includeGuideBox, includeLabels, paddingMm]);

  const filename = `rhinestone-grid-${stoneSize.toLowerCase()}-${columns}x${rows}.svg`;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleDownload() {
    if (!result.ok) return;
    const blob = new Blob([result.svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopy() {
    if (!result.ok) return;
    try {
      await navigator.clipboard.writeText(result.svgString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable in non-secure contexts
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* ── Controls ────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">

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

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Columns</span>
          <input
            type="number"
            min={1}
            max={50}
            value={columns}
            onChange={(e) => setColumns(Math.max(1, Math.floor(Number(e.target.value))))}
            className="rounded border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Rows</span>
          <input
            type="number"
            min={1}
            max={50}
            value={rows}
            onChange={(e) => setRows(Math.max(1, Math.floor(Number(e.target.value))))}
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
          {/* ── Validation status ──────────────────────────────────────── */}
          <div
            className={`rounded border p-3 text-sm ${
              result.validation.valid
                ? 'border-green-300 bg-green-50 text-green-800'
                : 'border-red-300 bg-red-50 text-red-700'
            }`}
          >
            <strong>
              {result.validation.valid ? '✓ Template valid' : '✗ Template invalid'}
            </strong>
            {result.validation.issues.length > 0 && (
              <ul className="mt-1 list-disc pl-4">
                {result.validation.issues.map((issue, i) => (
                  <li key={i}>
                    <span className="font-mono text-xs">[{issue.code}]</span>{' '}
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Template stats ─────────────────────────────────────────── */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            {(
              [
                ['Stone size', stoneSize],
                ['Stone count', result.stoneCount],
                ['Columns', columns],
                ['Rows', rows],
              ] as [string, string | number][]
            ).map(([label, value]) => (
              <div key={label}>
                <dt className="text-zinc-500">{label}</dt>
                <dd className="font-semibold text-zinc-900">{value}</dd>
              </div>
            ))}
          </dl>

          {/* ── SVG preview ────────────────────────────────────────────── */}
          <div className="overflow-auto rounded border border-zinc-200 bg-zinc-50 p-3">
            <p className="mb-2 text-xs text-zinc-400">
              Preview — dimensions are in mm (not to screen scale)
            </p>
            {/*
              The SVG string below is produced entirely by our deterministic engine
              (createBasicSvgExport) from validated number and select inputs only.
              No raw SVG input from the user is accepted or parsed here.
              dangerouslySetInnerHTML is safe for this controlled, engine-only source.
            */}
            <div
              className="[&_svg]:h-auto [&_svg]:max-w-full"
              dangerouslySetInnerHTML={{ __html: result.svgString }}
            />
          </div>

          {/* ── Actions ────────────────────────────────────────────────── */}
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
        </>
      )}
    </div>
  );
}
