'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useReducer, useState } from 'react';
import dynamic from 'next/dynamic';
import { Download, Pause, Play, SlidersHorizontal, Shapes } from 'lucide-react';
import { buildPapercraftDesignEntry, readWorkspaceVault, writeWorkspaceVault } from '../lib/workspaceVault';
import { fillHoles, flipFaces, reportSolid, simplifyMesh } from '@/src/lib/papercraft-engine';
import { useStudioTheme } from '../lib/studioTheme';
import MobileStudioBar from '../components/MobileStudioBar';
import { useT } from '../lib/i18n';
import ModelPanel from './ModelPanel';
import PagesView from './PagesView';
import PapercraftTopbar from './PapercraftTopbar';
import PatternView from './PatternView';
import SettingsPanel from './SettingsPanel';
import { computePapercraft, DEFAULT_SIMPLIFY_FACES, MAX_FACES } from './papercraftCompute';
import { buildCoverContent, coverPageSize } from './papercraftCover';
import { buildCricutDownload, buildPdfDownload, buildSilhouetteDownload, downloadExportFile } from './papercraftExport';
import { ModelFileError, readModelFile } from './papercraftFiles';
import { bootPapercraft } from './papercraftBoot';
import { readPapercraftDraft, writePapercraftDraft } from './papercraftDraft';
import { buildPapercraftShareLink, readSharedPapercraft } from './papercraftShare';
import { canSavePapercraft, deserializePapercraft, snapshotText } from './papercraftSnapshot';
import { papercraftReducer, type PapercraftAction } from './papercraftState';
import { readPapercraftVersions, recordPapercraftVersion, type PapercraftVersion } from './papercraftVersions';

// three.js is loaded when the 3D view is first opened.
const Model3D = dynamic(() => import('./Model3D'), { ssr: false });

