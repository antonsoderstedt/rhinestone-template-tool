/**
 * Reusable numeric input with units and validation
 */

interface NumericInputProps {
  label: string;
  value: number | '';
  onChange: (value: number | '') => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  helpText?: string;
  disabled?: boolean;
}

import { editorFieldLabelClassName, editorInputClassName } from './controlStyles';

export default function NumericInput({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step = 1,
  placeholder,
  helpText,
  disabled = false,
}: NumericInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      onChange('');
      return;
    }
    const num = parseFloat(val);
    if (!isNaN(num)) {
      onChange(num);
    }
  };

  return (
    <label className="flex flex-col gap-1.5">
      <span className={editorFieldLabelClassName}>{label}</span>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={handleChange}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          disabled={disabled}
          className={`${editorInputClassName} ${unit ? 'pr-12' : ''}`}
        />
        {unit && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">
            {unit}
          </span>
        )}
      </div>
      {helpText && <span className="text-xs leading-6 text-ink-muted">{helpText}</span>}
    </label>
  );
}
