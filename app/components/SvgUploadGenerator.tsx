'use client';

import { useState, useMemo } from 'react';
import {
  svgStringToPolylines,
  createPolylineFilledRhinestoneTemplate,
  validateRhinestoneTemplate,
  createBasicSvgExport,
  getTemplatePhysicalSize,
  getDensityPresetOptions,
  checkExportReadiness,
} from '@/src/lib/rhinestone-engine/index';
import type { StoneSizeId, TemplateValidationResult, DensityPreset, ExportReadinessResult, PolylineCleanupOptions, TemplateFillMode, FillPattern } from '@/src/lib/rhinestone-engine/index';
import SvgPreview from './SvgPreview';
import SvgExportActions from './SvgExportActions';
import TemplateStatsCard from './TemplateStatsCard';
import ExportReadinessPanel from './ExportReadinessPanel';
import { downloadProject } from '@/app/lib/projectUtils';
import type { SvgUploadProjectState, RhinestoneProjectFile } from '@/src/lib/rhinestone-engine/index';

// ─── Types ────────────────────────────────────────────────────────────────────

const STONE_SIZES: StoneSizeId[] = ['SS6', 'SS8', 'SS10', 'SS12'];

type GeneratorResult =
  | {
      ok: true;
      /** Engine-generated rhinestone SVG — NEVER the uploaded raw SVG. */
      exportedSvg: string;
      stoneCount: number;
      pathCount: number;
      physicalWidthMm: number;
      physicalHeightMm: number;      readiness: ExportReadinessResult;      validation: TemplateValidationResult;
    }
  | { ok: false; error: string };

// ─── Component ────────────────────────────────────────────────────────────────

