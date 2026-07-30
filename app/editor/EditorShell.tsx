'use client';

import { useReducer, useCallback, useRef, useMemo, useState, useEffect } from 'react';
import {
  editorReducer,
  DEFAULT_EDITOR_STATE,
  type EditorAction,
} from './EditorState';
import type { EditableStone } from './EditorState';
import {
  createStoneGridTemplate,
  createOutlineTextTemplate,
  createDotMatrixTextTemplate,
  svgStringToPolylines,
  createPolylineFilledRhinestoneTemplate,
  scalePolylinesToFit,
  checkExportReadiness,
  parseRhinestoneProject,
  serializeRhinestoneProject,
  createBasicSvgExport,
} from '@/src/lib/rhinestone-engine/index';
import type {
} from '@/src/lib/rhinestone-engine/index';
import EditorTopbar from './EditorTopbar';
import EditorToolbar from './EditorToolbar';
import EditorCanvas from './EditorCanvas';
import EditorPropertiesPanel from './EditorPropertiesPanel';
import EditorStatusBar from './EditorStatusBar';
import EditorDialog from './EditorDialog';
import EditorToast from './EditorToast';
import {
  resolveGeneratorMutationDecision,
  shouldPromptForGeneratorMutation,
} from './generatorChangePolicy';
import {
  buildEffectiveTemplate,
  buildProjectFileFromEditorState,
  savedStoneToEditableStone,
} from './projectPersistence';

