'use client';

import { cn } from './cn';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  helpText?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export default function Toggle({ checked, onChange, label, helpText, disabled, className }: ToggleProps) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', disabled && 'cursor-not-allowed opacity-50', className)}>
      <span className="relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full border border-border bg-sand-200 transition-colors checked:border-accent-500 checked:bg-accent-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2"
        />
        <span className="pointer-events-none absolute left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
      </span>
      {(label || helpText) && (
        <span className="flex flex-col">
          {label && <span className="text-xs font-medium text-ink">{label}</span>}
          {helpText && <span className="text-xs text-ink-muted">{helpText}</span>}
        </span>
      )}
    </label>
  );
}
