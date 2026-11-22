'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, Download, FileDown, FolderOpen, LibraryBig, Menu, RotateCcw, RotateCw, Save, Settings2, Shirt, Sparkles } from 'lucide-react';
import { EditorAction } from './EditorState';
import type { StudioTheme } from '../lib/studioTheme';
import StudioThemeToggle from '../components/StudioThemeToggle';
import { KeyboardShortcutsButton } from '../components/KeyboardShortcuts';
import StudioMenuSheet, { type StudioMenuSection } from '../components/StudioMenuSheet';

import { useT } from '../lib/i18n';
function ToolbarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1 border-l border-[var(--studio-border)] px-2 py-1 first:border-l-0">
      <div className="hidden px-1.5 text-xs font-medium uppercase tracking-[0.16em] text-[var(--studio-ink-subtle)] 2xl:block">{label}</div>
      <div className="hidden h-5 w-px bg-[var(--studio-hover-overlay)] 2xl:block" />
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
  exportReady?: boolean;
  exportErrorCount?: number;
  exportWarningCount?: number;
  needsCalibration?: boolean;
  recentDesigns?: { id: string; name: string }[];
  designSurface?: 'canvas' | 'garment';
  dispatch?: React.Dispatch<EditorAction>;
  onNewProject?: () => void;
  onOpenProject?: () => void;
  onOpenRecent?: (id: string) => void;
  /** Save to My Designs (browser-stored). */
  onSave?: () => void;
  /** Download a `.rhinestone.json` project file for backup / sharing. */
  onExportProjectFile?: () => void;
  /** Open the My Designs panel. */
  onOpenLibrary?: () => void;
  onExport?: () => void;
  onOpenSetup?: () => void;
  onOpenGarmentPreview?: () => void;
  onToggleDesignSurface?: (surface: 'canvas' | 'garment') => void;
  theme?: StudioTheme;
  onToggleTheme?: () => void;
}

