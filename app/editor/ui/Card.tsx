'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

export const cardVariants = cva('rounded-xl border border-border bg-surface-raised', {
  variants: {
    padding: {
      none: '',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    },
    elevation: {
      none: '',
      sm: 'shadow-sm',
      md: 'shadow-md',
    },
  },
  defaultVariants: {
    padding: 'md',
    elevation: 'none',
  },
});

export interface CardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

export default function Card({ className, padding, elevation, ...props }: CardProps) {
  return <div className={cn(cardVariants({ padding, elevation }), className)} {...props} />;
}
