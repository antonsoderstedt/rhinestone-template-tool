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
  createOutlineTextTemplateAsync,
  createDotMatrixTextTemplate,
  svgStringToPolylines,
  createPolylineFilledRhinestoneTemplate,
  scalePolylinesToFit,
  checkExportReadiness,
  createTemplateLibraryEntry,
  parseRhinestoneProject,
  serializeRhinestoneProject,
  createBasicSvgExport,
  LEGACY_OUTLINE_FONT_ID,
  LocalStorageTemplateLibraryRepository,
  createRhinestoneFontTemplate,
  createSvgAlphabetTemplate,
  createLetterStencilTemplate,
  createRasterArtworkTemplate,
  defaultSvgAlphabetGlyphLoader,
  createImportedTemplate,
  TRW_STONE_SIZE_CALIBRATION,
} from '@/src/lib/rhinestone-engine/index';
import type {
  TemplateLibraryEntry,
  TemplateLibraryRecord,
  TemplateLibraryRepository,
} from '@/src/lib/rhinestone-engine/index';
import EditorTopbar from './EditorTopbar';
import EditorCanvas from './EditorCanvas';
import EditorPropertiesPanel from './EditorPropertiesPanel';
import EditorStatusBar from './EditorStatusBar';
import EditorDialog from './EditorDialog';
import EditorToast from './EditorToast';
import TemplateLibraryPanel from './TemplateLibraryPanel';
import GarmentPreviewPanel from '../components/GarmentPreviewPanel';
import {
  resolveGeneratorMutationDecision,
  shouldPromptForGeneratorMutation,
} from './generatorChangePolicy';
import { getCanvasHint, getSourcePanelTool } from './editorUi';
import {
  buildEffectiveTemplate,
  buildProjectFileFromEditorState,
  savedStoneToEditableStone,
} from './projectPersistence';
import { decodeRasterImageDataUrl } from '../lib/rasterImageDecode';