export default function EditorTopbar({
  projectName = 'Untitled Project',
  canUndo = false,
  canRedo = false,
  canExport = false,
  canPreviewGarment = false,
  exportReady = false,
  exportErrorCount = 0,
  exportWarningCount = 0,
  needsCalibration = false,
  recentDesigns = [],
  designSurface = 'canvas',
  dispatch = () => undefined,
  onNewProject = () => undefined,
  onOpenProject = () => undefined,
  onOpenRecent = () => undefined,
  onSave = () => undefined,
  onExportProjectFile = () => undefined,
  onOpenLibrary = () => undefined,
  onExport = () => undefined,
  onOpenSetup = () => undefined,
  onOpenGarmentPreview = () => undefined,
  onToggleDesignSurface = () => undefined,
  theme = 'dark',
  onToggleTheme = () => undefined,
}: EditorTopbarProps) {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuSections: StudioMenuSection[] = [
    {
      title: 'Project',
      items: [
        { id: 'new', label: 'New project', icon: Sparkles, onSelect: onNewProject },
        { id: 'save', label: 'Save to My Designs', icon: Save, onSelect: onSave },
        { id: 'library', label: 'My Designs', icon: LibraryBig, onSelect: onOpenLibrary },
        { id: 'open-file', label: 'Open project file…', icon: FolderOpen, onSelect: onOpenProject },
        { id: 'export-file', label: 'Download project file', icon: FileDown, onSelect: onExportProjectFile },
      ],
    },
    ...(recentDesigns.length > 0
      ? [{
          title: 'Recent designs',
          items: recentDesigns.map((design) => ({ id: `recent-${design.id}`, label: design.name, icon: FolderOpen, onSelect: () => onOpenRecent(design.id) })),
        }]
      : []),
    {
      title: 'Output',
      items: [
        { id: 'canvas', label: 'Canvas view', pressed: designSurface === 'canvas', onSelect: () => onToggleDesignSurface('canvas') },
        { id: 'garment', label: 'Garment preview', icon: Shirt, disabled: !canPreviewGarment, pressed: designSurface === 'garment', onSelect: () => { onOpenGarmentPreview(); onToggleDesignSurface('garment'); } },
        { id: 'setup', label: 'Setup and calibration', icon: Settings2, onSelect: onOpenSetup },
      ],
    },
  ];
  const exportStatus = !canExport
    ? { label: 'No template', className: 'border-[var(--studio-border)] bg-[var(--studio-hover-overlay-soft)] text-[var(--studio-ink-muted)]' }
    : exportReady
    ? { label: 'Ready', className: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' }
    : exportErrorCount > 0
      ? { label: `Blocked (${exportErrorCount})`, className: 'border-rose-400/30 bg-rose-500/10 text-rose-200' }
      : needsCalibration
        ? { label: 'Needs calibration', className: 'border-amber-400/30 bg-amber-500/10 text-amber-200' }
        : exportWarningCount > 0
        ? { label: `Warnings (${exportWarningCount})`, className: 'border-amber-400/30 bg-amber-500/10 text-amber-200' }
        : { label: 'No template', className: 'border-[var(--studio-border)] bg-[var(--studio-hover-overlay-soft)] text-[var(--studio-ink-muted)]' };
  return (
    <section aria-label={t('Project actions')} className="flex items-center gap-2 border-b border-[var(--studio-border)] bg-[var(--studio-surface)] px-3 py-1.5 text-[var(--studio-ink)] lg:min-h-[60px] lg:flex-wrap">
      {/* Phones and tablets: menu, project name, undo/redo. Everything else is in the menu or the bottom bar. */}
      <div className="flex w-full items-center gap-1.5 lg:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label={t('Open menu')}
          aria-haspopup="dialog"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--studio-border)] bg-[var(--studio-well)] text-[var(--studio-ink)] transition hover:bg-[var(--studio-hover-overlay)]"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <input
          type="text"
          value={projectName}
          onChange={(e) => dispatch({ type: 'SET_PROJECT_NAME', name: e.target.value })}
          aria-label={t('Project name')}
          className="h-11 min-w-0 flex-1 rounded-lg border border-[var(--studio-border)] bg-[var(--studio-well)] px-3 text-base font-semibold text-[var(--studio-ink)] focus-visible:ring-2 focus-visible:ring-violet-400"
          placeholder={t('Untitled Project')}
        />
        <button
          type="button"
          onClick={() => dispatch({ type: 'UNDO' })}
          disabled={!canUndo}
          aria-label={t('Undo')}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] disabled:opacity-30"
        >
          <RotateCcw className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'REDO' })}
          disabled={!canRedo}
          aria-label={t('Redo')}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] disabled:opacity-30"
        >
          <RotateCw className="h-5 w-5" aria-hidden="true" />
        </button>
        <StudioMenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} sections={menuSections} theme={theme} onToggleTheme={onToggleTheme} />
      </div>

      <div className="flex min-w-[200px] max-w-[360px] flex-1 items-center gap-2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-1 shadow-sm max-lg:hidden">
        <input
          type="text"
          value={projectName}
          onChange={(e) => dispatch({ type: 'SET_PROJECT_NAME', name: e.target.value })}
          aria-label={t('Project name')}
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-1 text-sm font-semibold text-[var(--studio-ink)] focus:bg-[var(--studio-surface)] focus-visible:ring-2 focus-visible:ring-violet-400"
          placeholder={t('Untitled Project')}
        />
      </div>

      <div className="flex shrink-0 items-center max-lg:hidden">
        <ToolbarSection label="Project">
          <button
            onClick={onNewProject}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400"
            title={t('Start a new project')}
          >
            <Sparkles className="h-4 w-4" />
            {t('New')}
          </button>
          <div className="relative">
            <details className="group">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus-visible:ring-2 focus-visible:ring-violet-400 [&::-webkit-details-marker]:hidden">
                <FolderOpen className="h-4 w-4" />
                {t('Open')}
                <ChevronDown className="h-3 w-3 opacity-60 transition group-open:rotate-180" />
              </summary>
              <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-md border border-[var(--studio-border)] bg-[var(--studio-surface)] shadow-xl">
                {recentDesigns.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--studio-ink-muted)]">{t('Recent designs')}</div>
                    {recentDesigns.map((design) => (
                      <button
                        key={design.id}
                        onClick={() => { onOpenRecent(design.id); (document.activeElement as HTMLElement | null)?.blur(); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]"
                      >
                        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[var(--studio-ink-muted)]" />
                        <span className="truncate">{design.name}</span>
                      </button>
                    ))}
                  </>
                )}
                <div className={`flex flex-col ${recentDesigns.length > 0 ? 'border-t border-[var(--studio-border)]' : ''}`}>
                  <button
                    onClick={() => { onOpenLibrary(); (document.activeElement as HTMLElement | null)?.blur(); }}
                    className="px-3 py-2 text-left text-xs text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]"
                  >
                    {t('My Designs…')}
                  </button>
                  <button
                    onClick={() => { onOpenProject(); (document.activeElement as HTMLElement | null)?.blur(); }}
                    className="px-3 py-2 text-left text-xs text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]"
                  >
                    {t('Open project file…')}
                  </button>
                </div>
              </div>
            </details>
          </div>
          <button
            onClick={onSave}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400"
            title={t('Save to My Designs (kept in this browser)')}
          >
            <Save className="h-4 w-4" />
            {t('Save')}
          </button>
          <button
            onClick={onOpenLibrary}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400"
            title={t('Browse your saved designs and starter templates')}
          >
            <LibraryBig className="h-4 w-4" />
            {t('My Designs')}
          </button>
          <button
            onClick={onExportProjectFile}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400"
            title={t('Download a project file (.rhinestone.json) for backup or sharing')}
          >
            <FileDown className="h-4 w-4" />
            {t('Export file')}
          </button>
        </ToolbarSection>

        <ToolbarSection label="History">
          <button
            onClick={() => dispatch({ type: 'UNDO' })}
            disabled={!canUndo}
            aria-label={t('Undo')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--studio-ink-muted)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-30"
            title={t('Undo last change (Cmd/Ctrl+Z)')}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => dispatch({ type: 'REDO' })}
            disabled={!canRedo}
            aria-label={t('Redo')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--studio-ink-muted)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-30"
            title={t('Redo last undone change (Cmd/Ctrl+Shift+Z)')}
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </ToolbarSection>

        <ToolbarSection label="Output">
          <div className="inline-flex rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] p-0.5">
            {(['canvas', 'garment'] as const).map((surface) => (
              <button
                key={surface}
                type="button"
                disabled={surface === 'garment' && !canPreviewGarment}
                aria-pressed={designSurface === surface}
                onClick={() => {
                  if (surface === 'garment') onOpenGarmentPreview();
                  onToggleDesignSurface(surface);
                }}
                className={`rounded px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-30 ${designSurface === surface ? 'bg-violet-500/35 text-white' : 'text-[var(--studio-ink-muted)] hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]'}`}
                title={surface === 'garment' && !canPreviewGarment ? 'Create or open a design before previewing' : undefined}
              >
                {surface === 'canvas' ? 'Canvas' : <><Shirt className="inline h-3 w-3 mr-1" />{t('Garment')}</>}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onExport}
              disabled={!canExport}
              className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:bg-[var(--studio-hover-overlay)] disabled:text-[var(--studio-ink-subtle)]"
              title={canExport ? 'Export the current design as SVG' : 'Create or open a design before exporting'}
            >
              <Download className="h-4 w-4" />
              {t('Export')}
            </button>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.14em] ${exportStatus.className}`}>
              {exportStatus.label}
            </span>
          </div>
        </ToolbarSection>

        <Link
          href="/htv"
          className="ml-2 hidden rounded-md border border-[var(--studio-border)] bg-[var(--studio-hover-overlay-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--studio-ink-muted)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] xl:inline-flex"
        >
          {t('HTV Studio')}
        </Link>
        <button
          onClick={onOpenSetup}
          className="ml-1 inline-flex items-center justify-center gap-2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-hover-overlay-soft)] px-2.5 py-1 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400"
          title={t('Open calibration and setup')}
        >
          <Settings2 className="h-4 w-4" />
          <span className="max-xl:sr-only">{t('Setup')}</span>
        </button>
        <KeyboardShortcutsButton />
        <StudioThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </section>
  );
}
