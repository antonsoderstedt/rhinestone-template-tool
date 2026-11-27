'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useFontCatalogRevision } from '@/app/lib/useFontCatalog';
import { DEFAULT_PREVIEW_TEXT } from '../lib/fontLaunch';
import { useSearchParams } from 'next/navigation';
import type { WorkspaceAsset } from '../lib/workspaceVault';
import {
  DEFAULT_HTV_STATE,
  createHtvTextLayer,
  createHtvVectorLayer,
  htvReducer,
  type HtvLayer,
  type HtvVectorLayer,
} from './HtvState';
import { combineVectorLayers, offsetVectorLayerPolylines } from './htvFormOps';
import { useStudioTheme } from '../lib/studioTheme';
import HtvTopbar from './HtvTopbar';
import HtvToolsPanel from './HtvToolsPanel';
import HtvCanvas from './HtvCanvas';
import HtvInspectorPanel from './HtvInspectorPanel';
import HtvSilhouetteConverterModal from './HtvSilhouetteConverterModal';
import HtvGarmentPreviewPanel from './HtvGarmentPreviewPanel';
import HtvGarmentStage from './HtvGarmentStage';
import dynamic from 'next/dynamic';
import WorkspaceModeBanner from '../components/WorkspaceModeBanner';
import HtvColourFilesPanel from './HtvColourFilesPanel';
import { createHtvSvgExport, type HtvExportOptions } from './htvExport';
// Loaded when first needed: three.js alone is ~300 KiB and most visits never open the 3D tab or the export dialog.
const HtvGarment3D = dynamic(() => import('./HtvGarment3D'), { ssr: false });
const ExportDialog = dynamic(() => import('../components/ExportDialog'));
import { sanitizeExportFilename } from '../components/exportDialogHelpers';
import { centerPolylines } from './htvGeometry';
import { createShapePolylines, getShapeDisplayName, type HtvShapeId } from './htvShapeLibrary';
import { getDesignTemplate, type HtvDesignTemplateId } from './htvDesignTemplates';
import { getPlacementsForGarmentType } from './htvPlacementZones';
import { summarizeHtvStatus } from './htvStatus';
import { findHtvSizeIssues, summarizeHtvSize } from './htvSizeCheck';
import { planFitToPlacement } from './htvFitToPlacement';
import { getPlacementZoneSizeMm } from './htvPlacementZones';
import { useMeasuredTextSizes } from './useMeasuredTextSizes';
import { KeyboardShortcutsHost } from '../components/KeyboardShortcuts';
import MobileStudioBar from '../components/MobileStudioBar';
import { useIsMobileStudio } from '../lib/useMediaQuery';
import { Download, Plus, SlidersHorizontal } from 'lucide-react';
import { isKeyHandlingWidget, isModalOpen, resolveStudioShortcut } from '../lib/studioShortcuts';
import { decodeRasterImageDataUrl } from '../lib/rasterImageDecode';
import {
  DEFAULT_OUTLINE_FONT_ID,
  isAvailableOutlineFontId,
  listOutlineFonts,
  svgStringToPolylines,
  type TraceableImageData,
} from '@/src/lib/rhinestone-engine/index';
import {
  buildHtvDesignEntry,
  deserializeHtvState,
  EMPTY_WORKSPACE_VAULT,
  findAssetById,
  findHtvDesignById,
  readWorkspaceVault,
  writeWorkspaceVault,
} from '../lib/workspaceVault';

import { useT } from '../lib/i18n';
import { trackExport } from '../lib/tracking/track';
const DEFAULT_TEXT_FONT_ID = listOutlineFonts().find((f) => !f.isLegacy)?.fontId ?? '';

