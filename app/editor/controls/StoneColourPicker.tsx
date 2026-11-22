'use client';

import { STONE_COLOUR_PRESETS, inkOn, isStoneColour } from '../stoneColours';
import { editorFieldLabelClassName } from './controlStyles';

import { useT } from '../../lib/i18n';
/** Swatches for the quick colours, "None", and any colour from the system picker. */
export default function StoneColourPicker({
  label,
  value,
  onChange,
  noneLabel = 'No colour',
}: {
  label: string;
  /** The colour in use, or null. */
  value: string | null;
  onChange: (colour: string | null) => void;
  noneLabel?: string;
}) {
  const t = useT();
  const current = value && isStoneColour(value) ? value.toLowerCase() : null;
  const isPreset = current !== null && STONE_COLOUR_PRESETS.some((preset) => preset.hex.toLowerCase() === current);
  return (
    <div className="space-y-2" role="group" aria-label={label}>
      <span className={editorFieldLabelClassName}>{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-pressed={current === null}
          className={`rounded-full border px-2.5 py-1 text-xs transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${
            current === null ? 'border-violet-500 bg-violet-500/10 text-[var(--studio-ink)]' : 'border-[var(--studio-border)] text-[var(--studio-ink-secondary)] hover:border-violet-400/50'
          }`}
        >
          {noneLabel}
        </button>
        {STONE_COLOUR_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.hex)}
            aria-pressed={current === preset.hex.toLowerCase()}
            aria-label={preset.label}
            title={preset.label}
            className={`h-7 w-7 rounded-full border-2 transition focus:outline-none focus:ring-2 focus:ring-accent-400 ${
              current === preset.hex.toLowerCase() ? 'border-violet-500' : 'border-[var(--studio-border-strong)]'
            }`}
            style={{ backgroundColor: preset.hex, color: inkOn(preset.hex) }}
          />
        ))}
        <label className="inline-flex items-center gap-1.5 text-xs text-[var(--studio-ink-muted)]">
          <input
            type="color"
            aria-label={`${label}: pick any colour`}
            value={current ?? '#8b5cf6'}
            onChange={(event) => onChange(event.target.value.toLowerCase())}
            className={`h-7 w-7 cursor-pointer rounded-full border-2 bg-transparent p-0 ${current !== null && !isPreset ? 'border-violet-500' : 'border-[var(--studio-border-strong)]'}`}
          />
          {t('Other')}
        </label>
      </div>
    </div>
  );
}
