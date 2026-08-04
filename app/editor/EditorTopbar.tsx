'use client';

import { Download, FolderOpen, LibraryBig, RotateCcw, RotateCw, Save, Settings2, Sparkles } from 'lucide-react';
import { EditorAction } from './EditorState';

interface EditorTopbarProps {
  projectName: string;
  canUndo: boolean;
  canRedo: boolean;
  canExport: boolean;
  dispatch: React.Dispatch<EditorAction>;
  onNewProject: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onOpenLibrary: () => void;
  onExport: () => void;
  onOpenSetup: () => void;
}

export default function EditorTopbar({
  projectName,
  canUndo,
  canRedo,
  canExport,
  dispatch,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onOpenLibrary,
  onExport,
  onOpenSetup,
}: EditorTopbarProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-5 py-3">
      {/* Left: Logo + Project Name */}
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 text-sm font-bold text-white shadow-lg shadow-purple-950/50">
            R
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Rhinestone</p>
            <p className="text-xs text-zinc-500">Template Editor</p>
          </div>
        </div>
        <div className="hidden h-5 w-px bg-zinc-800 lg:block" />
        <input
          type="text"
          value={projectName}
          onChange={(e) => dispatch({ type: 'SET_PROJECT_NAME', name: e.target.value })}
          aria-label="Project name"
          className="min-w-[140px] max-w-[260px] rounded-lg border border-transparent bg-transparent px-3 py-2 text-sm text-zinc-200 focus:border-purple-500 focus:bg-zinc-900 focus:outline-none"
          placeholder="Untitled Project"
        />
      </div>

      {/* Center: Actions */}
      <div className="order-3 flex w-full items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 px-2 py-1.5 shadow-sm md:order-2 md:w-auto">
        <button
          onClick={onNewProject}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          title="Start a new project"
        >
          <Sparkles className="h-4 w-4" />
          New
        </button>
        <button
          onClick={onOpenProject}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          title="Open a saved project"
        >
          <FolderOpen className="h-4 w-4" />
          Open
        </button>
        <button
          onClick={onSaveProject}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          title="Save the current project"
        >
          <Save className="h-4 w-4" />
          Save
        </button>
        <button
          onClick={onOpenLibrary}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          title="Open the local template library"
        >
          <LibraryBig className="h-4 w-4" />
          Library
        </button>
        
        <div className="mx-1 h-6 w-px bg-zinc-800" />
        
        <button
          onClick={() => dispatch({ type: 'UNDO' })}
          disabled={!canUndo}
          aria-label="Undo"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-zinc-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-30"
          title="Undo last change (Cmd/Ctrl+Z)"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          onClick={() => dispatch({ type: 'REDO' })}
          disabled={!canRedo}
          aria-label="Redo"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-zinc-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-30"
          title="Redo last undone change (Cmd/Ctrl+Shift+Z)"
        >
          <RotateCw className="h-4 w-4" />
        </button>
        
        <div className="mx-1 h-6 w-px bg-zinc-800" />
        
        <button
          onClick={onExport}
          disabled={!canExport}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          title={canExport ? 'Export the current design as SVG' : 'Create or open a design before exporting'}
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

      {/* Right: Setup */}
      <div className="order-2 md:order-3">
        <button
          onClick={onOpenSetup}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          title="Open calibration and setup"
        >
          <Settings2 className="h-4 w-4" />
          <span className="hidden xl:inline">Setup</span>
        </button>
      </div>
    </header>
  );
}
