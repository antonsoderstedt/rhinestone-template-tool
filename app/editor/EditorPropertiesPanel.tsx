'use client';

import { PenLine, Sparkles } from 'lucide-react';
import { TEXT_LABELS_NOT_CRICUT_SAFE_MESSAGE } from '@/src/lib/rhinestone-engine/index';
import type { ExportReadinessResult } from '@/src/lib/rhinestone-engine/index';
import ExportReadinessPanel from '../components/ExportReadinessPanel';
import QuickFixes from './QuickFixes';
import DesignPartsPanel from './DesignPartsPanel';
import StoneEstimateCard from './StoneEstimateCard';
import StoneColourCounts from './controls/StoneColourCounts';
import StoneColourPicker from './controls/StoneColourPicker';
import { getQuickFixes, type QuickFixAction } from './quickFixItems';
import { EditorState, EditorAction, EditorTool } from './EditorState';
import NumericInput from './controls/NumericInput';
import { type OutlineFontStatus } from './controls/FontPicker';
import { type ArtworkInfo } from './artworkGeneration';
import { getEditableStatusCopy, getSourcePanelTool } from './editorUi';
import { useT } from '../lib/i18n';
import { PanelSection } from './properties/shared';
import { TextToolProperties } from './properties/TextToolProperties';
import { RhinestoneFontToolProperties } from './properties/RhinestoneFontToolProperties';
import { SvgAlphabetToolProperties } from './properties/SvgAlphabetToolProperties';
import { LetterStencilToolProperties } from './properties/LetterStencilToolProperties';
import { TemplateImportToolProperties } from './properties/TemplateImportToolProperties';
import { SvgToolProperties } from './properties/SvgToolProperties';
import { GridToolProperties } from './properties/GridToolProperties';
import { ManualToolProperties } from './properties/ManualToolProperties';
import { SelectToolProperties } from './properties/SelectToolProperties';

interface EditorPropertiesPanelProps {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  mode: 'source' | 'inspector';
  outlineFontStatus?: OutlineFontStatus;
  artworkInfo?: ArtworkInfo | null;
  exportReadiness?: ExportReadinessResult | null;
  /** Stones of the design as it will be exported, for the "stones to buy" estimate. */
  stones?: ReadonlyArray<{ stoneSize: import('@/src/lib/rhinestone-engine/index').StoneSizeId; metadata?: Record<string, unknown> }>;
  /** One-click fixes (spacing, fit to mat). `canResize` is false for hand-made designs. */
  onQuickFix?: (action: QuickFixAction) => void;
  canResize?: boolean;
  /** Set when the design is artwork whose stones overlap by design; see getQuickFixes. */
  overlapEnlargement?: { scale: number; widthMm: number } | null;
}

