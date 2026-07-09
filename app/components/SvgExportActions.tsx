'use client';

import { useState } from 'react';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SvgExportActionsProps {
  svg: string;
  filename: string;
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Download and Copy SVG action buttons.
 *
 * Both actions are disabled when `svg` is empty or `disabled` is true.
 * The SVG must come from our engine — this component does not validate content.
 */
export default function SvgExportActions({
  svg,
  filename,
  disabled = false,
}: SvgExportActionsProps) {
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');

  const isDisabled = disabled || !svg;

  function handleDownload() {
    if (isDisabled) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopy() {
    if (isDisabled) return;
    try {
      await navigator.clipboard.writeText(svg);
      setCopyState('success');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  }

  const copyLabel =
    copyState === 'success' ? 'Copied!' : copyState === 'error' ? 'Failed' : 'Copy SVG';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={handleDownload}
        disabled={isDisabled}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Download SVG
      </button>
      <button
        onClick={() => void handleCopy()}
        disabled={isDisabled}
        className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {copyLabel}
      </button>
      <span className="text-xs text-zinc-400">{filename}</span>
    </div>
  );
}
