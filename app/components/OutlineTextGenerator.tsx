'use client';

import { useState, useMemo } from 'react';
import {
  createOutlineTextTemplate,
  validateRhinestoneTemplate,
  createBasicSvgExport,
  getDensityPresetOptions,
  checkExportReadiness,
  getTemplatePhysicalSize,
  LEGACY_OUTLINE_FONT_ID,
} from '@/src/lib/rhinestone-engine/index';
import type {
  StoneSizeId,
  TemplateValidationResult,
  DensityPreset,
  ExportReadinessResult,
  OutlineTextAlign,
  TemplateFillMode,
  FillPattern,
} from '@/src/lib/rhinestone-engine/index';
import SvgPreview from './SvgPreview';
import SvgExportActions from './SvgExportActions';
import TemplateStatsCard from './TemplateStatsCard';
import ExportReadinessPanel from './ExportReadinessPanel';
import { downloadProject } from '@/app/lib/projectUtils';
import type { OutlineTextProjectState, RhinestoneProjectFile } from '@/src/lib/rhinestone-engine/index';

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

/**
 * Outline Text Generator — Font Outline Foundation v1.
 *
 * Uses the built-in vector outline font. All outline logic lives in the engine.
 * This component only manages React state and renders results.
 *
 * No system fonts, no TTF/OTF parsing, no font file upload.
 */
