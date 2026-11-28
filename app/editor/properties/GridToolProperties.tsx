'use client';

import StoneProfileControl from '../controls/StoneProfileControl';
import DensityControl from '../controls/DensityControl';
import NumericInput from '../controls/NumericInput';
import { editorFieldLabelClassName, editorSegmentActiveClassName, editorSegmentBaseClassName, editorSegmentIdleClassName, editorSelectClassName } from '../controls/controlStyles';
import { ALL_OVER_PATTERNS, type AllOverPattern } from '@/src/lib/rhinestone-engine/index';
import { useT } from '../../lib/i18n';
import { ToolPropertiesProps } from './shared';

/** Sizes people cover with stones all over. Millimetres; the user can type any size. */
export const ALL_OVER_PRESETS: ReadonlyArray<{ label: string; widthMm: number; heightMm: number }> = [
  { label: 'Back pocket', widthMm: 130, heightMm: 140 },
  { label: 'Front pocket', widthMm: 110, heightMm: 130 },
  { label: 'Jeans leg', widthMm: 250, heightMm: 1000 },
  { label: 'Sleeve', widthMm: 100, heightMm: 450 },
  { label: 'Tote bag', widthMm: 300, heightMm: 350 },
  { label: 'A4 sheet', widthMm: 210, heightMm: 297 },
];

export function GridToolProperties({ state, dispatch }: ToolPropertiesProps) {
  const t = useT();
  const { gridTool } = state;
  const area = gridTool.mode === 'area';
  const pattern = ALL_OVER_PATTERNS.find((entry) => entry.id === gridTool.areaPattern);

  return (
    <div className="space-y-4">
      <div role="group" aria-label={t('What to make')} className="grid grid-cols-2 gap-1.5">
        {([
          { mode: 'rows', label: 'Rows and columns', note: 'A block of stones' },
          { mode: 'area', label: 'Cover an area', note: 'Jeans, a pocket, a whole garment' },
        ] as const).map((option) => (
          <button
            key={option.mode}
            type="button"
            aria-pressed={gridTool.mode === option.mode}
            onClick={() => dispatch({ type: 'UPDATE_GRID_TOOL', updates: option.mode === 'area' ? { mode: 'area', densityPreset: gridTool.mode === 'rows' && gridTool.densityPreset === 'standard' ? 'airy' : gridTool.densityPreset } : { mode: 'rows' } })}
            className={`${editorSegmentBaseClassName} text-left ${gridTool.mode === option.mode ? editorSegmentActiveClassName : editorSegmentIdleClassName}`}
          >
            <span className="block text-sm font-medium">{t(option.label)}</span>
            <span className="block text-xs text-ink-muted">{t(option.note)}</span>
          </button>
        ))}
      </div>

      {!area && (
        <div className="grid grid-cols-2 gap-3">
          <NumericInput
            label={t('Columns')}
            value={gridTool.columns}
            onChange={(val) => dispatch({ type: 'UPDATE_GRID_TOOL', updates: { columns: typeof val === 'number' ? val : 1 } })}
            min={1}
            max={100}
          />

          <NumericInput
            label={t('Rows')}
            value={gridTool.rows}
            onChange={(val) => dispatch({ type: 'UPDATE_GRID_TOOL', updates: { rows: typeof val === 'number' ? val : 1 } })}
            min={1}
            max={100}
          />
        </div>
      )}

      {area && (
        <>
          <div className="space-y-1.5" role="group" aria-label={t('Common sizes')}>
            <span className={editorFieldLabelClassName}>{t('Common sizes')}</span>
            <div className="flex flex-wrap gap-1.5">
              {ALL_OVER_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => dispatch({ type: 'UPDATE_GRID_TOOL', updates: { areaWidthMm: preset.widthMm, areaHeightMm: preset.heightMm } })}
                  aria-pressed={gridTool.areaWidthMm === preset.widthMm && gridTool.areaHeightMm === preset.heightMm}
                  className="rounded-full border border-[var(--studio-border)] px-2.5 py-1 text-xs text-[var(--studio-ink-secondary)] transition hover:border-violet-400/50 hover:text-[var(--studio-ink)] aria-pressed:border-violet-500 aria-pressed:text-[var(--studio-ink)]"
                >
                  {t(preset.label)} · {preset.widthMm} × {preset.heightMm}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumericInput label={t('Width')} value={gridTool.areaWidthMm} unit="mm" min={10} max={2000} step={5}
              onChange={(val) => dispatch({ type: 'UPDATE_GRID_TOOL', updates: { areaWidthMm: val } })} />
            <NumericInput label={t('Height')} value={gridTool.areaHeightMm} unit="mm" min={10} max={2000} step={5}
              onChange={(val) => dispatch({ type: 'UPDATE_GRID_TOOL', updates: { areaHeightMm: val } })} />
          </div>
          <div className="space-y-1.5">
            <span className={editorFieldLabelClassName}>{t('Pattern')}</span>
            <select
              aria-label={t('Pattern')}
              value={gridTool.areaPattern}
              onChange={(event) => dispatch({ type: 'UPDATE_GRID_TOOL', updates: { areaPattern: event.target.value as AllOverPattern } })}
              className={editorSelectClassName}
            >
              {ALL_OVER_PATTERNS.map((entry) => (
                <option key={entry.id} value={entry.id}>{t(entry.label)}</option>
              ))}
            </select>
            {pattern && <p className="text-xs text-ink-muted">{t(pattern.description)}</p>}
          </div>
          {gridTool.areaPattern === 'scatter' && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'UPDATE_GRID_TOOL', updates: { areaSeed: gridTool.areaSeed + 1 } })}
              className="rounded-md border border-[var(--studio-border)] px-3 py-2 text-xs font-medium text-[var(--studio-ink-secondary)] hover:border-violet-400/50 focus:outline-none focus:ring-2 focus:ring-accent-400"
            >
              {t('Shuffle')}
            </button>
          )}
          <p className="text-xs text-ink-muted">{t('A design bigger than a mat is cut in parts: choose Cut in parts when you export.')}</p>
        </>
      )}

      <StoneProfileControl
        value={gridTool.stoneSize}
        onChange={(size) => dispatch({ type: 'UPDATE_GRID_TOOL', updates: { stoneSize: size } })}
      />

      <DensityControl
        densityPreset={gridTool.densityPreset}
        customSpacingMm={gridTool.customSpacingMm}
        onDensityChange={(preset) => dispatch({ type: 'UPDATE_GRID_TOOL', updates: { densityPreset: preset } })}
        onCustomSpacingChange={(val) => dispatch({ type: 'UPDATE_GRID_TOOL', updates: { customSpacingMm: val } })}
      />
    </div>
  );
}