export default function HtvShell() {
  const t = useT();
  const { theme, toggleTheme } = useStudioTheme();
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(htvReducer, DEFAULT_HTV_STATE);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'warning' | 'error' } | null>(null);
  const [garmentPreviewOpen, setGarmentPreviewOpen] = useState(false);
  const [designSurface, setDesignSurface] = useState<'canvas' | 'garment' | '3d'>('canvas');
  // Phones and tablets: which panel the bottom bar has open under the canvas.
  const [mobilePanel, setMobilePanel] = useState<'none' | 'add' | 'inspect'>('none');
  const isMobile = useIsMobileStudio();
  const [placementOverlayMode, setPlacementOverlayMode] = useState<'active-only' | 'all-active'>('all-active');
  const [pendingImage, setPendingImage] = useState<{ image: TraceableImageData; previewDataUrl: string } | null>(null);
  const [activeSavedDesignId, setActiveSavedDesignId] = useState<string | null>(null);
  const [libraryAssets, setLibraryAssets] = useState<WorkspaceAsset[]>([]);
  const [workspaceVault, setWorkspaceVault] = useState(EMPTY_WORKSPACE_VAULT);
  const nextLayerIdRef = useRef(0);
  const handledQueryRef = useRef<string | null>(null);
  const fontCatalogRevision = useFontCatalogRevision();

  useEffect(() => {
    const sync = () => {
      const vault = readWorkspaceVault();
      queueMicrotask(() => {
        setWorkspaceVault(vault);
        setLibraryAssets(vault.assets.filter((asset) => !asset.archived).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
      });
    };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('focus', sync); };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), toast.tone === 'error' ? 5000 : 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const syncNextLayerId = useCallback((layerIds: readonly { id: string }[]) => {
    let max = 0;
    for (const layer of layerIds) {
      const match = /(\d+)$/.exec(layer.id);
      if (!match) continue;
      const value = Number(match[1]);
      if (value > max) max = value;
    }
    nextLayerIdRef.current = max + 1;
  }, []);

  const createLayerId = useCallback((prefix: string) => {
    const id = `${prefix}-${nextLayerIdRef.current}`;
    nextLayerIdRef.current += 1;
    return id;
  }, []);

  const handleAddText = useCallback(() => {
    const layer = createHtvTextLayer({ id: createLayerId('text'), fontId: DEFAULT_TEXT_FONT_ID, text: 'TEXT', placementId: state.garment.placementZone });
    dispatch({ type: 'ADD_LAYERS', layers: [layer] });
  }, [createLayerId, state.garment.placementZone]);

  const handleAddShape = useCallback((shapeId: HtvShapeId) => {
    const { polylines, widthMm, heightMm } = createShapePolylines(shapeId);
    const layer = createHtvVectorLayer({
      id: createLayerId('shape'),
      name: getShapeDisplayName(shapeId),
      polylines,
      naturalWidthMm: widthMm,
      naturalHeightMm: heightMm,
      placementId: state.garment.placementZone,
      sourceKind: 'library-asset',
    });
    dispatch({ type: 'ADD_LAYERS', layers: [layer] });
  }, [createLayerId, state.garment.placementZone]);

  const handleAddTemplate = useCallback((templateId: HtvDesignTemplateId) => {
    const template = getDesignTemplate(templateId);
    if (!template) return;
    const layers = template.build(createLayerId, DEFAULT_TEXT_FONT_ID);
    dispatch({ type: 'ADD_LAYERS', layers });
  }, [createLayerId]);

  const handleCombineLayers = useCallback((ids: string[]) => {
    const layers = state.layers.filter((l): l is HtvVectorLayer => ids.includes(l.id) && l.type === 'vector');
    if (layers.length < 2) return;
    const { polylines, widthMm, heightMm } = combineVectorLayers(layers);
    const newLayer = createHtvVectorLayer({
      id: createLayerId('combine'),
      name: 'Combined shape',
      polylines,
      naturalWidthMm: widthMm,
      naturalHeightMm: heightMm,
      sourceKind: 'library-asset',
      colorId: layers[0]!.colorId,
    });
    dispatch({ type: 'DELETE_LAYERS', ids });
    dispatch({ type: 'ADD_LAYERS', layers: [newLayer] });
  }, [state.layers, createLayerId]);

  const handleOffsetLayer = useCallback((id: string, offsetMm: number) => {
    const layer = state.layers.find((l) => l.id === id);
    if (!layer || layer.type !== 'vector') return;
    const { polylines, widthMm, heightMm } = offsetVectorLayerPolylines(layer, offsetMm);
    const newLayer = createHtvVectorLayer({
      id: createLayerId('offset'),
      name: `${layer.name} outline`,
      polylines,
      naturalWidthMm: widthMm,
      naturalHeightMm: heightMm,
      sourceKind: 'library-asset',
      colorId: layer.colorId,
      x: layer.x,
      y: layer.y,
      rotationDeg: layer.rotationDeg,
      scale: layer.scale,
    });
    dispatch({ type: 'ADD_LAYERS', layers: [newLayer] });
  }, [state.layers, createLayerId]);

  const handleImportFile = useCallback(async (file: File) => {
    const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
    try {
      if (isSvg) {
        const text = await file.text();
        const raw = svgStringToPolylines(text);
        if (raw.length === 0) {
          setToast({ message: 'This SVG had no shapes the importer could read.', tone: 'warning' });
          return;
        }
        const { polylines, widthMm, heightMm } = centerPolylines(raw);
        const layer = createHtvVectorLayer({
          id: createLayerId('svg'),
          name: file.name.replace(/\.svg$/i, ''),
          polylines,
          naturalWidthMm: widthMm,
          naturalHeightMm: heightMm,
          placementId: state.garment.placementZone,
          sourceKind: 'svg-upload',
        });
        dispatch({ type: 'ADD_LAYERS', layers: [layer] });
        return;
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Could not read the file.'));
        reader.readAsDataURL(file);
      });
      const image = await decodeRasterImageDataUrl(dataUrl);
      setPendingImage({ image, previewDataUrl: dataUrl });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Could not import this file.', tone: 'error' });
    }
  }, [createLayerId, state.garment.placementZone]);

  const refreshLibraryAssets = useCallback(() => {
    const vault = readWorkspaceVault();
    setLibraryAssets(vault.assets.filter((asset) => !asset.archived).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
  }, []);

  useEffect(() => {
    const handleFocus = () => refreshLibraryAssets();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [refreshLibraryAssets]);

  const insertWorkspaceAsset = useCallback(async (asset: WorkspaceAsset) => {
    dispatch({ type: 'SET_PROJECT_NAME', name: asset.name });
    if (asset.kind === 'svg' && asset.svgText) {
      const raw = svgStringToPolylines(asset.svgText);
      if (raw.length === 0) {
        setToast({ message: 'This library SVG had no readable shapes.', tone: 'warning' });
        return;
      }
      const { polylines, widthMm, heightMm } = centerPolylines(raw);
      dispatch({
        type: 'ADD_LAYERS',
        layers: [createHtvVectorLayer({
          id: createLayerId('svg'),
          name: asset.name,
          polylines,
          naturalWidthMm: widthMm,
          naturalHeightMm: heightMm,
          placementId: state.garment.placementZone,
          sourceKind: 'svg-upload',
        })],
      });
      return;
    }

    const image = await decodeRasterImageDataUrl(asset.sourceDataUrl);
    setPendingImage({ image, previewDataUrl: asset.sourceDataUrl });
  }, [createLayerId, state.garment.placementZone]);

  const handleAddLibraryAsset = useCallback(async (assetId: string) => {
    const asset = findAssetById(assetId);
    if (!asset) {
      setToast({ message: 'That library asset could not be found.', tone: 'warning' });
      refreshLibraryAssets();
      return;
    }
    await insertWorkspaceAsset(asset);
  }, [insertWorkspaceAsset, refreshLibraryAssets]);

  const handleApplySilhouette = useCallback((result: { polylines: ReturnType<typeof centerPolylines>['polylines']; widthMm: number; heightMm: number }) => {
    const layer = createHtvVectorLayer({
      id: createLayerId('trace'),
      name: 'Traced image',
      polylines: result.polylines,
      naturalWidthMm: result.widthMm,
      naturalHeightMm: result.heightMm,
      placementId: state.garment.placementZone,
      sourceKind: 'silhouette-trace',
    });
    dispatch({ type: 'ADD_LAYERS', layers: [layer] });
    setPendingImage(null);
  }, [createLayerId, state.garment.placementZone]);

  const handleSaveDesign = useCallback(() => {
    const vault = readWorkspaceVault();
    const existing = activeSavedDesignId
      ? vault.htvDesigns.find((design) => design.designId === activeSavedDesignId) ?? null
      : null;
    const entry = buildHtvDesignEntry(state, existing);
    const nextVault = {
      ...vault,
      htvDesigns: [entry, ...vault.htvDesigns.filter((design) => design.designId !== entry.designId)],
    };
    writeWorkspaceVault(nextVault);
    setActiveSavedDesignId(entry.designId);
    setToast({ message: existing ? 'HTV design updated in My Designs.' : 'HTV design saved to My Designs.', tone: 'success' });
  }, [activeSavedDesignId, state]);

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [htvExportOptions, setHtvExportOptions] = useState<Required<Pick<HtvExportOptions, 'mirror' | 'weedBorder' | 'registrationMarks'>>>({
    mirror: true,
    weedBorder: false,
    registrationMarks: false,
  });
  const [htvExportPreview, setHtvExportPreview] = useState<{
    forLayers: readonly HtvLayer[];
    forOptions: typeof htvExportOptions;
    forMarginMm: number;
    svg: string | null;
    widthMm: number | null;
    heightMm: number | null;
    designWidthMm: number | null;
    designHeightMm: number | null;
    layerCount: number;
    error: string | null;
  } | null>(null);

  const exportLayers = useMemo(
    () => state.layers.filter((layer) => layer.placementId === state.garment.placementZone),
    [state.garment.placementZone, state.layers],
  );
  const weedMarginMm = workspaceVault.settings.htvWeedMarginMm;
  const measuredTextSizes = useMeasuredTextSizes(state.layers);
  const sizeSummary = useMemo(
    () => summarizeHtvSize(state.layers, state.garment.placementZone, state.garment.type, weedMarginMm, measuredTextSizes),
    [state.layers, state.garment.placementZone, state.garment.type, weedMarginMm, measuredTextSizes],
  );

  // The one-click fix for a design that is bigger than its placement area or than a mat.
  const fitPlan = useMemo(
    () => (sizeSummary.issues.some((issue) => issue.id === 'exceeds-placement' || issue.id === 'exceeds-mat')
      ? planFitToPlacement(exportLayers, sizeSummary.zoneSizeMm, measuredTextSizes, weedMarginMm)
      : null),
    [exportLayers, measuredTextSizes, sizeSummary.issues, sizeSummary.zoneSizeMm, weedMarginMm],
  );
  const fitToPlacement = useCallback(() => {
    if (!fitPlan) return;
    dispatch({ type: 'BATCH_UPDATE_LAYERS', updates: fitPlan.updates });
    setToast({ message: `Made the design ${Math.round(fitPlan.scale * 100)}% of its size so it fits.`, tone: 'success' });
  }, [fitPlan]);

  useEffect(() => {
    if (!exportDialogOpen) return;
    let cancelled = false;
    void createHtvSvgExport(exportLayers, state.projectName, { ...htvExportOptions, marginMm: weedMarginMm })
      .then((result) => {
        if (cancelled) return;
        setHtvExportPreview({
          forLayers: exportLayers,
          forOptions: htvExportOptions,
          forMarginMm: weedMarginMm,
          svg: result.svg,
          widthMm: result.widthMm,
          heightMm: result.heightMm,
          designWidthMm: result.designWidthMm,
          designHeightMm: result.designHeightMm,
          layerCount: result.layerCount,
          error: null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setHtvExportPreview({
          forLayers: exportLayers,
          forOptions: htvExportOptions,
          forMarginMm: weedMarginMm,
          svg: null,
          widthMm: null,
          heightMm: null,
          designWidthMm: null,
          designHeightMm: null,
          layerCount: 0,
          error: err instanceof Error ? err.message : 'Could not prepare the export.',
        });
      });
    return () => { cancelled = true; };
  }, [exportDialogOpen, exportLayers, htvExportOptions, state.projectName, weedMarginMm]);

  const htvExportFresh = htvExportPreview
    && htvExportPreview.forLayers === exportLayers
    && htvExportPreview.forOptions === htvExportOptions
    && htvExportPreview.forMarginMm === weedMarginMm
    ? htvExportPreview
    : null;

  // The export dialog already reports whether the file fits a mat; here we add whether the artwork fits its placement, using the exact size.
  const exportPlacementNotes = useMemo(() => {
    if (!htvExportFresh || htvExportFresh.designWidthMm === null || htvExportFresh.designHeightMm === null) return [];
    return findHtvSizeIssues({
      designSizeMm: { widthMm: htvExportFresh.designWidthMm, heightMm: htvExportFresh.designHeightMm },
      zoneSizeMm: getPlacementZoneSizeMm(state.garment.type, state.garment.placementZone),
      zoneName: sizeSummary.zoneName,
      weedMarginMm,
    })
      .filter((issue) => issue.id === 'exceeds-placement')
      .map((issue) => ({ tone: 'warning' as const, text: issue.message }));
  }, [htvExportFresh, sizeSummary.zoneName, state.garment.placementZone, state.garment.type, weedMarginMm]);

  const handleExport = useCallback(() => {
    if (exportLayers.length === 0) {
      setToast({ message: 'Nothing to export yet. Add a layer to the active placement first.', tone: 'warning' });
      return;
    }
    setExportDialogOpen(true);
  }, [exportLayers.length]);

  const handleExportDownload = useCallback((filename: string) => {
    if (!htvExportFresh?.svg) return;
    const blob = new Blob([htvExportFresh.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    trackExport(filename);
    setExportDialogOpen(false);
    setToast({ message: `Exported ${htvExportFresh.layerCount} layer(s) as SVG.`, tone: 'success' });
  }, [htvExportFresh]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isKeyHandlingWidget(e.target) || isModalOpen()) return;

      if (e.key === 'Escape' && state.selectedLayerIds.size > 0) {
        e.preventDefault();
        dispatch({ type: 'SET_SELECTED_LAYERS', ids: [] });
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedLayerIds.size > 0) {
        e.preventDefault();
        dispatch({ type: 'DELETE_LAYERS', ids: [...state.selectedLayerIds] });
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && state.selectedLayerIds.size > 0) {
        e.preventDefault();
        dispatch({ type: 'DUPLICATE_LAYERS', ids: [...state.selectedLayerIds] });
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
      }
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        dispatch({ type: 'SET_SELECTED_LAYERS', ids: state.layers.map((l) => l.id) });
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && state.selectedLayerIds.size > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const updates = state.layers
          .filter((l) => state.selectedLayerIds.has(l.id))
          .map((l) => ({ id: l.id, updates: { x: l.x + dx, y: l.y + dy } }));
        dispatch({ type: 'BATCH_UPDATE_LAYERS', updates });
      }

      // Save, export, view (fit / zoom). `?` is handled by <KeyboardShortcutsHost>.
      const shortcut = resolveStudioShortcut(e, { tools: false, nudgeStepMm: 1, nudgeShiftStepMm: 10 });
      if (!shortcut) return;
      if (shortcut.type === 'save') {
        e.preventDefault();
        handleSaveDesign();
      } else if (shortcut.type === 'export') {
        e.preventDefault();
        handleExport();
      } else if (shortcut.type === 'fit' || shortcut.type === 'zoom-reset') {
        e.preventDefault();
        dispatch({ type: 'UPDATE_CANVAS', updates: { zoom: 1, panX: 0, panY: 0 } });
      } else if (shortcut.type === 'zoom-in') {
        e.preventDefault();
        dispatch({ type: 'UPDATE_CANVAS', updates: { zoom: Math.min(state.canvas.zoom * 1.2, 5) } });
      } else if (shortcut.type === 'zoom-out') {
        e.preventDefault();
        dispatch({ type: 'UPDATE_CANVAS', updates: { zoom: Math.max(state.canvas.zoom / 1.2, 0.2) } });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedLayerIds, state.layers, state.canvas.zoom, handleSaveDesign, handleExport]);

  // On a phone, adding something (text, a shape, a file…) moves on to the inspector so it can be edited at once.
  const showInspectorOnPhone = () => {
    if (isMobile) setMobilePanel('inspect');
  };

  const activePlacementLayers = state.layers.filter((layer) => layer.placementId === state.garment.placementZone);
  const htvStatus = summarizeHtvStatus(state.layers, state.garment.placementZone, sizeSummary);

  useEffect(() => {
    const activePlacements = getPlacementsForGarmentType(state.garment.type).map((item) => item.id);
    if (!activePlacements.includes(state.garment.placementZone)) {
      const fallback = activePlacements[0] ?? 'full-front';
      dispatch({ type: 'UPDATE_GARMENT', updates: { placementZone: fallback, activePlacementZones: [fallback], size: state.garment.type === 'tote' ? 'OS' : state.garment.size === 'OS' ? 'M' : state.garment.size } });
    }
  }, [state.garment.type, state.garment.placementZone, state.garment.size]);

  useEffect(() => {
    const placementLayers = state.layers.filter((layer) => layer.placementId === state.garment.placementZone);
    const selectionForPlacement = [...state.selectedLayerIds].filter((id) => placementLayers.some((layer) => layer.id === id));
    if (selectionForPlacement.length !== state.selectedLayerIds.size) {
      dispatch({ type: 'SET_SELECTED_LAYERS', ids: selectionForPlacement });
    }
  }, [state.garment.placementZone, state.layers, state.selectedLayerIds]);

  useEffect(() => {
    syncNextLayerId(state.layers);
  }, [state.layers, syncNextLayerId]);

  useEffect(() => {
    const designId = searchParams.get('designId');
    const assetId = searchParams.get('asset');
    const fontId = searchParams.get('font');
    const launchText = searchParams.get('text');
    const queryKey = `${designId ?? ''}|${assetId ?? ''}|${fontId ?? ''}|${launchText ?? ''}`;

    if (queryKey === '|||') return;
    if (handledQueryRef.current === queryKey) return;
    // A font from the font library can only be found once the library's catalog has loaded.
    if (fontId && fontCatalogRevision === 0) return;

    const applyQueryIntent = async () => {
      if (designId) {
        const design = findHtvDesignById(designId);
        if (design) {
          const restored = deserializeHtvState(design.snapshot);
          dispatch({ type: 'LOAD_STATE', state: restored });
          setActiveSavedDesignId(design.designId);
          handledQueryRef.current = queryKey;
          return;
        }
      }

      if (assetId) {
        const asset = findAssetById(assetId);
        if (asset) {
          await insertWorkspaceAsset(asset);
          handledQueryRef.current = queryKey;
          return;
        }
      }

      if (fontId) {
        const resolvedFontId = isAvailableOutlineFontId(fontId) ? fontId : DEFAULT_OUTLINE_FONT_ID;
        if (resolvedFontId !== fontId) {
          setToast({ message: 'Font not found — using a default font instead.', tone: 'warning' });
        }
        dispatch({ type: 'SET_PROJECT_NAME', name: `${launchText ?? 'Preview'} HTV Design` });
        dispatch({
          type: 'ADD_LAYERS',
          layers: [createHtvTextLayer({
            id: createLayerId('text'),
            text: launchText ?? DEFAULT_PREVIEW_TEXT,
            fontId: resolvedFontId,
            placementId: state.garment.placementZone,
          })],
        });
        handledQueryRef.current = queryKey;
      }
    };

    void applyQueryIntent();
  }, [createLayerId, fontCatalogRevision, searchParams, insertWorkspaceAsset, state.garment.placementZone]);

  return (
    <div data-theme={theme} className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--studio-bg)] text-[var(--studio-ink)]">
      <KeyboardShortcutsHost studio="htv" />
      <HtvTopbar
        projectName={state.projectName}
        canUndo={state.history.past.length > 0}
        canRedo={state.history.future.length > 0}
        canExport={activePlacementLayers.length > 0}
        canPreviewGarment={activePlacementLayers.length > 0}
        designSurface={designSurface}
        recentDesigns={workspaceVault.htvDesigns.slice(0, 5).map((design) => ({ id: design.designId, name: design.name }))}
        dispatch={dispatch}
        onSaveDesign={handleSaveDesign}
        onOpenRecent={(id) => {
          const design = findHtvDesignById(id);
          if (!design) return;
          const restored = deserializeHtvState(design.snapshot);
          dispatch({ type: 'LOAD_STATE', state: restored });
          setActiveSavedDesignId(design.designId);
          setToast({ message: `Opened "${design.name}".`, tone: 'success' });
        }}
        onExport={handleExport}
        onOpenGarmentPreview={() => setGarmentPreviewOpen(true)}
        onToggleDesignSurface={setDesignSurface}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <WorkspaceModeBanner
        mode="HTV Studio"
        status={htvStatus.status}
        project={state.projectName || 'Untitled HTV Design'}
        guidance={htvStatus.guidance}
        chips={htvStatus.chips}
        action={fitPlan ? { label: 'Fit to the print area', onClick: fitToPlacement } : undefined}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--studio-bg)] lg:flex-row">
        <div className={`order-2 min-h-0 w-full shrink-0 overflow-hidden border-t border-[var(--studio-border)] max-lg:h-[44dvh] ${mobilePanel !== 'add' ? 'max-lg:hidden' : ''} lg:order-none lg:h-full lg:max-h-none lg:w-[272px] lg:border-t-0`}>
          <HtvToolsPanel
            state={state}
            dispatch={dispatch}
            libraryAssets={libraryAssets}
            onAddText={(...args) => { showInspectorOnPhone(); return handleAddText(...args); }}
            onImportFile={(...args) => { showInspectorOnPhone(); return handleImportFile(...args); }}
            onAddShape={(...args) => { showInspectorOnPhone(); return handleAddShape(...args); }}
            onAddTemplate={(...args) => { showInspectorOnPhone(); return handleAddTemplate(...args); }}
            onAddLibraryAsset={(...args) => { showInspectorOnPhone(); return handleAddLibraryAsset(...args); }}
            designSurface={designSurface}
            onToggleDesignSurface={setDesignSurface}
            placementOverlayMode={placementOverlayMode}
            onTogglePlacementOverlayMode={setPlacementOverlayMode}
          />
        </div>

        <main id="main-content" tabIndex={-1} aria-label={t('Design surface')} className="order-1 min-h-[58vh] min-w-0 flex-1 max-lg:min-h-0 lg:order-none lg:min-h-0">
          <h1 className="sr-only">{t('HTV Studio')}</h1>
          {designSurface === 'garment' ? (
            <HtvGarmentStage state={state} dispatch={dispatch} showAllPlacementOverlays={placementOverlayMode === 'all-active'} />
          ) : designSurface === '3d' ? (
            <HtvGarment3D
              state={state}
              fallback={<HtvGarmentStage state={state} dispatch={dispatch} showAllPlacementOverlays={placementOverlayMode === 'all-active'} />}
            />
          ) : (
            <HtvCanvas state={state} dispatch={dispatch} measuredSizes={measuredTextSizes} />
          )}
        </main>

        <div className={`order-3 min-h-0 w-full shrink-0 overflow-hidden border-t border-[var(--studio-border)] max-lg:h-[44dvh] ${mobilePanel !== 'inspect' ? 'max-lg:hidden' : ''} lg:order-none lg:h-full lg:max-h-none lg:w-[288px] lg:border-t-0`}>
          <HtvInspectorPanel
            state={state}
            dispatch={dispatch}
            onCombineLayers={handleCombineLayers}
            onOffsetLayer={handleOffsetLayer}
          />
        </div>

        {pendingImage && (
          <HtvSilhouetteConverterModal
            image={pendingImage.image}
            previewDataUrl={pendingImage.previewDataUrl}
            onCancel={() => setPendingImage(null)}
            onApply={handleApplySilhouette}
          />
        )}

        <ExportDialog
          open={exportDialogOpen}
          title={t('Export HTV SVG')}
          svg={htvExportFresh?.svg ?? null}
          loading={exportDialogOpen && !htvExportFresh}
          error={htvExportFresh?.error ?? null}
          widthMm={htvExportFresh?.widthMm ?? null}
          heightMm={htvExportFresh?.heightMm ?? null}
          summaryRows={[
            { label: 'Layers', value: String(htvExportFresh?.layerCount ?? exportLayers.length) },
            { label: 'Weed margin', value: `${weedMarginMm} mm` },
          ]}
          notes={[
            ...exportPlacementNotes,
            ...(htvExportOptions.mirror
              ? [{ tone: 'info' as const, text: 'Mirrored for iron-on vinyl: cut it face-down and the text will read correctly once pressed.' }]
              : [{ tone: 'warning' as const, text: 'Not mirrored. Text and artwork will press on backwards unless your vinyl is cut face-up.' }]),
            ...(state.layers.length > exportLayers.length
              ? [{ tone: 'info' as const, text: `${state.layers.length - exportLayers.length} layer(s) on other placements are not included.` }]
              : []),
          ]}
          defaultFilename={sanitizeExportFilename(state.projectName || 'htv-design', 'htv-design').replace(/\.svg$/, '')}
          onDownload={handleExportDownload}
          onClose={() => setExportDialogOpen(false)}
        >
          <label className="flex items-center gap-2 text-xs text-[var(--studio-ink-secondary)]">
            <input
              type="checkbox"
              checked={htvExportOptions.mirror}
              onChange={(event) => setHtvExportOptions((current) => ({ ...current, mirror: event.target.checked }))}
            />
            {t('Mirror horizontally (recommended for iron-on vinyl)')}
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--studio-ink-secondary)]">
            <input
              type="checkbox"
              checked={htvExportOptions.weedBorder}
              onChange={(event) => setHtvExportOptions((current) => ({ ...current, weedBorder: event.target.checked }))}
            />
            {t('Weed border (cut line around the design)')}
          </label>
          <label className="flex items-center gap-2 text-xs text-[var(--studio-ink-secondary)]">
            <input
              type="checkbox"
              checked={htvExportOptions.registrationMarks}
              onChange={(event) => setHtvExportOptions((current) => ({ ...current, registrationMarks: event.target.checked }))}
            />
            {t('Registration marks (corner crosses)')}
          </label>
          <HtvColourFilesPanel
            layers={exportLayers}
            projectName={state.projectName}
            options={{ ...htvExportOptions, marginMm: weedMarginMm }}
            filenameBase={sanitizeExportFilename(state.projectName || 'htv-design', 'htv-design').replace(/\.svg$/, '')}
            onDownloaded={(message) => setToast({ message, tone: 'success' })}
          />
        </ExportDialog>

        <HtvGarmentPreviewPanel open={garmentPreviewOpen} state={state} showAllPlacementOverlays={placementOverlayMode === 'all-active'} onClose={() => setGarmentPreviewOpen(false)} />
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-4 max-lg:bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-md px-4 py-2 text-sm font-medium shadow-lg ${
            toast.tone === 'success' ? 'bg-success-600 text-ink-inverse' : toast.tone === 'warning' ? 'bg-warning-600 text-ink-inverse' : 'bg-danger-600 text-ink-inverse'
          }`}
        >
          {toast.message}
        </div>
      )}

      <MobileStudioBar
        items={[
          { id: 'add', label: 'Add', icon: Plus, active: mobilePanel === 'add', onSelect: () => setMobilePanel((current) => (current === 'add' ? 'none' : 'add')) },
          { id: 'inspect', label: 'Inspect', icon: SlidersHorizontal, active: mobilePanel === 'inspect', onSelect: () => setMobilePanel((current) => (current === 'inspect' ? 'none' : 'inspect')) },
          { id: 'export', label: 'Export', icon: Download, primary: true, disabled: activePlacementLayers.length === 0, onSelect: handleExport },
        ]}
      />
    </div>
  );
}
