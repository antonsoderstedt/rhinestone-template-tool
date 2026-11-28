'use client';

import { getRecommendedCenterDistance } from '@/src/lib/rhinestone-engine/index';
import StoneProfileControl from '../controls/StoneProfileControl';
import NumericInput from '../controls/NumericInput';
import { useT } from '../../lib/i18n';
import { ToolPropertiesProps } from './shared';

export function ManualToolProperties({ state, dispatch }: ToolPropertiesProps) {
  const t = useT();
  const { manualTool } = state;
  const recommendedDrawSpacingMm = getRecommendedCenterDistance(manualTool.addStoneSize);
  const selectAllStoneIds = state.editableTemplate.isEditable
    ? state.editableTemplate.stones.map((stone) => stone.id)
    : state.template?.stones.map((stone) => stone.id) ?? [];

  const handleMoveWholeDesign = () => {
    if (!state.editableTemplate.isEditable && state.template) {
      dispatch({ type: 'CONVERT_TO_EDITABLE' });
    }
    if (selectAllStoneIds.length > 0) {
      dispatch({ type: 'SET_SELECTED_STONES', ids: new Set(selectAllStoneIds) });
    }
    dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'select' });
  };
  
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface-sunken px-3 py-3 text-sm text-ink-secondary">
        <p className="font-medium text-ink">{t('Pen tool')}</p>
        <p className="mt-1 text-xs text-ink-muted">{t('Draw or erase directly on the canvas. Pen mode is now freehand by default, while the grid stays visible as a guide in the background.')}</p>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-medium text-ink-secondary">{t('Tool mode')}</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => dispatch({ type: 'UPDATE_MANUAL_TOOL', updates: { interactionMode: 'place' } })}
            className={`rounded-xl border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${manualTool.interactionMode === 'place' ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'}`}
          >
            <div className="font-medium">{t('Place')}</div>
            <div className="mt-1 text-xs text-ink-muted">{t('Click or drag to add stones')}</div>
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'UPDATE_MANUAL_TOOL', updates: { interactionMode: 'erase' } })}
            className={`rounded-xl border px-3 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${manualTool.interactionMode === 'erase' ? 'border-danger-400 bg-danger-50 text-danger-600' : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'}`}
          >
            <div className="font-medium">{t('Erase')}</div>
            <div className="mt-1 text-xs text-ink-muted">{t('Click or drag to remove stones')}</div>
          </button>
        </div>
      </div>
      
      {manualTool.interactionMode === 'place' && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-ink-secondary">{t('Draw mode')}</span>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'UPDATE_MANUAL_TOOL', updates: { drawMode: 'freehand' } })}
              className={`rounded-xl border px-2 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${manualTool.drawMode === 'freehand' ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'}`}
            >
              <div className="font-medium">{t('Freehand')}</div>
              <div className="mt-1 text-xs text-ink-muted">{t('Follows the cursor, nudges around crowding')}</div>
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'UPDATE_MANUAL_TOOL', updates: { drawMode: 'grid' } })}
              className={`rounded-xl border px-2 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${manualTool.drawMode === 'grid' ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'}`}
            >
              <div className="font-medium">{t('Grid snap')}</div>
              <div className="mt-1 text-xs text-ink-muted">{t('Locks every stone to the grid')}</div>
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'UPDATE_MANUAL_TOOL', updates: { drawMode: 'row' } })}
              className={`rounded-xl border px-2 py-2 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${manualTool.drawMode === 'row' ? 'border-accent-400 bg-accent-50 text-ink' : 'border-border bg-surface-sunken text-ink-secondary hover:border-border hover:bg-surface-raised'}`}
            >
              <div className="font-medium">{t('Row lock')}</div>
              <div className="mt-1 text-xs text-ink-muted">{t('Keeps a drag perfectly straight')}</div>
            </button>
          </div>
          {manualTool.drawMode === 'grid' && (
            <p className="text-xs text-ink-muted">{t('Grid snap forces every stone onto the grid below, ignoring "Snap to Grid" — a spot that would collide is skipped instead of nudged.')}</p>
          )}
          {manualTool.drawMode === 'row' && (
            <p className="text-xs text-ink-muted">{t('Row lock picks a horizontal or vertical line the moment you start dragging, then keeps every stone on it.')}</p>
          )}
        </div>
      )}

      {/* Stone Size */}
      <StoneProfileControl
        value={manualTool.addStoneSize}
        onChange={(size) => dispatch({ type: 'UPDATE_MANUAL_TOOL', updates: { addStoneSize: size } })}
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_SELECTED_STONES', ids: new Set(selectAllStoneIds) })}
          disabled={selectAllStoneIds.length === 0}
          className="rounded-lg border border-border bg-surface-sunken px-3 py-2 text-xs font-medium text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('Select all')}
        </button>
        <button
          type="button"
          onClick={handleMoveWholeDesign}
          disabled={selectAllStoneIds.length === 0}
          className="rounded-lg border border-info-500/20 bg-info-50 px-3 py-2 text-xs font-medium text-info-600 transition hover:bg-info-500/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('Move whole design')}
        </button>
      </div>

      <NumericInput
        label={manualTool.interactionMode === 'erase' ? 'Erase brush size' : 'Smart assist reach'}
        value={manualTool.assistBrushSizeMm}
        onChange={(val) => dispatch({ type: 'UPDATE_MANUAL_TOOL', updates: { assistBrushSizeMm: typeof val === 'number' ? val : manualTool.assistBrushSizeMm } })}
        unit="mm"
        min={2}
        max={60}
        step={0.5}
      />
      
      {/* Snap to Grid */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-xs font-medium text-ink-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={manualTool.snapToGrid}
            onChange={(e) => dispatch({ type: 'UPDATE_MANUAL_TOOL', updates: { snapToGrid: e.target.checked } })}
            className="rounded border-border bg-surface-sunken text-accent-600 focus:ring-accent-500 focus:ring-offset-0"
          />
          {t('Snap to Grid')}
        </label>

        <div className="rounded-xl border border-border bg-surface-sunken px-3 py-3">
          <NumericInput
            label={t('Grid Size (mm)')}
            value={manualTool.gridSnapSize}
            onChange={(val) => dispatch({ type: 'UPDATE_MANUAL_TOOL', updates: { gridSnapSize: val as number } })}
            min={1}
            max={50}
            step={1}
            unit="mm"
            disabled={!manualTool.snapToGrid}
          />
          {!manualTool.snapToGrid && <p className="mt-2 text-xs text-ink-muted">{t('Enable Snap to Grid to adjust the placement step size.')}</p>}
        </div>
      </div>

      {!manualTool.snapToGrid && manualTool.drawMode !== 'grid' && (
        <div className="rounded-xl border border-success-500/20 bg-success-50 px-3 py-3 text-xs text-success-600">
          Free draw is active. The grid is visual only until you enable snapping{manualTool.drawMode === 'freehand' ? '' : ' (Row lock still keeps the drag straight)'}.
        </div>
      )}

      <label className="flex items-center gap-2 text-xs font-medium text-ink-secondary cursor-pointer">
        <input
          type="checkbox"
          checked={state.canvas.showRulers}
          onChange={(e) => dispatch({ type: 'UPDATE_CANVAS', updates: { showRulers: e.target.checked } })}
          className="rounded border-border bg-surface-sunken text-accent-600 focus:ring-accent-500 focus:ring-offset-0"
        />
        {t('Show rulers in preview')}
      </label>

      <div className="rounded-xl border border-border bg-surface-sunken px-3 py-3 text-xs text-ink-muted">
        {manualTool.interactionMode === 'erase'
          ? 'Erase mode removes stones directly under the cursor path without switching to Select.'
          : `Draw mode uses about ${recommendedDrawSpacingMm.toFixed(1)} mm center-to-center spacing for ${manualTool.addStoneSize}. Smart assist can search about ${manualTool.assistBrushSizeMm.toFixed(1)} mm for a better spot.`}
      </div>
      
      <div className="pt-4 border-t border-border space-y-2">
        <p className="text-xs text-ink-secondary">{t('Keyboard shortcuts:')}</p>
        <ul className="text-xs text-ink-muted space-y-1">
          <li>• Place mode: click one stone or drag a line</li>
          <li>• Erase mode: click or drag to remove stones</li>
          <li>• Move whole design selects everything and switches to Select</li>
          <li>• Ctrl/Cmd + wheel zooms · wheel pans the canvas</li>
        </ul>
      </div>
    </div>
  );
}
