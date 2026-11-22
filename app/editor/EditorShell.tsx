'use client';

import { useReducer, useCallback, useRef, useMemo, useState, useEffect } from 'react';
import { DEFAULT_PREVIEW_TEXT } from '../lib/fontLaunch';
import GettingStartedGuide from './GettingStartedGuide';
import EmptyCanvasPrompt from './EmptyCanvasPrompt';
import { useSearchParams } from 'next/navigation';
import {
  editorReducer,
  DEFAULT_EDITOR_STATE,
  type EditorAction,
} from './EditorState';
import type { EditableStone, EditorState } from './EditorState';
import {
  createStoneGridTemplate,
  createOutlineTextTemplateAsync,
  createDotMatrixTextTemplate,
  checkExportReadiness,
  createTemplateLibraryEntry,
  parseRhinestoneProject,
  createBasicSvgExport,
  getMatFit,
  LEGACY_OUTLINE_FONT_ID,
  LocalStorageTemplateLibraryRepository,
  createRhinestoneFontTemplate,
  createSvgAlphabetTemplate,
  createLetterStencilTemplate,
  defaultSvgAlphabetGlyphLoader,
  createImportedTemplate,
  validateAssetUpload,
  TRW_STONE_SIZE_CALIBRATION,
  DEFAULT_OUTLINE_FONT_ID,
  isAvailableOutlineFontId,
  autoFixSpacing,
  enlargeToCuttableSpacing,
  getDefaultMaterialProfile,
} from '@/src/lib/rhinestone-engine/index';
import type {
  RhinestoneTemplate,
  TemplateLibraryEntry,
  TemplateLibraryRecord,
  TemplateLibraryRepository,
} from '@/src/lib/rhinestone-engine/index';
import { useStudioTheme } from '../lib/studioTheme';
import { planPreviousSessionKeep } from './previousSession';
import TestPatchPanel from './TestPatchPanel';
import MoreFormatsPanel from './MoreFormatsPanel';
import DesignSpaceGuide from './DesignSpaceGuide';
import ReportProblemDialog from '../components/ReportProblemDialog';
import SharePanel from './SharePanel';
import { calibrationStatusBySize } from '../lib/calibrationStatus';
import { decodeSharePayload, readSharePayload } from '../lib/shareLink';
import VersionHistoryDialog from './VersionHistoryDialog';
import { readVersions, recordVersion, removeVersions } from '../lib/versionHistory';
import EditorTopbar from './EditorTopbar';
import EditorCanvas from './EditorCanvas';
import EditorPropertiesPanel from './EditorPropertiesPanel';
import type { OutlineFontStatus } from './controls/FontPicker';
import EditorStatusBar from './EditorStatusBar';
import EditorDialog from './EditorDialog';
import { buildFitToMatPlan, canResizeDesign } from './fitToMat';
import { hasSpacingIssues, type QuickFixAction } from './quickFixItems';
import dynamic from 'next/dynamic';
import PromptDialog from '../components/PromptDialog';
import { readSvgSizeMm } from '../components/exportDialogHelpers';
import EditorToast from './EditorToast';
import { KeyboardShortcutsHost } from '../components/KeyboardShortcuts';
import { Download, ScanSearch, SlidersHorizontal, Wrench } from 'lucide-react';
import MobileStudioBar from '../components/MobileStudioBar';
import { useIsMobileStudio } from '../lib/useMediaQuery';
import {
  RHINESTONE_NUDGE_SHIFT_STEP_MM,
  RHINESTONE_NUDGE_STEP_MM,
  isKeyHandlingWidget,
  isModalOpen,
  nudgeCenters,
  resolveStudioShortcut,
} from '../lib/studioShortcuts';
import TemplateLibraryPanel from './TemplateLibraryPanel';
import { useStableValue } from './useStableValue';
import { generateRasterArtwork, type ArtworkInfo } from './artworkGeneration';
import { generateSvgArtworkAsync } from './artworkWorkerClient';
// Dialogs are loaded when first opened, keeping the first load of the studio smaller.
const ExportDialog = dynamic(() => import('../components/ExportDialog'));
const SplitExportPanel = dynamic(() => import('./SplitExportPanel'));
const GarmentPreviewPanel = dynamic(() => import('../components/GarmentPreviewPanel'), { ssr: false });
import { getExportFilename, getExportGate, summarizeExportStatus } from '../components/summarizeExportStatus';
import {
  resolveGeneratorMutationDecision,
  shouldPromptForGeneratorMutation,
} from './generatorChangePolicy';
import { EDITOR_TOOLS, RAIL_TOOLS, getCanvasHint, getSourcePanelTool, railToolFor } from './editorUi';
import {
  buildEffectiveTemplate,
  buildProjectFileFromEditorState,
  readRhinestoneAutosave,
  savedStoneToEditableStone,
} from './projectPersistence';
import { decodeRasterImageDataUrl } from '../lib/rasterImageDecode';
import { buildProjectFilename, downloadProject, readProjectFile } from '../lib/projectUtils';
import { findAssetById, readActiveCalibrationProfile, readWorkspaceSettings } from '../lib/workspaceVault';
import { generateAndResolveTemplate } from './generateAndResolveTemplate';
import {
  calculateCanvasWorkspaceBounds,
  MAX_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM,
  validatePersistedCanvasView,
} from './canvasCoordinates';

/** Deleting at least this many stones in one step shows an Undo toast (every delete does). */
const DELETE_UNDO_THRESHOLD = 1;

type OutlineFontStatusState = { status: 'idle' | 'loading' | 'error'; message: string | null; fontId: string };

/** State updater that keeps the current object when nothing changed, so React skips the render. */
function replaceOutlineFontStatus(next: OutlineFontStatusState) {
  return (current: OutlineFontStatusState): OutlineFontStatusState =>
    current.status === next.status && current.message === next.message && current.fontId === next.fontId ? current : next;
}

