'use client';

import Link from 'next/link';
import { Download, RotateCcw, RotateCw, Save, Settings2, Shirt } from 'lucide-react';
import type { HtvAction } from './HtvState';

function ToolbarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 border-l border-white/10 px-2 py-1 first:border-l-0">
      <div className="px-1.5 text-[9px] font-medium uppercase tracking-[0.16em] text-zinc-500">{label}</div>
      <div className="h-5 w-px bg-white/10" />
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
  designSurface: 'canvas' | 'garment';
  dispatch: React.Dispatch<HtvAction>;
  onSaveDesign: () => void;
  onExport: () => void;
  onOpenGarmentPreview: () => void;
  onToggleDesignSurface: (surface: 'canvas' | 'garment') => void;
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
}: HtvTopbarProps) {
  return (
    <header className="border-b border-white/10 bg-[#202024] text-zinc-200">
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border border-white/10 bg-[#17171a] px-3 py-1 shadow-sm">
          <span className="rounded border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-violet-200">
            Layer editor
          </span>
          <input
            type="text"
            value={projectName}
            onChange={(e) => dispatch({ type: 'SET_PROJECT_NAME', name: e.target.value })}
            aria-label="Project name"
            className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-1 text-sm font-semibold text-zinc-100 focus:border-violet-400/60 focus:bg-[#202024] focus:outline-none"
            placeholder="Untitled HTV Design"
          />
        </div>

        <ToolbarSection label="History">
          <button
            onClick={() => dispatch({ type: 'UNDO' })}
            disabled={!canUndo}
            aria-label="Undo"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-30"
            title="Undo (Cmd/Ctrl+Z)"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => dispatch({ type: 'REDO' })}
            disabled={!canRedo}
            aria-label="Redo"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-30"
            title="Redo (Cmd/Ctrl+Shift+Z)"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </ToolbarSection>

        <ToolbarSection label="Output">
          <button
            onClick={onOpenGarmentPreview}
            disabled={!canPreviewGarment}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-30"
            title={canPreviewGarment ? 'Preview this design on a t-shirt or hoodie' : 'Add a layer before previewing'}
          >
            <Shirt className="h-4 w-4" />
            Preview
          </button>
          <button
            onClick={onSaveDesign}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-400"
            title="Save this HTV design to My Designs"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
          <button
            onClick={onExport}
            disabled={!canExport}
            className="inline-flex items-center gap-2 rounded-md bg-violet-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-500"
            title={canExport ? 'Export the current design as a vector SVG cut file' : 'Add a layer before exporting'}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </ToolbarSection>

        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex rounded-md border border-white/10 bg-[#17171a] p-1">
            {(['canvas', 'garment'] as const).map((surface) => (
              <button
                key={surface}
                type="button"
                onClick={() => onToggleDesignSurface(surface)}
                className={`rounded px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition ${designSurface === surface ? 'bg-violet-500/35 text-white' : 'text-zinc-400 hover:bg-white/10 hover:text-zinc-100'}`}
              >
                {surface}
              </button>
            ))}
          </div>
          <Link
            href="/rhinestone"
            className="hidden rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100 md:inline-flex"
          >
            Rhinestone
          </Link>
          <button
            onClick={onOpenGarmentPreview}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-400"
            title="Open large garment preview"
          >
            <Settings2 className="h-4 w-4" />
            View
          </button>
        </div>
      </div>
    </header>
  );
}
