'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  DEFAULT_HTV_STATE,
  createHtvTextLayer,
  createHtvVectorLayer,
  htvReducer,
  type HtvVectorLayer,
} from './HtvState';
import { combineVectorLayers, offsetVectorLayerPolylines } from './htvFormOps';
import HtvTopbar from './HtvTopbar';
import HtvToolsPanel from './HtvToolsPanel';
import HtvCanvas from './HtvCanvas';
import HtvInspectorPanel from './HtvInspectorPanel';
import HtvSilhouetteConverterModal from './HtvSilhouetteConverterModal';
import HtvGarmentPreviewPanel from './HtvGarmentPreviewPanel';
import { createHtvSvgExport } from './htvExport';
import { centerPolylines } from './htvGeometry';
import { createShapePolylines, getShapeDisplayName, type HtvShapeId } from './htvShapeLibrary';
import { getDesignTemplate, type HtvDesignTemplateId } from './htvDesignTemplates';
import { decodeRasterImageDataUrl } from '../lib/rasterImageDecode';
import { listOutlineFonts, svgStringToPolylines, type TraceableImageData } from '@/src/lib/rhinestone-engine/index';
import {
  buildHtvDesignEntry,
  deserializeHtvState,
  findAssetById,
  findHtvDesignById,
  readWorkspaceVault,
  writeWorkspaceVault,
} from '../lib/workspaceVault';

const DEFAULT_TEXT_FONT_ID = listOutlineFonts().find((f) => !f.isLegacy)?.fontId ?? '';

export default function HtvShell() {
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(htvReducer, DEFAULT_HTV_STATE);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'warning' | 'error' } | null>(null);
  const [garmentPreviewOpen, setGarmentPreviewOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ image: TraceableImageData; previewDataUrl: string } | null>(null);
  const [activeSavedDesignId, setActiveSavedDesignId] = useState<string | null>(null);
  const nextLayerIdRef = useRef(0);
  const handledQueryRef = useRef<string | null>(null);

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
    const layer = createHtvTextLayer({ id: createLayerId('text'), fontId: DEFAULT_TEXT_FONT_ID, text: 'TEXT' });
    dispatch({ type: 'ADD_LAYERS', layers: [layer] });
  }, [createLayerId]);

  const handleAddShape = useCallback((shapeId: HtvShapeId) => {
    const { polylines, widthMm, heightMm } = createShapePolylines(shapeId);
    const layer = createHtvVectorLayer({
      id: createLayerId('shape'),
      name: getShapeDisplayName(shapeId),
      polylines,
      naturalWidthMm: widthMm,
      naturalHeightMm: heightMm,
      sourceKind: 'library-asset',
    });
    dispatch({ type: 'ADD_LAYERS', layers: [layer] });
  }, [createLayerId]);

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
  }, [createLayerId]);

  const handleApplySilhouette = useCallback((result: { polylines: ReturnType<typeof centerPolylines>['polylines']; widthMm: number; heightMm: number }) => {
    const layer = createHtvVectorLayer({
      id: createLayerId('trace'),
      name: 'Traced image',
      polylines: result.polylines,
      naturalWidthMm: result.widthMm,
      naturalHeightMm: result.heightMm,
      sourceKind: 'silhouette-trace',
    });
    dispatch({ type: 'ADD_LAYERS', layers: [layer] });
    setPendingImage(null);
  }, [createLayerId]);

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

  const handleExport = useCallback(async () => {
    try {
      const result = await createHtvSvgExport(state.layers, state.projectName);
      const blob = new Blob([result.svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.projectName.trim() || 'htv-design'}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      setToast({ message: `Exported ${result.layerCount} layer(s) as SVG.`, tone: 'success' });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Export failed.', tone: 'error' });
    }
  }, [state.layers, state.projectName]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedLayerIds, state.layers]);

  const hasLayers = state.layers.length > 0;

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
          dispatch({ type: 'SET_PROJECT_NAME', name: asset.name });
          if (asset.kind === 'svg' && asset.svgText) {
            const raw = svgStringToPolylines(asset.svgText);
            if (raw.length > 0) {
              const { polylines, widthMm, heightMm } = centerPolylines(raw);
              dispatch({
                type: 'ADD_LAYERS',
                layers: [createHtvVectorLayer({
                  id: createLayerId('svg'),
                  name: asset.name,
                  polylines,
                  naturalWidthMm: widthMm,
                  naturalHeightMm: heightMm,
                  sourceKind: 'svg-upload',
                })],
              });
            }
          } else if (asset.kind === 'image') {
            const image = await decodeRasterImageDataUrl(asset.sourceDataUrl);
            setPendingImage({ image, previewDataUrl: asset.sourceDataUrl });
          }
          handledQueryRef.current = queryKey;
          return;
        }
      }

      if (fontId) {
        dispatch({ type: 'SET_PROJECT_NAME', name: `${launchText ?? 'Preview'} HTV Design` });
        dispatch({
          type: 'ADD_LAYERS',
          layers: [createHtvTextLayer({
            id: createLayerId('text'),
            text: launchText ?? 'Sulay 123',
            fontId,
          })],
        });
        handledQueryRef.current = queryKey;
      }
    };

    void applyQueryIntent();
  }, [createLayerId, searchParams]);

  return (
    <div className="h-full min-h-0 flex flex-col bg-surface">
      <HtvTopbar
        projectName={state.projectName}
        canUndo={state.history.past.length > 0}
        canRedo={state.history.future.length > 0}
        canExport={hasLayers}
        canPreviewGarment={hasLayers}
        dispatch={dispatch}
        onSaveDesign={handleSaveDesign}
        onExport={handleExport}
        onOpenGarmentPreview={() => setGarmentPreviewOpen(true)}
      />

      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface lg:flex-row lg:overflow-hidden">
        <div className="order-2 min-h-0 max-h-[34vh] w-full shrink-0 overflow-hidden lg:order-none lg:h-full lg:max-h-none lg:w-[272px]">
          <HtvToolsPanel
            state={state}
            dispatch={dispatch}
            onAddText={handleAddText}
            onImportFile={handleImportFile}
            onAddShape={handleAddShape}
            onAddTemplate={handleAddTemplate}
          />
        </div>

        <div className="order-1 min-h-[58vh] min-w-0 flex-1 lg:order-none lg:min-h-0">
          <HtvCanvas state={state} dispatch={dispatch} />
        </div>

        <div className="order-3 min-h-0 max-h-[34vh] w-full shrink-0 overflow-hidden lg:order-none lg:h-full lg:max-h-none lg:w-[288px]">
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

        <HtvGarmentPreviewPanel open={garmentPreviewOpen} state={state} onClose={() => setGarmentPreviewOpen(false)} />
      </div>

      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-medium shadow-lg ${
            toast.tone === 'success' ? 'bg-success-500 text-ink-inverse' : toast.tone === 'warning' ? 'bg-warning-500 text-ink-inverse' : 'bg-danger-500 text-ink-inverse'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
