'use client';

import Link from 'next/link';
import { Download, RotateCcw, RotateCw, Shirt } from 'lucide-react';
import type { HtvAction } from './HtvState';

interface HtvTopbarProps {
  projectName: string;
  canUndo: boolean;
  canRedo: boolean;
  canExport: boolean;
  canPreviewGarment: boolean;
  dispatch: React.Dispatch<HtvAction>;
  onExport: () => void;
  onOpenGarmentPreview: () => void;
}

export default function HtvTopbar({
  projectName,
  canUndo,
  canRedo,
  canExport,
  canPreviewGarment,
  dispatch,
  onExport,
  onOpenGarmentPreview,
}: HtvTopbarProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-sunken px-5 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-sm font-bold text-ink-inverse shadow-lg shadow-ink/20">
            H
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">HTV Studio</p>
            <p className="text-xs text-ink-muted">Vinyl Design Editor</p>
          </div>
        </div>
        <Link
          href="/"
          className="hidden rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-secondary transition hover:bg-surface-raised hover:text-ink md:inline-flex"
        >
          ← Rhinestone Studio
        </Link>
        <div className="hidden h-5 w-px bg-surface-sunken lg:block" />
        <input
          type="text"
          value={projectName}
          onChange={(e) => dispatch({ type: 'SET_PROJECT_NAME', name: e.target.value })}
          aria-label="Project name"
          className="min-w-[140px] max-w-[260px] rounded-lg border border-transparent bg-transparent px-3 py-2 text-sm text-ink focus:border-accent-400 focus:bg-surface-raised focus:outline-none"
          placeholder="Untitled HTV Design"
        />
      </div>

      <div className="order-3 flex w-full items-center gap-2 rounded-xl border border-border bg-surface-raised px-2 py-1.5 shadow-sm md:order-2 md:w-auto">
        <button
          onClick={() => dispatch({ type: 'UNDO' })}
          disabled={!canUndo}
          aria-label="Undo"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-secondary transition hover:bg-surface-sunken hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent-400 disabled:cursor-not-allowed disabled:opacity-30"
          title="Undo (Cmd/Ctrl+Z)"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          onClick={() => dispatch({ type: 'REDO' })}
          disabled={!canRedo}
          aria-label="Redo"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-secondary transition hover:bg-surface-sunken hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent-400 disabled:cursor-not-allowed disabled:opacity-30"
          title="Redo (Cmd/Ctrl+Shift+Z)"
        >
          <RotateCw className="h-4 w-4" />
        </button>

        <div className="mx-1 h-6 w-px bg-surface-sunken" />

        <button
          onClick={onOpenGarmentPreview}
          disabled={!canPreviewGarment}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-secondary transition hover:bg-surface-sunken hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent-400 disabled:cursor-not-allowed disabled:opacity-30"
          title={canPreviewGarment ? 'Preview this design on a t-shirt or hoodie' : 'Add a layer before previewing'}
        >
          <Shirt className="h-4 w-4" />
          Preview
        </button>

        <div className="mx-1 h-6 w-px bg-surface-sunken" />

        <button
          onClick={onExport}
          disabled={!canExport}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-3 py-2 text-sm font-medium text-ink-inverse transition hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-400 disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted"
          title={canExport ? 'Export the current design as a vector SVG cut file' : 'Add a layer before exporting'}
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>
    </header>
  );
}
