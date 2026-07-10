'use client';

import { useState, useMemo } from 'react';
import {
  createPolylineRhinestoneTemplate,
  validateRhinestoneTemplate,
  createBasicSvgExport,
  getTemplatePhysicalSize,
  getDensityPresetOptions,
} from '@/src/lib/rhinestone-engine/index';
import type {
  StoneSizeId,
  Polyline,
  TemplateValidationResult,
  DensityPreset,
} from '@/src/lib/rhinestone-engine/index';
import SvgPreview from './SvgPreview';
import SvgExportActions from './SvgExportActions';
import TemplateStatsCard from './TemplateStatsCard';
import ValidationIssuesList from './ValidationIssuesList';

// ─── Demo shapes ──────────────────────────────────────────────────────────────

type DemoShape = 'diamond' | 'triangle' | 'rectangle' | 'zigzag';

const DEMO_SHAPES: { value: DemoShape; label: string }[] = [
  { value: 'diamond', label: 'Diamond' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'zigzag', label: 'Zigzag' },
];

function buildDemoPolylines(shape: DemoShape): Polyline[] {
  switch (shape) {
    case 'diamond':
      // 4 sides of 25mm each, total perimeter 100mm
      return [
        {
          points: [
            { x: 20, y: 0 },
            { x: 40, y: 15 },
            { x: 20, y: 30 },
            { x: 0, y: 15 },
          ],
          closed: true,
        },
      ];
    case 'triangle':
      // Equilateral-ish: 30mm base, ~30mm sides, total perimeter ~90mm
      return [
        {
          points: [
            { x: 0, y: 0 },
            { x: 30, y: 0 },
            { x: 15, y: 26 },
          ],
          closed: true,
        },
      ];
    case 'rectangle':
      // 40×20mm, perimeter 120mm
      return [
        {
          points: [
            { x: 0, y: 0 },
            { x: 40, y: 0 },
            { x: 40, y: 20 },
            { x: 0, y: 20 },
          ],
          closed: true,
        },
      ];
    case 'zigzag':
      // 4 diagonal segments ~17mm each, open path
      return [
        {
          points: [
            { x: 0, y: 0 },
            { x: 12, y: 12 },
            { x: 24, y: 0 },
            { x: 36, y: 12 },
            { x: 48, y: 0 },
          ],
        },
      ];
  }
}

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
      validation: TemplateValidationResult;
    }
  | { ok: false; error: string };

// ─── Component ────────────────────────────────────────────────────────────────

export default function PolylineLogoGenerator() {
  const [shape, setShape] = useState<DemoShape>('diamond');
  const [stoneSize, setStoneSize] = useState<StoneSizeId>('SS10');
  const [includeGuideBox, setIncludeGuideBox] = useState(true);
  const [includeLabels, setIncludeLabels] = useState(false);
  const [paddingMm, setPaddingMm] = useState(5);
  const [targetWidthMm, setTargetWidthMm] = useState<number | ''>(80);
  const [targetHeightMm, setTargetHeightMm] = useState<number | ''>('');
  const [preserveAspectRatio, setPreserveAspectRatio] = useState(true);
  const [densityPreset, setDensityPreset] = useState<DensityPreset>('standard');
  const [customSpacingMm, setCustomSpacingMm] = useState<number | ''>(4.0);

  const result = useMemo<GeneratorResult>(() => {
    try {
      const polylines = buildDemoPolylines(shape);
      const template = createPolylineRhinestoneTemplate({
        id: `polyline-${shape}-${stoneSize.toLowerCase()}`,
        name: `${shape.charAt(0).toUpperCase() + shape.slice(1)} — ${stoneSize}`,
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

      const svgString = createBasicSvgExport(template, {
        includeGuideBox,
        includeLabels,
        paddingMm,
        decimalPlaces: 3,
      });

      return { ok: true, svgString, stoneCount: template.stones.length, physicalWidthMm, physicalHeightMm, validation };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [shape, stoneSize, includeGuideBox, includeLabels, paddingMm, targetWidthMm, targetHeightMm, preserveAspectRatio, densityPreset, customSpacingMm]);

  const filename = `rhinestone-polyline-logo-${stoneSize.toLowerCase()}.svg`;

  return (
    <div className="flex flex-col gap-6">

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Demo Shape</span>
          <select
            value={shape}
            onChange={(e) => setShape(e.target.value as DemoShape)}
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            {DEMO_SHAPES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
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
            type="number" min={1} step={1} value={targetWidthMm} placeholder="e.g. 80"
            onChange={(e) => setTargetWidthMm(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
            className="rounded border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-zinc-700">Target Height (mm)</span>
          <input
            type="number" min={1} step={1} value={targetHeightMm} placeholder="optional"
            onChange={(e) => setTargetHeightMm(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
            className="rounded border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </label>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={preserveAspectRatio} onChange={(e) => setPreserveAspectRatio(e.target.checked)} className="h-4 w-4 rounded" />
          <span className="text-sm font-medium text-zinc-700">Preserve aspect ratio</span>
        </label>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={includeGuideBox} onChange={(e) => setIncludeGuideBox(e.target.checked)} className="h-4 w-4 rounded" />
          <span className="text-sm font-medium text-zinc-700">Include guide box</span>
        </label>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={includeLabels} onChange={(e) => setIncludeLabels(e.target.checked)} className="h-4 w-4 rounded" />
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
              { label: 'Shape', value: shape },
              { label: 'Path mode', value: 'Polyline Sampling' },
              { label: 'Est. width', value: `${result.physicalWidthMm.toFixed(1)} mm` },
              { label: 'Est. height', value: `${result.physicalHeightMm.toFixed(1)} mm` },
              { label: 'Density', value: densityPreset },
            ]}
          />

          <SvgPreview svg={result.svgString} title="Polyline template preview" />

          <SvgExportActions svg={result.svgString} filename={filename} />
        </>
      )}
    </div>
  );
}
