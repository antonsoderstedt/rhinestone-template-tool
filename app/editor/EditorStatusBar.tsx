'use client';

import { CheckCircle2, Clock3, PenSquare, WandSparkles } from 'lucide-react';
import { RhinestoneTemplate, getTemplatePhysicalSize } from '@/src/lib/rhinestone-engine/index';
import { CanvasState } from './EditorState';
import { getEditableStatusCopy } from './editorUi';
import { useIsMobileStudio } from '../lib/useMediaQuery';

interface EditorStatusBarProps {
  template: RhinestoneTemplate | null;
  canvas: CanvasState;
  exportReady: boolean;
  exportErrorCount: number;
  exportWarningCount: number;
  needsCalibration?: boolean;
  spacingAdjustmentNote?: string | null;
  isEditable: boolean;
  autosaveUpdatedAt: string | null;
  activeLibraryName: string | null;
  onReportProblem?: () => void;
}

export default function EditorStatusBar({
  template,
  canvas,
  exportReady,
  exportErrorCount,
  exportWarningCount,
  needsCalibration = false,
  spacingAdjustmentNote,
  isEditable,
  autosaveUpdatedAt,
  activeLibraryName,
  onReportProblem,
}: EditorStatusBarProps) {
  // On a phone this bar scrolls sideways; a scrollable region has to be reachable with the keyboard.
  const isMobile = useIsMobileStudio();
  const stoneCount = template?.stones.length ?? 0;
  const statusCopy = getEditableStatusCopy(isEditable);
  const autosaveLabel = autosaveUpdatedAt
    ? `Autosaved ${new Date(autosaveUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : 'Autosave on';
  
  const physicalSize = template && template.stones.length > 0
    ? (() => {
        const bounds = getTemplatePhysicalSize(template);
        return `${bounds.widthMm.toFixed(1)}×${bounds.heightMm.toFixed(1)} mm`;
      })()
    : '0×0 mm';

  const workflowStateLabel = !template
    ? 'No template'
    : exportReady
    ? 'Ready to export'
    : exportErrorCount > 0
      ? `${exportErrorCount} error${exportErrorCount !== 1 ? 's' : ''}`
      : needsCalibration
        ? 'Needs calibration'
      : template
        ? `${exportWarningCount} warning${exportWarningCount !== 1 ? 's' : ''}`
        : 'No template';

  const workflowToneClass = !template
    ? 'border-[var(--studio-border)] bg-[var(--studio-hover-overlay-soft)] text-[var(--studio-ink-muted)]'
    : exportReady
    ? 'border-success-500/30 bg-success-50 text-success-600'
    : exportErrorCount > 0
      ? 'border-danger-500/30 bg-danger-50 text-danger-600'
      : needsCalibration
        ? 'border-warning-500/30 bg-warning-50 text-warning-700'
      : template
        ? 'border-warning-500/30 bg-warning-50 text-warning-600'
        : 'border-[var(--studio-border)] bg-[var(--studio-hover-overlay-soft)] text-[var(--studio-ink-muted)]';

  return (
    <footer tabIndex={isMobile ? 0 : undefined} aria-label="Design status" className="flex flex-wrap items-center justify-between gap-3 max-lg:flex-nowrap max-lg:overflow-x-auto max-lg:whitespace-nowrap max-lg:px-3 border-t border-[var(--studio-border)] bg-[var(--studio-well)] px-4 py-1.5 text-xs text-[var(--studio-ink-muted)]">
      <div className="flex flex-wrap items-center gap-3 max-lg:shrink-0 max-lg:flex-nowrap">
        <span className="font-medium">{stoneCount} stone{stoneCount !== 1 && 's'}</span>
        <span className="font-mono">{physicalSize}</span>
        {spacingAdjustmentNote && (
          <span className="rounded-full border border-warning-500/30 bg-warning-50 px-2.5 py-1 font-medium text-warning-700">
            {spacingAdjustmentNote}
          </span>
        )}
        <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${isEditable ? 'border-info-500/30 bg-info-500/15 text-info-700' : 'border-accent-300 bg-accent-50 text-accent-700'}`} title={statusCopy.actionHint}>
          {isEditable ? <PenSquare className="h-3.5 w-3.5" /> : <WandSparkles className="h-3.5 w-3.5" />}
          <span className="font-medium">{statusCopy.label}</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 max-lg:shrink-0 max-lg:flex-nowrap">
        <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${workflowToneClass}`}>
          {exportReady ? <CheckCircle2 className="h-3.5 w-3.5" /> : exportErrorCount > 0 ? <div className="h-2 w-2 rounded-full bg-danger-500" /> : needsCalibration ? <div className="h-2 w-2 rounded-full bg-warning-500" /> : template ? <div className="h-2 w-2 rounded-full bg-warning-500" /> : <Clock3 className="h-3.5 w-3.5" />}
          <span className="font-medium">{workflowStateLabel}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 max-lg:shrink-0 max-lg:flex-nowrap">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${activeLibraryName ? 'border-success-500/30 bg-success-50 text-success-600' : 'border-[var(--studio-border)] bg-[var(--studio-hover-overlay-soft)] text-[var(--studio-ink-muted)]'}`}>
          <Clock3 className="h-3.5 w-3.5" />
          <span>{autosaveLabel}</span>
        </span>
        {activeLibraryName && (
          <span>Saved in My Designs: <span className="font-medium text-[var(--studio-ink-secondary)]">{activeLibraryName}</span></span>
        )}
        {onReportProblem && (
          <button type="button" onClick={onReportProblem} className="underline-offset-2 hover:text-[var(--studio-ink)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
            Report a problem
          </button>
        )}
        <span>Zoom: <span className="font-mono text-[var(--studio-ink-secondary)]">{Math.round(canvas.zoom * 100)}%</span></span>
        {canvas.showGrid && (
          <span className="text-[var(--studio-ink-muted)]">Grid: {canvas.gridSizeMm}mm</span>
        )}
        {canvas.showRulers && (
          <span className="text-[var(--studio-ink-muted)]">Rulers on</span>
        )}
      </div>
    </footer>
  );
}
