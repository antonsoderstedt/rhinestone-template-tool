'use client';

import { useState, useMemo } from 'react';
import {
  createDotMatrixTextTemplate,
  validateRhinestoneTemplate,
  createBasicSvgExport,
  getDensityPresetOptions,
  checkExportReadiness,
  getTemplatePhysicalSize,
} from '@/src/lib/rhinestone-engine/index';
import type { StoneSizeId, TemplateValidationResult, DensityPreset, ExportReadinessResult, TextAlign } from '@/src/lib/rhinestone-engine/index';
import SvgPreview from './SvgPreview';
import SvgExportActions from './SvgExportActions';
import TemplateStatsCard from './TemplateStatsCard';
import ExportReadinessPanel from './ExportReadinessPanel';
import { downloadProject } from '@/app/lib/projectUtils';
import type { DotMatrixTextProjectState, RhinestoneProjectFile } from '@/src/lib/rhinestone-engine/index';

// ─── Constants ────────────────────────────────────────────────────────────────

const STONE_SIZES: StoneSizeId[] = ['SS6', 'SS8', 'SS10', 'SS12'];

// ─── Types ────────────────────────────────────────────────────────────────────

type GeneratorResult =
  | {
      ok: true;
      svgString: string;
      stoneCount: number;
      physicalWidthMm: number;
      physicalHeightMm: number;
      readiness: ExportReadinessResult;
      validation: TemplateValidationResult;
    }
  | { ok: false; error: string };

// ─── Component ────────────────────────────────────────────────────────────────