export default function EditorPropertiesPanel({ state, dispatch, mode, outlineFontStatus, artworkInfo, exportReadiness, stones, onQuickFix, canResize = false, overlapEnlargement = null }: EditorPropertiesPanelProps) {
  const t = useT();
  if (mode === 'source') {
    const sourceTool = getSourcePanelTool(state);
    const statusCopy = getEditableStatusCopy(state.editableTemplate.isEditable);
    return (
      <div className="rhinestone-studio-panel flex h-full w-full flex-col gap-3 overflow-y-auto overscroll-contain bg-[var(--studio-surface)] p-3 backdrop-blur-xl">

        {state.activeTool === 'select' ? (
          <>
            <PanelSection title={t('Select tool')} description={t('Click, shift-click, or drag a box on the canvas to select stones.')}>
              <p className="text-xs text-[var(--studio-ink-muted)]">{t('Switch to the Inspect tab to fine-tune selection position, alignment, and export options.')}</p>
            </PanelSection>
            {state.parts.length > 0 && <DesignPartsPanel state={state} dispatch={dispatch} />}
          </>
        ) : (
          <>
            <PanelSection title={statusCopy.label} description={statusCopy.description} defaultOpen={false}>
              <div className={`rounded-md border px-3 py-2 shadow-sm ${state.editableTemplate.isEditable ? 'border-sky-400/30 bg-sky-500/10 text-sky-200' : 'border-violet-400/30 bg-violet-500/15 text-violet-100'}`}>
                <div className="flex items-center gap-2 text-sm font-medium">
                  {state.editableTemplate.isEditable ? <PenLine className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  <span>{statusCopy.label}</span>
                </div>
                <p className="mt-2 text-xs text-[var(--studio-ink-muted)]">{statusCopy.actionHint}</p>
              </div>
            </PanelSection>

            <PanelSection title={getToolTitle(sourceTool)}>
              {sourceTool === 'text' && <TextToolProperties state={state} dispatch={dispatch} outlineFontStatus={outlineFontStatus} />}
              {sourceTool === 'rhinestone-font' && <RhinestoneFontToolProperties state={state} dispatch={dispatch} outlineFontStatus={outlineFontStatus} />}
              {sourceTool === 'svg-alphabet' && <SvgAlphabetToolProperties state={state} dispatch={dispatch} outlineFontStatus={outlineFontStatus} />}
              {sourceTool === 'letter-stencil' && <LetterStencilToolProperties state={state} dispatch={dispatch} outlineFontStatus={outlineFontStatus} />}
              {sourceTool === 'svg' && <SvgToolProperties state={state} dispatch={dispatch} artworkInfo={artworkInfo} />}
              {sourceTool === 'template-import' && <TemplateImportToolProperties state={state} dispatch={dispatch} />}
              {sourceTool === 'grid' && <GridToolProperties state={state} dispatch={dispatch} />}
              {sourceTool === 'manual' && <ManualToolProperties state={state} dispatch={dispatch} />}
            </PanelSection>
            <DesignPartsPanel state={state} dispatch={dispatch} />
          </>
        )}
      </div>
    );
  }

  if (mode === 'inspector') {
    const quickFixes = getQuickFixes(exportReadiness ?? null, { enlargement: overlapEnlargement });
    return (
      <div className="rhinestone-studio-panel flex h-full w-full flex-col gap-3 overflow-y-auto overscroll-contain bg-[var(--studio-surface)] p-3 backdrop-blur-xl">
        {quickFixes.length > 0 && onQuickFix && (
          <PanelSection title={t('Quick fixes')} description={t('Problems found in this design, and one-click ways to fix them.')}>
            <QuickFixes items={quickFixes} canResize={canResize} onAction={onQuickFix} />
          </PanelSection>
        )}

        <PanelSection title={t('Inspector')} description={t('Selection, position, alignment, and export controls live here.')}>
          <SelectToolProperties state={state} dispatch={dispatch} />
        </PanelSection>

        <PanelSection title={t('Export Settings')} description={t('These options affect only the exported SVG output.')} defaultOpen={false}>
          <label className="flex items-center gap-2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-2 text-sm text-[var(--studio-ink-secondary)]">
            <input
              type="checkbox"
              checked={state.includeGuideBox}
              onChange={(e) => dispatch({ type: 'UPDATE_EXPORT_SETTINGS', updates: { includeGuideBox: e.target.checked } })}
              className="h-4 w-4 rounded border-[var(--studio-border-strong)] bg-[var(--studio-well)]"
            />
            {t('Include guide box')}
          </label>

          <label className="flex items-center gap-2 rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-2 text-sm text-[var(--studio-ink-secondary)]">
            <input
              type="checkbox"
              checked={state.includeLabels}
              onChange={(e) => dispatch({ type: 'UPDATE_EXPORT_SETTINGS', updates: { includeLabels: e.target.checked } })}
              className="h-4 w-4 rounded border-[var(--studio-border-strong)] bg-[var(--studio-well)]"
            />
            {t('Include labels')}
          </label>

          {state.includeLabels && (
            <div role="alert" className="rounded-xl border border-warning-500/30 bg-warning-50 px-3 py-3 text-xs text-warning-600">
              {TEXT_LABELS_NOT_CRICUT_SAFE_MESSAGE}
            </div>
          )}

          <NumericInput
            label={t('Padding')}
            value={state.paddingMm}
            onChange={(val) => dispatch({ type: 'UPDATE_EXPORT_SETTINGS', updates: { paddingMm: typeof val === 'number' ? val : state.paddingMm } })}
            unit="mm"
            min={0}
            max={100}
            step={0.5}
          />
        </PanelSection>

        {stones && stones.length > 0 && (
          <PanelSection title={t('Stone colour')} description={t('What colour the stones will be. Each colour of an uploaded artwork can have its own.')} defaultOpen={false}>
            <StoneColourPicker
              label={t('Colour of the stones')}
              value={state.designStoneColour}
              noneLabel={t('No colour')}
              onChange={(colour) => dispatch({ type: 'SET_DESIGN_STONE_COLOUR', colour })}
            />
          </PanelSection>
        )}

        {stones && stones.length > 0 && (
          <PanelSection title={t('Stones to buy')} description={t('How many stones and packs this design needs.')} defaultOpen={false}>
            <StoneColourCounts stones={stones} />
            <StoneEstimateCard stones={stones} />
          </PanelSection>
        )}

        {exportReadiness && (
          <PanelSection title={t('Export readiness')} description={t('Cricut-safe checks for the current design.')} defaultOpen={false}>
            <ExportReadinessPanel result={exportReadiness} />
          </PanelSection>
        )}
      </div>
    );
  }
}

// ─── Tool-Specific Property Panels ───────────────────────────────────────────

function getToolTitle(tool: EditorTool): string {
  switch (tool) {
    case 'select': return 'Selection';
    case 'text': return 'Text Source';
    case 'svg': return 'Artwork Source';
    case 'grid': return 'Grid Source';
    case 'rhinestone-font': return 'Text Source';
    case 'svg-alphabet': return 'SVG Alphabet';
    case 'letter-stencil': return 'Letter Stencils';
    case 'template-import': return 'Template Import';
    case 'manual': return 'Manual Source';
  }
}
