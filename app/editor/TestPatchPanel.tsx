'use client';

import { FlaskConical } from 'lucide-react';
import { createBasicSvgExport, type ExportOptions, type RhinestoneTemplate } from '@/src/lib/rhinestone-engine/index';
import { TEST_PATCH_COLUMNS, TEST_PATCH_ROWS, buildTestPatch } from './testPatch';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** "Cut a small test first": a few rows with the design's own hole size and spacing, for a scrap of material. */
export default function TestPatchPanel({
  template,
  svgOptions,
  filenameBase,
  downloadAllowed,
  uncalibrated,
  onDownloaded,
}: {
  template: RhinestoneTemplate;
  svgOptions: ExportOptions;
  filenameBase: string;
  downloadAllowed: boolean;
  uncalibrated: boolean;
  onDownloaded: (message: string) => void;
}) {
  if (template.stones.length === 0) return null;
  const download = () => {
    const patch = buildTestPatch(template.stones);
    if (!patch) return;
    const svg = createBasicSvgExport(patch, { ...svgOptions, includeLabels: false });
    const name = `${filenameBase}-test-patch${uncalibrated ? '-uncalibrated' : ''}.svg`;
    triggerDownload(new Blob([svg], { type: 'image/svg+xml' }), name);
    onDownloaded(`Downloaded ${name}.`);
  };
  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-300">
      <p className="flex items-center gap-1.5 font-semibold text-zinc-100">
        <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
        Cut a small test first
      </p>
      <p className="mt-1 leading-5 text-zinc-400">
        {TEST_PATCH_COLUMNS} × {TEST_PATCH_ROWS} stones with the same hole size and spacing as this design. Cut it on a scrap of the material and press in a few stones before you cut the real thing.
      </p>
      <button
        type="button"
        disabled={!downloadAllowed}
        onClick={download}
        className="mt-2 inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 font-medium text-zinc-100 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Download the test patch
      </button>
    </div>
  );
}
