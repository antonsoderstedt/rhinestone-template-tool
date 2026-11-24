/**
 * Reusable density preset + custom spacing control
 */

import { useId } from 'react';
import type { DensityPreset } from '@/src/lib/rhinestone-engine/index';
import NumericInput from './NumericInput';
import { editorSelectClassName } from './controlStyles';
import { GLOSSARY } from '../editorUi';
import FieldHeader from './FieldHeader';

import { useT } from '../../lib/i18n';
interface DensityControlProps {
  densityPreset: DensityPreset;
  customSpacingMm: number | '';
  onDensityChange: (preset: DensityPreset) => void;
  onCustomSpacingChange: (value: number | '') => void;
}

const DENSITY_OPTIONS: { value: DensityPreset; label: string }[] = [
  { value: 'airy', label: 'Airy' },
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
  const t = useT();
  const selectId = useId();
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1.5">
        <FieldHeader
          label={t('Spacing')}
          htmlFor={selectId}
          help={`${GLOSSARY.spacing} Safe and Loose leave more room, Dense packs stones tighter, Custom lets you type a distance.`}
        />
        <select
          id={selectId}
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
      </div>

      {densityPreset === 'custom' && (
        <NumericInput
          label={t('Custom Spacing')}
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