export default function PapercraftShell() {
  const t = useT();
  const { theme, toggleTheme } = useStudioTheme();
  // What the studio opens with: a saved design from the address, else the work in progress from the last visit, else the test cube.
  const [boot] = useState(() => bootPapercraft(window.location.search, readWorkspaceVault(), readPapercraftDraft()));
  const [state, dispatch] = useReducer(papercraftReducer, boot.state);
  const [activeId, setActiveId] = useState<string | null>(boot.activeId);
  const [savedText, setSavedText] = useState<string | null>(() => {
    if (!boot.activeId) return null;
    const entry = readWorkspaceVault().papercraftDesigns.find((d) => d.designId === boot.activeId);
    return entry ? JSON.stringify(entry.snapshot) : null;
  });
  const [savedAt, setSavedAt] = useState<string | null>(() => readWorkspaceVault().papercraftDesigns.find((d) => d.designId === boot.activeId)?.updatedAt ?? null);
  const [versions, setVersions] = useState<PapercraftVersion[]>(() => (boot.activeId ? readPapercraftVersions(window.localStorage, boot.activeId) : []));
  const [mobilePanel, setMobilePanel] = useState<'none' | 'model' | 'settings'>('none');
  const [importError, setImportError] = useState<string | null>(null);
  const [simplifying, setSimplifying] = useState(false);
  // A saved design named in the address that is not there (deleted here or on another device) says so.
  const [toast, setToast] = useState<string | null>(() => (boot.from === 'missing-design' ? t('That saved model was not found. It may have been deleted.') : null));
  const [playing, setPlaying] = useState(false);

  // Only the things that decide the pattern: turning the 3D view or the fold slider never recomputes it.
  const { source, size, paper, pattern, edits, detailPct, layout } = state;
  const input = useMemo(() => ({ source, size, paper, pattern, edits, detailPct, layout }), [source, size, paper, pattern, edits, detailPct, layout]);
  const deferred = useDeferredValue(input);
  const working = deferred !== input;
  const result = useMemo(() => computePapercraft(deferred), [deferred]);
  const run = result.ok ? result.run : null;
  const report = useMemo(() => (run ? reportSolid(run.solid) : null), [run]);

  // The cover page's words, in the language in use (also shown first in the Pages view).
  const cover = useMemo(
    () => (run && state.cover ? { content: buildCoverContent(run, state.projectName, state.paper.preset, t, state.pattern.numberPartsBy === 'build'), size: coverPageSize(state.paper.preset) } : null),
    [run, state.cover, state.projectName, state.paper.preset, state.pattern.numberPartsBy, t],
  );

  // Choosing another model or importing a file starts a new design (saving it does not overwrite the one that was open).
  const dispatchModelChange: React.Dispatch<PapercraftAction> = useCallback((action) => {
    dispatch(action);
    if (action.type === 'USE_BUILT_IN' || action.type === 'USE_FILE') {
      setActiveId(null);
      setSavedText(null);
      setSavedAt(null);
      setVersions([]);
    }
  }, []);

  // The design as text: what is saved, compared, kept as a version and put in a link. (The view and the fold amount are not part of it.)
  const currentText = useMemo(
    () => snapshotText({ ...state, view: 'pattern', selectedPartId: null, fold: 1 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.projectName, state.source, state.size, state.paper, state.pattern, state.cover, state.edits],
  );
  const dirty = activeId === null || currentText !== savedText;
  const canSave = canSavePapercraft(state);

  // The work in progress is kept for the next visit (not a saved design, and not synced).
  useEffect(() => {
    const id = window.setTimeout(() => writePapercraftDraft({ activeId, snapshotText: currentText }), 800);
    return () => window.clearTimeout(id);
  }, [activeId, currentText]);

  const saveDesign = useCallback(() => {
    if (!canSavePapercraft(state)) {
      setToast(t('This model is too big to save in the browser. Keep the model file.'));
      return;
    }
    const vault = readWorkspaceVault();
    const existing = activeId ? vault.papercraftDesigns.find((d) => d.designId === activeId) ?? null : null;
    // The version that is about to be replaced is kept, so a save can be undone.
    if (existing) recordPapercraftVersion(window.localStorage, existing.designId, { savedAt: existing.updatedAt, name: existing.name, snapshotText: JSON.stringify(existing.snapshot) });
    const entry = buildPapercraftDesignEntry(state, existing);
    const ok = writeWorkspaceVault({
      ...vault,
      papercraftDesigns: existing ? vault.papercraftDesigns.map((d) => (d.designId === entry.designId ? entry : d)) : [entry, ...vault.papercraftDesigns],
    });
    if (!ok) {
      setToast(t('Could not save: the browser has no room left. Delete a saved design or a file in the Library, then try again.'));
      return;
    }
    setActiveId(entry.designId);
    setSavedText(JSON.stringify(entry.snapshot));
    setSavedAt(entry.updatedAt);
    setVersions(readPapercraftVersions(window.localStorage, entry.designId));
    setToast(t('Saved to My Designs.'));
  }, [state, activeId, t]);

  const shareLink = useCallback(async () => {
    const result = await buildPapercraftShareLink(state, window.location.origin);
    if (!result.ok) {
      setToast(t('This model is too big for a link. Save it instead: it follows you to your other devices.'));
      return;
    }
    try {
      await navigator.clipboard.writeText(result.url);
      setToast(t('Link copied. Anyone who opens it gets their own copy of this model.'));
    } catch {
      window.prompt(t('Copy this link:'), result.url);
    }
  }, [state, t]);

  const restoreVersion = useCallback(
    (version: PapercraftVersion) => {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(version.snapshotText);
      } catch {
        parsed = null;
      }
      const restored = parsed ? deserializePapercraft(parsed) : null;
      if (!restored) {
        setToast(t('That version could not be opened.'));
        return;
      }
      // What is open now is kept as a version too, so nothing is lost by looking back.
      if (activeId) recordPapercraftVersion(window.localStorage, activeId, { savedAt: new Date().toISOString(), name: state.projectName, snapshotText: currentText });
      dispatch({ type: 'LOAD_STATE', state: restored });
      if (activeId) setVersions(readPapercraftVersions(window.localStorage, activeId));
      setToast(t('Opened the earlier version. Press Save to keep it.'));
    },
    [activeId, currentText, state.projectName, t],
  );

  // A link someone shared (`#share=...`): their model opens as a new, unsaved one.
  useEffect(() => {
    if (!window.location.hash.startsWith('#share=')) return;
    let cancelled = false;
    readSharedPapercraft(window.location.hash)
      .then((shared) => {
        if (cancelled || !shared) return;
        dispatch({ type: 'LOAD_STATE', state: shared });
        setActiveId(null);
        setSavedText(null);
        setSavedAt(null);
        setVersions([]);
        setToast(t('Opened the model from the link. Save it to keep it.'));
      })
      .catch((error: unknown) => {
        if (!cancelled) setToast(error instanceof Error ? error.message : t('That link could not be opened.'));
      })
      .finally(() => window.history.replaceState(null, '', window.location.pathname + window.location.search));
    return () => {
      cancelled = true;
    };
    // Once, when the studio opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importFile = useCallback(async (file: File) => {
    setImportError(null);
    try {
      const { fileName, mesh } = await readModelFile(file);
      if (mesh.faces.length > MAX_FACES) {
        // Too heavy to unfold: simplify it first (the page gets a moment to say so).
        setSimplifying(true);
        await new Promise((resolve) => setTimeout(resolve, 30));
        try {
          const simplified = simplifyMesh(mesh, { targetFaces: DEFAULT_SIMPLIFY_FACES });
          dispatchModelChange({ type: 'USE_FILE', fileName, mesh: simplified.mesh, original: mesh });
          setToast(t('The model had {from} faces. It was simplified to {to} so it can be unfolded; change the detail under Model.', { from: mesh.faces.length, to: simplified.outputFaces }));
        } finally {
          setSimplifying(false);
        }
      } else {
        dispatchModelChange({ type: 'USE_FILE', fileName, mesh });
      }
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
  }, [t, dispatchModelChange]);

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

  const exportSilhouette = useCallback(() => {
    if (!run) return;
    const file = buildSilhouetteDownload(run, state.projectName);
    downloadExportFile(file);
    setToast(t('Silhouette DXF made: {name}', { name: file.fileName }));
  }, [run, state.projectName, t]);

  const simplifyModel = useCallback(async (targetFaces: number) => {
    if (state.source.kind !== 'file') return;
    // Always from the imported mesh, so a second try with more faces gets the detail back.
    const from = state.source.original ?? state.source.mesh;
    setSimplifying(true);
    await new Promise((resolve) => setTimeout(resolve, 30));
    try {
      const result = simplifyMesh(from, { targetFaces });
      dispatch({ type: 'SIMPLIFY_MESH', mesh: result.mesh });
      setToast(
        result.reached
          ? t('Simplified from {from} to {to} faces.', { from: from.faces.length, to: result.outputFaces })
          : t('Simplified from {from} to {to} faces. It could not go lower without breaking the model.', { from: from.faces.length, to: result.outputFaces }),
      );
    } finally {
      setSimplifying(false);
    }
  }, [state.source, t]);

  const restoreOriginal = useCallback(() => dispatch({ type: 'RESTORE_ORIGINAL' }), []);

  const closeHoles = useCallback(() => {
    if (state.source.kind !== 'file') return;
    const result = fillHoles(state.source.mesh);
    if (result.filled === 0) {
      setToast(t('No hole could be closed: they are too big or not a clean loop.'));
      return;
    }
    dispatch({ type: 'REPAIR_MESH', mesh: result.mesh });
    setToast(result.skipped > 0 ? t('Holes closed: {count}. Some openings are left: they are too big to be holes.', { count: result.filled }) : t('Holes closed: {count}.', { count: result.filled }));
  }, [state.source, t]);

  const turnInsideOut = useCallback(() => {
    if (state.source.kind !== 'file') return;
    dispatch({ type: 'REPAIR_MESH', mesh: flipFaces(state.source.mesh) });
    setToast(t('Turned the model inside out.'));
  }, [state.source, t]);

  const toggleEdge = useCallback((edgeId: number, joined: boolean) => dispatch({ type: 'TOGGLE_EDGE', edgeId, joined }), []);
  const selectPart = useCallback((partId: number | null) => dispatch({ type: 'SELECT_PART', partId }), []);

  const failure = !result.ok ? result : null;
  const failureText = failure
    ? failure.reason === 'too-many-faces'
      ? t('This model has {count} faces. Models over {max} faces are not unfolded: simplify it under Model.', { count: failure.faceCount ?? 0, max: MAX_FACES })
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
        canSave={canSave}
        dirty={dirty}
        onSave={saveDesign}
        dispatch={dispatch}
        onExportPdf={exportPdf}
        onExportCricut={exportCricut}
        onExportSilhouette={exportSilhouette}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className={`order-2 min-h-0 w-full shrink-0 overflow-hidden border-t border-[var(--studio-border)] max-lg:h-[44dvh] ${mobilePanel !== 'model' ? 'max-lg:hidden' : ''} lg:order-none lg:h-full lg:w-[272px] lg:border-t-0`}>
          <ModelPanel state={state} dispatch={dispatchModelChange} report={report} solid={run?.solid ?? null} importError={importError} onImportFile={importFile} onFillHoles={closeHoles} onFlipFaces={turnInsideOut} simplifying={simplifying} onSimplify={simplifyModel} onRestoreOriginal={restoreOriginal} />
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
          {run && state.view === 'pattern' && <PatternView run={run} selectedPartId={state.selectedPartId} onSelectPart={selectPart} onToggleEdge={toggleEdge} colourParts={state.colourParts} />}
          {run && state.view === 'pages' && <PagesView run={run} cover={cover} layout={state.layout} dispatch={dispatch} selectedPartId={state.selectedPartId} onSelectPart={selectPart} />}
          {run && state.view === 'model' && (
            <div className="flex h-full flex-col">
              <div className="min-h-0 flex-1">
                <Model3D run={run} fold={state.fold} selectedPartId={state.selectedPartId} onSelectPart={selectPart} colourParts={state.colourParts} />
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
          <SettingsPanel state={state} dispatch={dispatch} run={run} save={{ activeId, dirty, savedAt, versions, canSave }} onSave={saveDesign} onShare={shareLink} onRestoreVersion={restoreVersion} onExportPdf={exportPdf} onExportCricut={exportCricut} onExportSilhouette={exportSilhouette} />
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
