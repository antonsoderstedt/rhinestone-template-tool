'use client';

import { useMemo, useState } from 'react';
import { Download, Scissors } from 'lucide-react';
import {
  CRICUT_MAT_12X12_USABLE_MM,
  CRICUT_MAT_12X24_USABLE_MM,
  buildPartTemplate,
  createBasicSvgExport,
  planSplitForMat,
  type ExportOptions,
  type RhinestoneTemplate,
  type SplitPlan,
} from '@/src/lib/rhinestone-engine/index';
import { createZip } from '../lib/zip';

import { useT } from '../lib/i18n';
type MatChoice = '12x12' | '12x24';

const MATS: Record<MatChoice, { label: string; short: string; long: number }> = {
  '12x12': { label: '12 × 12 in (30 × 30 cm)', short: 'mat 12×12', long: CRICUT_MAT_12X12_USABLE_MM.longSide },
  '12x24': { label: '12 × 24 in (30 × 60 cm)', short: 'mat 12×24', long: CRICUT_MAT_12X24_USABLE_MM.longSide },
};

export interface SplitExportPanelProps {
  template: RhinestoneTemplate;
  svgOptions: ExportOptions;
  /** Shown in the layout file. */
  designName: string;
  /** File name without extension. Parts are named `<name>-part-1-of-3.svg`. */
  filenameBase: string;
  /** From the export dialog: false until calibration is approved or the warning acknowledged. */
  downloadAllowed: boolean;
  uncalibrated: boolean;
  onDownloaded: (message: string) => void;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const fmt = (mm: number) => `${(mm / 10).toFixed(1)} cm`;

/** Text that goes into the zip so the parts can be put back together on the garment. */
export function buildLayoutText(name: string, plan: SplitPlan, matLabel: string, files: string[]): string {
  const lines = [
    `${name} – split into ${plan.parts.length} parts for ${matLabel}`,
    `Whole design: ${plan.widthMm.toFixed(1)} × ${plan.heightMm.toFixed(1)} mm`,
    '',
    'Place the parts on the garment with the offsets below, measured from the top left corner of the whole design.',
    'Each part is cut on its own mat; a stone is never cut in two.',
    '',
  ];
  const originX = plan.parts.reduce((m, p) => Math.min(m, p.minX), Infinity);
  const originY = plan.parts.reduce((m, p) => Math.min(m, p.minY), Infinity);
  plan.parts.forEach((part, i) => {
    lines.push(
      `Part ${part.index}: ${files[i]}`,
      `  column ${part.column + 1}, row ${part.row + 1} · ${part.stones.length} stones · ${part.widthMm.toFixed(1)} × ${part.heightMm.toFixed(1)} mm`,
      `  offset from the design's top left: ${(part.minX - originX).toFixed(1)} mm right, ${(part.minY - originY).toFixed(1)} mm down`,
      part.needsTurn ? '  Turn this part 90° on the mat.' : '',
    );
  });
  return lines.filter((l, i, all) => !(l === '' && all[i - 1] === '')).join('\n') + '\n';
}

export default function SplitExportPanel({ template, svgOptions, designName, filenameBase, downloadAllowed, uncalibrated, onDownloaded }: SplitExportPanelProps) {
  const t = useT();
  const [matChoice, setMatChoice] = useState<MatChoice>('12x24');
  const padding = svgOptions.paddingMm ?? 0;

  const plan = useMemo(() => {
    const mat = MATS[matChoice];
    const usableShort = CRICUT_MAT_12X12_USABLE_MM.shortSide;
    // The SVG adds padding around every part, and the padded file has to fit the mat.
    return planSplitForMat(template, { shortSideMm: usableShort - 2 * padding, longSideMm: mat.long - 2 * padding });
  }, [template, matChoice, padding]);

  const suffix = uncalibrated ? '-uncalibrated' : '';
  const fileNames = plan.parts.map((part) => `${filenameBase}-part-${part.index}-of-${plan.parts.length}${suffix}.svg`);

  const buildPartSvg = (index: number) => createBasicSvgExport(buildPartTemplate(template, plan, plan.parts[index]!), svgOptions);

  const downloadPart = (index: number) => {
    triggerDownload(new Blob([buildPartSvg(index)], { type: 'image/svg+xml' }), fileNames[index]!);
    onDownloaded(`Part ${index + 1} of ${plan.parts.length} exported.`);
  };

  const downloadAll = () => {
    const files = plan.parts.map((_, i) => ({ name: fileNames[i]!, data: buildPartSvg(i) }));
    files.push({ name: `${filenameBase}-layout.txt`, data: buildLayoutText(designName, plan, MATS[matChoice].label, fileNames) });
    const zip = createZip(files);
    triggerDownload(new Blob([zip as BlobPart], { type: 'application/zip' }), `${filenameBase}-${plan.parts.length}-parts${suffix}.zip`);
    onDownloaded(`${plan.parts.length} parts exported as a .zip with a layout file.`);
  };

  const pad = 4;
  const viewW = plan.widthMm + pad * 2;
  const viewH = plan.heightMm + pad * 2;
  const originX = plan.parts.reduce((m, p) => Math.min(m, p.minX), Infinity);
  const originY = plan.parts.reduce((m, p) => Math.min(m, p.minY), Infinity);
  const colours = ['#a855f7', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

  return (
    <section aria-labelledby="split-export-title" className="flex flex-col gap-2.5" data-testid="split-export">
      <h3 id="split-export-title" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-300">
        <Scissors className="h-3.5 w-3.5" aria-hidden="true" />
        {t('Split across mats')}
      </h3>
      <p className="text-xs leading-5 text-zinc-400">
        {t('Too big for one mat, or want smaller pieces? Cut the design in parts. Seams run between stones, so no stone is cut.')}
      </p>

      <fieldset className="flex flex-col gap-1 text-xs text-zinc-200">
        <legend className="sr-only">{t('Mat size')}</legend>
        {(Object.keys(MATS) as MatChoice[]).map((key) => (
          <label key={key} className="flex items-center gap-2">
            <input type="radio" name="split-mat" checked={matChoice === key} onChange={() => setMatChoice(key)} />
            {MATS[key].label}
          </label>
        ))}
      </fieldset>

      {plan.parts.length === 0 ? null : !plan.splittable ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {t('The stones are too large to split for this mat. Choose a smaller stone size.')}
        </p>
      ) : plan.fitsWhole ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200" data-testid="split-fits">
          The whole design ({fmt(plan.widthMm)} × {fmt(plan.heightMm)}) fits one {MATS[matChoice].short}. No split needed.
        </p>
      ) : (
        <>
          <p className="text-xs font-medium text-white" data-testid="split-summary">
            {plan.parts.length} parts on {MATS[matChoice].short}
            {plan.seamCrossings === 0
              ? ' · every seam runs between stones'
              : ` · ${plan.seamCrossings} ${plan.seamCrossings === 1 ? 'stone is' : 'stones are'} on a seam and kept whole`}
          </p>

          <svg
            viewBox={`${-pad} ${-pad} ${viewW} ${viewH}`}
            className="h-32 w-full rounded-lg border border-zinc-800 bg-white"
            role="img"
            aria-label={`Overview of the ${plan.parts.length} parts`}
          >
            {plan.parts.map((part, i) => (
              <g key={part.index}>
                <rect
                  x={part.minX - originX}
                  y={part.minY - originY}
                  width={part.widthMm}
                  height={part.heightMm}
                  fill={colours[i % colours.length]}
                  fillOpacity={0.12}
                  stroke={colours[i % colours.length]}
                  strokeWidth={Math.max(plan.widthMm, plan.heightMm) / 300}
                  strokeDasharray={`${plan.widthMm / 80} ${plan.widthMm / 120}`}
                />
                {part.stones.map((stone) => (
                  <circle
                    key={stone.id}
                    cx={stone.center.x - originX}
                    cy={stone.center.y - originY}
                    r={stone.holeDiameterMm / 2}
                    fill={colours[i % colours.length]}
                  />
                ))}
                <text
                  x={part.minX - originX + part.widthMm / 2}
                  y={part.minY - originY + part.heightMm / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={Math.min(part.widthMm, part.heightMm) / 3}
                  fontWeight={700}
                  fill="#111827"
                  fillOpacity={0.55}
                >
                  {part.index}
                </text>
              </g>
            ))}
          </svg>

          <ul className="flex flex-col gap-1 text-xs">
            {plan.parts.map((part, i) => (
              <li key={part.index} className="flex items-center justify-between gap-2 rounded-md border border-zinc-800 px-2.5 py-1.5">
                <span className="min-w-0 text-zinc-300">
                  <span className="font-semibold text-white">Part {part.index}</span> · {part.stones.length} stones · {fmt(part.widthMm)} × {fmt(part.heightMm)}
                  {part.needsTurn && <span className="text-amber-200"> · turn 90°</span>}
                </span>
                <button
                  type="button"
                  disabled={!downloadAllowed}
                  onClick={() => downloadPart(i)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 font-medium text-zinc-100 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Download part ${part.index} of ${plan.parts.length}`}
                >
                  <Download className="h-3 w-3" aria-hidden="true" /> {t('SVG')}
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            disabled={!downloadAllowed}
            onClick={downloadAll}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download all {plan.parts.length} parts (.zip)
          </button>
          {!downloadAllowed && <p className="text-xs text-amber-200">{t('Confirm the calibration notice below to enable the downloads.')}</p>}
          {(template.cutShapes?.length ?? 0) > 0 && (
            <p className="text-xs text-amber-200">{t('Cut outlines belong to the whole design and are left out of the parts.')}</p>
          )}
        </>
      )}
    </section>
  );
}
