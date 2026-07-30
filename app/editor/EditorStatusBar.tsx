'use client';

import { CheckCircle2, PenSquare, WandSparkles } from 'lucide-react';
import { RhinestoneTemplate, getTemplatePhysicalSize } from '@/src/lib/rhinestone-engine/index';
import { CanvasState } from './EditorState';
import { getEditableStatusCopy } from './editorUi';

interface EditorStatusBarProps {
  template: RhinestoneTemplate | null;
  canvas: CanvasState;
  exportReady: boolean;
  isEditable: boolean;
}

export default function EditorStatusBar({ template, canvas, exportReady, isEditable }: EditorStatusBarProps) {
  const stoneCount = template?.stones.length ?? 0;
  const statusCopy = getEditableStatusCopy(isEditable);
  
  const physicalSize = template && template.stones.length > 0
    ? (() => {
        const bounds = getTemplatePhysicalSize(template);
        return `${bounds.widthMm.toFixed(1)}×${bounds.heightMm.toFixed(1)} mm`;
      })()
    : '0×0 mm';

  return (
    <footer className="flex items-center justify-between gap-6 border-t border-zinc-800 bg-zinc-950 px-5 py-3 text-xs">
      {/* Left: Design stats */}
      <div className="flex items-center gap-4 text-zinc-400">
        <span>
          <span className="font-medium text-zinc-300">{stoneCount}</span> stone{stoneCount !== 1 && 's'}
        </span>
        <span className="text-zinc-600">|</span>
        <span>
          Size: <span className="font-mono text-zinc-300">{physicalSize}</span>
        </span>
        <span className="text-zinc-600">|</span>
        <span className={`flex items-center gap-2 rounded-full border px-3 py-1 ${isEditable ? 'border-blue-500/30 bg-blue-500/15 text-blue-200' : 'border-purple-500/30 bg-purple-500/15 text-purple-200'}`} title={statusCopy.actionHint}>
          {isEditable ? <PenSquare className="h-3.5 w-3.5" /> : <WandSparkles className="h-3.5 w-3.5" />}
          <span className="font-medium">{statusCopy.label}</span>
        </span>
      </div>

      {/* Center: Export readiness */}
      <div className="flex min-w-[280px] items-center justify-center gap-3 text-zinc-300">
        <div className="hidden text-center lg:block">
          <p className="font-medium text-zinc-100">{statusCopy.description}</p>
          <p className="text-[11px] text-zinc-500">{statusCopy.actionHint}</p>
        </div>
        {exportReady ? (
          <div className="flex items-center gap-1.5 text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Ready to export</span>
          </div>
        ) : template ? (
          <div className="flex items-center gap-1.5 text-yellow-400">
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            <span>Has warnings</span>
          </div>
        ) : (
          <span className="text-zinc-500">No template</span>
        )}
      </div>

      {/* Right: Canvas info */}
      <div className="flex items-center gap-4 text-zinc-400">
        <span>
          Zoom: <span className="font-mono text-zinc-300">{Math.round(canvas.zoom * 100)}%</span>
        </span>
        {canvas.showGrid && (
          <>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-500">Grid: {canvas.gridSizeMm}mm</span>
          </>
        )}
      </div>
    </footer>
  );
}
