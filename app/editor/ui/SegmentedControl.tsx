'use client';

import { cn } from './cn';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  description?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedControlOption<T>[];
  className?: string;
  columns?: number;
}

export default function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  columns = options.length,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn('grid gap-1.5', className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      role="radiogroup"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400',
              active
                ? 'border-accent-400 bg-accent-50 text-accent-700 shadow-xs'
                : 'border-border bg-surface-raised text-ink-secondary hover:border-border-strong hover:bg-sand-50',
            )}
          >
            <span className="flex items-center gap-1.5 font-medium">
              {option.icon}
              {option.label}
            </span>
            {option.description && <span className="text-[10px] text-ink-muted">{option.description}</span>}
          </button>
        );
      })}
    </div>
  );
}