export default function EditorShell() {
  const [state, dispatch] = useReducer(editorReducer, DEFAULT_EDITOR_STATE);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingGeneratorAction, setPendingGeneratorAction] = useState<EditorAction | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'warning' | 'error' | 'info' } | null>(null);
  const [pendingDialog, setPendingDialog] = useState<
    | null
    | {
        kind: 'new-project' | 'export-warning';
        title: string;
        message: string;
        confirmLabel: string;
        confirmTone?: 'default' | 'destructive';
        icon?: 'sparkles' | 'warning' | 'info';
      }
  >(null);

  useEffect(() => {
    if (!toast) return;
    const timeoutId = window.setTimeout(() => setToast(null), toast.tone === 'error' ? 5000 : 3200);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  // ─── Template Generation ───────────────────────────────────────────────────

  /**
   * Generate template based on active tool and its state.
   * This runs whenever tool state changes.
   */
  useEffect(() => {
    try {
      let template = null;

      switch (state.activeTool) {
        case 'grid':
          template = createStoneGridTemplate({
            id: 'grid-preview',
            name: 'Grid Preview',
            stoneSize: state.gridTool.stoneSize,
            columns: state.gridTool.columns,
            rows: state.gridTool.rows,
            densityPreset: state.gridTool.densityPreset,
            customSpacingMm: typeof state.gridTool.customSpacingMm === 'number' ? state.gridTool.customSpacingMm : undefined,
          });
          break;

        case 'text':
          if (state.textTool.text.trim()) {
            if (state.textTool.mode === 'outline') {
              template = createOutlineTextTemplate({
                id: 'text-outline-preview',
                name: 'Text Outline Preview',
                text: state.textTool.text,
                stoneSize: state.textTool.stoneSize,
                fontSizeMm: typeof state.textTool.fontSizeMm === 'number' ? state.textTool.fontSizeMm : 25,
                align: state.textTool.align,
                letterSpacingMm: typeof state.textTool.letterSpacingMm === 'number' ? state.textTool.letterSpacingMm : 0,
                lineSpacingMm: typeof state.textTool.lineSpacingMm === 'number' ? state.textTool.lineSpacingMm : 10,
                targetWidthMm: typeof state.textTool.targetWidthMm === 'number' ? state.textTool.targetWidthMm : undefined,
                targetHeightMm: typeof state.textTool.targetHeightMm === 'number' ? state.textTool.targetHeightMm : undefined,
                preserveAspectRatio: state.textTool.preserveAspectRatio,
                densityPreset: state.textTool.densityPreset,
                customSpacingMm: typeof state.textTool.customSpacingMm === 'number' ? state.textTool.customSpacingMm : undefined,
                fillMode: state.textTool.fillMode,
                fillPattern: state.textTool.fillPattern,
              });
            } else {
              template = createDotMatrixTextTemplate({
                id: 'text-dotmatrix-preview',
                name: 'Dot Matrix Text Preview',
                text: state.textTool.text,
                stoneSize: state.textTool.stoneSize,
                letterSpacingColumns: state.textTool.letterSpacingColumns,
                lineSpacingRows: state.textTool.lineSpacingRows,
                targetWidthMm: typeof state.textTool.targetWidthMm === 'number' ? state.textTool.targetWidthMm : undefined,
                targetHeightMm: typeof state.textTool.targetHeightMm === 'number' ? state.textTool.targetHeightMm : undefined,
                preserveAspectRatio: state.textTool.preserveAspectRatio,
                densityPreset: state.textTool.densityPreset,
                customSpacingMm: typeof state.textTool.customSpacingMm === 'number' ? state.textTool.customSpacingMm : undefined,
              });
            }
          }
          break;

        case 'svg':
          if (state.svgTool.uploadedSvgText) {
            // Parse SVG to polylines
            const polylines = svgStringToPolylines(state.svgTool.uploadedSvgText, {
              cleanupOptions: state.svgTool.cleanupEnabled
                ? {
                    simplify: state.svgTool.cleanupSimplify,
                    simplifyToleranceMm: state.svgTool.cleanupSimplifyTol,
                    removeTinyPolylines: state.svgTool.cleanupRemoveTiny,
                    minPolylineLengthMm: state.svgTool.cleanupMinLength,
                    removeDuplicatePoints: state.svgTool.cleanupRemoveDups,
                    duplicatePointToleranceMm: state.svgTool.cleanupDupTol,
                  }
                : undefined,
            });

            // Scale to target dimensions if specified
            let scaledPolylines = polylines;
            if (
              (typeof state.svgTool.targetWidthMm === 'number' || typeof state.svgTool.targetHeightMm === 'number') &&
              polylines.length > 0
            ) {
              scaledPolylines = scalePolylinesToFit(polylines, {
                targetWidthMm: typeof state.svgTool.targetWidthMm === 'number' ? state.svgTool.targetWidthMm : undefined,
                targetHeightMm: typeof state.svgTool.targetHeightMm === 'number' ? state.svgTool.targetHeightMm : undefined,
                preserveAspectRatio: state.svgTool.preserveAspectRatio,
              });
            }

            // Create template with fill mode
            template = createPolylineFilledRhinestoneTemplate({
              id: 'svg-preview',
              name: state.svgTool.svgFileName || 'SVG Preview',
              polylines: scaledPolylines,
              stoneSize: state.svgTool.stoneSize,
              fillMode: state.svgTool.fillMode,
              fillPattern: state.svgTool.fillPattern,
              densityPreset: state.svgTool.densityPreset,
              customSpacingMm: typeof state.svgTool.customSpacingMm === 'number' ? state.svgTool.customSpacingMm : undefined,
            });
          }
          break;

        // Other tools will be implemented incrementally
        default:
          return;
      }

      dispatch({ type: 'SET_TEMPLATE', template });
    } catch (err) {
      console.error('Template generation error:', err);
      dispatch({ type: 'SET_TEMPLATE', template: null });
    }
  }, [
    state.activeTool,
    state.gridTool,
    state.textTool,
    state.svgTool,
  ]);

  // ─── Export Readiness ──────────────────────────────────────────────────────

  const effectiveTemplate = useMemo(() => buildEffectiveTemplate(state), [state]);

  const exportReady = useMemo(() => {
    if (!effectiveTemplate) return false;
    const readiness = checkExportReadiness(effectiveTemplate);
    return readiness.ready;
  }, [effectiveTemplate]);

  const editorDispatch = useCallback((action: EditorAction) => {
    if (shouldPromptForGeneratorMutation(state, action)) {
      setPendingGeneratorAction(action);
      return;
    }
    dispatch(action);
  }, [state]);

  const applyPendingGeneratorAction = useCallback((mode: 'replace' | 'keep' | 'cancel') => {
    if (!pendingGeneratorAction) return;

    for (const action of resolveGeneratorMutationDecision(pendingGeneratorAction, mode)) {
      dispatch(action);
    }
    setPendingGeneratorAction(null);
  }, [pendingGeneratorAction]);

  const runExport = useCallback(() => {
    if (!effectiveTemplate) {
      setToast({ message: 'Export unavailable because the design is empty.', tone: 'warning' });
      return;
    }

    try {
      const svgString = createBasicSvgExport(effectiveTemplate, {
        includeGuideBox: state.includeGuideBox,
        includeLabels: state.includeLabels,
        paddingMm: state.paddingMm,
        decimalPlaces: 3,
      });

      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const filename = `${state.projectName.toLowerCase().replace(/\s+/g, '-')}.svg`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setToast({ message: 'SVG exported.', tone: 'success' });
    } catch (err) {
      setToast({ message: `Export failed: ${err instanceof Error ? err.message : String(err)}`, tone: 'error' });
    }
  }, [effectiveTemplate, state.includeGuideBox, state.includeLabels, state.paddingMm, state.projectName]);

  const notify = useCallback((message: string, tone: 'success' | 'warning' | 'error' | 'info') => {
    setToast({ message, tone });
  }, []);

  const handleDialogConfirm = useCallback(() => {
    if (!pendingDialog) return;

    if (pendingDialog.kind === 'new-project') {
      dispatch({ type: 'RESET_EDITOR' });
      setToast({ message: 'Started a new project.', tone: 'info' });
    }

    if (pendingDialog.kind === 'export-warning') {
      runExport();
    }

    setPendingDialog(null);
  }, [pendingDialog, runExport]);

  // ─── Topbar Actions ────────────────────────────────────────────────────────

  const handleNewProject = useCallback(() => {
    setPendingDialog({
      kind: 'new-project',
      title: 'Start a new project?',
      message: 'Unsaved changes in the current editor session will be lost.',
      confirmLabel: 'Start new project',
      icon: 'sparkles',
    });
  }, []);

  const handleOpenProject = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = ''; // Reset for re-loading same file

    const reader = new FileReader();
    reader.onload = (ev) => {
      const json = typeof ev.target?.result === 'string' ? ev.target.result : '';
      try {
        const project = parseRhinestoneProject(json);
        
        // Update project name
        dispatch({ type: 'SET_PROJECT_NAME', name: project.projectName });

        // Update export settings
        if (project.exportSettings) {
          dispatch({
            type: 'UPDATE_EXPORT_SETTINGS',
            updates: {
              includeGuideBox: project.exportSettings.includeGuideBox,
              includeLabels: project.exportSettings.includeLabels,
              paddingMm: project.exportSettings.paddingMm,
            },
          });
        } else if ('includeGuideBox' in project.generatorState) {
          dispatch({ type: 'UPDATE_EXPORT_SETTINGS', updates: { includeGuideBox: project.generatorState.includeGuideBox } });
          if ('includeLabels' in project.generatorState) {
            dispatch({ type: 'UPDATE_EXPORT_SETTINGS', updates: { includeLabels: project.generatorState.includeLabels } });
          }
          if ('paddingMm' in project.generatorState) {
            dispatch({ type: 'UPDATE_EXPORT_SETTINGS', updates: { paddingMm: project.generatorState.paddingMm } });
          }
        }

        // Map generatorState to editor state and activate correct tool
        switch (project.generatorState.generatorId) {
          case 'manual-grid':
            dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'grid' });
            editorDispatch({
              type: 'UPDATE_GRID_TOOL',
              updates: {
                stoneSize: project.generatorState.stoneSize,
                columns: project.generatorState.columns,
                rows: project.generatorState.rows,
                densityPreset: project.generatorState.densityPreset,
                customSpacingMm: project.generatorState.customSpacingMm,
              },
            });
            break;

          case 'outline-text':
            dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'text' });
            editorDispatch({
              type: 'UPDATE_TEXT_TOOL',
              updates: {
                mode: 'outline',
                text: project.generatorState.text,
                stoneSize: project.generatorState.stoneSize,
                fontSizeMm: project.generatorState.fontSizeMm,
                targetWidthMm: project.generatorState.targetWidthMm ?? '',
                targetHeightMm: project.generatorState.targetHeightMm ?? '',
                preserveAspectRatio: project.generatorState.preserveAspectRatio,
                align: project.generatorState.align,
                letterSpacingMm: project.generatorState.letterSpacingMm,
                lineSpacingMm: project.generatorState.lineSpacingMm,
                fillMode: project.generatorState.fillMode,
                fillPattern: project.generatorState.fillPattern,
                densityPreset: project.generatorState.densityPreset,
                customSpacingMm: project.generatorState.customSpacingMm,
              },
            });
            break;

          case 'dot-matrix-text':
            dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'text' });
            editorDispatch({
              type: 'UPDATE_TEXT_TOOL',
              updates: {
                mode: 'dot-matrix',
                text: project.generatorState.text,
                stoneSize: project.generatorState.stoneSize,
                targetWidthMm: project.generatorState.targetWidthMm ?? '',
                targetHeightMm: project.generatorState.targetHeightMm ?? '',
                preserveAspectRatio: project.generatorState.preserveAspectRatio,
                letterSpacingColumns: project.generatorState.letterSpacingColumns,
                lineSpacingRows: project.generatorState.lineSpacingRows,
                densityPreset: project.generatorState.densityPreset,
                customSpacingMm: project.generatorState.customSpacingMm,
              },
            });
            break;

          case 'svg-upload':
            dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'svg' });
            editorDispatch({
              type: 'UPDATE_SVG_TOOL',
              updates: {
                uploadedSvgText: project.generatorState.uploadedSvgText,
                svgFileName: 'loaded.svg',
                stoneSize: project.generatorState.stoneSize,
                targetWidthMm: project.generatorState.targetWidthMm ?? '',
                targetHeightMm: project.generatorState.targetHeightMm ?? '',
                preserveAspectRatio: project.generatorState.preserveAspectRatio,
                fillMode: project.generatorState.fillMode,
                fillPattern: project.generatorState.fillPattern,
                densityPreset: project.generatorState.densityPreset,
                customSpacingMm: project.generatorState.customSpacingMm,
                cleanupEnabled: project.generatorState.cleanupEnabled,
                cleanupSimplify: project.generatorState.cleanupSimplify,
                cleanupSimplifyTol: project.generatorState.cleanupSimplifyTol,
                cleanupRemoveTiny: project.generatorState.cleanupRemoveTiny,
                cleanupMinLength: project.generatorState.cleanupMinLength,
                cleanupRemoveDups: project.generatorState.cleanupRemoveDups,
                cleanupDupTol: project.generatorState.cleanupDupTol,
              },
            });
            break;

          case 'manual-editor':
            dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'manual' });
            dispatch({ type: 'SET_TEMPLATE', template: null });
            break;

          default:
            setToast({ message: `Project type "${project.generatorState.generatorId}" is not yet supported in this editor.`, tone: 'error' });
            return;
        }

        // Restore manual tool state if present
        if (project.manualToolState) {
          dispatch({
            type: 'UPDATE_MANUAL_TOOL',
            updates: {
              snapToGrid: project.manualToolState.snapToGrid,
              gridSnapSize: project.manualToolState.gridSnapSize,
              addStoneSize: project.manualToolState.addStoneSize,
            },
          });
        }

        // Override active tool if specified in project
        if (project.activeTool) {
          dispatch({ type: 'SET_ACTIVE_TOOL', tool: project.activeTool });
        }

        // Restore editable state if present (wait for template to generate first)
        if (project.editableState) {
          // Use setTimeout to allow template generation to complete
          setTimeout(() => {
            const editableStones: EditableStone[] = project.editableState!.stones.map(s => ({
              id: s.id,
              center: { x: s.x, y: s.y },
              holeDiameterMm: s.holeDiameterMm,
              stoneSize: s.stoneSize,
            }));

            dispatch({
              type: 'RESTORE_EDITABLE',
              stones: editableStones,
              sourceGenerator: project.generatorState.generatorId,
            });
          }, 100);
        } else if (project.generatorState.generatorId === 'manual-editor') {
          const manualStones: EditableStone[] = project.generatorState.stones.map(savedStoneToEditableStone);
          setTimeout(() => {
            dispatch({
              type: 'RESTORE_EDITABLE',
              stones: manualStones,
              sourceGenerator: 'manual-editor',
            });
          }, 0);
        }

        // Success - template will auto-generate from state update
        setToast({ message: 'Project opened.', tone: 'success' });
      } catch (err) {
        setToast({ message: `Invalid project file: ${err instanceof Error ? err.message : String(err)}`, tone: 'error' });
      }
    };
    reader.readAsText(file);
  }, [editorDispatch]);

  const handleSaveProject = useCallback(() => {
    if (!effectiveTemplate) {
      setToast({ message: 'Nothing to save yet. Create or open a design first.', tone: 'warning' });
      return;
    }

    const project = buildProjectFileFromEditorState(state);
    if (!project) {
      setToast({ message: 'Project save failed because the current editor state could not be serialized.', tone: 'error' });
      return;
    }

    const json = serializeRhinestoneProject(project);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const filename = `${state.projectName.toLowerCase().replace(/\s+/g, '-')}.json`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ message: 'Project saved.', tone: 'success' });
  }, [effectiveTemplate, state]);

  const handleExport = useCallback(() => {
    if (!effectiveTemplate) {
      setToast({ message: 'Export unavailable because the design is empty.', tone: 'warning' });
      return;
    }

    if (!exportReady) {
      setPendingDialog({
        kind: 'export-warning',
        title: 'Export with warnings?',
        message: 'The current template has export warnings. Continue only if you want to export exactly what is on the canvas.',
        confirmLabel: 'Export anyway',
        confirmTone: 'destructive',
        icon: 'warning',
      });
      return;
    }

    runExport();
  }, [effectiveTemplate, exportReady, runExport]);

  const handleOpenSetup = useCallback(() => {
    // Navigate to setup page
    window.location.href = '/setup';
  }, []);

  // ─── Canvas Click Handler ──────────────────────────────────────────────────

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-zinc-900">
      {/* Hidden file input for Open Project */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      <EditorTopbar
        projectName={state.projectName}
        canUndo={state.history.past.length > 0}
        canRedo={state.history.future.length > 0}
        canExport={Boolean(effectiveTemplate)}
        dispatch={dispatch}
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProject}
        onSaveProject={handleSaveProject}
        onExport={handleExport}
        onOpenSetup={handleOpenSetup}
      />

      <EditorDialog
        open={Boolean(pendingGeneratorAction)}
        title="Regenerate from source settings?"
        description="The current design is editable. Regenerating will replace your manual stone edits with a new generated baseline from the source panel."
        confirmLabel="Regenerate and replace edits"
        onConfirm={() => applyPendingGeneratorAction('replace')}
        onCancel={() => applyPendingGeneratorAction('cancel')}
        tertiaryAction={{
          label: 'Keep editable design',
          onClick: () => applyPendingGeneratorAction('keep'),
        }}
        tone="destructive"
        icon="warning"
      />

      <EditorDialog
        open={Boolean(pendingDialog)}
        title={pendingDialog?.title ?? ''}
        description={pendingDialog?.message ?? ''}
        confirmLabel={pendingDialog?.confirmLabel ?? 'Confirm'}
        onConfirm={handleDialogConfirm}
        onCancel={() => setPendingDialog(null)}
        tone={pendingDialog?.confirmTone ?? 'default'}
        icon={pendingDialog?.icon ?? 'info'}
      />

      {toast && (
        <div className="absolute bottom-20 right-4 z-30">
          <EditorToast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />
        </div>
      )}

      <div className="flex min-h-0 flex-1 bg-zinc-950">
        <EditorPropertiesPanel state={state} dispatch={editorDispatch} mode="source" />

        <main className="flex min-w-0 flex-1 flex-col bg-zinc-950">
          <div className="border-b border-zinc-800 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Canvas workspace</h2>
                <p className="text-xs text-zinc-500">Select, add, pan, zoom, and fit the current design without leaving the editor.</p>
              </div>
              <EditorToolbar activeTool={state.activeTool} dispatch={editorDispatch} orientation="horizontal" />
            </div>
          </div>

          <EditorCanvas
            state={state}
            dispatch={editorDispatch}
            onNotify={notify}
          />
        </main>

        <EditorPropertiesPanel state={state} dispatch={editorDispatch} mode="inspector" />
      </div>

      <EditorStatusBar
        template={effectiveTemplate}
        canvas={state.canvas}
        exportReady={exportReady}
        isEditable={state.editableTemplate.isEditable}
      />
    </div>
  );
}
