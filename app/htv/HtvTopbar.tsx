'use client';

import Link from 'next/link';
import { Download, RotateCcw, RotateCw, Save, Settings2, Shirt } from 'lucide-react';
import type { HtvAction } from './HtvState';
import type { StudioTheme } from '../lib/studioTheme';
import StudioThemeToggle from '../components/StudioThemeToggle';

function ToolbarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 border-l border-[var(--studio-border)] px-2 py-1 first:border-l-0">
      <div className="px-1.5 text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--studio-ink-subtle)]">{label}</div>
      <div className="h-5 w-px bg-[var(--studio-hover-overlay)]" />
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
  designSurface: 'canvas' | 'garment' | '3d';
  dispatch: React.Dispatch<HtvAction>;
  onSaveDesign: () => void;
  onExport: () => void;
  onOpenGarmentPreview: () => void;
  onToggleDesignSurface: (surface: 'canvas' | 'garment' | '3d') => void;
  theme: StudioTheme;
  onToggleTheme: () => void;
}

export default function HtvTopbar({
  projectName,
  canUndo,
  canRedo,
  canExport,
  canPreviewGarment,
  designSurface,
  dispatch,
  onSaveDesign,
  onExport,
  onOpenGarmentPreview,
  onToggleDesignSurface,
  theme,
  onToggleTheme,
}: HtvTopbarProps) {
  return (
    <header className="border-b border-[var(--studio-border)] bg-[var(--studio-surface)] text-[var(--studio-ink)]">
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-1 shadow-sm">
          <span className="rounded border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-violet-200">
            Layer editor
          </span>
          <input
            type="text"
            value={projectName}
            onChange={(e) => dispatch({ type: 'SET_PROJECT_NAME', name: e.target.value })}
            aria-label="Project name"
            className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-1 text-sm font-semibold text-[var(--studio-ink)] focus:border-violet-400/60 focus:bg-[var(--studio-surface)] focus:outline-none"
            placeholder="Untitled HTV Design"
          />
        </div>

        <ToolbarSection label="History">
          <button
            onClick={() => dispatch({ type: 'UNDO' })}
            disabled={!canUndo}
            aria-label="Undo"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--studio-ink-muted)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-30"
            title="Undo (Cmd/Ctrl+Z)"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => dispatch({ type: 'REDO' })}
            disabled={!canRedo}
            aria-label="Redo"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--studio-ink-muted)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-30"
            title="Redo (Cmd/Ctrl+Shift+Z)"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </ToolbarSection>

        <ToolbarSection label="Output">
          <button
            onClick={onOpenGarmentPreview}
            disabled={!canPreviewGarment}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-30"
            title={canPreviewGarment ? 'Preview this design on a t-shirt or hoodie' : 'Add a layer before previewing'}
          >
            <Shirt className="h-4 w-4" />
            Preview
          </button>
          <button
            onClick={onSaveDesign}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400"
            title="Save this HTV design to My Designs"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
          <button
            onClick={onExport}
            disabled={!canExport}
            className="inline-flex items-center gap-2 rounded-md bg-violet-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:bg-[var(--studio-hover-overlay)] disabled:text-[var(--studio-ink-subtle)]"
            title={canExport ? 'Export the current design as a vector SVG cut file' : 'Add a layer before exporting'}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </ToolbarSection>

        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] p-1">
            {(['canvas', 'garment', '3d'] as const).map((surface) => (
              <button
                key={surface}
                type="button"
                onClick={() => onToggleDesignSurface(surface)}
                className={`rounded px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition ${designSurface === surface ? 'bg-violet-500/35 text-white' : 'text-[var(--studio-ink-muted)] hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]'}`}
              >
                {surface}
              </button>
            ))}
          </div>
          <Link
            href="/rhinestone"
            className="hidden rounded-md border border-[var(--studio-border)] bg-[var(--studio-hover-overlay-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--studio-ink-muted)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] md:inline-flex"
          >
            Rhinestone
          </Link>
          <button
            onClick={onOpenGarmentPreview}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-hover-overlay-soft)] px-2.5 py-1 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400"
            title="Open large garment preview"
          >
            <Settings2 className="h-4 w-4" />
            View
          </button>
          <StudioThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </header>
  );
}
