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
    <Accordion title={title} defaultOpen={defaultOpen}>
      {children}
    </Accordion>
  );
}
