'use client';

import { CheckCircle2, Clock3, PenSquare, WandSparkles } from 'lucide-react';
import { RhinestoneTemplate, getTemplatePhysicalSize } from '@/src/lib/rhinestone-engine/index';
import { CanvasState } from './EditorState';
import { getEditableStatusCopy } from './editorUi';

interface EditorStatusBarProps {
  template: RhinestoneTemplate | null;
  canvas: CanvasState;
  exportReady: boolean;
  isEditable: boolean;
  autosaveUpdatedAt: string | null;
  activeLibraryName: string | null;
}

export default function EditorStatusBar({
  template,
  canvas,
  exportReady,
  isEditable,
  autosaveUpdatedAt,
  activeLibraryName,
}: EditorStatusBarProps) {
  const stoneCount = template?.stones.length ?? 0;
  const statusCopy = getEditableStatusCopy(isEditable);
  const autosaveLabel = autosaveUpdatedAt
    ? `Autosaved ${new Date(autosaveUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Autosave pending';
  
  const physicalSize = template && template.stones.length > 0
    ? (() => {
        const bounds = getTemplatePhysicalSize(template);
        return `${bounds.widthMm.toFixed(1)}×${bounds.heightMm.toFixed(1)} mm`;
      })()
    : '0×0 mm';

  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#17171a] px-4 py-1.5 text-[11px] text-zinc-400">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium">{stoneCount} stone{stoneCount !== 1 && 's'}</span>
        <span className="font-mono">{physicalSize}</span>
        <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${isEditable ? 'border-info-500/30 bg-info-500/15 text-info-700' : 'border-accent-300 bg-accent-50 text-accent-700'}`} title={statusCopy.actionHint}>
          {isEditable ? <PenSquare className="h-3.5 w-3.5" /> : <WandSparkles className="h-3.5 w-3.5" />}
          <span className="font-medium">{statusCopy.label}</span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        {exportReady ? (
          <div className="flex items-center gap-1.5 text-success-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>Ready to export</span>
          </div>
        ) : template ? (
          <div className="flex items-center gap-1.5 text-warning-600">
            <div className="w-2 h-2 rounded-full bg-warning-500" />
            <span>Has warnings</span>
          </div>
        ) : (
          <span className="text-ink-muted">No template</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${activeLibraryName ? 'border-success-500/30 bg-success-50 text-success-600' : 'border-white/10 bg-white/5 text-zinc-400'}`}>
          <Clock3 className="h-3.5 w-3.5" />
          <span>{autosaveLabel}</span>
        </span>
        <span>Library: <span className="font-medium text-zinc-300">{activeLibraryName ?? 'Local draft'}</span></span>
        <span>Zoom: <span className="font-mono text-zinc-300">{Math.round(canvas.zoom * 100)}%</span></span>
        {canvas.showGrid && (
          <span className="text-ink-muted">Grid: {canvas.gridSizeMm}mm</span>
        )}
        {canvas.showRulers && (
          <span className="text-ink-muted">Rulers on</span>
        )}
      </div>
    </footer>
  );
}
