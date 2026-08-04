'use client';

import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

export const iconButtonVariants = cva(
  'inline-flex shrink-0 items-center justify-center rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-40 active:scale-[0.96]',
  {
    variants: {
      intent: {
        default: 'text-ink-secondary hover:bg-sand-100 hover:text-ink',
        active: 'bg-accent-500 text-ink-inverse shadow-sm hover:bg-accent-600',
        subtle: 'text-ink-muted hover:bg-surface-sunken hover:text-ink-secondary',
        onSurface: 'bg-surface-raised text-ink-secondary shadow-xs border border-border hover:text-ink hover:border-border-strong',
      },
      size: {
        sm: 'h-8 w-8',
        md: 'h-10 w-10',
        lg: 'h-11 w-11',
      },
    },
    defaultVariants: {
      intent: 'default',
      size: 'md',
    },
  },
);

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {}

const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, intent, size, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={cn(iconButtonVariants({ intent, size }), className)} {...props} />
  ),
);
IconButton.displayName = 'IconButton';

export default IconButton;
