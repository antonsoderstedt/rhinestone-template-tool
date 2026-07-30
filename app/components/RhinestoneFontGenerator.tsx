'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  createRhinestoneFontTemplate,
  validateRhinestoneTemplate,
  createBasicSvgExport,
  checkExportReadiness,
  getTemplatePhysicalSize,
  TRW_STONE_SIZE_CALIBRATION,
  RHINESTONE_FONT_REGISTRY,
  TRW_CLEAN_STONE_FONT_ID,
} from '@/src/lib/rhinestone-engine/index';
import type {
  StoneSizeId,
  TemplateValidationResult,
  ExportReadinessResult,
  RhinestoneFontId,
  RhinestoneFontDefinition,
} from '@/src/lib/rhinestone-engine/index';
import SvgPreview from './SvgPreview';
import SvgExportActions from './SvgExportActions';
import TemplateStatsCard from './TemplateStatsCard';
import ExportReadinessPanel from './ExportReadinessPanel';
import { downloadProject } from '@/app/lib/projectUtils';
import type { RhinestoneFontProjectState, RhinestoneProjectFile } from '@/src/lib/rhinestone-engine/index';

// ─── Constants ────────────────────────────────────────────────────────────────

const STONE_SIZES: StoneSizeId[] = ['SS6', 'SS10', 'SS16', 'SS20'];

// Use TRW calibration for supported sizes
const TRW_DIAMETER_MM: Record<StoneSizeId, number> = {
  SS6: TRW_STONE_SIZE_CALIBRATION.SS6.diameterMm,
  SS8: 2.4, // Not used in TRW fonts
  SS10: TRW_STONE_SIZE_CALIBRATION.SS10.diameterMm,
  SS12: 3.2, // Not used in TRW fonts
  SS16: TRW_STONE_SIZE_CALIBRATION.SS16.diameterMm,
  SS20: TRW_STONE_SIZE_CALIBRATION.SS20.diameterMm,
};

function getDiameterForStoneSize(sizeId: StoneSizeId): number {
  return TRW_DIAMETER_MM[sizeId];
}

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
      unsupportedCharacters: string[];
      warnings: string[];
    }
  | { ok: false; error: string };

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Rhinestone Font Generator
 *
 * Uses fonts where glyphs contain pre-placed rhinestone shapes.
 * Does NOT use outline generation or fill algorithms.
 */
