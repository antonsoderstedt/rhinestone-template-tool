'use client';

import { cn } from './cn';

interface FieldProps {
  label?: React.ReactNode;
  helpText?: React.ReactNode;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export default function Field({ label, helpText, htmlFor, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-medium text-ink-secondary">
          {label}
        </label>
      )}
      {children}
      {helpText && <span className="text-xs text-ink-muted">{helpText}</span>}
    </div>
  );
}
