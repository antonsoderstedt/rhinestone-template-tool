'use client';

import { forwardRef } from 'react';
import { cn } from './cn';

export const inputClassName =
  'w-full rounded-lg border border-border bg-surface-sunken px-3 py-2 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-accent-400 focus:bg-surface-raised focus:outline-none focus:ring-2 focus:ring-accent-400/30 disabled:cursor-not-allowed disabled:bg-sand-100 disabled:text-ink-muted';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  unit?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, unit, ...props }, ref) => {
  if (!unit) {
    return <input ref={ref} className={cn(inputClassName, className)} {...props} />;
  }
  return (
    <div className="relative">
      <input ref={ref} className={cn(inputClassName, 'pr-10 tabular-nums', className)} {...props} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-muted">
        {unit}
      </span>
    </div>
  );
});
Input.displayName = 'Input';

export default Input;