export default function RhinestoneFontGenerator({ defaultState }: { defaultState?: RhinestoneFontProjectState } = {}) {
  const [text, setText] = useState(defaultState?.text ?? 'Sulay');
  const [rhinestoneFontId, setRhinestoneFontId] = useState<RhinestoneFontId>(
    (defaultState?.rhinestoneFontId ?? TRW_CLEAN_STONE_FONT_ID) as RhinestoneFontId
  );
  const [stoneSize, setStoneSize] = useState<StoneSizeId>(
    defaultState?.stoneSize ?? 'SS10'
  );
  const [letterSpacingMm, setLetterSpacingMm] = useState<number | ''>(
    defaultState?.letterSpacingMm ?? 1
  );
  const [lineSpacingMm, setLineSpacingMm] = useState<number | ''>(
    defaultState?.lineSpacingMm ?? 0
  );
  const [includeGuideBox, setIncludeGuideBox] = useState(defaultState?.includeGuideBox ?? true);
  const [includeLabels, setIncludeLabels] = useState(defaultState?.includeLabels ?? false);
  const [paddingMm, setPaddingMm] = useState(defaultState?.paddingMm ?? 5);
  const [result, setResult] = useState<GeneratorResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedFont = useMemo<RhinestoneFontDefinition | undefined>(() => {
    return RHINESTONE_FONT_REGISTRY.find((f) => f.fontId === rhinestoneFontId);
  }, [rhinestoneFontId]);

  useEffect(() => {
    let cancelled = false;

    async function generate() {
      if (!text.trim()) {
        setResult({ ok: false, error: 'Please enter text to generate.' });
        setIsGenerating(false);
        return;
      }

      setIsGenerating(true);

      try {
        const targetStoneSizeMm = getDiameterForStoneSize(stoneSize);

        const templateResult = await createRhinestoneFontTemplate({
          text,
          rhinestoneFontId,
          targetStoneSizeId: stoneSize,
          targetStoneSizeMm,
          letterSpacingMm: letterSpacingMm !== '' ? letterSpacingMm : 1,
          lineSpacingMm: lineSpacingMm !== '' ? lineSpacingMm : 0,
        });

        if (cancelled) return;

        const validation = validateRhinestoneTemplate(templateResult.template);
        const readiness = checkExportReadiness(templateResult.template);
        const { widthMm, heightMm } = getTemplatePhysicalSize(templateResult.template);

        const svgString = createBasicSvgExport(templateResult.template, {
          includeGuideBox,
          includeLabels,
          paddingMm,
          decimalPlaces: 3,
        });

        if (!cancelled) {
          setResult({
            ok: true,
            svgString,
            stoneCount: templateResult.template.stones.length,
            physicalWidthMm: widthMm,
            physicalHeightMm: heightMm,
            readiness,
            validation,
            unsupportedCharacters: templateResult.unsupportedCharacters,
            warnings: templateResult.warnings,
          });
          setIsGenerating(false);
        }
      } catch (err) {
        if (!cancelled) {
          setResult({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
          setIsGenerating(false);
        }
      }
    }

    generate();

    return () => {
      cancelled = true;
    };
  }, [text, rhinestoneFontId, stoneSize, letterSpacingMm, lineSpacingMm, includeGuideBox, includeLabels, paddingMm]);

  const filename = `rhinestone-font-${stoneSize.toLowerCase()}.svg`;

  function handleSaveProject() {
    const project: RhinestoneProjectFile = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      projectName: `Rhinestone Font — ${text.replace(/\n/g, ' ')} ${stoneSize}`,
      generatorState: {
        generatorId: 'rhinestone-font',
        text,
        rhinestoneFontId,
        stoneSize,
        targetStoneSizeMm: getDiameterForStoneSize(stoneSize),
        letterSpacingMm: letterSpacingMm !== '' ? letterSpacingMm : 1,
        lineSpacingMm: lineSpacingMm !== '' ? lineSpacingMm : 0,
        includeGuideBox,
        includeLabels,
        paddingMm,
      },
    };

    downloadProject(project);
  }

  const hasMultipleLines = text.includes('\n');

  return (
    <div className="space-y-6">

      {/* ── Font Selection ───────────────────────────────────────────────── */}
      <div>
        <label htmlFor="rhinestone-font-select" className="block text-sm font-medium text-zinc-700 mb-2">
          Rhinestone Font
        </label>
        <select
          id="rhinestone-font-select"
          value={rhinestoneFontId}
          onChange={(e) => setRhinestoneFontId(e.target.value as RhinestoneFontId)}
          className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {RHINESTONE_FONT_REGISTRY.filter((f) => f.category !== 'Fixture').map((font) => (
            <option key={font.fontId} value={font.fontId}>
              {font.displayName}
              {font.isPrivate ? ' (Private)' : ''}
            </option>
          ))}
        </select>

        {selectedFont && (
          <div className="mt-2 space-y-1">
            {selectedFont.isPrivate && (
              <p className="text-xs text-amber-600">
                ⚠️ Private font — {selectedFont.license}
              </p>
            )}
            {selectedFont.characterCoverage && (
              <p className="text-xs text-zinc-500">
                Coverage: {selectedFont.characterCoverage.uppercase ? 'A–Z' : ''}
                {selectedFont.characterCoverage.uppercase && selectedFont.characterCoverage.lowercase ? ', ' : ''}
                {selectedFont.characterCoverage.lowercase ? 'a–z' : ''}
                {!selectedFont.characterCoverage.digits && ' (no digits)'}
                {!selectedFont.characterCoverage.swedish && ' (no Swedish Å Ä Ö)'}
              </p>
            )}
            {selectedFont.limitations && selectedFont.limitations.length > 0 && (
              <details className="text-xs text-zinc-500">
                <summary className="cursor-pointer hover:text-zinc-700">Limitations</summary>
                <ul className="mt-1 ml-4 list-disc space-y-0.5">
                  {selectedFont.limitations.map((limit, i) => (
                    <li key={i}>{limit}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {/* ── Text Input ───────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="rhinestone-font-text" className="block text-sm font-medium text-zinc-700 mb-2">
          Text
        </label>
        <textarea
          id="rhinestone-font-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter your text..."
        />
        <p className="mt-1 text-xs text-zinc-500">
          Supports uppercase, lowercase, and spaces. Unsupported characters will be skipped.
        </p>
      </div>

      {/* ── Unsupported Characters Warning ───────────────────────────────── */}
      {result && result.ok && result.unsupportedCharacters.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Unsupported characters:</strong>{' '}
          <span className="font-mono">{result.unsupportedCharacters.join(', ')}</span>
          <br />
          <span className="text-xs mt-1 block">
            These characters are not available in {selectedFont?.displayName} and will be skipped.
          </span>
        </div>
      )}

      {/* ── Warnings ─────────────────────────────────────────────────────── */}
      {result && result.ok && result.warnings.length > 0 && (
        <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {result.warnings.map((warning, i) => (
            <p key={i}>{warning}</p>
          ))}
        </div>
      )}

      {/* ── Stone Size ───────────────────────────────────────────────────── */}
      <div>
        <label htmlFor="rhinestone-font-stone-size" className="block text-sm font-medium text-zinc-700 mb-2">
          Stone Size
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <select
              id="rhinestone-font-stone-size"
              value={stoneSize}
              onChange={(e) => setStoneSize(e.target.value as StoneSizeId)}
              className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STONE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center text-sm text-zinc-600">
            <span className="font-mono">{getDiameterForStoneSize(stoneSize).toFixed(3)} mm</span>
            <span className="ml-2 text-xs text-zinc-400">physical diameter</span>
          </div>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Stone diameter determines the scale of the entire text. Larger stones = larger design.
        </p>
      </div>

      {/* ── Letter Spacing ───────────────────────────────────────────────── */}
      <div>
        <label htmlFor="rhinestone-font-letter-spacing" className="block text-sm font-medium text-zinc-700 mb-2">
          Letter Spacing (mm)
        </label>
        <input
          id="rhinestone-font-letter-spacing"
          type="number"
          value={letterSpacingMm}
          onChange={(e) => setLetterSpacingMm(e.target.value === '' ? '' : parseFloat(e.target.value))}
          step={0.1}
          min={0}
          max={20}
          className="w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Space between characters. Does not affect internal stone layout within each glyph.
        </p>
      </div>

      {/* ── Line Spacing ──────────────────────────────────────────────────── */}
      {hasMultipleLines && (
        <div>
          <label htmlFor="rhinestone-font-line-spacing" className="block text-sm font-medium text-zinc-700 mb-2">
            Line Spacing (mm)
          </label>
          <input
            id="rhinestone-font-line-spacing"
            type="number"
            value={lineSpacingMm}
            onChange={(e) => setLineSpacingMm(e.target.value === '' ? '' : parseFloat(e.target.value))}
            step={0.1}
            min={0}
            max={50}
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Space between lines of text.
          </p>
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
            <label htmlFor="rhinestone-font-padding" className="block text-sm text-zinc-700 mb-1">
              Padding (mm)
            </label>
            <input
              id="rhinestone-font-padding"
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
      {isGenerating && (
        <div className="rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Loading font and generating template...
        </div>
      )}

      {!isGenerating && result && !result.ok && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Generation error:</strong> {result.error}
        </div>
      )}

      {!isGenerating && result && result.ok && (
        <div className="space-y-4">
          <TemplateStatsCard
            stoneCount={result.stoneCount}
            stoneSize={stoneSize}
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
