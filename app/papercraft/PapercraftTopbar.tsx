'use client';

import { Box, FileText, Layers, Save, Scissors, Shapes } from 'lucide-react';
import type { StudioTheme } from '../lib/studioTheme';
import StudioThemeToggle from '../components/StudioThemeToggle';
import { useT } from '../lib/i18n';
import type { PapercraftAction, PapercraftView } from './papercraftState';

interface PapercraftTopbarProps {
  projectName: string;
  view: PapercraftView;
  canExport: boolean;
  canSave: boolean;
  /** There are changes that are not saved. */
  dirty: boolean;
  onSave: () => void;
  dispatch: React.Dispatch<PapercraftAction>;
  onExportPdf: () => void;
  onExportCricut: () => void;
  onExportSilhouette: () => void;
  theme: StudioTheme;
  onToggleTheme: () => void;
}

export default function PapercraftTopbar({ projectName, view, canExport, canSave, dirty, onSave, dispatch, onExportPdf, onExportCricut, onExportSilhouette, theme, onToggleTheme }: PapercraftTopbarProps) {
  const t = useT();
  const views: { id: PapercraftView; label: string; icon: typeof Box }[] = [
    { id: 'model', label: t('3D model'), icon: Box },
    { id: 'pattern', label: t('Pattern'), icon: Shapes },
    { id: 'pages', label: t('Pages'), icon: Layers },
  ];
  return (
    <section aria-label={t('Project actions')} className="border-b border-[var(--studio-border)] bg-[var(--studio-surface)] text-[var(--studio-ink)]">
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5">
        <div className="flex min-w-[160px] max-w-[320px] flex-1 items-center rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-1 shadow-sm">
          <input
            type="text"
            value={projectName}
            onChange={(event) => dispatch({ type: 'SET_NAME', name: event.target.value })}
            aria-label={t('Project name')}
            placeholder={t('Untitled model')}
            className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-1 text-sm font-semibold text-[var(--studio-ink)] focus:bg-[var(--studio-surface)] focus-visible:ring-2 focus-visible:ring-violet-400"
          />
        </div>

        <div role="group" aria-label={t('View')} className="inline-flex rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] p-1">
          {views.map((v) => {
            const Icon = v.icon;
            return (
              <button
                key={v.id}
                type="button"
                aria-pressed={view === v.id}
                onClick={() => dispatch({ type: 'SET_VIEW', view: v.id })}
                className={`inline-flex min-h-9 items-center gap-1.5 rounded px-3 py-1 text-xs font-medium uppercase tracking-[0.1em] transition ${view === v.id ? 'bg-violet-500/35 text-[var(--studio-ink)]' : 'text-[var(--studio-ink-muted)] hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]'}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {v.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            className="hidden items-center gap-2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-1.5 text-xs font-medium text-[var(--studio-ink)] transition hover:bg-[var(--studio-surface-hover)] focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-40 lg:inline-flex"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {t('Save')}
            {dirty && <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-400" />}
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            disabled={!canExport}
            className="hidden items-center gap-2 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:bg-[var(--studio-hover-overlay)] disabled:text-[var(--studio-ink-subtle)] lg:inline-flex"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            {t('PDF')}
          </button>
          <button
            type="button"
            onClick={onExportCricut}
            disabled={!canExport}
            className="hidden items-center gap-2 rounded-md border border-violet-400/50 bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-[var(--studio-ink)] transition hover:bg-violet-500/25 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-40 lg:inline-flex"
          >
            <Scissors className="h-4 w-4" aria-hidden="true" />
            {t('Cricut SVG')}
          </button>
          <button
            type="button"
            onClick={onExportSilhouette}
            disabled={!canExport}
            className="hidden items-center gap-2 rounded-md border border-violet-400/50 bg-violet-500/15 px-3 py-1.5 text-xs font-medium text-[var(--studio-ink)] transition hover:bg-violet-500/25 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-40 lg:inline-flex"
          >
            <Scissors className="h-4 w-4" aria-hidden="true" />
            {t('Silhouette DXF')}
          </button>
          <StudioThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </section>
  );
}
