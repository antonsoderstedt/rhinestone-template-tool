'use client';

import { useState, useMemo } from 'react';
import {
  svgStringToPolylines,
  createPolylineRhinestoneTemplate,
  validateRhinestoneTemplate,
  createBasicSvgExport,
  getTemplatePhysicalSize,
  getDensityPresetOptions,
} from '@/src/lib/rhinestone-engine/index';
import type { StoneSizeId, TemplateValidationResult, DensityPreset } from '@/src/lib/rhinestone-engine/index';
import SvgPreview from './SvgPreview';
import SvgExportActions from './SvgExportActions';
import TemplateStatsCard from './TemplateStatsCard';
import ValidationIssuesList from './ValidationIssuesList';

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
      physicalHeightMm: number;
      validation: TemplateValidationResult;
    }
  | { ok: false; error: string };

// ─── Component ────────────────────────────────────────────────────────────────

export default function SvgUploadGenerator() {
  /**
   * Raw uploaded SVG text — used ONLY as input to svgStringToPolylines.
   * This value is NEVER passed to dangerouslySetInnerHTML or rendered directly.
   */
  const [uploadedSvgText, setUploadedSvgText] = useState<string | null>(null);
  const [stoneSize, setStoneSize] = useState<StoneSizeId>('SS10');
  const [includeGuideBox, setIncludeGuideBox] = useState(true);
  const [includeLabels, setIncludeLabels] = useState(false);
  const [paddingMm, setPaddingMm] = useState(5);
  const [targetWidthMm, setTargetWidthMm] = useState<number | ''>(100);
  const [targetHeightMm, setTargetHeightMm] = useState<number | ''>('');
  const [preserveAspectRatio, setPreserveAspectRatio] = useState(true);
  const [densityPreset, setDensityPreset] = useState<DensityPreset>('standard');
  const [customSpacingMm, setCustomSpacingMm] = useState<number | ''>(4.0);

  // ── File handler ────────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

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
      const polylines = svgStringToPolylines(uploadedSvgText);
      const template = createPolylineRhinestoneTemplate({
        id: 'uploaded-svg',
        name: 'Uploaded SVG',
        polylines,
        stoneSize,
        targetWidthMm: targetWidthMm !== '' ? targetWidthMm : undefined,
        targetHeightMm: targetHeightMm !== '' ? targetHeightMm : undefined,
        preserveAspectRatio,
        densityPreset,
        customSpacingMm: densityPreset === 'custom' && customSpacingMm !== '' ? customSpacingMm : undefined,
      });
      const validation = validateRhinestoneTemplate(template);
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
        validation,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [uploadedSvgText, stoneSize, includeGuideBox, includeLabels, paddingMm, targetWidthMm, targetHeightMm, preserveAspectRatio, densityPreset, customSpacingMm]);

  const filename = `rhinestone-uploaded-svg-${stoneSize.toLowerCase()}.svg`;

  return (
    <div className="flex flex-col gap-6">

      {/* ── Info banner ──────────────────────────────────────────────────── */}
      <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <strong>SVG Upload v2 — curves + transforms supported.</strong>{' '}
        Supported elements: line, polyline, polygon, rect, circle, ellipse, and
        path (M/L/H/V/Z/C/S/Q/T). Arcs (A) may still need to be expanded before
        upload. The app converts SVG geometry into internal stone positions and
        exports a new clean SVG — the raw uploaded SVG is never rendered.
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

      </div>

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
          <ValidationIssuesList
            valid={result.validation.valid}
            issues={result.validation.issues}
          />

          <TemplateStatsCard
            stoneSize={stoneSize}
            stoneCount={result.stoneCount}
            extraStats={[
              { label: 'Source', value: 'Uploaded SVG' },
              { label: 'Path count', value: result.pathCount },
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

          <SvgExportActions svg={result.exportedSvg} filename={filename} />
        </>
      )}
    </div>
  );
}