export default function TextMatrixGenerator({ defaultState }: { defaultState?: DotMatrixTextProjectState } = {}) {
  const [text, setText] = useState(defaultState?.text ?? 'SMOOCH');
  const [stoneSize, setStoneSize] = useState<StoneSizeId>(defaultState?.stoneSize ?? 'SS10');
  const [includeGuideBox, setIncludeGuideBox] = useState(defaultState?.includeGuideBox ?? true);
  const [includeLabels, setIncludeLabels] = useState(defaultState?.includeLabels ?? false);
  const [paddingMm, setPaddingMm] = useState(defaultState?.paddingMm ?? 5);
  const [densityPreset, setDensityPreset] = useState<DensityPreset>(defaultState?.densityPreset ?? 'standard');
  const [customSpacingMm, setCustomSpacingMm] = useState<number | ''>(defaultState?.customSpacingMm ?? 4.0);
  // ── Layout v2 state ────────────────────────────────────────────────
  const [targetWidthMm, setTargetWidthMm] = useState<number | ''>(defaultState?.targetWidthMm ?? '');
  const [targetHeightMm, setTargetHeightMm] = useState<number | ''>(defaultState?.targetHeightMm ?? '');
  const [preserveAspectRatio, setPreserveAspectRatio] = useState(defaultState?.preserveAspectRatio ?? true);
  const [align, setAlign] = useState<TextAlign>(defaultState?.align ?? 'left');
  const [letterSpacing, setLetterSpacing] = useState(defaultState?.letterSpacingColumns ?? 1);
  const [lineSpacing, setLineSpacing] = useState(defaultState?.lineSpacingRows ?? 2);

  const result = useMemo<GeneratorResult>(() => {
    try {
      const template = createDotMatrixTextTemplate({
        id: `text-dot-matrix-${stoneSize.toLowerCase()}`,
        name: `Dot Matrix Text — ${stoneSize}`,
        text,
        stoneSize,
        densityPreset,
        customSpacingMm: densityPreset === 'custom' && customSpacingMm !== '' ? customSpacingMm : undefined,
        targetWidthMm:  targetWidthMm  !== '' ? targetWidthMm  : undefined,
        targetHeightMm: targetHeightMm !== '' ? targetHeightMm : undefined,
        preserveAspectRatio,
        align,
        letterSpacingColumns: letterSpacing,
        lineSpacingRows: lineSpacing,
      });

      const validation = validateRhinestoneTemplate(template);
      const readiness  = checkExportReadiness(template);
      const { widthMm, heightMm } = getTemplatePhysicalSize(template);

      const svgString = createBasicSvgExport(template, {
        includeGuideBox,
        includeLabels,
        paddingMm,
        decimalPlaces: 3,
      });

      return { ok: true, svgString, stoneCount: template.stones.length,
               physicalWidthMm: widthMm, physicalHeightMm: heightMm,
               readiness, validation };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }, [text, stoneSize, includeGuideBox, includeLabels, paddingMm,
      densityPreset, customSpacingMm,
      targetWidthMm, targetHeightMm, preserveAspectRatio, align, letterSpacing, lineSpacing]);

  const filename = `rhinestone-text-dot-matrix-${stoneSize.toLowerCase()}.svg`;
  function handleSaveProject() {
    const project: RhinestoneProjectFile = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      projectName: `Dot Matrix — ${text.replace(/\n/g, ' ')} ${stoneSize}`,
      generatorState: {
        generatorId: 'dot-matrix-text',
        text,
        stoneSize,
        includeGuideBox,
        includeLabels,
        paddingMm,
        densityPreset,
        customSpacingMm: customSpacingMm !== '' ? customSpacingMm : 4.0,
        targetWidthMm: targetWidthMm !== '' ? targetWidthMm : null,
        targetHeightMm: targetHeightMm !== '' ? targetHeightMm : null,
        preserveAspectRatio,
        align,
        letterSpacingColumns: letterSpacing,
        lineSpacingRows: lineSpacing,
      },
    };
    downloadProject(project);
  }
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

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Density</span>
          <select value={densityPreset} onChange={(e) => setDensityPreset(e.target.value as DensityPreset)}
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400">
            {getDensityPresetOptions().map((o) => (
              <option key={o.value} value={o.value}>{o.label} — {o.description}</option>
            ))}
          </select>
        </label>

        {densityPreset === 'custom' && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Custom spacing (mm)</span>
            <input type="number" min={0.1} step={0.05} value={customSpacingMm}
              onChange={(e) => setCustomSpacingMm(e.target.value === '' ? '' : Number(e.target.value))}
              className="rounded border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400" />
          </label>
        )}

      </div>

      {/* ── Layout v2 controls ───────────────────────────────────────────── */}
      <details className="rounded border border-zinc-200 overflow-hidden">
        <summary className="px-4 py-2.5 text-sm font-medium text-zinc-700 cursor-pointer hover:bg-zinc-50 select-none">
          Layout settings (alignment, sizing, spacing)
        </summary>
        <div className="px-4 pb-4 pt-3 grid gap-3 sm:grid-cols-2 border-t border-zinc-100">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Alignment</span>
            <select value={align} onChange={(e) => setAlign(e.target.value as TextAlign)}
              className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400">
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Target width (mm)</span>
            <input type="number" min={1} step={1} value={targetWidthMm} placeholder="auto"
              onChange={(e) => setTargetWidthMm(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Target height (mm)</span>
            <input type="number" min={1} step={1} value={targetHeightMm} placeholder="auto"
              onChange={(e) => setTargetHeightMm(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400" />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={preserveAspectRatio} onChange={(e) => setPreserveAspectRatio(e.target.checked)} className="h-4 w-4 rounded" />
            <span className="text-sm text-zinc-700">Preserve aspect ratio</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Letter spacing (dot columns)</span>
            <input type="number" min={0} step={1} value={letterSpacing}
              onChange={(e) => setLetterSpacing(Math.max(0, Math.floor(Number(e.target.value))))}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Line spacing (dot rows)</span>
            <input type="number" min={0} step={1} value={lineSpacing}
              onChange={(e) => setLineSpacing(Math.max(0, Math.floor(Number(e.target.value))))}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm" />
          </label>
        </div>
      </details>

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
            extraStats={[
              { label: 'Text', value: text.replace(/\n/g, ' \u21b5 ') },
              { label: 'Font mode', value: 'Dot Matrix 5\u00d77' },
              { label: 'Align', value: align },
              { label: 'Est. width', value: `${result.physicalWidthMm.toFixed(1)} mm` },
              { label: 'Density', value: densityPreset },
            ]}
          />

          <SvgPreview svg={result.svgString} title="Text template preview" />

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
