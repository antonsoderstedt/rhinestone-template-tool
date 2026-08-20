'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';

interface AccordionProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export default function Accordion({
  title,
  subtitle,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className,
}: AccordionProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isOpen = controlledOpen ?? uncontrolledOpen;

  const toggle = () => {
    const next = !isOpen;
    if (onOpenChange) onOpenChange(next);
    if (controlledOpen === undefined) setUncontrolledOpen(next);
  };

  return (
    <div className={cn('border-t border-border pt-3 first:border-t-0 first:pt-0', className)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-2 py-2 text-left transition-colors"
      >
        <span className="flex flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-secondary">{title}</span>
          {subtitle && <span className="text-[11px] text-ink-muted">{subtitle}</span>}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-ink-muted transition-transform', isOpen && 'rotate-180')} />
      </button>
      {isOpen && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  );
}
