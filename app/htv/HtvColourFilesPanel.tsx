'use client';

import { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { createZip } from '../lib/zip';
import { createHtvColourFiles, buildColourFilesNote, type HtvColourFile, type HtvExportOptions } from './htvExport';
import type { HtvLayer } from './HtvState';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const safe = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'colour';

/** "Cut each colour separately": one file per vinyl colour, all with the same frame, in a .zip. Only for 2+ colours. */
export default function HtvColourFilesPanel({
  layers,
  projectName,
  options,
  filenameBase,
  onDownloaded,
}: {
  layers: readonly HtvLayer[];
  projectName: string;
  options: HtvExportOptions;
  filenameBase: string;
  onDownloaded: (message: string) => void;
}) {
  const [files, setFiles] = useState<HtvColourFile[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void createHtvColourFiles(layers, projectName, options)
      .then((result) => {
        if (!cancelled) setFiles(result);
      })
      .catch(() => {
        if (!cancelled) setFiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [layers, projectName, options]);

  if (!files || files.length < 2) return null;
  const download = () => {
    const entries = files.map((file, i) => ({ name: `${filenameBase}-${i + 1}-${safe(file.colourName)}.svg`, data: file.svg }));
    entries.push({ name: `${filenameBase}-colours.txt`, data: buildColourFilesNote(projectName, files, entries.map((e) => e.name)) });
    triggerDownload(new Blob([createZip(entries) as BlobPart], { type: 'application/zip' }), `${filenameBase}-by-colour.zip`);
    onDownloaded(`${files.length} colours exported as a .zip.`);
  };
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-300">
      <p className="flex items-center gap-1.5 font-semibold text-zinc-100">
        <Layers className="h-3.5 w-3.5" aria-hidden="true" />
        Cut each colour separately
      </p>
      <p className="mt-1 leading-5 text-zinc-400">
        {files.length} colours: {files.map((f) => f.colourName).join(', ')}. One file per vinyl colour, all the same size so they line up when you press them on top of each other.
      </p>
      <button
        type="button"
        onClick={download}
        className="mt-2 inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 font-medium text-zinc-100 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
      >
        Download one file per colour (.zip)
      </button>
    </div>
  );
}