export default function EditorShell() {
  const AUTOSAVE_STORAGE_KEY = 'rhinestone-template-library-autosave';
  const [state, dispatch] = useReducer(editorReducer, DEFAULT_EDITOR_STATE);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateLibraryRepositoryRef = useRef<TemplateLibraryRepository | null>(null);
  const generationRequestRef = useRef(0);
  const [pendingGeneratorAction, setPendingGeneratorAction] = useState<EditorAction | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'warning' | 'error' | 'info' } | null>(null);
  const [templateLibraryOpen, setTemplateLibraryOpen] = useState(false);
  const [garmentPreviewOpen, setGarmentPreviewOpen] = useState(false);
  const [activeLibraryTemplateId, setActiveLibraryTemplateId] = useState<string | null>(null);
  const [autosaveEntry, setAutosaveEntry] = useState<TemplateLibraryEntry | null>(null);
  const [hasPromptedAutosaveRestore, setHasPromptedAutosaveRestore] = useState(false);
  const [libraryRecord, setLibraryRecord] = useState<TemplateLibraryRecord>({ version: 1, builtInTemplates: [], userTemplates: [] });
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
        kind: 'new-project' | 'export-warning' | 'autosave-restore';
        title: string;
        message: string;
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

  useEffect(() => {
    if (!toast) return;
    const timeoutId = window.setTimeout(() => setToast(null), toast.tone === 'error' ? 5000 : 3200);
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
    if (!rawAutosave) return;
    const timeoutId = window.setTimeout(() => {
      try {
        setAutosaveEntry(JSON.parse(rawAutosave) as TemplateLibraryEntry);
      } catch {
        setAutosaveEntry(null);
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refreshTemplateLibrary]);

  useEffect(() => {
    if (!autosaveEntry || hasPromptedAutosaveRestore) return;
    if (state.projectName !== DEFAULT_EDITOR_STATE.projectName) return;
    if (state.template || state.editableTemplate.isEditable) return;

    const timeoutId = window.setTimeout(() => {
      setPendingDialog({
        kind: 'autosave-restore',
        title: 'Restore autosave?',
        message: `A recent autosave for "${autosaveEntry.name}" is available in this browser. Restore it now or discard it.`,
        confirmLabel: 'Restore autosave',
        icon: 'info',
        tertiaryAction: {
          label: 'Discard autosave',
          tone: 'destructive',
          onClick: () => {
            globalThis.localStorage?.removeItem(AUTOSAVE_STORAGE_KEY);
            setAutosaveEntry(null);
            setPendingDialog(null);
            setToast({ message: 'Autosave discarded.', tone: 'info' });
          },
        },
      });
      setHasPromptedAutosaveRestore(true);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [autosaveEntry, hasPromptedAutosaveRestore, state.editableTemplate.isEditable, state.projectName, state.template]);

  // ─── Template Generation ───────────────────────────────────────────────────

  const sourceTool = useMemo(() => getSourcePanelTool(state), [state]);

  /**
   * Generate template based on active tool and its state.
   * This runs whenever tool state changes.
   */
  useEffect(() => {
    const requestId = ++generationRequestRef.current;

    const generateTemplate = async () => {
      try {
        let template = null;

        switch (sourceTool) {
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
            setOutlineFontStatus((current) => current.status === 'idle' ? current : { status: 'idle', message: null, fontId: state.textTool.fontId });
            break;

          case 'text':
            if (state.textTool.text.trim()) {
              if (state.textTool.mode === 'outline') {
                const usesBundledFont = state.textTool.fontId !== LEGACY_OUTLINE_FONT_ID;
                setOutlineFontStatus({
                  status: usesBundledFont ? 'loading' : 'idle',
                  message: usesBundledFont ? 'Loading font geometry…' : null,
                  fontId: state.textTool.fontId,
                });
                template = await createOutlineTextTemplateAsync({
                  id: 'text-outline-preview',
                  name: 'Text Outline Preview',
                  text: state.textTool.text,
                  stoneSize: state.textTool.stoneSize,
                  outlineTextStyle: state.textTool.outlineTextStyle,
                  fontId: state.textTool.fontId,
                  fontSizeMm: typeof state.textTool.fontSizeMm === 'number' ? state.textTool.fontSizeMm : 25,
                  align: state.textTool.align,
                  letterSpacingMm: typeof state.textTool.letterSpacingMm === 'number' ? state.textTool.letterSpacingMm : 0,
                  lineSpacingMm: typeof state.textTool.lineSpacingMm === 'number' ? state.textTool.lineSpacingMm : 10,
                  targetWidthMm: typeof state.textTool.targetWidthMm === 'number' ? state.textTool.targetWidthMm : undefined,
                  targetHeightMm: typeof state.textTool.targetHeightMm === 'number' ? state.textTool.targetHeightMm : undefined,
                  preserveAspectRatio: state.textTool.preserveAspectRatio,
                  coverageMode: state.textTool.coverageMode,
                  densityPreset: state.textTool.densityPreset,
                  customSpacingMm: typeof state.textTool.customSpacingMm === 'number' ? state.textTool.customSpacingMm : undefined,
                  fillMode: state.textTool.fillMode,
                  fillPattern: state.textTool.fillPattern,
                  placementPattern: state.textTool.placementPattern,
                  contourSettings: state.textTool.contourSettings,
                  radialSettings: state.textTool.radialSettings,
                });
                if (requestId !== generationRequestRef.current) return;
                setOutlineFontStatus({ status: 'idle', message: null, fontId: state.textTool.fontId });

                // Legacy vector font only: characters with no real glyph
                // silently fell back to '?' — surface that instead of
                // swallowing it (metadata value is comma-joined; see
                // outlineTextTemplate.ts for why it can't be a real array).
                const rawUnsupported = template?.metadata?.['unsupportedCharacters'];
                const unsupportedCharacters = typeof rawUnsupported === 'string' && rawUnsupported.length > 0
                  ? rawUnsupported.split(',')
                  : [];
                if (JSON.stringify(state.textTool.unsupportedCharacters) !== JSON.stringify(unsupportedCharacters)) {
                  dispatch({ type: 'UPDATE_TEXT_TOOL', updates: { unsupportedCharacters } });
                }
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
                setOutlineFontStatus((current) => current.status === 'idle' ? current : { status: 'idle', message: null, fontId: state.textTool.fontId });
              }
            }
            break;

          case 'svg':
            if (state.svgTool.assetKind === 'image' && state.svgTool.uploadedImageDataUrl) {
              const rasterImage = await decodeRasterImageDataUrl(state.svgTool.uploadedImageDataUrl);
              const rasterResult = createRasterArtworkTemplate({
                image: rasterImage,
                name: state.svgTool.imageFileName || 'Image Artwork Preview',
                stoneSize: state.svgTool.stoneSize,
                spacingMm: typeof state.svgTool.customSpacingMm === 'number' ? state.svgTool.customSpacingMm : 4,
                threshold: state.svgTool.imageThreshold,
                detail: state.svgTool.imageDetail,
                invert: state.svgTool.imageInvert,
                colorCount: state.svgTool.imageColorCount,
                targetWidthMm: typeof state.svgTool.targetWidthMm === 'number' ? state.svgTool.targetWidthMm : undefined,
                targetHeightMm: typeof state.svgTool.targetHeightMm === 'number' ? state.svgTool.targetHeightMm : undefined,
                preserveAspectRatio: state.svgTool.preserveAspectRatio,
              });
              template = rasterResult.template;
            } else if (state.svgTool.uploadedSvgText) {
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

              template = createPolylineFilledRhinestoneTemplate({
                id: 'svg-preview',
                name: state.svgTool.svgFileName || 'SVG Preview',
                polylines: scaledPolylines,
                stoneSize: state.svgTool.stoneSize,
                coverageMode: state.svgTool.coverageMode,
                fillMode: state.svgTool.fillMode,
                fillPattern: state.svgTool.fillPattern,
                placementPattern: state.svgTool.placementPattern,
                contourSettings: state.svgTool.contourSettings,
                radialSettings: state.svgTool.radialSettings,
                densityPreset: state.svgTool.densityPreset,
                customSpacingMm: typeof state.svgTool.customSpacingMm === 'number' ? state.svgTool.customSpacingMm : undefined,
                fillEdgeInsetMm: state.svgTool.renderMode === 'artwork-dots' ? 0 : undefined,
              });
            }
            setOutlineFontStatus((current) => current.status === 'idle' ? current : { status: 'idle', message: null, fontId: state.textTool.fontId });
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
            setOutlineFontStatus((current) => current.status === 'idle' ? current : { status: 'idle', message: null, fontId: state.textTool.fontId });
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
            setOutlineFontStatus((current) => current.status === 'idle' ? current : { status: 'idle', message: null, fontId: state.textTool.fontId });
            break;

          default:
            return;
        }

        if (requestId !== generationRequestRef.current) return;
        dispatch({ type: 'SET_TEMPLATE', template });
      } catch (err) {
        if (requestId !== generationRequestRef.current) return;
        console.error('Template generation error:', err);
        setOutlineFontStatus({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
          fontId: state.textTool.fontId,
        });
        if (sourceTool !== 'rhinestone-font' && sourceTool !== 'template-import') {
          dispatch({ type: 'SET_TEMPLATE', template: null });
        }
      }
    };

    void generateTemplate();
  }, [
    sourceTool,
    state.gridTool,
    state.textTool,
    state.textTool.contourSettings,
    state.textTool.radialSettings,
    state.svgTool,
    state.svgTool.contourSettings,
    state.svgTool.radialSettings,
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

  const exportReady = useMemo(() => {
    if (!effectiveTemplate) return false;
    const readiness = checkExportReadiness(effectiveTemplate, { includeLabels: state.includeLabels });
    return readiness.ready;
  }, [effectiveTemplate, state.includeLabels]);

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
    dispatch({ type: 'SET_PROJECT_NAME', name: project.projectName });

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
  }, [editorDispatch, state.svgTool.contourSettings, state.svgTool.radialSettings, state.textTool.contourSettings, state.textTool.radialSettings]);

  const handleOpenLibrary = useCallback(() => {
    setTemplateLibraryOpen(true);
  }, []);

  const handleSaveToLibrary = useCallback(async () => {
    if (!effectiveTemplate) {
      setToast({ message: 'Nothing to save to the library yet.', tone: 'warning' });
      return;
    }
    if (!templateLibraryRepositoryRef.current) {
      setToast({ message: 'Library save failed because the current project could not be serialized.', tone: 'error' });
      return;
    }

    let entry = null;
    if (activeLibraryTemplateId) {
      const currentEntry = await templateLibraryRepositoryRef.current.get(activeLibraryTemplateId);
      if (currentEntry && !currentEntry.builtIn) {
        entry = buildCurrentLibraryEntry(currentEntry.templateId, currentEntry.name, currentEntry.createdAt, currentEntry.favorite);
      }
    }

    if (!entry) {
      const now = new Date().toISOString();
      entry = buildCurrentLibraryEntry(`library-${now}`, state.projectName, now, false);
    }

    if (!entry) {
      setToast({ message: 'Library save failed because the current project could not be serialized.', tone: 'error' });
      return;
    }

    await templateLibraryRepositoryRef.current.save(entry);
    setActiveLibraryTemplateId(entry.templateId);
    await refreshTemplateLibrary();
    setToast({ message: activeLibraryTemplateId ? 'Library design updated.' : 'Design saved to the local library.', tone: 'success' });
  }, [activeLibraryTemplateId, buildCurrentLibraryEntry, effectiveTemplate, refreshTemplateLibrary, state.projectName]);

  const handleLoadFromLibrary = useCallback(async (templateId: string) => {
    if (!templateLibraryRepositoryRef.current) return;
    const entry = await templateLibraryRepositoryRef.current.get(templateId);
    if (!entry) {
      setToast({ message: 'That library entry could not be found.', tone: 'error' });
      return;
    }

    const project = parseRhinestoneProject(JSON.stringify(entry.snapshot.project));
    applyProjectToEditor(project);
    setActiveLibraryTemplateId(entry.builtIn ? null : entry.templateId);
    setTemplateLibraryOpen(false);
    setToast({ message: 'Library design opened.', tone: 'success' });
  }, [applyProjectToEditor]);

  const handleLoadAutosave = useCallback(() => {
    if (!autosaveEntry) return;
    const project = parseRhinestoneProject(JSON.stringify(autosaveEntry.snapshot.project));
    applyProjectToEditor(project);
    setActiveLibraryTemplateId(null);
    setTemplateLibraryOpen(false);
    setToast({ message: 'Autosave opened.', tone: 'success' });
  }, [applyProjectToEditor, autosaveEntry]);

  const handleDialogConfirm = useCallback(() => {
    if (!pendingDialog) return;

    if (pendingDialog.kind === 'new-project') {
      dispatch({ type: 'RESET_EDITOR' });
      setToast({ message: 'Started a new project.', tone: 'info' });
    }

    if (pendingDialog.kind === 'export-warning') {
      runExport();
    }

    if (pendingDialog.kind === 'autosave-restore') {
      handleLoadAutosave();
    }

    setPendingDialog(null);
  }, [handleLoadAutosave, pendingDialog, runExport]);

  const handleFavoriteLibraryEntry = useCallback(async (templateId: string, favorite: boolean) => {
    if (!templateLibraryRepositoryRef.current) return;
    await templateLibraryRepositoryRef.current.favorite(templateId, favorite);
    await refreshTemplateLibrary();
  }, [refreshTemplateLibrary]);

  const handleDeleteLibraryEntry = useCallback(async (templateId: string) => {
    if (!templateLibraryRepositoryRef.current) return;
    await templateLibraryRepositoryRef.current.delete(templateId);
    await refreshTemplateLibrary();
    setToast({ message: 'Library design deleted.', tone: 'info' });
  }, [refreshTemplateLibrary]);

  const handleRenameLibraryEntry = useCallback(async (templateId: string) => {
    if (!templateLibraryRepositoryRef.current) return;
    const nextName = window.prompt('Rename design');
    if (!nextName || !nextName.trim()) return;
    await templateLibraryRepositoryRef.current.rename(templateId, nextName.trim());
    await refreshTemplateLibrary();
    setToast({ message: 'Library design renamed.', tone: 'success' });
  }, [refreshTemplateLibrary]);

  const handleDuplicateLibraryEntry = useCallback(async (templateId: string) => {
    if (!templateLibraryRepositoryRef.current) return;
    const nextName = window.prompt('Duplicate design as');
    if (!nextName || !nextName.trim()) return;
    const nextTemplateId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? `library-${crypto.randomUUID()}`
      : `library-${Date.now()}`;

    if (activeLibraryTemplateId === templateId) {
      const duplicate = buildCurrentLibraryEntry(nextTemplateId, nextName.trim(), new Date().toISOString(), false);
      if (duplicate) {
        await templateLibraryRepositoryRef.current.save(duplicate);
      }
    } else {
      await templateLibraryRepositoryRef.current.duplicate(templateId, nextTemplateId, nextName.trim());
    }

    await refreshTemplateLibrary();
    setToast({ message: 'Library design duplicated.', tone: 'success' });
  }, [activeLibraryTemplateId, buildCurrentLibraryEntry, refreshTemplateLibrary]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = ''; // Reset for re-loading same file

    const reader = new FileReader();
    reader.onload = (ev) => {
      const json = typeof ev.target?.result === 'string' ? ev.target.result : '';
      try {
        const project = parseRhinestoneProject(json);
        applyProjectToEditor(project);
        setToast({ message: 'Project opened.', tone: 'success' });
      } catch (err) {
        setToast({ message: `Invalid project file: ${err instanceof Error ? err.message : String(err)}`, tone: 'error' });
      }
    };
    reader.readAsText(file);
  }, [applyProjectToEditor]);

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
    <div className="h-screen flex flex-col bg-surface">
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
        canPreviewGarment={Boolean(effectiveTemplate) && (effectiveTemplate?.stones.length ?? 0) > 0}
        dispatch={dispatch}
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProject}
        onSaveProject={handleSaveProject}
        onOpenLibrary={handleOpenLibrary}
        onExport={handleExport}
        onOpenSetup={handleOpenSetup}
        onOpenGarmentPreview={() => setGarmentPreviewOpen(true)}
      />

      <GarmentPreviewPanel
        open={garmentPreviewOpen}
        template={effectiveTemplate}
        onClose={() => setGarmentPreviewOpen(false)}
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
        tertiaryAction={pendingDialog?.tertiaryAction}
      />

      {toast && (
        <div className="absolute bottom-20 right-4 z-30">
          <EditorToast message={toast.message} tone={toast.tone} onDismiss={() => setToast(null)} />
        </div>
      )}

      <div className="flex min-h-0 flex-1 bg-surface">
        <div className="h-full min-h-0 w-[clamp(260px,22vw,320px)] shrink-0 overflow-hidden">
          <EditorPropertiesPanel state={state} dispatch={editorDispatch} mode="source" outlineFontStatus={outlineFontStatus} />
        </div>

        <main className="flex min-w-0 flex-1 flex-col bg-surface">
          <div className="border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">Canvas workspace</h2>
              <p className="text-xs text-ink-muted">{getCanvasHint(state.activeTool)}</p>
            </div>
          </div>

          <EditorCanvas
            state={state}
            dispatch={editorDispatch}
            onNotify={notify}
          />
        </main>

        <div className="h-full min-h-0 w-[clamp(260px,23vw,336px)] shrink-0 overflow-hidden">
          <EditorPropertiesPanel state={state} dispatch={editorDispatch} mode="inspector" outlineFontStatus={outlineFontStatus} />
        </div>
      </div>

      <EditorStatusBar
        template={effectiveTemplate}
        canvas={state.canvas}
        exportReady={exportReady}
        isEditable={state.editableTemplate.isEditable}
        autosaveUpdatedAt={autosaveEntry?.updatedAt ?? null}
        activeLibraryName={activeLibraryEntry?.name ?? null}
      />
    </div>
  );
}
