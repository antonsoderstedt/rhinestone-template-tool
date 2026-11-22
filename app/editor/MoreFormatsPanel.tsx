'use client';

import { FileDown } from 'lucide-react';
import { createDxfExport, createEpsExport, type RhinestoneTemplate } from '@/src/lib/rhinestone-engine/index';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** The same design as DXF or EPS, for cutters and programs that do not open SVG. Plain vector files, no pictures. */
export default function MoreFormatsPanel({
  template,
  paddingMm,
  filenameBase,
  downloadAllowed,
  uncalibrated,
  onDownloaded,
}: {
  template: RhinestoneTemplate;
  paddingMm: number;
  filenameBase: string;
  downloadAllowed: boolean;
  uncalibrated: boolean;
  onDownloaded: (message: string) => void;
}) {
  if (template.stones.length === 0) return null;
  const suffix = uncalibrated ? '-uncalibrated' : '';
  const download = (kind: 'dxf' | 'eps') => {
    const text = kind === 'dxf' ? createDxfExport(template, { paddingMm }) : createEpsExport(template, { paddingMm });
    const name = `${filenameBase}${suffix}.${kind}`;
    triggerDownload(new Blob([text], { type: kind === 'dxf' ? 'application/dxf' : 'application/postscript' }), name);
    onDownloaded(`Downloaded ${name}.`);
  };
  const buttonClass =
    'inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 font-medium text-zinc-100 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-300">
      <p className="flex items-center gap-1.5 font-semibold text-zinc-100">
        <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
        Other file types
      </p>
      <p className="mt-1 leading-5 text-zinc-400">For cutters and programs that do not open SVG. Every hole is a circle, in millimetres.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" disabled={!downloadAllowed} onClick={() => download('dxf')} className={buttonClass}>Download DXF</button>
        <button type="button" disabled={!downloadAllowed} onClick={() => download('eps')} className={buttonClass}>Download EPS</button>
      </div>
    </div>
  );
}
