'use client';

import { useT } from '../../lib/i18n';
import type { EditorState } from '../EditorState';

interface CanvasStatusProps {
  state: EditorState;
  stoneCount: number;
  hoverPosition: { x: number; y: number } | null;
  hoverSuggestedFrom: { x: number; y: number } | null;
}

/** The hint when the canvas is empty, the zoom level, and the status of the manual and select tools. */
export function CanvasStatus({ state, stoneCount, hoverPosition, hoverSuggestedFrom }: CanvasStatusProps) {
  const t = useT();
  return (
    <>
    {stoneCount === 0 && (
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-8 text-center">
        <p className="text-base font-semibold text-[var(--studio-ink-secondary)]">{t('Nothing here yet')}</p>
        <p className="max-w-sm text-sm text-[var(--studio-ink-muted)]">{t('Type a text, upload artwork or pick a starter in the panel on the right.')}</p>
      </div>
    )}

    {/* Zoom Indicator */}
    <div className="absolute bottom-3 right-3 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)]/90 px-2.5 py-1 text-xs font-medium tabular-nums text-[var(--studio-ink-muted)] shadow-sm backdrop-blur-sm lg:bottom-4 lg:right-4">
      {Math.round(state.canvas.zoom * 100)}%
    </div>

    {/* Manual Tool Status */}
    {state.activeTool === 'manual' && (
      <div className="absolute bottom-3 left-3 max-w-[calc(100%-6rem)] rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)]/90 px-3 py-2 text-xs text-[var(--studio-ink-muted)] shadow-sm backdrop-blur-sm lg:bottom-4 lg:left-4">
        <div>Click to place {state.manualTool.addStoneSize} stone</div>
        {state.manualTool.snapToGrid && (
          <div className="mt-1 text-[var(--studio-ink-muted)]">Snap: {state.manualTool.gridSnapSize}mm grid</div>
        )}
        {hoverPosition && (
          <div className="mt-1 font-mono tabular-nums text-[var(--studio-ink-muted)]">
            X {hoverPosition.x.toFixed(1)} mm · Y {hoverPosition.y.toFixed(1)} mm
          </div>
        )}
        {hoverSuggestedFrom && state.manualTool.interactionMode === 'place' && (
          <div className="mt-1 text-warning-600">{t('Smart assist nudged this stone to a safer spot.')}</div>
        )}
      </div>
    )}

    {/* Select Tool Status */}
    {state.activeTool === 'select' && state.selectedStoneIds.size > 0 && (
      <div className="absolute bottom-3 left-3 max-w-[calc(100%-6rem)] rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)]/90 px-3 py-2 text-xs text-[var(--studio-ink-muted)] shadow-sm backdrop-blur-sm lg:bottom-4 lg:left-4">
        {state.selectedStoneIds.size} stone{state.selectedStoneIds.size > 1 ? 's' : ''} selected
        <div className="mt-1 text-[var(--studio-ink-muted)]">{t('Delete or drag to move')}</div>
      </div>
    )}
    </>
  );
}
