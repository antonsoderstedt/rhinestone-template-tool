'use client';

import { useState } from 'react';
import { DEFAULT_EDITOR_STATE, type EditorAction } from '../EditorState';
import type { EditorState } from '../EditorState';
import EditorPropertiesPanel from '../EditorPropertiesPanel';
import type { OutlineFontStatus } from '../controls/FontPicker';
import { useIsMobileStudio } from '../../lib/useMediaQuery';
import { type ArtworkInfo } from '../artworkGeneration';
import { RAIL_TOOLS, getCanvasHint, railToolFor } from '../editorUi';
import type { ExportReadinessResult } from '@/src/lib/rhinestone-engine/index';
import { useT } from '../../lib/i18n';

export type MobilePanel = 'none' | 'tools' | 'design' | 'inspect';

export function StudioToolRail({
  activeTool,
  mobileOpen,
  onSelectTool,
}: {
  activeTool: typeof DEFAULT_EDITOR_STATE.activeTool;
  /** Phones/tablets: the Tools tab is open, so the rail shows as a grid under the canvas. */
  mobileOpen: boolean;
  onSelectTool: (tool: typeof DEFAULT_EDITOR_STATE.activeTool) => void;
}) {
  const t = useT();
  return (
    <nav
      className={`order-2 shrink-0 border-[var(--studio-border)] bg-[var(--studio-well)] max-lg:max-h-[44dvh] max-lg:overflow-y-auto max-lg:border-t max-lg:p-3 ${mobileOpen ? 'max-lg:grid max-lg:grid-cols-3 max-lg:gap-2 sm:max-lg:grid-cols-5' : 'max-lg:hidden'} lg:order-none lg:flex lg:h-full lg:w-[68px] lg:flex-col lg:gap-1 lg:border-r lg:px-1.5 lg:py-2`}
      aria-label={t('Studio tools')}
    >
      {RAIL_TOOLS.map((tool) => {
        const Icon = tool.icon;
        const active = railToolFor(activeTool) === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => onSelectTool(tool.id)}
            title={tool.description}
            aria-label={tool.label}
            aria-pressed={active}
            className={`flex min-h-16 flex-col items-center justify-center rounded-md px-2 py-2 text-xs transition lg:min-h-0 ${active ? 'bg-violet-500/35 text-white shadow-sm' : 'text-[var(--studio-ink-muted)] hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]'}`}
          >
            <Icon className="h-5 w-5 lg:h-4 lg:w-4" />
            <span className="mt-1 truncate">{tool.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── Tabbed context panel ───────────────────────────────────────────────────

export function StudioContextPanel({
  state,
  dispatch,
  outlineFontStatus,
  artworkInfo,
  exportReadiness,
  stones,
  onQuickFix,
  canResize,
  overlapEnlargement,
  mobilePanel,
}: {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  outlineFontStatus: OutlineFontStatus;
  artworkInfo: ArtworkInfo | null;
  exportReadiness: ExportReadinessResult | null;
  stones?: ReadonlyArray<{ stoneSize: import('@/src/lib/rhinestone-engine/index').StoneSizeId }>;
  onQuickFix: (action: import('../quickFixItems').QuickFixAction) => void;
  canResize: boolean;
  overlapEnlargement: { scale: number; widthMm: number } | null;
  /** Phones/tablets: which bottom-bar panel is open. `'none'` on desktop, where both tabs are visible. */
  mobilePanel: 'none' | 'tools' | 'design' | 'inspect';
}) {
  const t = useT();
  // Auto-switch: Inspect when select tool is active, Design (source settings) for generators.
  const autoTab = state.activeTool === 'select' ? 'inspector' : 'source';
  const [manualTab, setManualTab] = useState<'source' | 'inspector' | null>(null);
  const [prevTool, setPrevTool] = useState(state.activeTool);
  if (prevTool !== state.activeTool) {
    setPrevTool(state.activeTool);
    setManualTab(null);
  }
  // On a phone the bottom bar picks the tab; on desktop the tab strip does.
  const isMobile = useIsMobileStudio();
  const tab = isMobile && mobilePanel === 'design' ? 'source' : isMobile && mobilePanel === 'inspect' ? 'inspector' : (manualTab ?? autoTab);
  const mobileVisible = mobilePanel === 'design' || mobilePanel === 'inspect';

  return (
    <aside aria-label={t('Design and inspector')} className={`order-2 min-h-0 w-full shrink-0 flex-col overflow-hidden border-t border-[var(--studio-border)] max-lg:h-[44dvh] ${mobileVisible ? 'max-lg:flex' : 'max-lg:hidden'} lg:order-none lg:flex lg:h-full lg:max-h-none lg:w-[260px] lg:border-l lg:border-t-0`}>
      {/* Tabs */}
      <div role="tablist" aria-label={t('Panel')} className="flex shrink-0 border-b max-lg:hidden border-[var(--studio-border)] bg-[var(--studio-well)]">
        {(['source', 'inspector'] as const).map((t) => (
          <button
            key={t}
            id={`studio-tab-${t}`}
            role="tab"
            aria-selected={tab === t}
            aria-controls="studio-panel"
            onClick={() => setManualTab(t === autoTab ? null : t)}
            className={`flex-1 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${tab === t ? 'border-b-2 border-violet-400 bg-[var(--studio-surface)] text-violet-300' : 'text-[var(--studio-ink-muted)] hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]'}`}
          >
            {t === 'source' ? 'Design' : 'Inspect'}
          </button>
        ))}
      </div>
      {/* Panel content */}
      <div id="studio-panel" role="tabpanel" aria-labelledby={`studio-tab-${tab}`} className="min-h-0 flex-1 overflow-hidden">
        <EditorPropertiesPanel
          state={state}
          dispatch={dispatch}
          mode={tab}
          outlineFontStatus={outlineFontStatus}
          artworkInfo={artworkInfo}
          exportReadiness={tab === 'inspector' ? exportReadiness : null}
          stones={tab === 'inspector' ? stones : undefined}
          onQuickFix={onQuickFix}
          canResize={canResize}
          overlapEnlargement={overlapEnlargement}
        />
      </div>
    </aside>
  );
}

// ─── Canvas action strip ────────────────────────────────────────────────────

export function CanvasActionStrip({
  activeTool,
  hasTemplate,
  isEditable,
  dispatch,
}: {
  activeTool: EditorState['activeTool'];
  hasTemplate: boolean;
  isEditable: boolean;
  dispatch: React.Dispatch<EditorAction>;
}) {
  const hint = getCanvasHint(activeTool);

  const primaryAction = !hasTemplate
    ? null
    : !isEditable && activeTool !== 'select' && activeTool !== 'manual'
      ? { label: 'Edit stones', onClick: () => dispatch({ type: 'CONVERT_TO_EDITABLE' }) }
      : null;

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-1.5">
      <p className="min-w-0 truncate text-xs text-[var(--studio-ink-muted)]">{hint}</p>
      {primaryAction && (
        <button
          onClick={primaryAction.onClick}
          className="shrink-0 rounded-md border border-violet-400/30 bg-violet-500/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-violet-300 transition hover:bg-violet-500/25"
        >
          {primaryAction.label}
        </button>
      )}
    </div>
  );
}
