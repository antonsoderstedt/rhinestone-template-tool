'use client';

import Link from 'next/link';
import { Download, FolderOpen, LibraryBig, RotateCcw, RotateCw, Save, Settings2, Shirt, Sparkles } from 'lucide-react';
import { EditorAction } from './EditorState';

function ToolbarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 border-l border-white/10 px-2 py-1 first:border-l-0">
      <div className="px-1.5 text-[9px] font-medium uppercase tracking-[0.16em] text-zinc-500">{label}</div>
      <div className="h-5 w-px bg-white/10" />
      <div className="flex flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

interface EditorTopbarProps {
  projectName: string;
  canUndo: boolean;
  canRedo: boolean;
  canExport: boolean;
  canPreviewGarment: boolean;
  dispatch: React.Dispatch<EditorAction>;
  onNewProject: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onOpenLibrary: () => void;
  onExport: () => void;
  onOpenSetup: () => void;
  onOpenGarmentPreview: () => void;
}

export default function EditorTopbar({
  projectName,
  canUndo,
  canRedo,
  canExport,
  canPreviewGarment,
  dispatch,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onOpenLibrary,
  onExport,
  onOpenSetup,
  onOpenGarmentPreview,
}: EditorTopbarProps) {
  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-[#202024] px-3 py-1.5 text-zinc-200">
      <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border border-white/10 bg-[#17171a] px-3 py-1 shadow-sm">
        <span className="rounded border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-violet-200">
          Live editor
        </span>
        <input
          type="text"
          value={projectName}
          onChange={(e) => dispatch({ type: 'SET_PROJECT_NAME', name: e.target.value })}
          aria-label="Project name"
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-1 text-sm font-semibold text-zinc-100 focus:border-violet-400/60 focus:bg-[#202024] focus:outline-none"
          placeholder="Untitled Project"
        />
      </div>

      <div className="flex flex-wrap items-center">
        <ToolbarSection label="Project">
          <button
            onClick={onNewProject}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-400"
            title="Start a new project"
          >
            <Sparkles className="h-4 w-4" />
            New
          </button>
          <button
            onClick={onOpenProject}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-400"
            title="Open a saved project"
          >
            <FolderOpen className="h-4 w-4" />
            Open
          </button>
          <button
            onClick={onSaveProject}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-400"
            title="Save the current project"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
          <button
            onClick={onOpenLibrary}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-400"
            title="Open the local template library"
          >
            <LibraryBig className="h-4 w-4" />
            Library
          </button>
        </ToolbarSection>

        <ToolbarSection label="History">
          <button
            onClick={() => dispatch({ type: 'UNDO' })}
            disabled={!canUndo}
            aria-label="Undo"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-30"
            title="Undo last change (Cmd/Ctrl+Z)"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => dispatch({ type: 'REDO' })}
            disabled={!canRedo}
            aria-label="Redo"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-30"
            title="Redo last undone change (Cmd/Ctrl+Shift+Z)"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </ToolbarSection>

        <ToolbarSection label="Output">
          <button
            onClick={onOpenGarmentPreview}
            disabled={!canPreviewGarment}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-30"
            title={canPreviewGarment ? 'Preview this design on a t-shirt or hoodie' : 'Create or open a design before previewing'}
          >
            <Shirt className="h-4 w-4" />
            Preview
          </button>
          <button
            onClick={onExport}
            disabled={!canExport}
            className="inline-flex items-center gap-2 rounded-md bg-violet-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-zinc-500"
            title={canExport ? 'Export the current design as SVG' : 'Create or open a design before exporting'}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </ToolbarSection>

        <Link
          href="/htv"
          className="ml-2 hidden rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100 md:inline-flex"
        >
          HTV Studio
        </Link>
        <button
          onClick={onOpenSetup}
          className="ml-1 inline-flex items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-400"
          title="Open calibration and setup"
        >
          <Settings2 className="h-4 w-4" />
          Setup
        </button>
      </div>
    </header>
  );
}
