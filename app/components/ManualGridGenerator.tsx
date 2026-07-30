'use client';

import { useState, useMemo } from 'react';
import {
  createStoneGridTemplate,
  validateRhinestoneTemplate,
  createBasicSvgExport,
  getDensityPresetOptions,
  checkExportReadiness,
} from '@/src/lib/rhinestone-engine/index';
import type { StoneSizeId, TemplateValidationResult, DensityPreset, ExportReadinessResult } from '@/src/lib/rhinestone-engine/index';
import SvgPreview from './SvgPreview';
import SvgExportActions from './SvgExportActions';
import TemplateStatsCard from './TemplateStatsCard';
import ExportReadinessPanel from './ExportReadinessPanel';
import { downloadProject } from '@/app/lib/projectUtils';
import type { ManualGridProjectState, RhinestoneProjectFile } from '@/src/lib/rhinestone-engine/index';

// ─── Constants ────────────────────────────────────────────────────────────────

const STONE_SIZES: StoneSizeId[] = ['SS6', 'SS8', 'SS10', 'SS12'];

// ─── Types ────────────────────────────────────────────────────────────────────

type GeneratorResult =
  | {
      ok: true;
      svgString: string;
      stoneCount: number;      readiness: ExportReadinessResult;      validation: TemplateValidationResult;
    }
  | { ok: false; error: string };

// ─── Component ────────────────────────────────────────────────────────────────

export default function ManualGridGenerator({ defaultState }: { defaultState?: ManualGridProjectState } = {}) {
  // Form state
  const [stoneSize, setStoneSize] = useState<StoneSizeId>(defaultState?.stoneSize ?? 'SS10');
  const [columns, setColumns] = useState(defaultState?.columns ?? 5);
  const [rows, setRows] = useState(defaultState?.rows ?? 3);
  const [includeGuideBox, setIncludeGuideBox] = useState(defaultState?.includeGuideBox ?? true);
  const [includeLabels, setIncludeLabels] = useState(defaultState?.includeLabels ?? true);
  const [paddingMm, setPaddingMm] = useState(defaultState?.paddingMm ?? 5);
  const [densityPreset, setDensityPreset] = useState<DensityPreset>(defaultState?.densityPreset ?? 'standard');
  const [customSpacingMm, setCustomSpacingMm] = useState<number | ''>(defaultState?.customSpacingMm ?? 4.0);

  // Derived: template + validation + SVG
  const result = useMemo<GeneratorResult>(() => {
    try {
      const template = createStoneGridTemplate({
        id: `grid-${stoneSize.toLowerCase()}-${columns}x${rows}`,
        name: `${stoneSize} Grid ${columns}×${rows}`,
        stoneSize,
        columns,
        rows,
        densityPreset,
        customSpacingMm: densityPreset === 'custom' && customSpacingMm !== '' ? customSpacingMm : undefined,
      });

      const validation = validateRhinestoneTemplate(template);
      const readiness = checkExportReadiness(template);

      const svgString = createBasicSvgExport(template, {
        includeGuideBox,
        includeLabels,
        paddingMm,
        decimalPlaces: 3,
      });

      return { ok: true, svgString, stoneCount: template.stones.length, readiness, validation };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [stoneSize, columns, rows, includeGuideBox, includeLabels, paddingMm, densityPreset, customSpacingMm]);

  const filename = `rhinestone-grid-${stoneSize.toLowerCase()}-${columns}x${rows}.svg`;

  function handleSaveProject() {
    const project: RhinestoneProjectFile = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      projectName: `Grid ${stoneSize} ${columns}×${rows}`,
      generatorState: {
        generatorId: 'manual-grid',
        stoneSize,
        columns,
        rows,
        includeGuideBox,
        includeLabels,
        paddingMm,
        densityPreset,
        customSpacingMm: customSpacingMm !== '' ? customSpacingMm : 4.0,
      },
    };
    downloadProject(project);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* ── Controls ────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Stone size</span>
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
          <span className="text-sm font-medium text-zinc-700">Density</span>
          <select
            value={densityPreset}
            onChange={(e) => setDensityPreset(e.target.value as DensityPreset)}
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            {getDensityPresetOptions().map((o) => (
              <option key={o.value} value={o.value}>{o.label} — {o.description}</option>
            ))}
          </select>
        </label>

        {densityPreset === 'custom' && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Custom spacing (mm)</span>
            <input
              type="number" min={0.1} step={0.05} value={customSpacingMm}
              onChange={(e) => setCustomSpacingMm(e.target.value === '' ? '' : Number(e.target.value))}
              className="rounded border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </label>
        )}

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
          <ExportReadinessPanel result={result.readiness} />

          <TemplateStatsCard
            stoneSize={stoneSize}
            stoneCount={result.stoneCount}
            columns={columns}
            rows={rows}
            extraStats={[{ label: 'Density', value: densityPreset }]}
          />

          <SvgPreview svg={result.svgString} title="Template preview" />

          <SvgExportActions svg={result.svgString} filename={filename} disabled={!result.readiness.ready} />
        </>
      )}

      {/* ── Save project ──────────────────────────────────────────────── */}
      <div className="border-t border-zinc-100 pt-4">
        <button
          onClick={handleSaveProject}
          className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        >
          Save project (.json)
        </button>
        <p className="mt-1 text-xs text-zinc-400">Saves all settings to a file you can reload later.</p>
      </div>

    </div>
  );
}
