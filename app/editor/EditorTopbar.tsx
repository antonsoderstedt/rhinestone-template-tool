'use client';

import Link from 'next/link';
import { Download, FolderOpen, LibraryBig, RotateCcw, RotateCw, Save, Settings2, Shirt, Sparkles } from 'lucide-react';
import { EditorAction } from './EditorState';
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

interface EditorTopbarProps {
  projectName?: string;
  canUndo?: boolean;
  canRedo?: boolean;
  canExport?: boolean;
  canPreviewGarment?: boolean;
  dispatch?: React.Dispatch<EditorAction>;
  onNewProject?: () => void;
  onOpenProject?: () => void;
  onSaveProject?: () => void;
  onOpenLibrary?: () => void;
  onExport?: () => void;
  onOpenSetup?: () => void;
  onOpenGarmentPreview?: () => void;
  theme?: StudioTheme;
  onToggleTheme?: () => void;
}

export default function EditorTopbar({
  projectName = 'Untitled Project',
  canUndo = false,
  canRedo = false,
  canExport = false,
  canPreviewGarment = false,
  dispatch = () => undefined,
  onNewProject = () => undefined,
  onOpenProject = () => undefined,
  onSaveProject = () => undefined,
  onOpenLibrary = () => undefined,
  onExport = () => undefined,
  onOpenSetup = () => undefined,
  onOpenGarmentPreview = () => undefined,
  theme = 'dark',
  onToggleTheme = () => undefined,
}: EditorTopbarProps) {
  return (
    <header className="flex flex-wrap items-center gap-2 border-b border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 py-1.5 text-[var(--studio-ink)]">
      <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-1 shadow-sm">
        <span className="rounded border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-violet-200">
          Live editor
        </span>
        <input
          type="text"
          value={projectName}
          onChange={(e) => dispatch({ type: 'SET_PROJECT_NAME', name: e.target.value })}
          aria-label="Project name"
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-1 text-sm font-semibold text-[var(--studio-ink)] focus:border-violet-400/60 focus:bg-[var(--studio-surface)] focus:outline-none"
          placeholder="Untitled Project"
        />
      </div>

      <div className="flex flex-wrap items-center">
        <ToolbarSection label="Project">
          <button
            onClick={onNewProject}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400"
            title="Start a new project"
          >
            <Sparkles className="h-4 w-4" />
            New
          </button>
          <button
            onClick={onOpenProject}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400"
            title="Open a saved project"
          >
            <FolderOpen className="h-4 w-4" />
            Open
          </button>
          <button
            onClick={onSaveProject}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400"
            title="Save the current project"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
          <button
            onClick={onOpenLibrary}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400"
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--studio-ink-muted)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-30"
            title="Undo last change (Cmd/Ctrl+Z)"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => dispatch({ type: 'REDO' })}
            disabled={!canRedo}
            aria-label="Redo"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--studio-ink-muted)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-30"
            title="Redo last undone change (Cmd/Ctrl+Shift+Z)"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </ToolbarSection>

        <ToolbarSection label="Output">
          <button
            onClick={onOpenGarmentPreview}
            disabled={!canPreviewGarment}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-30"
            title={canPreviewGarment ? 'Preview this design on a t-shirt or hoodie' : 'Create or open a design before previewing'}
          >
            <Shirt className="h-4 w-4" />
            Preview
          </button>
          <button
            onClick={onExport}
            disabled={!canExport}
            className="inline-flex items-center gap-2 rounded-md bg-violet-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:bg-[var(--studio-hover-overlay)] disabled:text-[var(--studio-ink-subtle)]"
            title={canExport ? 'Export the current design as SVG' : 'Create or open a design before exporting'}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </ToolbarSection>

        <Link
          href="/htv"
          className="ml-2 hidden rounded-md border border-[var(--studio-border)] bg-[var(--studio-hover-overlay-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--studio-ink-muted)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] md:inline-flex"
        >
          HTV Studio
        </Link>
        <button
          onClick={onOpenSetup}
          className="ml-1 inline-flex items-center justify-center gap-2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-hover-overlay-soft)] px-2.5 py-1 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400"
          title="Open calibration and setup"
        >
          <Settings2 className="h-4 w-4" />
          Setup
        </button>
        <StudioThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}
