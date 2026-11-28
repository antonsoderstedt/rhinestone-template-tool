'use client';

import { Expand, Gem, Grid2X2, Hand, Minus, Plus, Scan } from 'lucide-react';
import { useT } from '../../lib/i18n';
import { IconButton } from '../ui';

interface CanvasToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onFitToScreen: () => void;
  panMode: boolean;
  onTogglePanMode: () => void;
  realisticStones: boolean;
  onToggleRealisticStones: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
}

/** The zoom, hand, shiny-stones and grid buttons in the corner of the canvas. */
export function CanvasToolbar({ onZoomIn, onZoomOut, onZoomReset, onFitToScreen, panMode, onTogglePanMode, realisticStones, onToggleRealisticStones, showGrid, onToggleGrid }: CanvasToolbarProps) {
  const t = useT();
  return (
    <div className="absolute right-4 top-4 z-10 flex gap-1 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)]/90 p-1 shadow-md backdrop-blur-sm lg:flex-col lg:p-1.5">
      <IconButton onClick={onZoomIn} title={t('Zoom in')} aria-label={t('Zoom in')}>
        <Plus className="h-4 w-4" />
      </IconButton>
      <IconButton onClick={onZoomOut} title={t('Zoom out')} aria-label={t('Zoom out')}>
        <Minus className="h-4 w-4" />
      </IconButton>
      <IconButton onClick={onZoomReset} title={t('Reset zoom to 100%')} aria-label={t('Reset zoom')}>
        <Scan className="h-4 w-4" />
      </IconButton>
      <IconButton onClick={onFitToScreen} title={t('Fit the design to the current canvas view')} aria-label={t('Fit to screen')}>
        <Expand className="h-4 w-4" />
      </IconButton>
      <div className="mx-1 w-px bg-border lg:mx-0 lg:my-1 lg:h-px lg:w-auto" />
      <IconButton
        onClick={onTogglePanMode}
        intent={panMode ? 'active' : 'default'}
        title={panMode ? 'Stop moving the view with one finger' : 'Move the view with one finger or the mouse'}
        aria-label={t('Toggle hand tool')}
        aria-pressed={panMode}
      >
        <Hand className="h-4 w-4" />
      </IconButton>
      <IconButton
        onClick={onToggleRealisticStones}
        intent={realisticStones ? 'active' : 'default'}
        title={realisticStones ? 'Show flat holes' : 'Show shiny stones'}
        aria-label={t('Toggle shiny stones')}
        aria-pressed={realisticStones}
      >
        <Gem className="h-4 w-4" />
      </IconButton>
      <IconButton
        onClick={onToggleGrid}
        intent={showGrid ? 'active' : 'default'}
        title={showGrid ? 'Hide grid overlay' : 'Show grid overlay'}
        aria-label={t('Toggle grid')}
      >
        <Grid2X2 className="h-4 w-4" />
      </IconButton>
    </div>
  );
}
