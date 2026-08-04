'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

export const badgeVariants = cva('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', {
  variants: {
    tone: {
      neutral: 'bg-sand-100 text-ink-secondary',
      brand: 'bg-brand-50 text-brand-600',
      accent: 'bg-accent-50 text-accent-700',
      success: 'bg-success-50 text-success-600',
      warning: 'bg-warning-50 text-warning-600',
      danger: 'bg-danger-50 text-danger-600',
      info: 'bg-info-50 text-info-600',
    },
  },
  defaultVariants: {
    tone: 'neutral',
  },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export default function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
