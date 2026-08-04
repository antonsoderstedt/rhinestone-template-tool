'use client';

import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]',
  {
    variants: {
      intent: {
        primary: 'bg-brand-500 text-ink-inverse shadow-sm hover:bg-brand-600',
        secondary: 'bg-surface-raised text-ink border border-border shadow-xs hover:border-border-strong hover:bg-sand-50',
        accent: 'bg-accent-500 text-ink-inverse shadow-sm hover:bg-accent-600',
        ghost: 'text-ink-secondary hover:bg-sand-100 hover:text-ink',
        destructive: 'bg-danger-500 text-ink-inverse shadow-sm hover:bg-danger-600',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      intent: 'secondary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, intent, size, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ intent, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';

export default Button;
