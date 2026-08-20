'use client';

import Link from 'next/link';
import { Download, RotateCcw, RotateCw, Save, Shirt } from 'lucide-react';
import type { HtvAction } from './HtvState';

function ToolbarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-[rgba(255,255,255,0.92)] px-2 py-2 shadow-sm">
      <div className="px-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">{label}</div>
      <div className="h-5 w-px bg-border" />
      <div className="flex flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

interface HtvTopbarProps {
  projectName: string;
  canUndo: boolean;
  canRedo: boolean;
  canExport: boolean;
  canPreviewGarment: boolean;
  dispatch: React.Dispatch<HtvAction>;
  onSaveDesign: () => void;
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
  onSaveDesign,
  onExport,
  onOpenGarmentPreview,
}: HtvTopbarProps) {
  return (
    <header className="border-b border-border/80 bg-[rgba(248,245,241,0.94)] px-4 py-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/70 bg-[linear-gradient(135deg,var(--color-sand-800),var(--color-brand-600))] text-xs font-bold text-ink-inverse shadow-sm shadow-sand-900/10">
              HT
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">Studio</p>
              <p className="text-sm font-semibold text-ink">HTV Studio</p>
            </div>
          </div>
          <div className="min-w-0 w-full flex-1 rounded-2xl border border-border/80 bg-[rgba(255,255,255,0.9)] px-4 py-2.5 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-700">
                Layer editor
              </span>
              <Link
                href="/rhinestone"
                className="hidden rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-medium text-ink-secondary transition hover:text-ink md:inline-flex"
              >
                Switch to Rhinestone Studio
              </Link>
            </div>
            <input
              type="text"
              value={projectName}
              onChange={(e) => dispatch({ type: 'SET_PROJECT_NAME', name: e.target.value })}
              aria-label="Project name"
              className="mt-2 w-full min-w-0 max-w-[420px] rounded-xl border border-transparent bg-transparent px-2 py-1.5 text-base font-semibold text-ink focus:border-accent-300 focus:bg-surface focus:outline-none"
              placeholder="Untitled HTV Design"
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ToolbarSection label="History">
          <button
            onClick={() => dispatch({ type: 'UNDO' })}
            disabled={!canUndo}
            aria-label="Undo"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-secondary transition hover:bg-surface hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent-400 disabled:cursor-not-allowed disabled:opacity-30"
            title="Undo (Cmd/Ctrl+Z)"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => dispatch({ type: 'REDO' })}
            disabled={!canRedo}
            aria-label="Redo"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-secondary transition hover:bg-surface hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent-400 disabled:cursor-not-allowed disabled:opacity-30"
            title="Redo (Cmd/Ctrl+Shift+Z)"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </ToolbarSection>

        <ToolbarSection label="Output">
          <button
            onClick={onOpenGarmentPreview}
            disabled={!canPreviewGarment}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-secondary transition hover:bg-surface hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent-400 disabled:cursor-not-allowed disabled:opacity-30"
            title={canPreviewGarment ? 'Preview this design on a t-shirt or hoodie' : 'Add a layer before previewing'}
          >
            <Shirt className="h-4 w-4" />
            Preview
          </button>
          <button
            onClick={onSaveDesign}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-secondary transition hover:bg-surface hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent-400"
            title="Save this HTV design to My Designs"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
          <button
            onClick={onExport}
            disabled={!canExport}
            className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-ink-inverse transition hover:bg-sand-800 focus:outline-none focus:ring-2 focus:ring-accent-400 disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted"
            title={canExport ? 'Export the current design as a vector SVG cut file' : 'Add a layer before exporting'}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </ToolbarSection>
      </div>
    </header>
  );
}
