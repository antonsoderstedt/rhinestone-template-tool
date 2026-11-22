'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, Download, FolderOpen, Menu, RotateCcw, RotateCw, Save, Settings2, Shirt } from 'lucide-react';
import type { HtvAction } from './HtvState';
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

interface HtvTopbarProps {
  projectName: string;
  canUndo: boolean;
  canRedo: boolean;
  canExport: boolean;
  canPreviewGarment: boolean;
  designSurface: 'canvas' | 'garment' | '3d';
  recentDesigns?: { id: string; name: string }[];
  dispatch: React.Dispatch<HtvAction>;
  onSaveDesign: () => void;
  onOpenRecent?: (id: string) => void;
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
  recentDesigns = [],
  dispatch,
  onSaveDesign,
  onOpenRecent = () => undefined,
  onExport,
  onOpenGarmentPreview,
  onToggleDesignSurface,
  theme,
  onToggleTheme,
}: HtvTopbarProps) {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuSections: StudioMenuSection[] = [
    {
      title: 'Project',
      items: [
        { id: 'save', label: 'Save to My Designs', icon: Save, onSelect: onSaveDesign },
        { id: 'preview', label: 'Garment preview', icon: Shirt, disabled: !canPreviewGarment, onSelect: onOpenGarmentPreview },
      ],
    },
    ...(recentDesigns.length > 0
      ? [{
          title: 'Recent designs',
          items: recentDesigns.map((design) => ({ id: `recent-${design.id}`, label: design.name, icon: FolderOpen, onSelect: () => onOpenRecent(design.id) })),
        }]
      : []),
    {
      title: 'View',
      items: (['canvas', 'garment', '3d'] as const).map((surface) => ({
        id: `surface-${surface}`,
        label: surface === 'canvas' ? 'Canvas' : surface === 'garment' ? 'Garment' : '3D preview',
        pressed: designSurface === surface,
        onSelect: () => onToggleDesignSurface(surface),
      })),
    },
  ];
  return (
    <section aria-label={t('Project actions')} className="border-b border-[var(--studio-border)] bg-[var(--studio-surface)] text-[var(--studio-ink)]">
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5">
        {/* Phones and tablets: menu, project name, undo/redo. The rest is in the menu or the bottom bar. */}
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
            placeholder={t('Untitled HTV Design')}
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

        <div className="flex min-w-[200px] max-w-[360px] flex-1 items-center gap-2 rounded-md max-lg:hidden border border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-1 shadow-sm">
          <input
            type="text"
            value={projectName}
            onChange={(e) => dispatch({ type: 'SET_PROJECT_NAME', name: e.target.value })}
            aria-label={t('Project name')}
            className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-1 text-sm font-semibold text-[var(--studio-ink)] focus:bg-[var(--studio-surface)] focus-visible:ring-2 focus-visible:ring-violet-400"
            placeholder={t('Untitled HTV Design')}
          />
        </div>

        <div className="contents max-lg:hidden">
        <ToolbarSection label={t('History')}>
          <button
            onClick={() => dispatch({ type: 'UNDO' })}
            disabled={!canUndo}
            aria-label={t('Undo')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--studio-ink-muted)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-30"
            title={t('Undo (Cmd/Ctrl+Z)')}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => dispatch({ type: 'REDO' })}
            disabled={!canRedo}
            aria-label={t('Redo')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--studio-ink-muted)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-30"
            title={t('Redo (Cmd/Ctrl+Shift+Z)')}
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </ToolbarSection>

        <ToolbarSection label={t('Output')}>
          {recentDesigns.length > 0 && (
            <div className="relative">
              <details className="group">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] [&::-webkit-details-marker]:hidden">
                  <FolderOpen className="h-4 w-4" />
                  {t('Recent')}
                  <ChevronDown className="h-3 w-3 opacity-60 transition group-open:rotate-180" />
                </summary>
                <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-md border border-[var(--studio-border)] bg-[var(--studio-surface)] shadow-xl">
                  <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--studio-ink-muted)]">{t('Recent HTV designs')}</div>
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
                </div>
              </details>
            </div>
          )}
          <button
            onClick={onOpenGarmentPreview}
            disabled={!canPreviewGarment}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-30"
            title={canPreviewGarment ? 'Preview this design on a t-shirt or hoodie' : 'Add a layer before previewing'}
          >
            <Shirt className="h-4 w-4" />
            {t('Preview')}
          </button>
          <button
            onClick={onSaveDesign}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400"
            title={t('Save this HTV design to My Designs')}
          >
            <Save className="h-4 w-4" />
            {t('Save')}
          </button>
          <button
            onClick={onExport}
            disabled={!canExport}
            className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:bg-[var(--studio-hover-overlay)] disabled:text-[var(--studio-ink-subtle)]"
            title={canExport ? 'Export the current design as a vector SVG cut file' : 'Add a layer before exporting'}
          >
            <Download className="h-4 w-4" />
            {t('Export')}
          </button>
        </ToolbarSection>

        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] p-1">
            {(['canvas', 'garment', '3d'] as const).map((surface) => (
              <button
                key={surface}
                type="button"
                aria-pressed={designSurface === surface}
                onClick={() => onToggleDesignSurface(surface)}
                className={`rounded px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em] transition ${designSurface === surface ? 'bg-violet-500/35 text-white' : 'text-[var(--studio-ink-muted)] hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]'}`}
              >
                {surface}
              </button>
            ))}
          </div>
          <Link
            href="/rhinestone"
            className="hidden rounded-md border border-[var(--studio-border)] bg-[var(--studio-hover-overlay-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--studio-ink-muted)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] md:inline-flex"
          >
            {t('Rhinestone')}
          </Link>
          <button
            onClick={onOpenGarmentPreview}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-hover-overlay-soft)] px-2.5 py-1 text-xs font-medium text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)] focus:outline-none focus:ring-2 focus:ring-violet-400"
            title={t('Open large garment preview')}
          >
            <Settings2 className="h-4 w-4" />
            {t('View')}
          </button>
          <KeyboardShortcutsButton />
          <StudioThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
        </div>
      </div>
    </section>
  );
}