export default function SvgUploadGenerator({ defaultState }: { defaultState?: SvgUploadProjectState } = {}) {
  /**
   * Raw uploaded SVG text — used ONLY as input to svgStringToPolylines.
   * This value is NEVER passed to dangerouslySetInnerHTML or rendered directly.
   */
  const [uploadedSvgText, setUploadedSvgText] = useState<string | null>(defaultState?.uploadedSvgText ?? null);
  const [svgFileName, setSvgFileName] = useState<string | null>(null);
  const [stoneSize, setStoneSize] = useState<StoneSizeId>(defaultState?.stoneSize ?? 'SS10');
  const [includeGuideBox, setIncludeGuideBox] = useState(defaultState?.includeGuideBox ?? true);
  const [includeLabels, setIncludeLabels] = useState(defaultState?.includeLabels ?? false);
  const [paddingMm, setPaddingMm] = useState(defaultState?.paddingMm ?? 5);
  const [targetWidthMm, setTargetWidthMm] = useState<number | ''>(defaultState?.targetWidthMm ?? 100);
  const [targetHeightMm, setTargetHeightMm] = useState<number | ''>(defaultState?.targetHeightMm ?? '');
  const [preserveAspectRatio, setPreserveAspectRatio] = useState(defaultState?.preserveAspectRatio ?? true);
  const [densityPreset, setDensityPreset] = useState<DensityPreset>(defaultState?.densityPreset ?? 'standard');
  const [customSpacingMm, setCustomSpacingMm] = useState<number | ''>(defaultState?.customSpacingMm ?? 4.0);

  // ── Cleanup state ───────────────────────────────────────────────────────────
  const [cleanupEnabled, setCleanupEnabled] = useState(defaultState?.cleanupEnabled ?? true);
  const [cleanupSimplify, setCleanupSimplify] = useState(defaultState?.cleanupSimplify ?? false);
  const [cleanupSimplifyTol, setCleanupSimplifyTol] = useState(defaultState?.cleanupSimplifyTol ?? 0.25);
  const [cleanupRemoveTiny, setCleanupRemoveTiny] = useState(defaultState?.cleanupRemoveTiny ?? true);
  const [cleanupMinLength, setCleanupMinLength] = useState(defaultState?.cleanupMinLength ?? 1);
  const [cleanupRemoveDups, setCleanupRemoveDups] = useState(defaultState?.cleanupRemoveDups ?? true);
  const [cleanupDupTol, setCleanupDupTol] = useState(defaultState?.cleanupDupTol ?? 0.05);
  const [fillMode, setFillMode] = useState<TemplateFillMode>(defaultState?.fillMode ?? 'outline');
  const [fillPattern, setFillPattern] = useState<FillPattern>(defaultState?.fillPattern ?? 'offset-grid');

  // ── File handler ────────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSvgFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = typeof ev.target?.result === 'string' ? ev.target.result : null;
      setUploadedSvgText(text);
    };
    reader.readAsText(file);
  }

  // ── Derived result ──────────────────────────────────────────────────────────
  /**
   * The result is computed from the uploaded SVG text through the engine
   * pipeline: parse → polylines → template → validate → export.
   *
   * The exported SVG comes from createBasicSvgExport — it contains only
   * real vector <circle> elements. The raw uploadedSvgText is NEVER included
   * in the output or rendered in any preview.
   */
  const result = useMemo<GeneratorResult | null>(() => {
    if (!uploadedSvgText) return null;
    try {
      const cleanupOptions: PolylineCleanupOptions | undefined = cleanupEnabled ? {
        removeDuplicatePoints: cleanupRemoveDups,
        duplicatePointToleranceMm: cleanupDupTol,
        removeTinyPolylines: cleanupRemoveTiny,
        minPolylineLengthMm: cleanupMinLength,
        simplify: cleanupSimplify,
        simplifyToleranceMm: cleanupSimplifyTol,
      } : undefined;

      const polylines = svgStringToPolylines(uploadedSvgText, {
        cleanup: cleanupEnabled,
        cleanupOptions,
      });
      const template = createPolylineFilledRhinestoneTemplate({
        id: 'uploaded-svg',
        name: 'Uploaded SVG',
        polylines,
        stoneSize,
        fillMode,
        fillPattern,
        targetWidthMm: targetWidthMm !== '' ? targetWidthMm : undefined,
        targetHeightMm: targetHeightMm !== '' ? targetHeightMm : undefined,
        preserveAspectRatio,
        densityPreset,
        customSpacingMm: densityPreset === 'custom' && customSpacingMm !== '' ? customSpacingMm : undefined,
      });
      const validation = validateRhinestoneTemplate(template);
      const readiness = checkExportReadiness(template);
      const { widthMm: physicalWidthMm, heightMm: physicalHeightMm } = getTemplatePhysicalSize(template);
      // IMPORTANT: exportedSvg is engine-generated, NOT the uploaded raw SVG
      const exportedSvg = createBasicSvgExport(template, {
        includeGuideBox,
        includeLabels,
        paddingMm,
        decimalPlaces: 3,
      });
      return {
        ok: true,
        exportedSvg,
        stoneCount: template.stones.length,
        pathCount: polylines.length,
        physicalWidthMm,
        physicalHeightMm,
        readiness,
        validation,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [uploadedSvgText, stoneSize, includeGuideBox, includeLabels, paddingMm,
      targetWidthMm, targetHeightMm, preserveAspectRatio, densityPreset, customSpacingMm,
      cleanupEnabled, cleanupRemoveDups, cleanupDupTol, cleanupRemoveTiny,
      cleanupMinLength, cleanupSimplify, cleanupSimplifyTol,
      fillMode, fillPattern]);

  const filename = `rhinestone-uploaded-svg-${stoneSize.toLowerCase()}.svg`;

  function handleSaveProject() {
    const project: RhinestoneProjectFile = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      projectName: `SVG Upload — ${svgFileName ?? 'no file'} ${stoneSize}`,
      generatorState: {
        generatorId: 'svg-upload',
        uploadedSvgText,
        stoneSize,
        includeGuideBox,
        includeLabels,
        paddingMm,
        targetWidthMm: targetWidthMm !== '' ? targetWidthMm : null,
        targetHeightMm: targetHeightMm !== '' ? targetHeightMm : null,
        preserveAspectRatio,
        densityPreset,
        customSpacingMm: customSpacingMm !== '' ? customSpacingMm : 4.0,
        cleanupEnabled,
        cleanupSimplify,
        cleanupSimplifyTol,
        cleanupRemoveTiny,
        cleanupMinLength,
        cleanupRemoveDups,
        cleanupDupTol,
        fillMode,
        fillPattern,
      },
    };
    downloadProject(project);
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Info banner ──────────────────────────────────────────────────── */}
      <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <strong>SVG Upload v2 — curves + transforms supported.</strong>{' '}
        Supported: line, polyline, polygon, rect, circle, ellipse, and path (M/L/H/V/Z/C/S/Q/T).
        Simple logos work best. Arcs (A) must be expanded before upload.
        The app parses SVG geometry into stone positions and exports a new clean rhinestone SVG —
        the raw uploaded file is never rendered.
      </div>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-sm font-medium text-zinc-700">Upload SVG File</span>
          <input
            type="file"
            accept=".svg,image/svg+xml"
            onChange={handleFileChange}
            className="rounded border border-zinc-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
          />
          {svgFileName && (
            <span className="text-xs text-zinc-500">
              Loaded: <span className="font-mono">{svgFileName}</span>
            </span>
          )}
          <span className="text-xs text-zinc-400">
            Only the parsed rhinestone template is previewed — the raw SVG is never rendered.
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

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Target Width (mm)</span>
          <input
            type="number"
            min={1}
            step={1}
            value={targetWidthMm}
            placeholder="e.g. 100"
            onChange={(e) => setTargetWidthMm(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
            className="rounded border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Target Height (mm)</span>
          <input
            type="number"
            min={1}
            step={1}
            value={targetHeightMm}
            placeholder="optional"
            onChange={(e) => setTargetHeightMm(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
            className="rounded border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={preserveAspectRatio}
            onChange={(e) => setPreserveAspectRatio(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          <span className="text-sm font-medium text-zinc-700">Preserve aspect ratio</span>
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

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Fill mode</span>
          <select value={fillMode} onChange={(e) => setFillMode(e.target.value as TemplateFillMode)}
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400">
            <option value="outline">Outline — stones along paths</option>
            <option value="fill">Fill — stones inside closed shapes</option>
            <option value="outline-fill">Outline + Fill — combined</option>
          </select>
        </label>

        {fillMode !== 'outline' && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Fill pattern</span>
            <select value={fillPattern} onChange={(e) => setFillPattern(e.target.value as FillPattern)}
              className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400">
              <option value="offset-grid">Offset grid (denser)</option>
              <option value="grid">Regular grid</option>
            </select>
          </label>
        )}

      </div>

      {/* ── SVG cleanup settings ──────────────────────────────────────────── */}
      <details className="rounded border border-zinc-200 overflow-hidden">
        <summary className="px-4 py-2.5 text-sm font-medium text-zinc-700 cursor-pointer hover:bg-zinc-50 select-none">
          SVG cleanup settings
        </summary>
        <div className="px-4 pb-4 pt-3 grid gap-3 sm:grid-cols-2 border-t border-zinc-100">
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" checked={cleanupEnabled} onChange={(e) => setCleanupEnabled(e.target.checked)} className="h-4 w-4 rounded" />
            <span className="text-sm font-medium text-zinc-700">Enable cleanup</span>
            <span className="text-xs text-zinc-400">(removes noise from complex SVGs)</span>
          </label>

          {cleanupEnabled && (
            <>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={cleanupRemoveDups} onChange={(e) => setCleanupRemoveDups(e.target.checked)} className="h-4 w-4 rounded" />
                <span className="text-sm text-zinc-700">Remove duplicate points</span>
              </label>

              {cleanupRemoveDups && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500">Duplicate tolerance (mm)</span>
                  <input type="number" min={0.001} step={0.01} value={cleanupDupTol}
                    onChange={(e) => setCleanupDupTol(Math.max(0.001, Number(e.target.value)))}
                    className="rounded border border-zinc-300 px-2 py-1 text-sm" />
                </label>
              )}

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={cleanupRemoveTiny} onChange={(e) => setCleanupRemoveTiny(e.target.checked)} className="h-4 w-4 rounded" />
                <span className="text-sm text-zinc-700">Remove tiny shapes</span>
              </label>

              {cleanupRemoveTiny && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500">Min shape length (mm)</span>
                  <input type="number" min={0.1} step={0.1} value={cleanupMinLength}
                    onChange={(e) => setCleanupMinLength(Math.max(0.1, Number(e.target.value)))}
                    className="rounded border border-zinc-300 px-2 py-1 text-sm" />
                </label>
              )}

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={cleanupSimplify} onChange={(e) => setCleanupSimplify(e.target.checked)} className="h-4 w-4 rounded" />
                <span className="text-sm text-zinc-700">Simplify curves</span>
              </label>

              {cleanupSimplify && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500">Simplify tolerance (mm)</span>
                  <input type="number" min={0.01} step={0.05} value={cleanupSimplifyTol}
                    onChange={(e) => setCleanupSimplifyTol(Math.max(0.01, Number(e.target.value)))}
                    className="rounded border border-zinc-300 px-2 py-1 text-sm" />
                </label>
              )}
            </>
          )}
        </div>
      </details>

      {/* ── No file yet ───────────────────────────────────────────────────── */}
      {!uploadedSvgText && (
        <p className="text-sm text-zinc-400 text-center py-6">
          Upload an SVG file to generate a rhinestone template.
        </p>
      )}

      {/* ── Error state ──────────────────────────────────────────────────── */}
      {result && !result.ok && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <strong>Error:</strong> {result.error}
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {result && result.ok && (
        <>
          <ExportReadinessPanel result={result.readiness} />

          <TemplateStatsCard
            stoneSize={stoneSize}
            stoneCount={result.stoneCount}
            extraStats={[
              { label: 'Source', value: 'Uploaded SVG' },
              { label: 'Path count', value: result.pathCount },
              { label: 'Fill mode', value: fillMode },
              { label: 'Est. width', value: `${result.physicalWidthMm.toFixed(1)} mm` },
              { label: 'Est. height', value: `${result.physicalHeightMm.toFixed(1)} mm` },
              { label: 'Density', value: densityPreset },
            ]}
          />

          {/*
            ⚠️ SECURITY: Only the engine-generated rhinestone SVG is previewed here.
            The raw uploadedSvgText is NEVER passed to SvgPreview or dangerouslySetInnerHTML.
          */}
          <SvgPreview svg={result.exportedSvg} title="Rhinestone template preview" />

          <SvgExportActions svg={result.exportedSvg} filename={filename} disabled={!result.readiness.ready} />
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
        <p className="mt-1 text-xs text-zinc-400">
          Includes SVG content and all settings. Reload with &ldquo;Open project&rdquo; on the main page.
        </p>
      </div>

    </div>
  );
}
