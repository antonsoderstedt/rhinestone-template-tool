/**
 * Collapsible advanced settings section — thin wrapper around the shared Accordion primitive.
 */

'use client';

import Accordion from '../ui/Accordion';

interface AdvancedSectionProps {
  title?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export default function AdvancedSection({ title = 'Advanced', children, defaultOpen = false }: AdvancedSectionProps) {
  return (
    <Accordion title={title} defaultOpen={defaultOpen} className="rounded-2xl border border-border/80 bg-[rgba(255,255,255,0.82)] px-4 py-1 shadow-sm" >
      {children}
    </Accordion>
  );
}
