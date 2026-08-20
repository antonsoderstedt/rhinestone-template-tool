/**
 * Reusable density preset + custom spacing control
 */

import type { DensityPreset } from '@/src/lib/rhinestone-engine/index';
import NumericInput from './NumericInput';
import { editorFieldLabelClassName, editorSelectClassName } from './controlStyles';

interface DensityControlProps {
  densityPreset: DensityPreset;
  customSpacingMm: number | '';
  onDensityChange: (preset: DensityPreset) => void;
  onCustomSpacingChange: (value: number | '') => void;
}

const DENSITY_OPTIONS: { value: DensityPreset; label: string }[] = [
  { value: 'loose', label: 'Loose' },
  { value: 'safe', label: 'Safe' },
  { value: 'standard', label: 'Standard' },
  { value: 'dense', label: 'Dense' },
  { value: 'custom', label: 'Custom' },
];

export default function DensityControl({
  densityPreset,
  customSpacingMm,
  onDensityChange,
  onCustomSpacingChange,
}: DensityControlProps) {
  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-1.5">
        <span className={editorFieldLabelClassName}>Density</span>
        <select
          value={densityPreset}
          onChange={(e) => onDensityChange(e.target.value as DensityPreset)}
          className={editorSelectClassName}
        >
          {DENSITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {densityPreset === 'custom' && (
        <NumericInput
          label="Custom Spacing"
          value={customSpacingMm}
          onChange={onCustomSpacingChange}
          unit="mm"
          min={0.5}
          max={20}
          step={0.1}
        />
      )}
    </div>
  );
}
