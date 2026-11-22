/**
 * Reusable width/height control with aspect ratio lock
 */

import NumericInput from './NumericInput';
import { editorFieldLabelClassName } from './controlStyles';

import { useT } from '../../lib/i18n';
interface PhysicalDimensionsControlProps {
  widthMm: number | '';
  heightMm: number | '';
  preserveAspectRatio: boolean;
  onWidthChange: (value: number | '') => void;
  onHeightChange: (value: number | '') => void;
  onPreserveAspectRatioChange: (value: boolean) => void;
  /** Show and type the sizes in this unit; the values stay in millimetres. Default mm. */
  unit?: 'mm' | 'in';
  /** When given, a mm / in switch is shown. */
  onUnitChange?: (unit: 'mm' | 'in') => void;
}

const MM_PER_INCH = 25.4;

export default function PhysicalDimensionsControl({
  widthMm,
  heightMm,
  preserveAspectRatio,
  onWidthChange,
  onHeightChange,
  onPreserveAspectRatioChange,
  unit = 'mm',
  onUnitChange,
}: PhysicalDimensionsControlProps) {
  const t = useT();
  const inches = unit === 'in';
  const show = (value: number | ''): number | '' => (value === '' || !inches ? value : Number((value / MM_PER_INCH).toFixed(3)));
  const store = (value: number | ''): number | '' => (value === '' || !inches ? value : Number((value * MM_PER_INCH).toFixed(3)));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={editorFieldLabelClassName}>{t('Target Dimensions')}</span>
        {onUnitChange && (
          <div role="group" aria-label={t('Unit')} className="inline-flex rounded-lg border border-border bg-surface-raised p-0.5 text-xs">
            {(['mm', 'in'] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                aria-pressed={unit === choice}
                onClick={() => onUnitChange(choice)}
                className={`rounded px-2 py-0.5 transition ${unit === choice ? 'bg-accent-500 text-ink-inverse' : 'text-ink-secondary hover:text-ink'}`}
              >
                {choice}
              </button>
            ))}
          </div>
        )}
        <label className="flex items-center gap-1.5 ml-auto">
          <input
            type="checkbox"
            checked={preserveAspectRatio}
            onChange={(e) => onPreserveAspectRatioChange(e.target.checked)}
            className="h-4 w-4 rounded border-border bg-surface text-accent-600 focus:ring-2 focus:ring-accent-100"
          />
          <span className="text-xs font-medium text-ink-secondary">{t('Lock ratio')}</span>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NumericInput
          label="Width"
          value={show(widthMm)}
          onChange={(value) => onWidthChange(store(value))}
          unit={unit}
          min={inches ? 0.2 : 5}
          max={inches ? 20 : 500}
          step={inches ? 0.05 : 0.1}
        />
        <NumericInput
          label="Height"
          value={show(heightMm)}
          onChange={(value) => onHeightChange(store(value))}
          unit={unit}
          min={inches ? 0.2 : 5}
          max={inches ? 20 : 500}
          step={inches ? 0.05 : 0.1}
        />
      </div>
    </div>
  );
}
