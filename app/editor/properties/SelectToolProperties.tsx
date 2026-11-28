'use client';

import { CopyPlus, DiamondMinus, Hand, MoveHorizontal, MoveVertical, ScanSearch } from 'lucide-react';
import { getRecommendedCenterDistance, getStoneSizeProfile } from '@/src/lib/rhinestone-engine/index';
import StoneColourPicker from '../controls/StoneColourPicker';
import { selectedColourOf } from '../stoneColours';
import StoneProfileControl from '../controls/StoneProfileControl';
import NumericInput from '../controls/NumericInput';
import { getSelectionActionState, getSelectionEmptyState } from '../editorUi';
import { findNearestValidStonePosition } from '../collisionDetection';
import { useT } from '../../lib/i18n';
import { ToolPropertiesProps } from './shared';

export function SelectToolProperties({ state, dispatch }: ToolPropertiesProps) {
  const t = useT();
  const selectedCount = state.selectedStoneIds.size;
  const { editableTemplate } = state;
  const actionState = getSelectionActionState(selectedCount);
  const emptyState = getSelectionEmptyState(editableTemplate.isEditable);
  
  // Get selected stone(s) for position editing
  const selectedStone = selectedCount === 1 
    ? editableTemplate.stones.find(s => state.selectedStoneIds.has(s.id))
    : null;
  const allEditableStoneIds = editableTemplate.stones.map((stone) => stone.id);

  const handleSmartFixSelection = () => {
    if (!editableTemplate.isEditable || selectedCount === 0) return;
    const selectedIds = [...state.selectedStoneIds];
    const moveAccumulator: Array<{ id: string; toX: number; toY: number }> = [];
    let workingStones = editableTemplate.stones.map((stone) => ({ ...stone, center: { ...stone.center } }));

    for (const stoneId of selectedIds) {
      const current = workingStones.find((stone) => stone.id === stoneId);
      if (!current) continue;
      const corrected = findNearestValidStonePosition(
        current.center.x,
        current.center.y,
        current.holeDiameterMm / 2,
        workingStones,
        {
          excludeIds: [stoneId],
          snapToGrid: state.manualTool.snapToGrid,
          gridSizeMm: state.manualTool.gridSnapSize,
          searchStepMm: Math.max(getRecommendedCenterDistance(current.stoneSize) / 2, 1),
          maxRadiusMm: Math.max(state.manualTool.assistBrushSizeMm, getRecommendedCenterDistance(current.stoneSize)),
        },
      );
      if (!corrected) continue;
      if (corrected.x === current.center.x && corrected.y === current.center.y) continue;

      moveAccumulator.push({ id: stoneId, toX: corrected.x, toY: corrected.y });
      workingStones = workingStones.map((stone) =>
        stone.id === stoneId ? { ...stone, center: { x: corrected.x, y: corrected.y } } : stone,
      );
    }

    if (moveAccumulator.length > 0) {
      dispatch({ type: 'MOVE_STONES', moves: moveAccumulator });
    }
  };

  const handleCleanUpSelection = () => {
    if (!editableTemplate.isEditable || selectedCount < 3) return;
    const selectedStones = editableTemplate.stones.filter((stone) => state.selectedStoneIds.has(stone.id));
    if (selectedStones.length < 3) return;

    let workingStones = editableTemplate.stones.map((stone) => ({ ...stone, center: { ...stone.center } }));
    const spanX = Math.max(...selectedStones.map((stone) => stone.center.x)) - Math.min(...selectedStones.map((stone) => stone.center.x));
    const spanY = Math.max(...selectedStones.map((stone) => stone.center.y)) - Math.min(...selectedStones.map((stone) => stone.center.y));
    const primaryAxis: 'x' | 'y' = spanX >= spanY ? 'x' : 'y';
    const secondaryAxis: 'x' | 'y' = primaryAxis === 'x' ? 'y' : 'x';
    const ordered = [...selectedStones].sort((left, right) => left.center[primaryAxis] - right.center[primaryAxis]);
    const first = ordered[0]!;
    const last = ordered[ordered.length - 1]!;
    const targetSecondary = ordered.reduce((sum, stone) => sum + stone.center[secondaryAxis], 0) / ordered.length;
    const primarySpacing = ordered.length > 1
      ? (last.center[primaryAxis] - first.center[primaryAxis]) / (ordered.length - 1)
      : 0;
    const moves: Array<{ id: string; toX: number; toY: number }> = [];

    ordered.forEach((stone, index) => {
      const targetPrimary = first.center[primaryAxis] + primarySpacing * index;
      const desiredX = primaryAxis === 'x' ? targetPrimary : targetSecondary;
      const desiredY = primaryAxis === 'x' ? targetSecondary : targetPrimary;
      const corrected = findNearestValidStonePosition(
        desiredX,
        desiredY,
        stone.holeDiameterMm / 2,
        workingStones,
        {
          excludeIds: [stone.id],
          snapToGrid: state.manualTool.snapToGrid,
          gridSizeMm: state.manualTool.gridSnapSize,
          searchStepMm: Math.max(getRecommendedCenterDistance(stone.stoneSize) / 2, 1),
          maxRadiusMm: Math.max(state.manualTool.assistBrushSizeMm, getRecommendedCenterDistance(stone.stoneSize)),
        },
      );
      if (!corrected) return;
      if (corrected.x === stone.center.x && corrected.y === stone.center.y) return;
      moves.push({ id: stone.id, toX: corrected.x, toY: corrected.y });
      workingStones = workingStones.map((candidate) =>
        candidate.id === stone.id ? { ...candidate, center: { x: corrected.x, y: corrected.y } } : candidate,
      );
    });

    if (moves.length > 0) {
      dispatch({ type: 'MOVE_STONES', moves });
    }
  };

  return (
    <div className="space-y-4">
      {selectedCount === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--studio-border)] bg-[var(--studio-well)] px-4 py-4">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--studio-ink)]">
            <ScanSearch className="h-4 w-4 text-violet-300" />
            {emptyState.title}
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--studio-ink-muted)]">{emptyState.description}</p>
          <ul className="mt-3 space-y-2 text-xs leading-6 text-[var(--studio-ink-subtle)]">
            {emptyState.tips.map((tip) => (
              <li key={tip}>• {tip}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-md border border-[var(--studio-border)] bg-[var(--studio-well)] px-4 py-3 shadow-sm">
          <p className="text-sm font-medium text-[var(--studio-ink)]">{selectedCount} stone{selectedCount > 1 ? 's' : ''} selected</p>
          <p className="mt-1 text-xs text-[var(--studio-ink-muted)]">{t('Selection actions only affect the highlighted stones.')}</p>
          {editableTemplate.isEditable && (
            <div className="mt-3">
              <StoneColourPicker
                label={t('Colour of the selected stones')}
                value={selectedColourOf(editableTemplate.stones, state.selectedStoneIds)}
                noneLabel={t('Design colour')}
                onChange={(colour) => dispatch({ type: 'SET_STONES_COLOUR', ids: Array.from(state.selectedStoneIds), colour })}
              />
            </div>
          )}
        </div>
      )}
      
      {/* Single stone position editing */}
      {selectedStone && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-ink-secondary">{t('Position')}</label>
          <div className="grid grid-cols-2 gap-2">
            <NumericInput
              label={t('X (mm)')}
              value={selectedStone.center.x}
              onChange={(val) => {
                if (typeof val === 'number') {
                  dispatch({
                    type: 'UPDATE_STONE',
                    id: selectedStone.id,
                    updates: { center: { ...selectedStone.center, x: val } },
                  });
                }
              }}
              min={0}
              max={1000}
              step={0.1}
            />
            <NumericInput
              label={t('Y (mm)')}
              value={selectedStone.center.y}
              onChange={(val) => {
                if (typeof val === 'number') {
                  dispatch({
                    type: 'UPDATE_STONE',
                    id: selectedStone.id,
                    updates: { center: { ...selectedStone.center, y: val } },
                  });
                }
              }}
              min={0}
              max={1000}
              step={0.1}
            />
          </div>

          <StoneProfileControl
            value={selectedStone.stoneSize}
            onChange={(size) => {
              const profile = getStoneSizeProfile(size);
              dispatch({
                type: 'UPDATE_STONE',
                id: selectedStone.id,
                updates: {
                  stoneSize: size,
                  holeDiameterMm: profile.recommendedHoleDiameterMm,
                },
              });
            }}
          />

          <NumericInput
            label={t('Hole Diameter')}
            value={selectedStone.holeDiameterMm}
            onChange={(val) => {
              if (typeof val === 'number') {
                dispatch({
                  type: 'UPDATE_STONE',
                  id: selectedStone.id,
                  updates: { holeDiameterMm: val },
                });
              }
            }}
            unit="mm"
            min={0.1}
            max={20}
            step={0.1}
          />
        </div>
      )}
      
      <div className="space-y-3">
        <NumericInput
          label={t('Smart fix brush size')}
          value={state.manualTool.assistBrushSizeMm}
          onChange={(val) => dispatch({ type: 'UPDATE_MANUAL_TOOL', updates: { assistBrushSizeMm: typeof val === 'number' ? val : state.manualTool.assistBrushSizeMm } })}
          unit="mm"
          min={2}
          max={60}
          step={0.5}
        />

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => dispatch({ type: 'SET_SELECTED_STONES', ids: new Set(allEditableStoneIds) })}
            disabled={!editableTemplate.isEditable || allEditableStoneIds.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-sunken px-3 py-2 text-xs font-medium text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
            title={editableTemplate.isEditable ? 'Select all stones in the editable design.' : 'Make the design editable before selecting all stones.'}
          >
            {t('Select all')}
          </button>
          <button
            onClick={() => dispatch({ type: 'DUPLICATE_STONES', stoneIds: Array.from(state.selectedStoneIds) })}
            disabled={!actionState.canDuplicate}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface-sunken px-3 py-2 text-xs font-medium text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40"
            title={actionState.duplicateReason ?? 'Duplicate selected stones (Cmd/Ctrl+D)'}
          >
            <CopyPlus className="h-3.5 w-3.5" />
            {t('Duplicate')}
          </button>
          <button
            onClick={() => dispatch({ type: 'DELETE_STONES', stoneIds: Array.from(state.selectedStoneIds) })}
            disabled={!actionState.canDelete}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-danger-500/20 bg-danger-50 px-3 py-2 text-xs font-medium text-danger-600 transition hover:bg-danger-500/15 disabled:cursor-not-allowed disabled:opacity-40"
            title={actionState.deleteReason ?? 'Delete selected stones (Delete/Backspace)'}
          >
            <DiamondMinus className="h-3.5 w-3.5" />
            {t('Delete')}
          </button>
        </div>

        <button
          onClick={handleSmartFixSelection}
          disabled={selectedCount === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-success-500/20 bg-success-50 px-3 py-2 text-xs font-medium text-success-600 transition hover:bg-success-500/15 disabled:cursor-not-allowed disabled:opacity-40"
          title={selectedCount > 0 ? 'Try to nudge the selected stones to the nearest safe positions.' : 'Select at least one stone to auto-correct it.'}
        >
          {t('Smart fix selection')}
        </button>

        <button
          onClick={handleCleanUpSelection}
          disabled={selectedCount < 3}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-info-500/20 bg-info-50 px-3 py-2 text-xs font-medium text-info-600 transition hover:bg-info-500/15 disabled:cursor-not-allowed disabled:opacity-40"
          title={selectedCount >= 3 ? 'Straighten the selection and even out spacing.' : 'Select at least three stones to clean up spacing.'}
        >
          {t('Clean up selection')}
        </button>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-ink-secondary">{t('Align')}</label>
            {!actionState.canAlign && <span className="text-xs text-ink-muted">Select at least two stones</span>}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'left' })} disabled={!actionState.canAlign} className="rounded-lg border border-border bg-surface-sunken px-2 py-2 text-xs text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40" title={actionState.alignReason ?? 'Align selected stones to the left'}><MoveHorizontal className="mx-auto h-3.5 w-3.5 rotate-180" /></button>
            <button onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'center' })} disabled={!actionState.canAlign} className="rounded-lg border border-border bg-surface-sunken px-2 py-2 text-xs text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40" title={actionState.alignReason ?? 'Align selected stones to the center'}><MoveHorizontal className="mx-auto h-3.5 w-3.5" /></button>
            <button onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'right' })} disabled={!actionState.canAlign} className="rounded-lg border border-border bg-surface-sunken px-2 py-2 text-xs text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40" title={actionState.alignReason ?? 'Align selected stones to the right'}><MoveHorizontal className="mx-auto h-3.5 w-3.5" /></button>
            <button onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'top' })} disabled={!actionState.canAlign} className="rounded-lg border border-border bg-surface-sunken px-2 py-2 text-xs text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40" title={actionState.alignReason ?? 'Align selected stones to the top'}><MoveVertical className="mx-auto h-3.5 w-3.5 rotate-180" /></button>
            <button onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'middle' })} disabled={!actionState.canAlign} className="rounded-lg border border-border bg-surface-sunken px-2 py-2 text-xs text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40" title={actionState.alignReason ?? 'Align selected stones to the vertical middle'}><MoveVertical className="mx-auto h-3.5 w-3.5" /></button>
            <button onClick={() => dispatch({ type: 'ALIGN_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'bottom' })} disabled={!actionState.canAlign} className="rounded-lg border border-border bg-surface-sunken px-2 py-2 text-xs text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40" title={actionState.alignReason ?? 'Align selected stones to the bottom'}><MoveVertical className="mx-auto h-3.5 w-3.5" /></button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-ink-secondary">{t('Distribute')}</label>
            {!actionState.canDistribute && <span className="text-xs text-ink-muted">Select at least three stones</span>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => dispatch({ type: 'DISTRIBUTE_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'horizontal' })} disabled={!actionState.canDistribute} className="rounded-lg border border-border bg-surface-sunken px-3 py-2 text-xs text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40" title={actionState.distributeReason ?? 'Distribute selected stones horizontally'}>{t('Horizontal')}</button>
            <button onClick={() => dispatch({ type: 'DISTRIBUTE_STONES', stoneIds: Array.from(state.selectedStoneIds), direction: 'vertical' })} disabled={!actionState.canDistribute} className="rounded-lg border border-border bg-surface-sunken px-3 py-2 text-xs text-ink transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40" title={actionState.distributeReason ?? 'Distribute selected stones vertically'}>{t('Vertical')}</button>
          </div>
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="space-y-3">
          <div className="pt-3 border-t border-border text-xs text-ink-secondary space-y-1">
            <p className="font-medium">{t('Selection Controls:')}</p>
            <ul className="text-ink-muted space-y-1">
              <li>• Drag to move</li>
              <li>• Cmd/Ctrl+A selects all stones</li>
              <li>• Shift+Click for multi-select</li>
              <li>• Ctrl/Cmd+D to duplicate</li>
              <li>• Ctrl/Cmd+C to copy</li>
              <li>• Ctrl/Cmd+V to paste</li>
              <li>• Arrow keys to nudge (Shift 5 mm, Alt 0.1 mm)</li>
              <li>• Delete/Backspace to remove</li>
              <li>• Escape to deselect</li>
            </ul>
          </div>
        </div>
      )}
      
      {!editableTemplate.isEditable && state.template && (
        <div className="rounded-md border border-violet-400/30 bg-violet-500/15 p-4">
          <button
            onClick={() => dispatch({ type: 'CONVERT_TO_EDITABLE' })}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-500"
            title={t('Select and move individual stones')}
          >
            <Hand className="h-4 w-4" />
            {t('Edit stones one by one')}
          </button>
          <p className="mt-2 text-xs text-[var(--studio-ink-muted)]">
            {t('Until you do, changing the settings rebuilds the design. Once you do, you can select and move each stone, and you are asked before the settings replace your edits.')}
          </p>
        </div>
      )}
      
      <div className="pt-4 border-t border-border space-y-2">
        <p className="text-xs text-ink-secondary">{t('Keyboard shortcuts:')}</p>
        <ul className="text-xs text-ink-muted space-y-1">
          <li>• Cmd/Ctrl+Z to undo</li>
          <li>• Cmd/Ctrl+Shift+Z to redo</li>
          <li>• Ctrl/Cmd + wheel zooms · wheel pans the canvas</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
