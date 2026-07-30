'use client';

import { RhinestoneTemplate, getTemplatePhysicalSize } from '@/src/lib/rhinestone-engine/index';
import { CanvasState } from './EditorState';

interface EditorStatusBarProps {
  template: RhinestoneTemplate | null;
  canvas: CanvasState;
  exportReady: boolean;
  isEditable: boolean;
}

export default function EditorStatusBar({ template, canvas, exportReady, isEditable }: EditorStatusBarProps) {
  const stoneCount = template?.stones.length ?? 0;
  
  const physicalSize = template && template.stones.length > 0
    ? (() => {
        const bounds = getTemplatePhysicalSize(template);
        return `${bounds.widthMm.toFixed(1)}×${bounds.heightMm.toFixed(1)} mm`;
      })()
    : '0×0 mm';

  return (
    <footer className="flex items-center justify-between border-t border-zinc-700 bg-zinc-900 px-4 py-2 text-xs">
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
        {isEditable ? (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Editable
          </span>
        ) : (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Generated
          </span>
        )}
      </div>

      {/* Center: Export readiness */}
      <div className="flex items-center gap-2">
        {exportReady ? (
          <div className="flex items-center gap-1.5 text-green-400">
            <div className="w-2 h-2 rounded-full bg-green-400" />
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
