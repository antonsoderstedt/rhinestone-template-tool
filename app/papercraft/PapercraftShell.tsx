'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useReducer, useState } from 'react';
import dynamic from 'next/dynamic';
import { Download, Pause, Play, SlidersHorizontal, Shapes } from 'lucide-react';
import { reportSolid } from '@/src/lib/papercraft-engine';
import { useStudioTheme } from '../lib/studioTheme';
import MobileStudioBar from '../components/MobileStudioBar';
import { useT } from '../lib/i18n';
import ModelPanel from './ModelPanel';
import PagesView from './PagesView';
import PapercraftTopbar from './PapercraftTopbar';
import PatternView from './PatternView';
import SettingsPanel from './SettingsPanel';
import { computePapercraft, MAX_FACES } from './papercraftCompute';
import { buildCoverContent, coverPageSize } from './papercraftCover';
import { buildCricutDownload, buildPdfDownload, downloadExportFile } from './papercraftExport';
import { ModelFileError, readModelFile } from './papercraftFiles';
import { initialPapercraftState, papercraftReducer } from './papercraftState';

// three.js is loaded when the 3D view is first opened.
const Model3D = dynamic(() => import('./Model3D'), { ssr: false });

export default function PapercraftShell() {
  const t = useT();
  const { theme, toggleTheme } = useStudioTheme();
  const [state, dispatch] = useReducer(papercraftReducer, undefined, initialPapercraftState);
  const [mobilePanel, setMobilePanel] = useState<'none' | 'model' | 'settings'>('none');
  const [importError, setImportError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  // Only the things that decide the pattern: turning the 3D view or the fold slider never recomputes it.
  const { source, size, paper, pattern, edits } = state;
  const input = useMemo(() => ({ source, size, paper, pattern, edits }), [source, size, paper, pattern, edits]);
  const deferred = useDeferredValue(input);
  const working = deferred !== input;
  const result = useMemo(() => computePapercraft(deferred), [deferred]);
  const run = result.ok ? result.run : null;
  const report = useMemo(() => (run ? reportSolid(run.solid) : null), [run]);

  // The cover page's words, in the language in use (also shown first in the Pages view).
  const cover = useMemo(
    () => (run && state.cover ? { content: buildCoverContent(run, state.projectName, state.paper.preset, t), size: coverPageSize(state.paper.preset) } : null),
    [run, state.cover, state.projectName, state.paper.preset, t],
  );

  const importFile = useCallback(async (file: File) => {
    setImportError(null);
    try {
      const { fileName, mesh } = await readModelFile(file);
      dispatch({ type: 'USE_FILE', fileName, mesh });
      setMobilePanel('none');
    } catch (error) {
      if (error instanceof ModelFileError) {
        setImportError(
          error.code === 'too-big'
            ? t('That file is too big (over 40 MB). Use a lighter, low-poly model.')
            : error.code === 'unsupported'
              ? t('That file type is not supported. Use OBJ, STL or GLB.')
              : error.code === 'no-faces'
                ? t('The file has no faces to build a model from.')
                : t('The file could not be read. Is it a broken or an empty model?'),
        );
      } else {
        setImportError(t('The file could not be read. Is it a broken or an empty model?'));
      }
    }
  }, [t]);

  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Play: fold or unfold the model once.
  useEffect(() => {
    if (!playing) return undefined;
    const target = state.fold > 0.5 ? 0 : 1;
    const from = state.fold;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 2200);
      dispatch({ type: 'SET_FOLD', fold: from + (target - from) * k });
      if (k < 1) frame = requestAnimationFrame(step);
      else setPlaying(false);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // Started once per press: the fold amount it reads is the one at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const exportPdf = useCallback(() => {
    if (!run) return;
    downloadExportFile(buildPdfDownload(run, state.projectName, cover));
    setToast(t('PDF made: print it at 100 % scale.'));
  }, [run, state.projectName, cover, t]);

  const exportCricut = useCallback(() => {
    if (!run) return;
    const file = buildCricutDownload(run, state.projectName);
    downloadExportFile(file);
    setToast(t('Cricut SVG made: {name}', { name: file.fileName }));
  }, [run, state.projectName, t]);

  const toggleEdge = useCallback((edgeId: number, joined: boolean) => dispatch({ type: 'TOGGLE_EDGE', edgeId, joined }), []);
  const selectPart = useCallback((partId: number | null) => dispatch({ type: 'SELECT_PART', partId }), []);

  const failure = !result.ok ? result : null;
  const failureText = failure
    ? failure.reason === 'too-many-faces'
      ? t('This model has {count} faces. Models over {max} faces are not unfolded yet: use a lower-poly version.', { count: failure.faceCount ?? 0, max: MAX_FACES })
      : failure.reason === 'empty'
        ? t('The model has no faces.')
        : t('Something went wrong while building the pattern. Try another model.')
    : null;

  return (
    <div data-theme={theme} className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--studio-bg)] text-[var(--studio-ink)]">
      <PapercraftTopbar
        projectName={state.projectName}
        view={state.view}
        canExport={Boolean(run)}
        dispatch={dispatch}
        onExportPdf={exportPdf}
        onExportCricut={exportCricut}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className={`order-2 min-h-0 w-full shrink-0 overflow-hidden border-t border-[var(--studio-border)] max-lg:h-[44dvh] ${mobilePanel !== 'model' ? 'max-lg:hidden' : ''} lg:order-none lg:h-full lg:w-[272px] lg:border-t-0`}>
          <ModelPanel state={state} dispatch={dispatch} report={report} importError={importError} onImportFile={importFile} />
        </div>

        <main
          id="main-content"
          tabIndex={-1}
          aria-label={t('Papercraft workspace')}
          className="relative order-1 min-h-[50vh] min-w-0 flex-1 max-lg:min-h-0 lg:order-none lg:min-h-0"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files?.[0];
            if (file) void importFile(file);
          }}
        >
          <h1 className="sr-only">{t('Papercraft Studio')}</h1>
          {run && state.view === 'pattern' && <PatternView run={run} selectedPartId={state.selectedPartId} onSelectPart={selectPart} onToggleEdge={toggleEdge} />}
          {run && state.view === 'pages' && <PagesView run={run} cover={cover} />}
          {run && state.view === 'model' && (
            <div className="flex h-full flex-col">
              <div className="min-h-0 flex-1">
                <Model3D run={run} fold={state.fold} selectedPartId={state.selectedPartId} onSelectPart={selectPart} />
              </div>
              <div className="flex items-center gap-3 border-t border-[var(--studio-border)] bg-[var(--studio-surface)] px-4 py-2">
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  aria-label={playing ? t('Pause') : t('Fold or unfold')}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] text-[var(--studio-ink)] hover:bg-[var(--studio-surface-hover)]"
                >
                  {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                </button>
                <label className="flex min-w-0 flex-1 items-center gap-3 text-xs text-[var(--studio-ink-secondary)]">
                  <span className="shrink-0">{t('Flat')}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(state.fold * 100)}
                    onChange={(event) => {
                      setPlaying(false);
                      dispatch({ type: 'SET_FOLD', fold: Number(event.target.value) / 100 });
                    }}
                    aria-label={t('How folded the model is')}
                    className="min-w-0 flex-1"
                  />
                  <span className="shrink-0">{t('Folded')}</span>
                </label>
              </div>
            </div>
          )}
          {failureText && (
            <div role="alert" className="flex h-full items-center justify-center p-6 text-center text-sm text-[var(--studio-ink-secondary)]">
              {failureText}
            </div>
          )}
          {working && (
            <div role="status" className="pointer-events-none absolute right-3 top-3 rounded-md bg-[var(--studio-surface)] px-3 py-1.5 text-xs text-[var(--studio-ink-secondary)] shadow">
              {t('Working…')}
            </div>
          )}
        </main>

        <div className={`order-3 min-h-0 w-full shrink-0 overflow-hidden border-t border-[var(--studio-border)] max-lg:h-[44dvh] ${mobilePanel !== 'settings' ? 'max-lg:hidden' : ''} lg:order-none lg:h-full lg:w-[288px] lg:border-t-0`}>
          <SettingsPanel state={state} dispatch={dispatch} run={run} onExportPdf={exportPdf} onExportCricut={exportCricut} />
        </div>
      </div>

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-4 max-lg:bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-md bg-success-600 px-4 py-2 text-sm font-medium text-ink-inverse shadow-lg">
          {toast}
        </div>
      )}

      <MobileStudioBar
          items={[
            { id: 'model', label: t('Model'), icon: Shapes, active: mobilePanel === 'model', onSelect: () => setMobilePanel((c) => (c === 'model' ? 'none' : 'model')) },
            { id: 'settings', label: t('Settings'), icon: SlidersHorizontal, active: mobilePanel === 'settings', onSelect: () => setMobilePanel((c) => (c === 'settings' ? 'none' : 'settings')) },
            { id: 'export', label: t('PDF'), icon: Download, primary: true, disabled: !run, onSelect: exportPdf },
          ]}
      />
    </div>
  );
}
