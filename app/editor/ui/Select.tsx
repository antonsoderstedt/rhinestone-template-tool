'use client';

import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        'w-full appearance-none rounded-lg border border-border bg-surface-sunken px-3 py-2 pr-9 text-sm text-ink transition-colors focus:border-accent-400 focus:bg-surface-raised focus:outline-none focus:ring-2 focus:ring-accent-400/30 disabled:cursor-not-allowed disabled:text-ink-muted',
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
  </div>
));
Select.displayName = 'Select';

export default Select;
