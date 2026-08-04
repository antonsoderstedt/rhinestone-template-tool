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
      <span className="text-xs font-medium text-ink-secondary">{label}</span>
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
          className="w-full rounded border border-border bg-surface-sunken px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent-400 disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-ink-muted"
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted pointer-events-none">
            {unit}
          </span>
        )}
      </div>
      {helpText && <span className="text-xs text-ink-muted">{helpText}</span>}
    </label>
  );
}
