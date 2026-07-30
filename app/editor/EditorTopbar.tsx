'use client';

import { EditorAction } from './EditorState';

interface EditorTopbarProps {
  projectName: string;
  canUndo: boolean;
  canRedo: boolean;
  dispatch: React.Dispatch<EditorAction>;
  onNewProject: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onExport: () => void;
  onOpenSetup: () => void;
}

export default function EditorTopbar({
  projectName,
  canUndo,
  canRedo,
  dispatch,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onExport,
  onOpenSetup,
}: EditorTopbarProps) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-700 bg-zinc-900 px-4 py-2.5">
      {/* Left: Logo + Project Name */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-purple-600 flex items-center justify-center text-white text-xs font-bold">
            R
          </div>
          <span className="text-sm font-semibold text-white">Rhinestone</span>
        </div>
        <div className="h-4 w-px bg-zinc-700" />
        <input
          type="text"
          value={projectName}
          onChange={(e) => dispatch({ type: 'SET_PROJECT_NAME', name: e.target.value })}
          className="bg-transparent border-none text-sm text-zinc-300 focus:outline-none focus:text-white min-w-[200px]"
          placeholder="Untitled Project"
        />
      </div>

      {/* Center: Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onNewProject}
          className="px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white rounded transition"
          title="New project"
        >
          New
        </button>
        <button
          onClick={onOpenProject}
          className="px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white rounded transition"
          title="Open project"
        >
          Open
        </button>
        <button
          onClick={onSaveProject}
          className="px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white rounded transition"
          title="Save project"
        >
          Save
        </button>
        
        <div className="h-4 w-px bg-zinc-700 mx-1" />
        
        <button
          onClick={() => dispatch({ type: 'UNDO' })}
          disabled={!canUndo}
          className="px-2 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          onClick={() => dispatch({ type: 'REDO' })}
          disabled={!canRedo}
          className="px-2 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo (Ctrl+Shift+Z)"
        >
          ↷
        </button>
        
        <div className="h-4 w-px bg-zinc-700 mx-1" />
        
        <button
          onClick={onExport}
          className="px-3 py-1.5 text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 rounded transition"
          title="Export SVG"
        >
          Export
        </button>
      </div>

      {/* Right: Setup */}
      <div>
        <button
          onClick={onOpenSetup}
          className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white rounded transition"
          title="Open calibration & setup"
        >
          ⚙ Setup
        </button>
      </div>
    </header>
  );
}
