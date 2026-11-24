'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { useT } from '../lib/i18n';
/** Steps for getting the SVG into Cricut Design Space at the right size. Short, in the order they are done. */
export default function DesignSpaceGuide({ widthMm, heightMm }: { widthMm: number | null; heightMm: number | null }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const size = widthMm !== null && heightMm !== null ? `${Math.round(widthMm)} × ${Math.round(heightMm)} mm (${(widthMm / 25.4).toFixed(1)} × ${(heightMm / 25.4).toFixed(1)} in)` : 'the size shown above';
  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/60 text-xs text-zinc-300">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left font-semibold text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-400"
      >
        {t('How to open it in Cricut Design Space')}
        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <ol className="list-decimal space-y-1.5 border-t border-zinc-800 px-3 py-3 pl-7 leading-5 text-zinc-400">
          <li>{t('Download the SVG here and keep it somewhere you can find it.')}</li>
          <li>In Design Space choose <strong className="text-zinc-200">New project</strong>, then <strong className="text-zinc-200">Upload</strong> and <strong className="text-zinc-200">Upload image</strong>, and pick the file.</li>
          <li>Choose <strong className="text-zinc-200">Complex</strong> if you are asked, then <strong className="text-zinc-200">Save as a Cut image</strong>, and add it to the canvas.</li>
          <li>Check the size. It should be {size}. If it is not, set the width and height by hand, with the lock on.</li>
          <li>{t('Do not resize it more than that: the holes are made for your stones, and a different size changes them.')}</li>
          <li>{t('Pick the material your flock template sheet is (a custom material works), put the mat in, and cut. Cut the test patch first if you have not used this material before.')}</li>
        </ol>
      )}
    </div>
  );
}