export default function OutlineTextGenerator({ defaultState }: { defaultState?: OutlineTextProjectState } = {}) {
  const [text, setText] = useState(defaultState?.text ?? 'SMOOCH');
  const [stoneSize, setStoneSize] = useState<StoneSizeId>(defaultState?.stoneSize ?? 'SS10');
  const [fontSizeMm, setFontSizeMm] = useState<number | ''>(defaultState?.fontSizeMm ?? 25);
  const [targetWidthMm, setTargetWidthMm] = useState<number | ''>(defaultState?.targetWidthMm ?? '');
  const [targetHeightMm, setTargetHeightMm] = useState<number | ''>(defaultState?.targetHeightMm ?? '');
  const [preserveAspectRatio, setPreserveAspectRatio] = useState(defaultState?.preserveAspectRatio ?? true);
  const [align, setAlign] = useState<OutlineTextAlign>(defaultState?.align ?? 'left');
  const [letterSpacingMm, setLetterSpacingMm] = useState<number | ''>(defaultState?.letterSpacingMm ?? 2);
  const [lineSpacingMm, setLineSpacingMm] = useState<number | ''>(defaultState?.lineSpacingMm ?? 8);
  const [fillMode, setFillMode] = useState<TemplateFillMode>(defaultState?.fillMode ?? 'outline');
  const [fillPattern, setFillPattern] = useState<FillPattern>(defaultState?.fillPattern ?? 'offset-grid');
  const [densityPreset, setDensityPreset] = useState<DensityPreset>(defaultState?.densityPreset ?? 'standard');
  const [customSpacingMm, setCustomSpacingMm] = useState<number | ''>(defaultState?.customSpacingMm ?? 4.0);
  const [includeGuideBox, setIncludeGuideBox] = useState(defaultState?.includeGuideBox ?? true);
  const [includeLabels, setIncludeLabels] = useState(defaultState?.includeLabels ?? false);
  const [paddingMm, setPaddingMm] = useState(defaultState?.paddingMm ?? 5);

  const result = useMemo<GeneratorResult>(() => {
    try {
      const template = createOutlineTextTemplate({
        id: `outline-text-${stoneSize.toLowerCase()}`,
        name: `Outline Text — ${stoneSize}`,
        text,
        stoneSize,
        fontSizeMm: fontSizeMm !== '' ? fontSizeMm : 25,
        targetWidthMm: targetWidthMm !== '' ? targetWidthMm : undefined,
        targetHeightMm: targetHeightMm !== '' ? targetHeightMm : undefined,
        preserveAspectRatio,
        align,
        letterSpacingMm: letterSpacingMm !== '' ? letterSpacingMm : 2,
        lineSpacingMm: lineSpacingMm !== '' ? lineSpacingMm : 8,
        fillMode,
        fillPattern,
        densityPreset,
        customSpacingMm:
          densityPreset === 'custom' && customSpacingMm !== ''
            ? customSpacingMm
            : undefined,
      });

      const validation = validateRhinestoneTemplate(template);
      const readiness = checkExportReadiness(template);
      const { widthMm, heightMm } = getTemplatePhysicalSize(template);

      const svgString = createBasicSvgExport(template, {
        includeGuideBox,
        includeLabels,
        paddingMm,
        decimalPlaces: 3,
      });

      return {
        ok: true,
        svgString,
        stoneCount: template.stones.length,
        physicalWidthMm: widthMm,
        physicalHeightMm: heightMm,
        readiness,
        validation,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [
    text, stoneSize, fontSizeMm, targetWidthMm, targetHeightMm,
    preserveAspectRatio, align, letterSpacingMm, lineSpacingMm,
    densityPreset, customSpacingMm, includeGuideBox, includeLabels, paddingMm,
    fillMode, fillPattern,
  ]);

  const filename = `rhinestone-outline-text-${stoneSize.toLowerCase()}.svg`;

  function handleSaveProject() {
    const project: RhinestoneProjectFile = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      projectName: `Outline Text — ${text.replace(/\n/g, ' ')} ${stoneSize}`,
      generatorState: {
        generatorId: 'outline-text',
        text,
        stoneSize,
        fontId: LEGACY_OUTLINE_FONT_ID,
        fontSizeMm: fontSizeMm !== '' ? fontSizeMm : 25,
        targetWidthMm: targetWidthMm !== '' ? targetWidthMm : null,
        targetHeightMm: targetHeightMm !== '' ? targetHeightMm : null,
        preserveAspectRatio,
        align,
        letterSpacingMm: letterSpacingMm !== '' ? letterSpacingMm : 2,
        lineSpacingMm: lineSpacingMm !== '' ? lineSpacingMm : 8,
        fillMode,
        fillPattern,
        densityPreset,
        customSpacingMm: customSpacingMm !== '' ? customSpacingMm : 4.0,
        includeGuideBox,
        includeLabels,
        paddingMm,
      },
    };
    downloadProject(project);
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Built-in font notice ─────────────────────────────────────────── */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800 leading-relaxed">
        <strong>Built-in vector font only.</strong>{' '}
        Outline Text is the first real text-outline foundation — strokes are sampled
        as rhinestone paths. Real font file upload and advanced typography (kerning,
        fill mode, text warp) come in a future phase. Dot Matrix remains available
        as a deterministic grid-based fallback.
      </div>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-sm font-medium text-zinc-700">Text</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Enter text (A–Z, 0–9, punctuation). Press Enter for a new line."
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-zinc-400 resize-y"
          />
          <span className="text-xs text-zinc-400">
            Built-in font: A–Z (lowercase mapped to uppercase), 0–9, . , ! ? - _  •  Enter for new line
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
          <span className="text-sm font-medium text-zinc-700">Font size (mm)</span>
          <input
            type="number"
            min={5}
            max={200}
            step={1}
            value={fontSizeMm}
            onChange={(e) =>
              setFontSizeMm(e.target.value === '' ? '' : Math.max(5, Number(e.target.value)))
            }
            className="rounded border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Alignment</span>
          <select
            value={align}
            onChange={(e) => setAlign(e.target.value as OutlineTextAlign)}
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Fill mode</span>
          <select value={fillMode} onChange={(e) => setFillMode(e.target.value as TemplateFillMode)}
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400">
            <option value="outline">Outline — stroke paths only</option>
            <option value="fill">Fill — inside closed shapes (O, 0…)</option>
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

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Density</span>
          <select
            value={densityPreset}
            onChange={(e) => setDensityPreset(e.target.value as DensityPreset)}
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            {getDensityPresetOptions().map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} — {o.description}
              </option>
            ))}
          </select>
        </label>

        {densityPreset === 'custom' && (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-zinc-700">Custom spacing (mm)</span>
            <input
              type="number"
              min={0.1}
              step={0.05}
              value={customSpacingMm}
              onChange={(e) =>
                setCustomSpacingMm(e.target.value === '' ? '' : Number(e.target.value))
              }
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

      {/* ── Advanced layout controls ─────────────────────────────────────── */}
      <details className="rounded border border-zinc-200 overflow-hidden">
        <summary className="px-4 py-2.5 text-sm font-medium text-zinc-700 cursor-pointer hover:bg-zinc-50 select-none">
          Layout settings (sizing, spacing)
        </summary>
        <div className="px-4 pb-4 pt-3 grid gap-3 sm:grid-cols-2 border-t border-zinc-100">

          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Target width (mm)</span>
            <input
              type="number"
              min={1}
              step={1}
              value={targetWidthMm}
              placeholder="auto"
              onChange={(e) =>
                setTargetWidthMm(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))
              }
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Target height (mm)</span>
            <input
              type="number"
              min={1}
              step={1}
              value={targetHeightMm}
              placeholder="auto"
              onChange={(e) =>
                setTargetHeightMm(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))
              }
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={preserveAspectRatio}
              onChange={(e) => setPreserveAspectRatio(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span className="text-xs text-zinc-600">Preserve aspect ratio</span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Letter spacing (mm)</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={letterSpacingMm}
              onChange={(e) =>
                setLetterSpacingMm(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))
              }
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Line spacing (mm)</span>
            <input
              type="number"
              min={0}
              step={1}
              value={lineSpacingMm}
              onChange={(e) =>
                setLineSpacingMm(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))
              }
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
          </label>

        </div>
      </details>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {!result.ok && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {result.error}
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {result.ok && (
        <>
          <TemplateStatsCard
            stoneSize={stoneSize}
            stoneCount={result.stoneCount}
            extraStats={[
              { label: 'Width', value: `${result.physicalWidthMm.toFixed(1)} mm` },
              { label: 'Height', value: `${result.physicalHeightMm.toFixed(1)} mm` },
              { label: 'Fill mode', value: fillMode },
              { label: 'Font mode', value: 'Built-in Vector Outline v1' },
            ]}
          />
          <ExportReadinessPanel result={result.readiness} />
          <SvgPreview svg={result.svgString} title="Outline text preview" />
          <SvgExportActions
            svg={result.svgString}
            filename={filename}
            disabled={!result.readiness.ready}
          />
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
