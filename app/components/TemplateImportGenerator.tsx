'use client';

import { useState, useMemo } from 'react';
import {
  createImportedTemplate,
  validateRhinestoneTemplate,
  createBasicSvgExport,
  getTemplatePhysicalSize,
  checkExportReadiness,
} from '@/src/lib/rhinestone-engine/index';
import type {
  StoneSizeId,
  TemplateValidationResult,
  ExportReadinessResult,
  ImportedTemplateResult,
} from '@/src/lib/rhinestone-engine/index';
import SvgPreview from './SvgPreview';
import SvgExportActions from './SvgExportActions';
import TemplateStatsCard from './TemplateStatsCard';
import ExportReadinessPanel from './ExportReadinessPanel';
import { downloadProject } from '@/app/lib/projectUtils';
import type { TemplateImportProjectState, RhinestoneProjectFile } from '@/src/lib/rhinestone-engine/index';

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
      templateResult: ImportedTemplateResult;
    }
  | { ok: false; error: string };

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Template Import Generator
 *
 * Imports SVG files containing pre-placed rhinestone shapes (circles/ellipses/paths).
 * Does NOT generate new stone positions — extracts existing stones from the SVG.
 */
export default function TemplateImportGenerator({ defaultState }: { defaultState?: TemplateImportProjectState } = {}) {
  const [uploadedSvgText, setUploadedSvgText] = useState<string | null>(defaultState?.uploadedSvgText ?? null);
  const [svgFileName, setSvgFileName] = useState<string | null>(null);
  const [defaultStoneSize, setDefaultStoneSize] = useState<StoneSizeId>('SS10');
  const [includeGuideBox, setIncludeGuideBox] = useState(defaultState?.includeGuideBox ?? true);
  const [includeLabels, setIncludeLabels] = useState(false);
  const [paddingMm, setPaddingMm] = useState(defaultState?.paddingMm ?? 5);

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

  const result = useMemo<GeneratorResult | null>(() => {
    if (!uploadedSvgText) return null;

    try {
      // Create template from imported SVG
      const templateResult = createImportedTemplate({
        svgText: uploadedSvgText,
        defaultStoneSizeId: defaultStoneSize,
        deduplicateTolerance: 0.01,
      });

      const validation = validateRhinestoneTemplate(templateResult.template);
      const readiness = checkExportReadiness(templateResult.template);
      const { widthMm, heightMm } = getTemplatePhysicalSize(templateResult.template);

      const svgString = createBasicSvgExport(templateResult.template, {
        includeGuideBox,
        includeLabels,
        paddingMm,
        decimalPlaces: 3,
      });

      return {
        ok: true,
        svgString,
        stoneCount: templateResult.template.stones.length,
        physicalWidthMm: widthMm,
        physicalHeightMm: heightMm,
        readiness,
        validation,
        templateResult,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [uploadedSvgText, defaultStoneSize, includeGuideBox, includeLabels, paddingMm]);

  const filename = `rhinestone-imported-template.svg`;

  function handleSaveProject() {
    const project: RhinestoneProjectFile = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      projectName: `Template Import — ${svgFileName ?? 'no file'}`,
      generatorState: {
        generatorId: 'template-import',
        uploadedSvgText,
        importMetadata: result?.ok ? {
          detectedDiameters: result.templateResult.detectedDiameters,
          detectedColors: result.templateResult.detectedColors,
          ignoredElements: result.templateResult.ignoredElements,
          originalStoneCount: result.stoneCount,
        } : undefined,
        includeGuideBox,
        paddingMm,
      },
    };

    downloadProject(project);
  }

  // Compute import summary stats
  const importSummary = useMemo(() => {
    if (!result || !result.ok) return null;

    const { templateResult } = result;
    const sizes = new Map<StoneSizeId, number>();

    // Count stones by size from the template
    templateResult.template.stones.forEach((stone) => {
      const size = stone.stoneSize;
      sizes.set(size, (sizes.get(size) || 0) + 1);
    });

    return {
      totalStones: templateResult.template.stones.length,
      sizes: Array.from(sizes.entries()).sort(),
      colors: templateResult.detectedColors,
      ignoredElements: templateResult.ignoredElements,
    };
  }, [result]);

  return (
    <div className="space-y-6">

      {/* ── Info Banner ──────────────────────────────────────────────────── */}
      <div className="rounded border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800">
        <strong>Import Existing Rhinestone Template</strong>
        <p className="mt-1">
          Upload an SVG file containing pre-placed rhinestone shapes (circles, ellipses, or circular paths).
          The app extracts stone positions, colors, and diameters directly from the file — no filling or generation.
        </p>
      </div>

      {/* ── File Upload ──────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="template-import-file" className="block text-sm font-medium text-zinc-700 mb-2">
          Upload SVG File
        </label>
        <input
          id="template-import-file"
          type="file"
          accept=".svg,image/svg+xml"
          onChange={handleFileChange}
          className="block w-full text-sm text-zinc-900 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200"
        />
        {svgFileName && (
          <p className="mt-2 text-sm text-zinc-600">
            File: <span className="font-mono">{svgFileName}</span>
          </p>
        )}
      </div>

      {/* ── Default Stone Size ───────────────────────────────────────────── */}
      <div>
        <label htmlFor="template-import-default-size" className="block text-sm font-medium text-zinc-700 mb-2">
          Default Stone Size
        </label>
        <select
          id="template-import-default-size"
          value={defaultStoneSize}
          onChange={(e) => setDefaultStoneSize(e.target.value as StoneSizeId)}
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="SS6">SS6</option>
          <option value="SS8">SS8</option>
          <option value="SS10">SS10</option>
          <option value="SS12">SS12</option>
        </select>
        <p className="mt-1 text-xs text-zinc-500">
          Used when stone size cannot be estimated from diameter. The engine will attempt to match
          detected diameters to standard sizes first.
        </p>
      </div>

      {/* ── Import Summary ───────────────────────────────────────────────── */}
      {importSummary && (
        <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
          <h3 className="font-semibold text-zinc-900 mb-2">Import Summary</h3>
          <dl className="space-y-1 text-zinc-700">
            <div>
              <dt className="inline font-medium">Stones detected:</dt>{' '}
              <dd className="inline">{importSummary.totalStones}</dd>
            </div>
            {importSummary.sizes.length > 0 && (
              <div>
                <dt className="inline font-medium">Sizes:</dt>{' '}
                <dd className="inline">
                  {importSummary.sizes.map(([size, count]) => `${size} (${count})`).join(', ')}
                </dd>
              </div>
            )}
            {importSummary.colors.length > 0 && (
              <div>
                <dt className="inline font-medium">Colors detected:</dt>{' '}
                <dd className="inline">{importSummary.colors.length} unique</dd>
              </div>
            )}
            {importSummary.ignoredElements > 0 && (
              <div>
                <dt className="inline font-medium">Ignored elements:</dt>{' '}
                <dd className="inline">{importSummary.ignoredElements}</dd>
              </div>
            )}
          </dl>
          {importSummary.colors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-zinc-600 hover:text-zinc-900">
                Show detected colors
              </summary>
              <div className="mt-2 text-xs">
                <strong>Colors:</strong> {importSummary.colors.join(', ')}
              </div>
            </details>
          )}
        </div>
      )}

      {/* ── Warnings ─────────────────────────────────────────────────────── */}
      {result && result.ok && result.templateResult.warnings.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Import warnings:</strong>
          <ul className="mt-1 ml-4 list-disc space-y-0.5">
            {result.templateResult.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Export Options ───────────────────────────────────────────────── */}
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-zinc-700 hover:text-zinc-900">
          Export Options
        </summary>
        <div className="mt-3 space-y-3 pl-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeGuideBox}
              onChange={(e) => setIncludeGuideBox(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <span className="text-sm text-zinc-700">Include guide box</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeLabels}
              onChange={(e) => setIncludeLabels(e.target.checked)}
              className="rounded border-zinc-300"
            />
            <span className="text-sm text-zinc-700">Include stone size labels</span>
          </label>
          <div>
            <label htmlFor="template-import-padding" className="block text-sm text-zinc-700 mb-1">
              Padding (mm)
            </label>
            <input
              id="template-import-padding"
              type="number"
              value={paddingMm}
              onChange={(e) => setPaddingMm(parseFloat(e.target.value) || 5)}
              step={1}
              min={0}
              max={50}
              className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          </div>
        </div>
      </details>

      {/* ── Result ───────────────────────────────────────────────────────── */}
      {!uploadedSvgText && (
        <div className="rounded border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          Please upload an SVG file to begin import.
        </div>
      )}

      {result && !result.ok && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Import error:</strong> {result.error}
        </div>
      )}

      {result && result.ok && (
        <div className="space-y-4">
          <TemplateStatsCard
            stoneCount={result.stoneCount}
            extraStats={[
              { label: 'Width', value: `${result.physicalWidthMm.toFixed(1)} mm` },
              { label: 'Height', value: `${result.physicalHeightMm.toFixed(1)} mm` },
            ]}
          />

          <ExportReadinessPanel result={result.readiness} />

          <SvgPreview svg={result.svgString} />

          <div className="flex gap-3">
            <SvgExportActions
              svg={result.svgString}
              filename={filename}
              disabled={!result.readiness.ready}
            />

            <button
              onClick={handleSaveProject}
              className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              Save Project
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
