'use client';

import { useCallback, useEffect, useReducer, useState } from 'react';
import {
  DEFAULT_HTV_STATE,
  createHtvTextLayer,
  createHtvVectorLayer,
  htvReducer,
} from './HtvState';
import HtvTopbar from './HtvTopbar';
import HtvToolsPanel from './HtvToolsPanel';
import HtvCanvas from './HtvCanvas';
import HtvInspectorPanel from './HtvInspectorPanel';
import HtvSilhouetteConverterModal from './HtvSilhouetteConverterModal';
import HtvGarmentPreviewPanel from './HtvGarmentPreviewPanel';
import { createHtvSvgExport } from './htvExport';
import { centerPolylines } from './htvGeometry';
import { decodeRasterImageDataUrl } from '../lib/rasterImageDecode';
import { listOutlineFonts, svgStringToPolylines, type TraceableImageData } from '@/src/lib/rhinestone-engine/index';

const DEFAULT_TEXT_FONT_ID = listOutlineFonts().find((f) => !f.isLegacy)?.fontId ?? '';

export default function HtvShell() {
  const [state, dispatch] = useReducer(htvReducer, DEFAULT_HTV_STATE);
  const [nextLayerId, setNextLayerId] = useState(0);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'warning' | 'error' } | null>(null);
  const [garmentPreviewOpen, setGarmentPreviewOpen] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ image: TraceableImageData; previewDataUrl: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), toast.tone === 'error' ? 5000 : 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const createLayerId = useCallback((prefix: string) => {
    setNextLayerId((n) => n + 1);
    return `${prefix}-${nextLayerId}`;
  }, [nextLayerId]);

  const handleAddText = useCallback(() => {
    const layer = createHtvTextLayer({ id: createLayerId('text'), fontId: DEFAULT_TEXT_FONT_ID, text: 'TEXT' });
    dispatch({ type: 'ADD_LAYERS', layers: [layer] });
  }, [createLayerId]);

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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedLayerIds, state.layers]);

  const hasLayers = state.layers.length > 0;

  return (
    <div className="h-screen flex flex-col bg-surface">
      <HtvTopbar
        projectName={state.projectName}
        canUndo={state.history.past.length > 0}
        canRedo={state.history.future.length > 0}
        canExport={hasLayers}
        canPreviewGarment={hasLayers}
        dispatch={dispatch}
        onExport={handleExport}
        onOpenGarmentPreview={() => setGarmentPreviewOpen(true)}
      />

      <div className="relative flex min-h-0 flex-1">
        <div className="w-[300px] shrink-0">
          <HtvToolsPanel state={state} dispatch={dispatch} onAddText={handleAddText} onImportFile={handleImportFile} />
        </div>

        <HtvCanvas state={state} dispatch={dispatch} />

        <div className="w-[300px] shrink-0">
          <HtvInspectorPanel state={state} dispatch={dispatch} />
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