export default function EditorShell() {
  const t = useT();
  const { theme, toggleTheme } = useStudioTheme();
  const searchParams = useSearchParams();
  const AUTOSAVE_STORAGE_KEY = 'rhinestone-template-library-autosave';
  const [state, dispatch] = useReducer(editorReducer, DEFAULT_EDITOR_STATE);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateLibraryRepositoryRef = useRef<TemplateLibraryRepository | null>(null);
  const generationRequestRef = useRef(0);
  const lastSpacingAdjustmentCountRef = useRef<number | null>(null);
  const handledQueryRef = useRef<string | null>(null);
  const launchIntentHandledRef = useRef(false);
  const [pendingGeneratorAction, setPendingGeneratorAction] = useState<EditorAction | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    tone: 'success' | 'warning' | 'error' | 'info';
    action?: { label: string; onClick: () => void };
  } | null>(null);
  const [namePrompt, setNamePrompt] = useState<{ mode: 'rename' | 'duplicate'; templateId: string; initialValue: string } | null>(null);
  const [templateLibraryOpen, setTemplateLibraryOpen] = useState(false);
  const [garmentPreviewOpen, setGarmentPreviewOpen] = useState(false);
  const [designSurface, setDesignSurface] = useState<'canvas' | 'garment'>('canvas');
  const [fitRequestId, setFitRequestId] = useState(0);
  // Phones and tablets: which panel the bottom bar has open under the canvas.
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('none');
  const isMobile = useIsMobileStudio();
  const [spacingAdjustmentNote, setSpacingAdjustmentNote] = useState<string | null>(null);
  const [activeLibraryTemplateId, setActiveLibraryTemplateId] = useState<string | null>(null);
  const [autosaveEntry, setAutosaveEntry] = useState<TemplateLibraryEntry | null>(null);
  const [autosaveDecision, setAutosaveDecision] = useState<'deciding' | 'ready' | 'restored'>('deciding');
  const initialAutosaveRestoreRef = useRef(false);
  const [libraryRecord, setLibraryRecord] = useState<TemplateLibraryRecord>({ version: 1, builtInTemplates: [], userTemplates: [] });
  const [artworkInfo, setArtworkInfo] = useState<ArtworkInfo | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [outlineFontStatus, setOutlineFontStatus] = useState<{
    status: 'idle' | 'loading' | 'error';
    message: string | null;
    fontId: string;
  }>({
    status: 'idle',
    message: null,
    fontId: LEGACY_OUTLINE_FONT_ID,
  });
  const [pendingDialog, setPendingDialog] = useState<
    | null
    | {
        kind: 'new-project' | 'export-blocked' | 'autosave-restore' | 'asset-open-error';
        title: string;
        message: string;
        details?: string[];
        confirmLabel: string;
        confirmTone?: 'default' | 'destructive';
        icon?: 'sparkles' | 'warning' | 'info';
        tertiaryAction?: {
          label: string;
          onClick: () => void;
          tone?: 'default' | 'destructive';
        };
      }
  >(null);
  const requestCanvasFit = useCallback(() => {
    setFitRequestId((current) => current + 1);
  }, []);

  const canvasViewStorageKey = useMemo(() => {
    const normalizedName = state.projectName.trim().toLowerCase().replace(/\s+/g, '-') || 'untitled-project';
    return `rhinestone-canvas-view:${normalizedName}`;
  }, [state.projectName]);

  // Deleting stones is easy to do by accident (and Select all + Delete removes everything),
  // so every delete offers a one-click Undo. History already supports undo; this only surfaces it.
  const editableStoneCount = state.editableTemplate.stones.length;
  const historyDepth = state.history.past.length;
  const previousStoneStatsRef = useRef({ stoneCount: editableStoneCount, historyDepth });
  const suppressDeleteToastRef = useRef(false);
  useEffect(() => {
    const previous = previousStoneStatsRef.current;
    previousStoneStatsRef.current = { stoneCount: editableStoneCount, historyDepth };
    const removed = previous.stoneCount - editableStoneCount;
    if (suppressDeleteToastRef.current) {
      // An auto-fix removed stones and already told the user; do not call that a "delete".
      suppressDeleteToastRef.current = false;
      return;
    }
    if (removed >= DELETE_UNDO_THRESHOLD && historyDepth === previous.historyDepth + 1) {
      setToast({
        message: removed === 1 ? 'Deleted 1 stone.' : `Deleted ${removed} stones.`,
        tone: 'info',
        action: { label: 'Undo', onClick: () => { dispatch({ type: 'UNDO' }); setToast(null); } },
      });
    }
  }, [dispatch, editableStoneCount, historyDepth]);

  useEffect(() => {
    if (!toast) return;
    const timeoutId = window.setTimeout(
      () => setToast(null),
      toast.action ? 8000 : toast.tone === 'error' ? 5000 : 3200,
    );
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const refreshTemplateLibrary = useCallback(async () => {
    if (!templateLibraryRepositoryRef.current) return;
    const record = await templateLibraryRepositoryRef.current.list();
    setLibraryRecord({
      ...record,
      builtInTemplates: [...record.builtInTemplates].sort((left, right) => left.name.localeCompare(right.name)),
      userTemplates: [...record.userTemplates].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    });
  }, []);

  useEffect(() => {
    templateLibraryRepositoryRef.current = new LocalStorageTemplateLibraryRepository();
    void refreshTemplateLibrary();
    const rawAutosave = globalThis.localStorage?.getItem(AUTOSAVE_STORAGE_KEY);
    const previousSession = readRhinestoneAutosave(rawAutosave);

    // Arriving with a launch link (a font, an asset or a saved design) means the
    // user wants that design, so it wins over restoring the last session. The last
    // session is not thrown away: it is copied into My Designs first.
    const params = new URLSearchParams(globalThis.location?.search ?? '');
    const hasLaunchIntent = ['designId', 'asset', 'font', 'text', 'tool'].some((key) => params.has(key)) || readSharePayload(globalThis.location?.hash ?? '') !== null;
    const entry = hasLaunchIntent ? null : previousSession;
    if (hasLaunchIntent && previousSession && !launchIntentHandledRef.current) {
      launchIntentHandledRef.current = true;
      const repository = templateLibraryRepositoryRef.current;
      const baseName = previousSession.name.replace(/\s*\(Autosave\)$/, '');
      void repository?.list().then(async (record) => {
        const plan = planPreviousSessionKeep(previousSession, record.userTemplates);
        if (!plan.keep) return;
        for (const templateId of plan.prune) await repository.delete(templateId);
        await repository.save({
          ...previousSession,
          templateId: `previous-session-${previousSession.updatedAt}`,
          name: `${baseName} (previous session)`,
          readOnly: false,
          tags: previousSession.tags.filter((tag) => tag !== 'autosave'),
        });
        await refreshTemplateLibrary();
        setToast({ message: 'Your previous session was saved in My Designs.', tone: 'info' });
      });
    }

    // A first visit (nothing to restore) starts from the Settings defaults. Dispatched
    // synchronously so it is applied before the launch-link effect below sets its text/font.
    if (!entry) dispatch({ type: 'APPLY_WORKSPACE_DEFAULTS', settings: readWorkspaceSettings() });
    queueMicrotask(() => {
      setAutosaveEntry(entry);
      setAutosaveDecision(entry ? 'restored' : 'ready');
    });
  }, [refreshTemplateLibrary]);

  /** Blank project that starts from the Settings defaults (stone size, density, artwork size). */
  const resetToNewProject = useCallback(() => {
    dispatch({ type: 'RESET_EDITOR' });
    dispatch({ type: 'APPLY_WORKSPACE_DEFAULTS', settings: readWorkspaceSettings() });
  }, []);

  // ─── Template Generation ───────────────────────────────────────────────────

  const sourceTool = useMemo(() => getSourcePanelTool(state), [state]);

  // The generation effect is keyed on tool *content*, not slice identity: while an update is stuck waiting for
  // its lane React rebuilds `state` on every render, so identical settings arrive as new objects (see useStableValue).
  const generationGridTool = useStableValue(state.gridTool);
  const generationTextTool = useStableValue(state.textTool);
  const generationSvgTool = useStableValue(state.svgTool);

  /**
   * Generate template based on active tool and its state.
   * This runs whenever tool state changes.
   */
  useEffect(() => {
    if (autosaveDecision === 'deciding') return;
    const requestId = ++generationRequestRef.current;

    const generateTemplate = async () => {
      try {
        let template: RhinestoneTemplate | null = null;

        switch (sourceTool) {
          case 'grid':
            template = createStoneGridTemplate({
              id: 'grid-preview',
              name: 'Grid Preview',
              stoneSize: generationGridTool.stoneSize,
              columns: generationGridTool.columns,
              rows: generationGridTool.rows,
              densityPreset: generationGridTool.densityPreset,
              customSpacingMm: typeof generationGridTool.customSpacingMm === 'number' ? generationGridTool.customSpacingMm : undefined,
            });
            setOutlineFontStatus((current) => current.status === 'idle' ? current : { status: 'idle', message: null, fontId: generationTextTool.fontId });
            break;

          case 'text':
            if (generationTextTool.text.trim()) {
              if (generationTextTool.mode === 'outline') {
                const usesBundledFont = generationTextTool.fontId !== LEGACY_OUTLINE_FONT_ID;
                setOutlineFontStatus(replaceOutlineFontStatus({
                  status: usesBundledFont ? 'loading' : 'idle',
                  message: usesBundledFont ? 'Loading font geometry…' : null,
                  fontId: generationTextTool.fontId,
                }));
                template = await createOutlineTextTemplateAsync({
                  id: 'text-outline-preview',
                  name: 'Text Outline Preview',
                  text: generationTextTool.text,
                  stoneSize: generationTextTool.stoneSize,
                  outlineTextStyle: generationTextTool.outlineTextStyle,
                  fontId: generationTextTool.fontId,
                  fontSizeMm: typeof generationTextTool.fontSizeMm === 'number' ? generationTextTool.fontSizeMm : 25,
                  align: generationTextTool.align,
                  letterSpacingMm: typeof generationTextTool.letterSpacingMm === 'number' ? generationTextTool.letterSpacingMm : 0,
                  lineSpacingMm: typeof generationTextTool.lineSpacingMm === 'number' ? generationTextTool.lineSpacingMm : 10,
                  curveAmount: generationTextTool.curveAmount,
                  targetWidthMm: typeof generationTextTool.targetWidthMm === 'number' ? generationTextTool.targetWidthMm : undefined,
                  targetHeightMm: typeof generationTextTool.targetHeightMm === 'number' ? generationTextTool.targetHeightMm : undefined,
                  preserveAspectRatio: generationTextTool.preserveAspectRatio,
                  coverageMode: generationTextTool.coverageMode,
                  densityPreset: generationTextTool.densityPreset,
                  customSpacingMm: typeof generationTextTool.customSpacingMm === 'number' ? generationTextTool.customSpacingMm : undefined,
                  fillMode: generationTextTool.fillMode,
                  fillPattern: generationTextTool.fillPattern,
                  placementPattern: generationTextTool.placementPattern,
                  contourSettings: generationTextTool.contourSettings,
                  radialSettings: generationTextTool.radialSettings,
                });
                if (requestId !== generationRequestRef.current) return;
                setOutlineFontStatus(replaceOutlineFontStatus({ status: 'idle', message: null, fontId: generationTextTool.fontId }));

                // Legacy vector font only: characters with no real glyph
                // silently fell back to '?' — surface that instead of
                // swallowing it (metadata value is comma-joined; see
                // outlineTextTemplate.ts for why it can't be a real array).
                const rawUnsupported = template?.metadata?.['unsupportedCharacters'];
                const unsupportedCharacters = typeof rawUnsupported === 'string' && rawUnsupported.length > 0
                  ? rawUnsupported.split(',')
                  : [];
                if (JSON.stringify(generationTextTool.unsupportedCharacters) !== JSON.stringify(unsupportedCharacters)) {
                  dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { unsupportedCharacters } });
                }
              } else {
                template = createDotMatrixTextTemplate({
                  id: 'text-dotmatrix-preview',
                  name: 'Dot Matrix Text Preview',
                  text: generationTextTool.text,
                  stoneSize: generationTextTool.stoneSize,
                  letterSpacingColumns: generationTextTool.letterSpacingColumns,
                  lineSpacingRows: generationTextTool.lineSpacingRows,
                  targetWidthMm: typeof generationTextTool.targetWidthMm === 'number' ? generationTextTool.targetWidthMm : undefined,
                  targetHeightMm: typeof generationTextTool.targetHeightMm === 'number' ? generationTextTool.targetHeightMm : undefined,
                  preserveAspectRatio: generationTextTool.preserveAspectRatio,
                  densityPreset: generationTextTool.densityPreset,
                  customSpacingMm: typeof generationTextTool.customSpacingMm === 'number' ? generationTextTool.customSpacingMm : undefined,
                });
                setOutlineFontStatus((current) => current.status === 'idle' ? current : { status: 'idle', message: null, fontId: generationTextTool.fontId });
              }
            }
            break;

          case 'svg':
            if (generationSvgTool.assetKind === 'image' && generationSvgTool.uploadedImageDataUrl) {
              const rasterImage = await decodeRasterImageDataUrl(generationSvgTool.uploadedImageDataUrl);
              if (requestId !== generationRequestRef.current) return;
              const generated = generateRasterArtwork(generationSvgTool, rasterImage);
              template = generated.template;
              if (requestId === generationRequestRef.current) setArtworkInfo(generated.info);
            } else if (generationSvgTool.uploadedSvgText) {
              const generated = await generateSvgArtworkAsync(generationSvgTool);
              if (requestId !== generationRequestRef.current) return;
              template = generated.template;
              if (requestId === generationRequestRef.current) setArtworkInfo(generated.info);
            }
            setOutlineFontStatus((current) => current.status === 'idle' ? current : { status: 'idle', message: null, fontId: generationTextTool.fontId });
            break;

          case 'rhinestone-font':
            if (!state.rhinestoneFontTool.text.trim()) {
              return;
            }
            {
              const defaultLetterSpacingMm = state.rhinestoneFontTool.presentationMode === 'stones' ? 1 : 0;
              const defaultLineSpacingMm = 0;
              // Get diameter for stone size - TRW calibration only supports SS6, SS10, SS16, SS20
              let targetDiameterMm = 3.429; // Default SS10
              const sizeId = state.rhinestoneFontTool.stoneSize;
              if (sizeId in TRW_STONE_SIZE_CALIBRATION) {
                targetDiameterMm = TRW_STONE_SIZE_CALIBRATION[sizeId as keyof typeof TRW_STONE_SIZE_CALIBRATION].diameterMm;
              }
              
              const result = await createRhinestoneFontTemplate({
                text: state.rhinestoneFontTool.text,
                rhinestoneFontId: state.rhinestoneFontTool.rhinestoneFontId,
                targetStoneSizeId: sizeId,
                targetStoneSizeMm: targetDiameterMm,
                letterSpacingMm: typeof state.rhinestoneFontTool.letterSpacingMm === 'number' ? state.rhinestoneFontTool.letterSpacingMm : defaultLetterSpacingMm,
                lineSpacingMm: typeof state.rhinestoneFontTool.lineSpacingMm === 'number' ? state.rhinestoneFontTool.lineSpacingMm : defaultLineSpacingMm,
              });
              template = result.template;
              // Update unsupported characters and warnings in tool state
              if (
                JSON.stringify(state.rhinestoneFontTool.unsupportedCharacters) !== JSON.stringify(result.unsupportedCharacters) ||
                JSON.stringify(state.rhinestoneFontTool.warnings) !== JSON.stringify(result.warnings)
              ) {
                dispatch({
                  type: 'UPDATE_RHINESTONE_FONT_TOOL',
                  updates: {
                    unsupportedCharacters: result.unsupportedCharacters,
                    warnings: result.warnings,
                  },
                });
              }
            }
            setOutlineFontStatus((current) => current.status === 'idle' ? current : { status: 'idle', message: null, fontId: generationTextTool.fontId });
            break;

          case 'svg-alphabet':
            if (!state.svgAlphabetTool.text.trim()) {
              return;
            }
            {
              let targetDiameterMm = 3.429;
              const sizeId = state.svgAlphabetTool.stoneSize;
              if (sizeId in TRW_STONE_SIZE_CALIBRATION) {
                targetDiameterMm = TRW_STONE_SIZE_CALIBRATION[sizeId as keyof typeof TRW_STONE_SIZE_CALIBRATION].diameterMm;
              }
              const result = await createSvgAlphabetTemplate({
                text: state.svgAlphabetTool.text,
                alphabetId: state.svgAlphabetTool.svgAlphabetId,
                targetStoneSizeId: sizeId,
                targetStoneSizeMm: targetDiameterMm,
                letterSpacingMm: typeof state.svgAlphabetTool.letterSpacingMm === 'number' ? state.svgAlphabetTool.letterSpacingMm : 2,
                lineSpacingMm: typeof state.svgAlphabetTool.lineSpacingMm === 'number' ? state.svgAlphabetTool.lineSpacingMm : 0,
                glyphLoader: defaultSvgAlphabetGlyphLoader,
              });
              template = result.template;
              if (
                JSON.stringify(state.svgAlphabetTool.unsupportedCharacters) !== JSON.stringify(result.unsupportedCharacters) ||
                JSON.stringify(state.svgAlphabetTool.warnings) !== JSON.stringify(result.warnings)
              ) {
                dispatch({
                  type: 'UPDATE_SVG_ALPHABET_TOOL',
                  updates: {
                    unsupportedCharacters: result.unsupportedCharacters,
                    warnings: result.warnings,
                  },
                });
              }
            }
            break;

          case 'letter-stencil':
            if (!state.letterStencilTool.text.trim()) {
              return;
            }
            {
              let targetDiameterMm = 3.429;
              const sizeId = state.letterStencilTool.stoneSize;
              if (sizeId in TRW_STONE_SIZE_CALIBRATION) {
                targetDiameterMm = TRW_STONE_SIZE_CALIBRATION[sizeId as keyof typeof TRW_STONE_SIZE_CALIBRATION].diameterMm;
              }
              const result = await createLetterStencilTemplate({
                text: state.letterStencilTool.text,
                source: state.letterStencilTool.sourceType === 'rhinestone-font'
                  ? {
                      type: 'rhinestone-font',
                      rhinestoneFontId: state.letterStencilTool.rhinestoneFontId,
                    }
                  : {
                      type: 'svg-alphabet',
                      alphabetId: state.letterStencilTool.svgAlphabetId,
                      glyphLoader: defaultSvgAlphabetGlyphLoader,
                    },
                targetStoneSizeId: sizeId,
                targetStoneSizeMm: targetDiameterMm,
                cardPaddingMm: typeof state.letterStencilTool.cardPaddingMm === 'number' ? state.letterStencilTool.cardPaddingMm : 3,
                cardCornerRadiusMm: typeof state.letterStencilTool.cardCornerRadiusMm === 'number' ? state.letterStencilTool.cardCornerRadiusMm : 2,
                minCardWidthMm: typeof state.letterStencilTool.minCardWidthMm === 'number' ? state.letterStencilTool.minCardWidthMm : 12,
                layoutMode: state.letterStencilTool.layoutMode,
                cutSheetGapMm: typeof state.letterStencilTool.cutSheetGapMm === 'number' ? state.letterStencilTool.cutSheetGapMm : 3,
              });
              template = result.template;
              if (
                JSON.stringify(state.letterStencilTool.unsupportedCharacters) !== JSON.stringify(result.unsupportedCharacters) ||
                JSON.stringify(state.letterStencilTool.warnings) !== JSON.stringify(result.warnings)
              ) {
                dispatch({
                  type: 'UPDATE_LETTER_STENCIL_TOOL',
                  updates: {
                    unsupportedCharacters: result.unsupportedCharacters,
                    warnings: result.warnings,
                  },
                });
              }
            }
            break;

          case 'template-import':
            if (state.templateImportTool.uploadedSvgText) {
              const importResult = createImportedTemplate({
                svgText: state.templateImportTool.uploadedSvgText,
                defaultStoneSizeId: state.templateImportTool.defaultStoneSize,
                deduplicateTolerance: 0.01,
              });
              template = importResult.template;
              // Update import summary in tool state
              const summary = `Imported ${importResult.template.stones.length} stones. ` +
                `Detected ${importResult.detectedDiameters.length} diameter(s), ${importResult.detectedColors.length} color(s).`;
              if (
                state.templateImportTool.importSummary !== summary ||
                state.templateImportTool.ignoredElements !== importResult.ignoredElements ||
                JSON.stringify(state.templateImportTool.warnings) !== JSON.stringify(importResult.warnings)
              ) {
                dispatch({
                  type: 'UPDATE_TEMPLATE_IMPORT_TOOL',
                  updates: {
                    detectedDiameters: importResult.detectedDiameters,
                    detectedColors: importResult.detectedColors,
                    ignoredElements: importResult.ignoredElements,
                    warnings: importResult.warnings,
                    importSummary: summary,
                  },
                });
              }
            }
            setOutlineFontStatus((current) => current.status === 'idle' ? current : { status: 'idle', message: null, fontId: generationTextTool.fontId });
            break;

          default:
            return;
        }

        const generationResult = await generateAndResolveTemplate({
          sourceTool,
          generateTemplate: () => template,
        });
        if (requestId !== generationRequestRef.current) return;
        template = generationResult.template;

        const spacingAdjustment = generationResult.spacingAdjustment;
        const adjustedStoneCount = spacingAdjustment?.adjustedStoneCount ?? 0;
        // Nudging a few stones apart is routine (the result is always cuttable), so it is not announced. Say
        // something only when stones had to be removed or the design is too dense for the stone size.
        const worthMentioning = (spacingAdjustment?.removedStoneCount ?? 0) > 0 || Boolean(spacingAdjustment?.tooDenseForStoneSize);
        if (adjustedStoneCount > 0 && worthMentioning) {
          const message = spacingAdjustment?.tooDenseForStoneSize
            ? `Adjusted ${adjustedStoneCount} stones for minimum spacing. This design is too dense for this stone size — increase the size or use a smaller stone.`
            : `Adjusted ${adjustedStoneCount} stones for minimum spacing.`;
          setSpacingAdjustmentNote(message);

          if (lastSpacingAdjustmentCountRef.current !== adjustedStoneCount) {
            setToast({ message, tone: spacingAdjustment?.tooDenseForStoneSize ? 'warning' : 'info' });
            lastSpacingAdjustmentCountRef.current = adjustedStoneCount;
          }
        } else {
          setSpacingAdjustmentNote(null);
          lastSpacingAdjustmentCountRef.current = 0;
        }

        // A generator that produced no stones (for example a digits-only font given letters) has made no design,
        // which is not an error: the panel says why, and the status stays neutral instead of "BLOCKED".
        const producedDesign = template && template.stones.length > 0 ? template : null;
        dispatch({ type: 'SET_TEMPLATE', template: producedDesign });
        if (producedDesign) {
          requestCanvasFit();
        }
      } catch (err) {
        if (requestId !== generationRequestRef.current) return;
        console.error('Template generation error:', err);
        setOutlineFontStatus(replaceOutlineFontStatus({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
          fontId: generationTextTool.fontId,
        }));
        if (sourceTool !== 'rhinestone-font' && sourceTool !== 'template-import') {
          dispatch({ type: 'SET_TEMPLATE', template: null });
        }
      }
    };

    void generateTemplate();
  }, [
    requestCanvasFit,
    autosaveDecision,
    sourceTool,
    generationGridTool,
    generationTextTool,
    generationTextTool.contourSettings,
    generationTextTool.radialSettings,
    generationSvgTool,
    generationSvgTool.contourSettings,
    generationSvgTool.radialSettings,
    state.rhinestoneFontTool.text,
    state.rhinestoneFontTool.rhinestoneFontId,
    state.rhinestoneFontTool.presentationMode,
    state.rhinestoneFontTool.stoneSize,
    state.rhinestoneFontTool.letterSpacingMm,
    state.rhinestoneFontTool.lineSpacingMm,
    state.rhinestoneFontTool.unsupportedCharacters,
    state.rhinestoneFontTool.warnings,
    state.svgAlphabetTool.text,
    state.svgAlphabetTool.svgAlphabetId,
    state.svgAlphabetTool.stoneSize,
    state.svgAlphabetTool.letterSpacingMm,
    state.svgAlphabetTool.lineSpacingMm,
    state.svgAlphabetTool.unsupportedCharacters,
    state.svgAlphabetTool.warnings,
    state.letterStencilTool.text,
    state.letterStencilTool.sourceType,
    state.letterStencilTool.svgAlphabetId,
    state.letterStencilTool.rhinestoneFontId,
    state.letterStencilTool.stoneSize,
    state.letterStencilTool.cardPaddingMm,
    state.letterStencilTool.cardCornerRadiusMm,
    state.letterStencilTool.minCardWidthMm,
    state.letterStencilTool.layoutMode,
    state.letterStencilTool.cutSheetGapMm,
    state.letterStencilTool.unsupportedCharacters,
    state.letterStencilTool.warnings,
    state.templateImportTool.uploadedSvgText,
    state.templateImportTool.defaultStoneSize,
    state.templateImportTool.ignoredElements,
    state.templateImportTool.importSummary,
    state.templateImportTool.warnings,
  ]);

  // ─── Export Readiness ──────────────────────────────────────────────────────

  const effectiveTemplate = useMemo(() => buildEffectiveTemplate(state), [state]);
  const restoredCanvasViewKeyRef = useRef<string | null>(null);
  const persistManualCanvasView = useCallback(
    (view: { zoom: number; panX: number; panY: number }) => {
      globalThis.localStorage?.setItem(
        canvasViewStorageKey,
        JSON.stringify({ ...view, manual: true }),
      );
    },
    [canvasViewStorageKey],
  );

  useEffect(() => {
    if (restoredCanvasViewKeyRef.current === canvasViewStorageKey) return;
    restoredCanvasViewKeyRef.current = canvasViewStorageKey;

    const raw = globalThis.localStorage?.getItem(canvasViewStorageKey);
    let restored = null;
    if (raw && effectiveTemplate) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        const stones = effectiveTemplate.stones.map((stone) => ({
          center: stone.center,
          holeDiameterMm: stone.holeDiameterMm,
        }));
        const workspace = calculateCanvasWorkspaceBounds(stones);
        const content = calculateCanvasWorkspaceBounds(stones, {
          paddingMm: 20,
          minWidthMm: 0,
          minHeightMm: 0,
        });
        restored = validatePersistedCanvasView(parsed, workspace, content);
      } catch {
        restored = null;
      }
    }

    if (restored) {
      dispatch({ type: 'UPDATE_CANVAS', updates: restored });
    } else {
      requestCanvasFit();
    }
  }, [canvasViewStorageKey, effectiveTemplate, requestCanvasFit]);

  const activeLibraryEntry = useMemo(
    () => libraryRecord.userTemplates.find((entry) => entry.templateId === activeLibraryTemplateId) ?? null,
    [activeLibraryTemplateId, libraryRecord.userTemplates],
  );

  const inferLibraryCategory = useCallback((generatorId: string | null): TemplateLibraryEntry['category'] => {
    switch (generatorId) {
      case 'manual-grid':
        return 'grid';
      case 'svg-upload':
      case 'template-import':
        return 'svg';
      case 'manual-editor':
        return 'manual';
      case 'outline-text':
      case 'dot-matrix-text':
      case 'rhinestone-font':
      case 'rhinestone-font-line':
      case 'rhinestone-font-digits':
      case 'svg-alphabet':
      case 'letter-stencil':
      default:
        return 'text';
    }
  }, []);

  const buildPreviewRef = useCallback((template: NonNullable<typeof effectiveTemplate>) => {
    const svgString = createBasicSvgExport(template, {
      includeGuideBox: false,
      includeLabels: false,
      paddingMm: 4,
      decimalPlaces: 2,
    });
    return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
  }, []);

  const buildLibraryTags = useCallback((category: TemplateLibraryEntry['category']) => {
    const tags = new Set<string>([category, state.activeTool]);
    if (effectiveTemplate) {
      for (const sizeId of new Set(effectiveTemplate.stones.map((stone) => stone.stoneSize))) {
        tags.add(sizeId.toLowerCase());
      }
    }
    return Array.from(tags);
  }, [effectiveTemplate, state.activeTool]);

  const buildCurrentLibraryEntry = useCallback((templateId: string, name: string, createdAt: string, favorite: boolean) => {
    if (!effectiveTemplate) return null;
    const project = buildProjectFileFromEditorState(state);
    if (!project) return null;

    const category = inferLibraryCategory(project.generatorState.generatorId);
    return createTemplateLibraryEntry({
      templateId,
      name,
      category,
      tags: buildLibraryTags(category),
      builtIn: false,
      readOnly: false,
      favorite,
      previewRef: buildPreviewRef(effectiveTemplate),
      widthMm: effectiveTemplate.widthMm ?? null,
      heightMm: effectiveTemplate.heightMm ?? null,
      stoneCount: effectiveTemplate.stones.length,
      stoneSizes: Array.from(new Set(effectiveTemplate.stones.map((stone) => stone.stoneSize))),
      colorLayerCount: Array.from(new Set(effectiveTemplate.stones.map((stone) => String(stone.metadata?.fill ?? stone.metadata?.stroke ?? 'default')))).length,
      createdAt,
      updatedAt: new Date().toISOString(),
      snapshot: project,
    });
  }, [buildLibraryTags, buildPreviewRef, effectiveTemplate, inferLibraryCategory, state]);

  useEffect(() => {
    if (!effectiveTemplate) return;
    const timeoutId = window.setTimeout(() => {
      const entry = buildCurrentLibraryEntry('autosave-current-design', `${state.projectName} (Autosave)`, autosaveEntry?.createdAt ?? new Date().toISOString(), false);
      if (!entry) return;
      const nextAutosaveEntry: TemplateLibraryEntry = {
        ...entry,
        readOnly: true,
        tags: [...entry.tags, 'autosave'],
      };
      globalThis.localStorage?.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(nextAutosaveEntry));
      setAutosaveEntry(nextAutosaveEntry);
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [autosaveEntry?.createdAt, buildCurrentLibraryEntry, effectiveTemplate, state.projectName]);

  const [activeCalibrationProfile, setActiveCalibrationProfile] = useState<ReturnType<typeof readActiveCalibrationProfile> | null>(null);
  useEffect(() => {
    const syncActiveCalibrationProfile = () => {
      const profile = readActiveCalibrationProfile();
      queueMicrotask(() => setActiveCalibrationProfile(profile));
    };
    syncActiveCalibrationProfile();
    window.addEventListener('storage', syncActiveCalibrationProfile);
    window.addEventListener('focus', syncActiveCalibrationProfile);
    return () => {
      window.removeEventListener('storage', syncActiveCalibrationProfile);
      window.removeEventListener('focus', syncActiveCalibrationProfile);
    };
  }, []);

  const exportReadiness = useMemo(() => {
    if (!effectiveTemplate) return null;
    return checkExportReadiness(effectiveTemplate, {
      includeLabels: state.includeLabels,
      approvedCalibrationProfile: activeCalibrationProfile,
    });
  }, [activeCalibrationProfile, effectiveTemplate, state.includeLabels]);

  const exportStatusSummary = useMemo(() => summarizeExportStatus(exportReadiness), [exportReadiness]);
  const exportDesignWarningNotes = useMemo(
    () => exportStatusSummary.designWarnings.slice(0, 5).map((issue) => ({
      tone: 'warning' as const,
      text: issue.suggestion ? `${issue.message} ${issue.suggestion}` : issue.message,
    })),
    [exportStatusSummary.designWarnings],
  );
  const exportReady = exportStatusSummary.ready;
  const exportErrorCount = exportStatusSummary.designErrors.length;
  const exportWarningCount = exportStatusSummary.designWarnings.length;
  const needsCalibration = exportStatusSummary.needsCalibration;
  const calibrationBySize = useMemo(
    () => calibrationStatusBySize(effectiveTemplate?.stones.map((stone) => stone.stoneSize) ?? [], activeCalibrationProfile),
    [activeCalibrationProfile, effectiveTemplate],
  );
  const editorDispatch = useCallback((action: EditorAction) => {
    if (shouldPromptForGeneratorMutation(state, action)) {
      setPendingGeneratorAction(action);
      return;
    }
    if (action.type === 'CONVERT_TO_EDITABLE' && !state.editableTemplate.isEditable) {
      setToast({ message: 'You can now select and move individual stones. Changing the settings will ask before it replaces your edits.', tone: 'info' });
    }
    dispatch(action);
  }, [state]);

  // Some vendor stone fonts are drawings of dots that overlap on purpose. They are shown exactly as drawn; when the
  // design is exported or the user asks, the whole layout can be enlarged until the stones can be cut. Only worked out
  // when stones actually collide, and only offered when the overlap is that of artwork (a real enlargement), not a few
  // stones that a small nudge fixes.
  const overlapEnlargement = useMemo(() => {
    if (!effectiveTemplate || !exportReadiness?.summary.hasCollisions || effectiveTemplate.stones.length > 4000) return null;
    const result = enlargeToCuttableSpacing(effectiveTemplate, { minGapMm: getDefaultMaterialProfile().minimumEdgeSpacingMm });
    if (result.scale < 1.3) return null;
    return { scale: result.scale, widthMm: (exportReadiness.summary.widthMm ?? 0) * result.scale, template: result.template, removedCount: result.removedCount };
  }, [effectiveTemplate, exportReadiness]);

  const handleEnlargeCuttable = useCallback(() => {
    if (!overlapEnlargement) return;
    suppressDeleteToastRef.current = true;
    dispatch({ type: 'REPLACE_STONES', stones: overlapEnlargement.template.stones });
    setToast({
      message: `Enlarged ×${overlapEnlargement.scale.toFixed(1)} (about ${Math.round(overlapEnlargement.widthMm)} mm wide) so every stone has room to be cut.${overlapEnlargement.removedCount > 0 ? ` ${overlapEnlargement.removedCount} stones that were still too close were removed.` : ''}`,
      tone: 'success',
      action: { label: 'Undo', onClick: () => { dispatch({ type: 'UNDO' }); setToast(null); } },
    });
  }, [overlapEnlargement]);

  // One-click fixes offered by the Quick fixes panel and the "fix errors before export" dialog.
  const handleAutoFixSpacing = useCallback(() => {
    if (!effectiveTemplate) return;
    // Artwork drawn with overlapping dots cannot be nudged apart without smearing the letters: enlarge instead.
    if (overlapEnlargement) {
      handleEnlargeCuttable();
      return;
    }
    const result = autoFixSpacing(effectiveTemplate, { minGapMm: getDefaultMaterialProfile().minimumEdgeSpacingMm });
    if (!result.changed) {
      setToast({ message: 'Nothing to fix: no stones are too close together.', tone: 'info' });
      return;
    }

    suppressDeleteToastRef.current = true;
    dispatch({ type: 'REPLACE_STONES', stones: result.template.stones });

    const moved = result.movedStoneCount;
    const removed = result.removedStoneCount;
    const parts = [
      moved > 0 ? `moved ${moved} ${moved === 1 ? 'stone' : 'stones'}` : null,
      removed > 0 ? `removed ${removed} that could not fit` : null,
    ].filter(Boolean).join(' and ');
    const stillWrong = result.remainingIssues.some((issue) => issue.severity === 'error');
    setToast({
      message: `Fixed spacing: ${parts}.${stillWrong ? ' Some problems remain; see the checks in the Inspect panel.' : ''}`,
      tone: removed > 0 || stillWrong ? 'warning' : 'success',
      action: { label: 'Undo', onClick: () => { dispatch({ type: 'UNDO' }); setToast(null); } },
    });
  }, [effectiveTemplate, handleEnlargeCuttable, overlapEnlargement]);

  const canResize = useMemo(() => canResizeDesign(state), [state]);

  const handleFitToMat = useCallback((mat: '12x12' | '12x24') => {
    if (!exportReadiness) return;
    const plan = buildFitToMatPlan(
      state,
      { widthMm: exportReadiness.summary.widthMm, heightMm: exportReadiness.summary.heightMm },
      mat,
    );
    if (!plan) {
      setToast({ message: 'This design cannot be resized automatically. Change its size in the Design panel, or delete stones.', tone: 'warning' });
      return;
    }
    editorDispatch(plan.action);
    setToast({
      message: `Resizing to about ${Math.round(plan.scale * 100)} % (${plan.targetWidthMm} × ${plan.targetHeightMm} mm) to fit a ${mat === '12x12' ? '12 × 12' : '12 × 24'} in mat.`,
      tone: 'info',
    });
  }, [editorDispatch, exportReadiness, state]);

  const handleQuickFix = useCallback((action: QuickFixAction) => {
    if (action === 'auto-fix-spacing') handleAutoFixSpacing();
    else if (action === 'enlarge-cuttable') handleEnlargeCuttable();
    else if (action === 'split-parts') setExportDialogOpen(true);
    else handleFitToMat(action === 'fit-12x12' ? '12x12' : '12x24');
  }, [handleAutoFixSpacing, handleEnlargeCuttable, handleFitToMat]);

  const applyPendingGeneratorAction = useCallback((mode: 'replace' | 'keep' | 'cancel') => {
    if (!pendingGeneratorAction) return;

    for (const action of resolveGeneratorMutationDecision(pendingGeneratorAction, mode)) {
      dispatch(action);
    }
    setPendingGeneratorAction(null);
  }, [pendingGeneratorAction]);

  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // The exact SVG shown in the export dialog preview and downloaded from it.
  const exportPreview = useMemo(() => {
    if (!exportDialogOpen || !effectiveTemplate) return null;
    try {
      const svg = createBasicSvgExport(effectiveTemplate, {
        includeGuideBox: state.includeGuideBox,
        includeLabels: state.includeLabels,
        paddingMm: state.paddingMm,
        decimalPlaces: 3,
        uncalibratedOverride: needsCalibration,
      });
      const size = readSvgSizeMm(svg);
      return { svg, widthMm: size?.widthMm ?? null, heightMm: size?.heightMm ?? null, error: null as string | null };
    } catch (err) {
      return {
        svg: null as string | null,
        widthMm: null as number | null,
        heightMm: null as number | null,
        error: `Could not prepare the export: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }, [effectiveTemplate, exportDialogOpen, needsCalibration, state.includeGuideBox, state.includeLabels, state.paddingMm]);

  const handleExportDownload = useCallback((filename: string, options: { uncalibratedOverride: boolean }) => {
    if (!exportPreview?.svg) return;
    const blob = new Blob([exportPreview.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setExportDialogOpen(false);
    setToast({
      message: options.uncalibratedOverride
        ? 'SVG exported without calibration. Test-cut a small piece before the real job.'
        : 'SVG exported.',
      tone: options.uncalibratedOverride ? 'warning' : 'success',
    });
  }, [exportPreview]);

  const notify = useCallback((message: string, tone: 'success' | 'warning' | 'error' | 'info') => {
    setToast({ message, tone });
  }, []);

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

  const applyProjectToEditor = useCallback((project: ReturnType<typeof parseRhinestoneProject>) => {
    // Loading replaces the whole design, so it uses the raw dispatch: the
    // "Regenerate from source settings?" prompt guards user edits, not loads.
    // A generated (non-editable) project must not open inside a leftover editable
    // session, which would keep showing the previous (possibly empty) stones.
    if (!project.editableState && project.generatorState.generatorId !== 'manual-editor') {
      dispatch({ type: 'DISCARD_EDITABLE_CHANGES' });
    }
    dispatch({ type: 'SET_PROJECT_NAME', name: project.projectName });
    dispatch({
      type: 'SET_PARTS',
      parts: (project.parts ?? []).map((part) => ({
        id: part.id,
        name: part.name,
        offsetX: part.offsetX,
        offsetY: part.offsetY,
        stones: part.stones.map((stone) => ({ id: stone.id, center: { x: stone.x, y: stone.y }, stoneSize: stone.stoneSize, holeDiameterMm: stone.holeDiameterMm })),
      })),
      workingOffset: project.workingOffset ?? { x: 0, y: 0 },
    });
    dispatch({ type: 'SET_DESIGN_STONE_COLOUR', colour: project.designStoneColour ?? null });

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

    switch (project.generatorState.generatorId) {
      case 'manual-grid':
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'grid' });
        dispatch({
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
        dispatch({
          type: 'UPDATE_TEXT_TOOL',
          updates: {
            mode: 'outline',
            text: project.generatorState.text,
            stoneSize: project.generatorState.stoneSize,
            outlineTextStyle: project.generatorState.outlineTextStyle ?? ((project.generatorState.coverageMode ?? project.generatorState.fillMode) === 'outline' ? 'outline' : 'filled-typography'),
            fontId: project.generatorState.fontId ?? LEGACY_OUTLINE_FONT_ID,
            fontSizeMm: project.generatorState.fontSizeMm,
            targetWidthMm: project.generatorState.targetWidthMm ?? '',
            targetHeightMm: project.generatorState.targetHeightMm ?? '',
            preserveAspectRatio: project.generatorState.preserveAspectRatio,
            align: project.generatorState.align,
            letterSpacingMm: project.generatorState.letterSpacingMm,
            lineSpacingMm: project.generatorState.lineSpacingMm,
            coverageMode: project.generatorState.coverageMode ?? project.generatorState.fillMode,
            fillMode: project.generatorState.fillMode,
            fillPattern: project.generatorState.fillPattern,
            placementPattern: project.generatorState.placementPattern ?? 'default',
            contourSettings: project.generatorState.contourSettings ?? state.textTool.contourSettings,
            radialSettings: project.generatorState.radialSettings ?? state.textTool.radialSettings,
            densityPreset: project.generatorState.densityPreset,
            customSpacingMm: project.generatorState.customSpacingMm,
          },
        });
        break;
      case 'dot-matrix-text':
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'text' });
        dispatch({
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
        dispatch({
          type: 'UPDATE_SVG_TOOL',
          updates: {
            assetKind: project.generatorState.assetKind ?? (project.generatorState.uploadedImageDataUrl ? 'image' : 'svg'),
            uploadedSvgText: project.generatorState.uploadedSvgText,
            svgFileName: project.generatorState.assetKind === 'svg' ? 'loaded.svg' : null,
            uploadedImageDataUrl: project.generatorState.uploadedImageDataUrl ?? null,
            imageFileName: project.generatorState.imageFileName ?? null,
            renderMode: project.generatorState.renderMode ?? ((project.generatorState.fillMode === 'fill' && (project.generatorState.placementPattern ?? 'default') === 'hexagonal') ? 'artwork-dots' : 'vector-layout'),
            stoneSize: project.generatorState.stoneSize,
            targetWidthMm: project.generatorState.targetWidthMm ?? '',
            targetHeightMm: project.generatorState.targetHeightMm ?? '',
            dimensionUnit: project.generatorState.dimensionUnit ?? 'mm',
            preserveAspectRatio: project.generatorState.preserveAspectRatio,
            coverageMode: project.generatorState.coverageMode ?? project.generatorState.fillMode,
            fillMode: project.generatorState.fillMode,
            fillPattern: project.generatorState.fillPattern,
            placementPattern: project.generatorState.placementPattern ?? 'default',
            contourSettings: project.generatorState.contourSettings ?? state.svgTool.contourSettings,
            radialSettings: project.generatorState.radialSettings ?? state.svgTool.radialSettings,
            layerRoles: project.generatorState.layerRoles ?? {},
            layerStoneColours: project.generatorState.layerStoneColours ?? {},
            densityPreset: project.generatorState.densityPreset,
            customSpacingMm: project.generatorState.customSpacingMm,
            imageColorCount: project.generatorState.imageColorCount ?? 1,
            imageThreshold: project.generatorState.imageThreshold ?? 128,
            imageDetail: project.generatorState.imageDetail ?? 128,
            imageInvert: project.generatorState.imageInvert ?? false,
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
      case 'rhinestone-font':
      case 'rhinestone-font-line':
      case 'rhinestone-font-digits':
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'rhinestone-font' });
        dispatch({
          type: 'UPDATE_RHINESTONE_FONT_TOOL',
          updates: {
            presentationMode: project.generatorState.presentationMode
              ?? (project.generatorState.generatorId === 'rhinestone-font-line'
                ? 'line'
                : project.generatorState.generatorId === 'rhinestone-font-digits'
                  ? 'digits'
                  : 'stones'),
            text: project.generatorState.text,
            rhinestoneFontId: project.generatorState.rhinestoneFontId,
            stoneSize: project.generatorState.stoneSize,
            letterSpacingMm: project.generatorState.letterSpacingMm,
            lineSpacingMm: project.generatorState.lineSpacingMm,
            unsupportedCharacters: [],
            warnings: [],
          },
        });
        break;
      case 'svg-alphabet':
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'svg-alphabet' });
        dispatch({
          type: 'UPDATE_SVG_ALPHABET_TOOL',
          updates: {
            text: project.generatorState.text,
            svgAlphabetId: project.generatorState.svgAlphabetId,
            stoneSize: project.generatorState.stoneSize,
            letterSpacingMm: project.generatorState.letterSpacingMm,
            lineSpacingMm: project.generatorState.lineSpacingMm,
            unsupportedCharacters: [],
            warnings: [],
          },
        });
        break;
      case 'letter-stencil':
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'letter-stencil' });
        dispatch({
          type: 'UPDATE_LETTER_STENCIL_TOOL',
          updates: {
            sourceType: project.generatorState.sourceType,
            text: project.generatorState.text,
            svgAlphabetId: project.generatorState.svgAlphabetId,
            rhinestoneFontId: project.generatorState.rhinestoneFontId,
            stoneSize: project.generatorState.stoneSize,
            cardPaddingMm: project.generatorState.cardPaddingMm,
            cardCornerRadiusMm: project.generatorState.cardCornerRadiusMm,
            minCardWidthMm: project.generatorState.minCardWidthMm,
            layoutMode: project.generatorState.layoutMode,
            cutSheetGapMm: project.generatorState.cutSheetGapMm,
            unsupportedCharacters: [],
            warnings: [],
          },
        });
        break;
      case 'template-import':
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'template-import' });
        dispatch({
          type: 'UPDATE_TEMPLATE_IMPORT_TOOL',
          updates: {
            uploadedSvgText: project.generatorState.uploadedSvgText,
            svgFileName: project.generatorState.svgFileName,
            pendingSvgText: null,
            pendingFileName: null,
            defaultStoneSize: project.generatorState.defaultStoneSize,
            detectedDiameters: project.generatorState.importMetadata?.detectedDiameters ?? [],
            detectedColors: project.generatorState.importMetadata?.detectedColors ?? [],
            ignoredElements: project.generatorState.importMetadata?.ignoredElements ?? 0,
            warnings: [],
            importSummary: project.generatorState.importMetadata ? `Imported ${project.generatorState.importMetadata.originalStoneCount} stones.` : null,
            importError: null,
          },
        });
        break;
      case 'manual-editor':
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'manual' });
        dispatch({ type: 'SET_TEMPLATE', template: null });
        break;
      default: {
        // Unreachable for any project that passed parseRhinestoneProject's
        // schema validation — this switch is exhaustive over the current
        // GeneratorProjectState union. Kept as defense-in-depth against a
        // future schema member added here without a matching case.
        const unhandled = project.generatorState as { generatorId: string };
        throw new Error(`Project type "${unhandled.generatorId}" is not yet supported in this editor.`);
      }
    }

    if (project.manualToolState) {
      dispatch({
        type: 'UPDATE_MANUAL_TOOL',
        updates: {
          snapToGrid: project.manualToolState.snapToGrid,
          gridSnapSize: project.manualToolState.gridSnapSize,
          addStoneSize: project.manualToolState.addStoneSize,
          interactionMode: project.manualToolState.interactionMode ?? 'place',
          assistBrushSizeMm: project.manualToolState.assistBrushSizeMm ?? 12,
        },
      });
    }

    if (project.activeTool) {
      dispatch({ type: 'SET_ACTIVE_TOOL', tool: project.activeTool });
    }

    if (project.editableState) {
      setTimeout(() => {
        const editableStones: EditableStone[] = project.editableState!.stones.map(savedStoneToEditableStone);
        dispatch({
          type: 'RESTORE_EDITABLE',
          stones: editableStones,
          sourceGenerator: project.generatorState.generatorId,
        });
        requestCanvasFit();
      }, 100);
    } else if (project.generatorState.generatorId === 'manual-editor') {
      const manualStones: EditableStone[] = project.generatorState.stones.map(savedStoneToEditableStone);
      setTimeout(() => {
        dispatch({
          type: 'RESTORE_EDITABLE',
          stones: manualStones,
          sourceGenerator: 'manual-editor',
        });
        requestCanvasFit();
      }, 0);
    }
  }, [requestCanvasFit, state.svgTool.contourSettings, state.svgTool.radialSettings, state.textTool.contourSettings, state.textTool.radialSettings]);

  useEffect(() => {
    const designId = searchParams.get('designId');
    const assetId = searchParams.get('asset');
    const fontId = searchParams.get('font');
    const launchText = searchParams.get('text');
    const toolParam = searchParams.get('tool');
    const launchTool = EDITOR_TOOLS.find((tool) => tool.id === toolParam)?.id ?? null;
    const queryKey = `${designId ?? ''}|${assetId ?? ''}|${fontId ?? ''}|${launchText ?? ''}|${launchTool ?? ''}`;

    if (queryKey === '||||') return;
    if (handledQueryRef.current === queryKey) return;

    const applyQueryIntent = async () => {
      if (launchTool && !designId && !assetId && !fontId) {
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: launchTool });
        handledQueryRef.current = queryKey;
        return;
      }

      if (designId && templateLibraryRepositoryRef.current) {
        const entry = await templateLibraryRepositoryRef.current.get(designId);
        if (entry) {
          const project = parseRhinestoneProject(JSON.stringify(entry.snapshot.project));
          applyProjectToEditor(project);
          setActiveLibraryTemplateId(entry.builtIn ? null : entry.templateId);
          handledQueryRef.current = queryKey;
          return;
        }
      }

      if (assetId) {
        const asset = findAssetById(assetId);
        if (asset) {
          if (asset.kind === 'svg') {
            const validation = validateAssetUpload({
              fileName: asset.fileName,
              mimeType: asset.mimeType,
              sizeBytes: asset.sizeBytes,
              svgText: asset.svgText,
            });
            if (!validation.valid) {
              setPendingDialog({
                kind: 'asset-open-error',
                title: 'This asset cannot be opened',
                message: validation.code === 'no_supported_shapes'
                  ? 'This SVG has no supported shapes for Rhinestone generation.'
                  : 'This file is not a valid SVG for Rhinestone generation.',
                details: ['Return to Library to upload a different asset, or retry opening this asset.'],
                confirmLabel: 'Back to Library',
                icon: 'warning',
                tertiaryAction: {
                  label: 'Retry open',
                  onClick: () => {
                    handledQueryRef.current = null;
                    setPendingDialog(null);
                    window.location.reload();
                  },
                },
              });
              handledQueryRef.current = queryKey;
              return;
            }
          }

          dispatch({ type: 'SET_PROJECT_NAME', name: asset.name });
          dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'svg' });
          dispatch({
            type: 'UPDATE_SVG_TOOL',
            updates: asset.kind === 'svg'
              ? {
                  assetKind: 'svg',
                  uploadedSvgText: asset.svgText,
                  svgFileName: asset.fileName,
                  uploadedImageDataUrl: null,
                  imageFileName: null,
                }
              : {
                  assetKind: 'image',
                  uploadedImageDataUrl: asset.sourceDataUrl,
                  imageFileName: asset.fileName,
                  uploadedSvgText: null,
                  svgFileName: null,
                },
          });
          handledQueryRef.current = queryKey;
          return;
        }
      }

      if (fontId) {
        const resolvedFontId = isAvailableOutlineFontId(fontId) ? fontId : DEFAULT_OUTLINE_FONT_ID;
        if (resolvedFontId !== fontId) {
          setToast({ message: 'Font not found — using a default font instead.', tone: 'warning' });
        }
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'text' });
        dispatch({ type: 'SET_PROJECT_NAME', name: `${(launchText ?? 'Preview').replace(/\s+/g, ' ').trim()} Rhinestone Design`, auto: true });
        dispatch({
          type: 'UPDATE_TEXT_TOOL',
          updates: {
            mode: 'outline',
            fontId: resolvedFontId,
            text: launchText ?? DEFAULT_PREVIEW_TEXT,
          },
        });
        handledQueryRef.current = queryKey;
      }
    };

    void applyQueryIntent();
  }, [applyProjectToEditor, searchParams]);

  const handleOpenLibrary = useCallback(() => {
    setTemplateLibraryOpen(true);
  }, []);

  const handleSaveToLibrary = useCallback(async () => {
    if (!effectiveTemplate) {
      setToast({ message: 'Nothing to save yet. Create or open a design first.', tone: 'warning' });
      return;
    }
    if (!templateLibraryRepositoryRef.current) {
      setToast({ message: 'Could not save: the current design could not be serialized.', tone: 'error' });
      return;
    }

    let entry = null;
    if (activeLibraryTemplateId) {
      const currentEntry = await templateLibraryRepositoryRef.current.get(activeLibraryTemplateId);
      if (currentEntry && !currentEntry.builtIn) {
        // The version being replaced is kept, so a save that turned out worse can be undone later.
        recordVersion(window.localStorage, currentEntry.templateId, {
          savedAt: currentEntry.updatedAt,
          name: currentEntry.name,
          stoneCount: currentEntry.stoneCount,
          projectJson: JSON.stringify(currentEntry.snapshot.project),
        });
        entry = buildCurrentLibraryEntry(currentEntry.templateId, currentEntry.name, currentEntry.createdAt, currentEntry.favorite);
      }
    }

    if (!entry) {
      const now = new Date().toISOString();
      entry = buildCurrentLibraryEntry(`library-${now}`, state.projectName, now, false);
    }

    if (!entry) {
      setToast({ message: 'Could not save: the current design could not be serialized.', tone: 'error' });
      return;
    }

    await templateLibraryRepositoryRef.current.save(entry);
    setActiveLibraryTemplateId(entry.templateId);
    await refreshTemplateLibrary();
    setToast({ message: activeLibraryTemplateId ? 'Saved to My Designs.' : 'Saved to My Designs. Find it under Open or on the My Designs page.', tone: 'success' });
  }, [activeLibraryTemplateId, buildCurrentLibraryEntry, effectiveTemplate, refreshTemplateLibrary, state.projectName]);

  const handleLoadFromLibrary = useCallback(async (templateId: string) => {
    if (!templateLibraryRepositoryRef.current) return;
    const entry = await templateLibraryRepositoryRef.current.get(templateId);
    if (!entry) {
      setToast({ message: 'That design could not be found.', tone: 'error' });
      return;
    }

    try {
      const project = parseRhinestoneProject(JSON.stringify(entry.snapshot.project));
      applyProjectToEditor(project);
      setActiveLibraryTemplateId(entry.builtIn ? null : entry.templateId);
      setTemplateLibraryOpen(false);
      setToast({ message: 'Design opened.', tone: 'success' });
    } catch (err) {
      setToast({ message: `This design could not be opened: ${err instanceof Error ? err.message.replace(/^\[Project\]\s*/, '') : 'unknown error'}`, tone: 'error' });
    }
  }, [applyProjectToEditor]);

  const handleLoadAutosave = useCallback((): boolean => {
    if (!autosaveEntry) return false;
    try {
      const project = parseRhinestoneProject(JSON.stringify(autosaveEntry.snapshot.project));
      applyProjectToEditor(project);
      setActiveLibraryTemplateId(null);
      setTemplateLibraryOpen(false);
      setToast({ message: 'Autosave opened.', tone: 'success' });
      return true;
    } catch (err) {
      // A saved session that cannot be read must never take the page down. Keep a copy of it (the next autosave
      // would overwrite it) and carry on with a fresh editor.
      try {
        globalThis.localStorage?.setItem(`${AUTOSAVE_STORAGE_KEY}-unreadable`, JSON.stringify(autosaveEntry));
      } catch {
        // storage full or blocked: nothing more to do
      }
      setToast({
        message: `Your last session could not be restored (${err instanceof Error ? err.message.replace(/^\[Project\]\s*/, '') : 'unknown error'}). A copy was kept.`,
        tone: 'error',
      });
      return false;
    }
  }, [AUTOSAVE_STORAGE_KEY, applyProjectToEditor, autosaveEntry]);

  // The first visit after a session was saved: say so in a toast (a banner row above the canvas pushed the whole
  // studio down after it loaded) and offer a clean start.
  const startFreshFromAutosave = useCallback(() => {
    globalThis.localStorage?.removeItem(AUTOSAVE_STORAGE_KEY);
    setAutosaveEntry(null);
    setAutosaveDecision('ready');
    resetToNewProject();
    setToast({ message: 'Started fresh.', tone: 'info' });
  }, [AUTOSAVE_STORAGE_KEY, resetToNewProject]);

  useEffect(() => {
    if (autosaveDecision !== 'restored' || !autosaveEntry || initialAutosaveRestoreRef.current) return;
    initialAutosaveRestoreRef.current = true;
    if (handleLoadAutosave()) {
      queueMicrotask(() => setToast({
        message: 'Restored your last session.',
        tone: 'info',
        action: { label: 'Start fresh', onClick: startFreshFromAutosave },
      }));
    }
  }, [autosaveDecision, autosaveEntry, handleLoadAutosave, startFreshFromAutosave]);

  const handleDialogConfirm = useCallback(() => {
    if (!pendingDialog) return;

    if (pendingDialog.kind === 'new-project') {
      resetToNewProject();
      setToast({ message: 'Started a new project.', tone: 'info' });
    }

    if (pendingDialog.kind === 'export-blocked') {
      setPendingDialog(null);
      return;
    }

    if (pendingDialog.kind === 'autosave-restore') {
      handleLoadAutosave();
    }

    if (pendingDialog.kind === 'asset-open-error') {
      window.location.assign('/library');
    }

    setPendingDialog(null);
  }, [handleLoadAutosave, pendingDialog, resetToNewProject]);

  const handleFavoriteLibraryEntry = useCallback(async (templateId: string, favorite: boolean) => {
    if (!templateLibraryRepositoryRef.current) return;
    await templateLibraryRepositoryRef.current.favorite(templateId, favorite);
    await refreshTemplateLibrary();
  }, [refreshTemplateLibrary]);

  const handleDeleteLibraryEntry = useCallback(async (templateId: string) => {
    const repository = templateLibraryRepositoryRef.current;
    if (!repository) return;
    const entry = await repository.get(templateId);
    await repository.delete(templateId);
    removeVersions(window.localStorage, templateId);
    await refreshTemplateLibrary();
    setToast({
      message: entry ? `Deleted “${entry.name}”.` : 'Design deleted.',
      tone: 'info',
      action: entry
        ? {
            label: 'Undo',
            onClick: () => {
              void (async () => {
                await repository.save(entry);
                await refreshTemplateLibrary();
                setToast({ message: `Restored “${entry.name}”.`, tone: 'success' });
              })();
            },
          }
        : undefined,
    });
  }, [refreshTemplateLibrary]);

  const handleRenameLibraryEntry = useCallback(async (templateId: string) => {
    const entry = await templateLibraryRepositoryRef.current?.get(templateId);
    if (!entry) return;
    setNamePrompt({ mode: 'rename', templateId, initialValue: entry.name });
  }, []);

  const handleDuplicateLibraryEntry = useCallback(async (templateId: string) => {
    const entry = await templateLibraryRepositoryRef.current?.get(templateId);
    if (!entry) return;
    setNamePrompt({ mode: 'duplicate', templateId, initialValue: `${entry.name} copy` });
  }, []);

  const submitNamePrompt = useCallback(async (nextName: string) => {
    const prompt = namePrompt;
    const repository = templateLibraryRepositoryRef.current;
    setNamePrompt(null);
    if (!prompt || !repository) return;

    if (prompt.mode === 'rename') {
      await repository.rename(prompt.templateId, nextName);
      await refreshTemplateLibrary();
      setToast({ message: 'Design renamed.', tone: 'success' });
      return;
    }

    const nextTemplateId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? `library-${crypto.randomUUID()}`
      : `library-${Date.now()}`;

    if (activeLibraryTemplateId === prompt.templateId) {
      const duplicate = buildCurrentLibraryEntry(nextTemplateId, nextName, new Date().toISOString(), false);
      if (duplicate) {
        await repository.save(duplicate);
      }
    } else {
      await repository.duplicate(prompt.templateId, nextTemplateId, nextName);
    }

    await refreshTemplateLibrary();
    setToast({ message: 'Design duplicated.', tone: 'success' });
  }, [activeLibraryTemplateId, buildCurrentLibraryEntry, namePrompt, refreshTemplateLibrary]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = ''; // Reset for re-loading same file

    void readProjectFile(file)
      .then((project) => {
        applyProjectToEditor(project);
        setToast({ message: 'Project opened.', tone: 'success' });
      })
      .catch((err) => {
        setToast({ message: `Invalid project file: ${err instanceof Error ? err.message : String(err)}`, tone: 'error' });
      });
  }, [applyProjectToEditor]);

  const handleSaveProject = useCallback(() => {
    if (!effectiveTemplate) {
      setToast({ message: 'Nothing to export yet. Create or open a design first.', tone: 'warning' });
      return;
    }

    const project = buildProjectFileFromEditorState(state);
    if (!project) {
      setToast({ message: 'Project export failed because the current editor state could not be serialized.', tone: 'error' });
      return;
    }

    const filename = buildProjectFilename(state.projectName);
    downloadProject(project, filename);
    setToast({ message: 'Project file downloaded. Keep it as a backup or share it.', tone: 'success' });
  }, [effectiveTemplate, state]);

  const handleExport = useCallback(() => {
    const gate = getExportGate(Boolean(effectiveTemplate), exportStatusSummary);

    if (gate === 'no-design') {
      setToast({ message: 'Export unavailable because the design is empty.', tone: 'warning' });
      return;
    }

    if (gate === 'blocked-design-errors') {
      setPendingDialog({
        kind: 'export-blocked',
        title: 'Fix errors before export',
        message: 'This design has critical export issues. Resolve them before exporting to SVG.',
        details: exportStatusSummary.designErrors
          .slice(0, 4)
          .map((issue) => issue.suggestion ? `${issue.message} Suggestion: ${issue.suggestion}` : issue.message),
        confirmLabel: 'Review issues',
        confirmTone: 'default',
        icon: 'warning',
        tertiaryAction: hasSpacingIssues(exportReadiness)
          ? { label: overlapEnlargement ? `Enlarge ×${overlapEnlargement.scale.toFixed(1)} to make cuttable` : 'Fix spacing automatically', onClick: () => { setPendingDialog(null); handleAutoFixSpacing(); } }
          : undefined,
      });
      return;
    }

    // Ready, warnings-only and "needs calibration" all go through the export dialog,
    // which previews the file and shows size, mat fit, warnings and calibration state.
    setExportDialogOpen(true);
  }, [effectiveTemplate, exportReadiness, exportStatusSummary, handleAutoFixSpacing, overlapEnlargement]);

  // A design opened from a share link: unpacked here, on this computer, and opened as a copy of its own (not saved until the
  // user saves it). The address is cleaned afterwards so reloading does not open it again over later work.
  const shareHandledRef = useRef(false);
  useEffect(() => {
    const payload = readSharePayload(window.location.hash);
    if (!payload || shareHandledRef.current) return;
    shareHandledRef.current = true;
    void decodeSharePayload(payload)
      .then((json) => {
        applyProjectToEditor(parseRhinestoneProject(json));
        setActiveLibraryTemplateId(null);
        setToast({ message: 'Opened a shared design. It is a copy: save it to keep it.', tone: 'success' });
      })
      .catch((error: unknown) => {
        setToast({ message: error instanceof Error ? error.message : 'The shared design could not be opened.', tone: 'error' });
      })
      .finally(() => window.history.replaceState(null, '', window.location.pathname + window.location.search));
  }, [applyProjectToEditor]);

  const handleOpenSetup = useCallback(() => {
    // Navigate to setup page
    window.location.href = '/setup';
  }, []);

  // ─── Keyboard shortcuts (tools, view, save/export, nudge) ──────────────────
  // Undo/redo, copy/paste, delete, select-all, duplicate, Esc and Space-pan live in EditorCanvas.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isKeyHandlingWidget(event.target) || isModalOpen()) return;
      const shortcut = resolveStudioShortcut(event, {
        tools: true,
        nudgeStepMm: RHINESTONE_NUDGE_STEP_MM,
        nudgeShiftStepMm: RHINESTONE_NUDGE_SHIFT_STEP_MM,
      });
      if (!shortcut) return;

      switch (shortcut.type) {
        case 'tool':
          event.preventDefault();
          dispatch({ type: 'SET_ACTIVE_TOOL', tool: shortcut.tool });
          return;
        case 'fit':
          event.preventDefault();
          requestCanvasFit();
          return;
        case 'zoom-in':
        case 'zoom-out':
        case 'zoom-reset': {
          event.preventDefault();
          const zoom = shortcut.type === 'zoom-reset'
            ? 1
            : shortcut.type === 'zoom-in'
              ? Math.min(state.canvas.zoom * 1.2, MAX_CANVAS_ZOOM)
              : Math.max(state.canvas.zoom / 1.2, MIN_CANVAS_ZOOM);
          const view = shortcut.type === 'zoom-reset'
            ? { zoom, panX: 0, panY: 0 }
            : { zoom, panX: state.canvas.panX, panY: state.canvas.panY };
          dispatch({ type: 'UPDATE_CANVAS', updates: view });
          persistManualCanvasView(view);
          return;
        }
        case 'export':
          event.preventDefault();
          handleExport();
          return;
        case 'save':
          event.preventDefault();
          void handleSaveToLibrary();
          return;
        case 'nudge': {
          const { isEditable, stones } = state.editableTemplate;
          if (!isEditable || state.selectedStoneIds.size === 0) return;
          event.preventDefault();
          const selected = stones
            .filter((stone) => state.selectedStoneIds.has(stone.id))
            .map((stone) => ({ id: stone.id, x: stone.center.x, y: stone.center.y }));
          dispatch({ type: 'MOVE_STONES', moves: nudgeCenters(selected, shortcut.dx, shortcut.dy) });
          return;
        }
        case 'help':
          return; // handled by <KeyboardShortcutsHost>
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    state.canvas.zoom, state.canvas.panX, state.canvas.panY, state.editableTemplate, state.selectedStoneIds,
    requestCanvasFit, persistManualCanvasView, handleExport, handleSaveToLibrary,
  ]);

  // ─── Canvas Click Handler ──────────────────────────────────────────────────

  // ─── Render ────────────────────────────────────────────────────────────────

  if (autosaveDecision === 'deciding') {
    return (
      <div data-theme={theme} className="flex h-full min-h-0 flex-1 items-center justify-center bg-[var(--studio-bg)] text-sm text-[var(--studio-ink-muted)]">
        {t('Loading your workspace…')}
      </div>
    );
  }

  return (
    <div data-theme={theme} className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--studio-bg)] text-[var(--studio-ink)]">
      {/* Hidden file input for Open Project */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.rhinestone.json,application/json"
        onChange={handleFileChange}
        className="hidden"
      />

      <KeyboardShortcutsHost studio="rhinestone" />
      <EditorTopbar
        projectName={state.projectName}
        canUndo={state.history.past.length > 0}
        canRedo={state.history.future.length > 0}
        canExport={Boolean(effectiveTemplate)}
        canPreviewGarment={Boolean(effectiveTemplate) && (effectiveTemplate?.stones.length ?? 0) > 0}
        exportReady={exportReady}
        exportErrorCount={exportErrorCount}
        exportWarningCount={exportWarningCount}
        needsCalibration={needsCalibration}
        recentDesigns={libraryRecord.userTemplates.slice(0, 5).map((entry) => ({ id: entry.templateId, name: entry.name }))}
        designSurface={designSurface}
        dispatch={dispatch}
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProject}
        onOpenRecent={(id) => void handleLoadFromLibrary(id)}
        onSave={() => void handleSaveToLibrary()}
        onExportProjectFile={handleSaveProject}
        onOpenLibrary={handleOpenLibrary}
        onExport={handleExport}
        onOpenSetup={handleOpenSetup}
        onOpenGarmentPreview={() => setGarmentPreviewOpen(true)}
        onToggleDesignSurface={(surface) => {
          setDesignSurface(surface);
          setGarmentPreviewOpen(surface === 'garment');
        }}
        theme={theme}
        onToggleTheme={toggleTheme}
      />


      <GarmentPreviewPanel
        open={garmentPreviewOpen}
        template={effectiveTemplate}
        onClose={() => { setGarmentPreviewOpen(false); setDesignSurface('canvas'); }}
      />

      <TemplateLibraryPanel
        open={templateLibraryOpen}
        autosaveEntry={autosaveEntry}
        builtInEntries={libraryRecord.builtInTemplates}
        userEntries={libraryRecord.userTemplates}
        onClose={() => setTemplateLibraryOpen(false)}
        onSaveCurrent={handleSaveToLibrary}
        onLoad={handleLoadFromLibrary}
        onLoadAutosave={handleLoadAutosave}
        onFavorite={handleFavoriteLibraryEntry}
        onDelete={handleDeleteLibraryEntry}
        onRename={handleRenameLibraryEntry}
        onDuplicate={handleDuplicateLibraryEntry}
      />

      <PromptDialog
        open={namePrompt !== null}
        title={namePrompt?.mode === 'duplicate' ? 'Duplicate design' : 'Rename design'}
        label={namePrompt?.mode === 'duplicate' ? 'Name of the copy' : 'Design name'}
        initialValue={namePrompt?.initialValue ?? ''}
        confirmLabel={namePrompt?.mode === 'duplicate' ? 'Duplicate' : 'Rename'}
        onSubmit={(value) => { void submitNamePrompt(value); }}
        onCancel={() => setNamePrompt(null)}
      />

      <EditorDialog
        open={Boolean(pendingGeneratorAction)}
        title={t('Regenerate from source settings?')}
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

      <ExportDialog
        open={exportDialogOpen}
        title={t('Export SVG')}
        svg={exportPreview?.svg ?? null}
        error={exportPreview?.error ?? null}
        widthMm={exportPreview?.widthMm ?? null}
        heightMm={exportPreview?.heightMm ?? null}
        summaryRows={[
          { label: 'Stones', value: String(effectiveTemplate?.stones.length ?? 0) },
          { label: 'Cutter', value: exportReadiness?.summary.cutter ?? '—' },
        ]}
        notes={exportDesignWarningNotes}
        calibration={{ needsCalibration, onCalibrate: handleOpenSetup, perSize: calibrationBySize }}
        defaultFilename={getExportFilename(state.projectName, false).replace(/\.svg$/, '')}
        onDownload={handleExportDownload}
        onClose={() => setExportDialogOpen(false)}
      >
        {(gate) => {
          if (!effectiveTemplate) return null;
          const svgOptions = {
            includeGuideBox: state.includeGuideBox,
            includeLabels: state.includeLabels,
            paddingMm: state.paddingMm,
            decimalPlaces: 3,
            uncalibratedOverride: needsCalibration,
          };
          const filenameBase = getExportFilename(state.projectName, false).replace(/\.svg$/, '');
          const doesNotFit = exportPreview?.widthMm != null && exportPreview.heightMm != null
            && getMatFit(exportPreview.widthMm, exportPreview.heightMm).status !== 'fits-12x12';
          return (
            <>
              {doesNotFit && (
                <SplitExportPanel
                  template={effectiveTemplate}
                  svgOptions={svgOptions}
                  designName={state.projectName.trim() || 'Rhinestone design'}
                  filenameBase={filenameBase}
                  downloadAllowed={gate.downloadAllowed}
                  uncalibrated={gate.uncalibrated}
                  onDownloaded={(message) => setToast({ message, tone: gate.uncalibrated ? 'warning' : 'success' })}
                />
              )}
              <SharePanel getProjectJson={() => { const project = buildProjectFileFromEditorState(state); return project ? JSON.stringify(project) : null; }} onDone={(message, tone) => setToast({ message, tone })} />
              <DesignSpaceGuide widthMm={exportPreview?.widthMm ?? null} heightMm={exportPreview?.heightMm ?? null} />
              <MoreFormatsPanel
                template={effectiveTemplate}
                paddingMm={state.paddingMm}
                filenameBase={filenameBase}
                downloadAllowed={gate.downloadAllowed}
                uncalibrated={gate.uncalibrated}
                onDownloaded={(message) => setToast({ message, tone: gate.uncalibrated ? 'warning' : 'success' })}
              />
              <TestPatchPanel
                template={effectiveTemplate}
                svgOptions={svgOptions}
                filenameBase={filenameBase}
                downloadAllowed={gate.downloadAllowed}
                uncalibrated={gate.uncalibrated}
                onDownloaded={(message) => setToast({ message, tone: gate.uncalibrated ? 'warning' : 'success' })}
              />
            </>
          );
        }}
      </ExportDialog>

      <EditorDialog
        open={Boolean(pendingDialog)}
        title={pendingDialog?.title ?? ''}
        description={pendingDialog?.message ?? ''}
        details={pendingDialog?.details}
        confirmLabel={pendingDialog?.confirmLabel ?? 'Confirm'}
        onConfirm={handleDialogConfirm}
        onCancel={() => setPendingDialog(null)}
        tone={pendingDialog?.confirmTone ?? 'default'}
        icon={pendingDialog?.icon ?? 'info'}
        tertiaryAction={pendingDialog?.tertiaryAction}
      />

      {toast && (
        <div className="absolute bottom-20 right-4 z-30 max-lg:bottom-32 max-lg:left-4">
          <EditorToast
            message={toast.message}
            tone={toast.tone}
            action={toast.action}
            onDismiss={() => setToast(null)}
          />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--studio-bg)] lg:flex-row">
        <StudioToolRail
          activeTool={state.activeTool}
          mobileOpen={mobilePanel === 'tools'}
          onSelectTool={(tool) => {
            dispatch({ type: 'SET_ACTIVE_TOOL', tool });
            // On a phone, picking a tool opens that tool's settings (or the inspector for Select).
            setMobilePanel(tool === 'select' ? 'inspect' : 'design');
          }}
        />

        <main id="main-content" tabIndex={-1} aria-label={t('Canvas')} className="relative order-1 flex min-h-[58vh] min-w-0 flex-1 flex-col bg-[var(--studio-surface)] max-lg:min-h-0 lg:order-none lg:min-h-0">
          <h1 className="sr-only">{t('Rhinestone Studio')}</h1>
          {/* With a panel open on a phone the canvas needs every pixel, so the guide and the hint strip step aside. */}
          {!(isMobile && mobilePanel !== 'none') && (
            <>
              <GettingStartedGuide />
              <CanvasActionStrip
                activeTool={state.activeTool}
                hasTemplate={Boolean(effectiveTemplate)}
                isEditable={state.editableTemplate.isEditable}
                dispatch={editorDispatch}
              />
            </>
          )}
          <EditorCanvas
            artworkSource={artworkInfo?.source ?? null}
            state={state}
            dispatch={editorDispatch}
            onNotify={notify}
            fitRequestId={fitRequestId}
            onManualViewChange={persistManualCanvasView}
          />
          {state.activeTool === 'text' && state.textTool.text.trim() === '' && !effectiveTemplate && (
            <EmptyCanvasPrompt onText={(text) => dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { text } })} />
          )}
        </main>

        <StudioContextPanel
          state={state}
          dispatch={editorDispatch}
          outlineFontStatus={outlineFontStatus}
          artworkInfo={artworkInfo}
          exportReadiness={exportReadiness}
          stones={effectiveTemplate?.stones}
          onQuickFix={handleQuickFix}
          canResize={canResize}
          overlapEnlargement={overlapEnlargement ? { scale: overlapEnlargement.scale, widthMm: overlapEnlargement.widthMm } : null}
          mobilePanel={mobilePanel}
        />
      </div>

      <EditorStatusBar
        template={effectiveTemplate}
        canvas={state.canvas}
        exportReady={exportReady}
        exportErrorCount={exportErrorCount}
        exportWarningCount={exportWarningCount}
        needsCalibration={needsCalibration}
        spacingAdjustmentNote={spacingAdjustmentNote}
        isEditable={state.editableTemplate.isEditable}
        autosaveUpdatedAt={autosaveEntry?.updatedAt ?? null}
        activeLibraryName={activeLibraryEntry?.name ?? null}
        onReportProblem={() => setReportOpen(true)}
        onShowVersions={activeLibraryTemplateId ? () => setVersionsOpen(true) : undefined}
      />
      <VersionHistoryDialog
        open={versionsOpen && activeLibraryTemplateId !== null}
        onClose={() => setVersionsOpen(false)}
        designName={activeLibraryEntry?.name ?? 'this design'}
        versions={versionsOpen && activeLibraryTemplateId ? readVersions(window.localStorage, activeLibraryTemplateId) : []}
        now={new Date()}
        onRestore={(version) => {
          if (!activeLibraryTemplateId) return;
          try {
            const project = parseRhinestoneProject(version.projectJson);
            // What is open now is kept as a version first, so going back is never a loss.
            const current = buildProjectFileFromEditorState(state);
            if (current) {
              recordVersion(window.localStorage, activeLibraryTemplateId, {
                savedAt: new Date().toISOString(),
                name: state.projectName,
                stoneCount: effectiveTemplate?.stones.length ?? 0,
                projectJson: JSON.stringify(current),
              });
            }
            applyProjectToEditor(project);
            setVersionsOpen(false);
            setToast({ message: 'Went back to that version. Save to keep it.', tone: 'success' });
          } catch {
            setToast({ message: 'That version could not be opened.', tone: 'error' });
          }
        }}
      />
      <ReportProblemDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        getDesignJson={() => {
          const project = buildProjectFileFromEditorState(state);
          return project ? JSON.stringify(project) : null;
        }}
      />

      <MobileStudioBar
        items={[
          {
            id: 'tools',
            label: EDITOR_TOOLS.find((tool) => tool.id === railToolFor(state.activeTool))?.label ?? 'Tools',
            icon: EDITOR_TOOLS.find((tool) => tool.id === railToolFor(state.activeTool))?.icon ?? Wrench,
            active: mobilePanel === 'tools',
            onSelect: () => setMobilePanel((current) => (current === 'tools' ? 'none' : 'tools')),
          },
          {
            id: 'design',
            label: 'Design',
            icon: SlidersHorizontal,
            active: mobilePanel === 'design',
            onSelect: () => setMobilePanel((current) => (current === 'design' ? 'none' : 'design')),
          },
          {
            id: 'inspect',
            label: 'Inspect',
            icon: ScanSearch,
            active: mobilePanel === 'inspect',
            onSelect: () => setMobilePanel((current) => (current === 'inspect' ? 'none' : 'inspect')),
          },
          {
            id: 'export',
            label: 'Export',
            icon: Download,
            primary: true,
            disabled: !effectiveTemplate,
            onSelect: handleExport,
          },
        ]}
      />
    </div>
  );
}

type MobilePanel = 'none' | 'tools' | 'design' | 'inspect';

function StudioToolRail({
  activeTool,
  mobileOpen,
  onSelectTool,
}: {
  activeTool: typeof DEFAULT_EDITOR_STATE.activeTool;
  /** Phones/tablets: the Tools tab is open, so the rail shows as a grid under the canvas. */
  mobileOpen: boolean;
  onSelectTool: (tool: typeof DEFAULT_EDITOR_STATE.activeTool) => void;
}) {
  const t = useT();
  return (
    <nav
      className={`order-2 shrink-0 border-[var(--studio-border)] bg-[var(--studio-well)] max-lg:max-h-[44dvh] max-lg:overflow-y-auto max-lg:border-t max-lg:p-3 ${mobileOpen ? 'max-lg:grid max-lg:grid-cols-3 max-lg:gap-2 sm:max-lg:grid-cols-5' : 'max-lg:hidden'} lg:order-none lg:flex lg:h-full lg:w-[68px] lg:flex-col lg:gap-1 lg:border-r lg:px-1.5 lg:py-2`}
      aria-label={t('Studio tools')}
    >
      {RAIL_TOOLS.map((tool) => {
        const Icon = tool.icon;
        const active = railToolFor(activeTool) === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => onSelectTool(tool.id)}
            title={tool.description}
            aria-label={tool.label}
            aria-pressed={active}
            className={`flex min-h-16 flex-col items-center justify-center rounded-md px-2 py-2 text-xs transition lg:min-h-0 ${active ? 'bg-violet-500/35 text-white shadow-sm' : 'text-[var(--studio-ink-muted)] hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]'}`}
          >
            <Icon className="h-5 w-5 lg:h-4 lg:w-4" />
            <span className="mt-1 truncate">{tool.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── Tabbed context panel ───────────────────────────────────────────────────

import type { ExportReadinessResult } from '@/src/lib/rhinestone-engine/index';
import { useT } from '../lib/i18n';
function StudioContextPanel({
  state,
  dispatch,
  outlineFontStatus,
  artworkInfo,
  exportReadiness,
  stones,
  onQuickFix,
  canResize,
  overlapEnlargement,
  mobilePanel,
}: {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  outlineFontStatus: OutlineFontStatus;
  artworkInfo: ArtworkInfo | null;
  exportReadiness: ExportReadinessResult | null;
  stones?: ReadonlyArray<{ stoneSize: import('@/src/lib/rhinestone-engine/index').StoneSizeId }>;
  onQuickFix: (action: import('./quickFixItems').QuickFixAction) => void;
  canResize: boolean;
  overlapEnlargement: { scale: number; widthMm: number } | null;
  /** Phones/tablets: which bottom-bar panel is open. `'none'` on desktop, where both tabs are visible. */
  mobilePanel: 'none' | 'tools' | 'design' | 'inspect';
}) {
  const t = useT();
  // Auto-switch: Inspect when select tool is active, Design (source settings) for generators.
  const autoTab = state.activeTool === 'select' ? 'inspector' : 'source';
  const [manualTab, setManualTab] = useState<'source' | 'inspector' | null>(null);
  const [prevTool, setPrevTool] = useState(state.activeTool);
  if (prevTool !== state.activeTool) {
    setPrevTool(state.activeTool);
    setManualTab(null);
  }
  // On a phone the bottom bar picks the tab; on desktop the tab strip does.
  const isMobile = useIsMobileStudio();
  const tab = isMobile && mobilePanel === 'design' ? 'source' : isMobile && mobilePanel === 'inspect' ? 'inspector' : (manualTab ?? autoTab);
  const mobileVisible = mobilePanel === 'design' || mobilePanel === 'inspect';

  return (
    <aside aria-label={t('Design and inspector')} className={`order-2 min-h-0 w-full shrink-0 flex-col overflow-hidden border-t border-[var(--studio-border)] max-lg:h-[44dvh] ${mobileVisible ? 'max-lg:flex' : 'max-lg:hidden'} lg:order-none lg:flex lg:h-full lg:max-h-none lg:w-[260px] lg:border-l lg:border-t-0`}>
      {/* Tabs */}
      <div role="tablist" aria-label={t('Panel')} className="flex shrink-0 border-b max-lg:hidden border-[var(--studio-border)] bg-[var(--studio-well)]">
        {(['source', 'inspector'] as const).map((t) => (
          <button
            key={t}
            id={`studio-tab-${t}`}
            role="tab"
            aria-selected={tab === t}
            aria-controls="studio-panel"
            onClick={() => setManualTab(t === autoTab ? null : t)}
            className={`flex-1 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${tab === t ? 'border-b-2 border-violet-400 bg-[var(--studio-surface)] text-violet-300' : 'text-[var(--studio-ink-muted)] hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]'}`}
          >
            {t === 'source' ? 'Design' : 'Inspect'}
          </button>
        ))}
      </div>
      {/* Panel content */}
      <div id="studio-panel" role="tabpanel" aria-labelledby={`studio-tab-${tab}`} className="min-h-0 flex-1 overflow-hidden">
        <EditorPropertiesPanel
          state={state}
          dispatch={dispatch}
          mode={tab}
          outlineFontStatus={outlineFontStatus}
          artworkInfo={artworkInfo}
          exportReadiness={tab === 'inspector' ? exportReadiness : null}
          stones={tab === 'inspector' ? stones : undefined}
          onQuickFix={onQuickFix}
          canResize={canResize}
          overlapEnlargement={overlapEnlargement}
        />
      </div>
    </aside>
  );
}

// ─── Canvas action strip ────────────────────────────────────────────────────

function CanvasActionStrip({
  activeTool,
  hasTemplate,
  isEditable,
  dispatch,
}: {
  activeTool: EditorState['activeTool'];
  hasTemplate: boolean;
  isEditable: boolean;
  dispatch: React.Dispatch<EditorAction>;
}) {
  const hint = getCanvasHint(activeTool);

  const primaryAction = !hasTemplate
    ? null
    : !isEditable && activeTool !== 'select' && activeTool !== 'manual'
      ? { label: 'Edit stones', onClick: () => dispatch({ type: 'CONVERT_TO_EDITABLE' }) }
      : null;

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-1.5">
      <p className="min-w-0 truncate text-xs text-[var(--studio-ink-muted)]">{hint}</p>
      {primaryAction && (
        <button
          onClick={primaryAction.onClick}
          className="shrink-0 rounded-md border border-violet-400/30 bg-violet-500/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-violet-300 transition hover:bg-violet-500/25"
        >
          {primaryAction.label}
        </button>
      )}
    </div>
  );
}
