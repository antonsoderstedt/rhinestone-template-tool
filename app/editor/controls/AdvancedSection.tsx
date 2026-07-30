/**
 * Collapsible advanced settings section
 */

'use client';

import { useState } from 'react';

interface AdvancedSectionProps {
  title?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export default function AdvancedSection({
  title = 'Advanced',
  children,
  defaultOpen = false,
}: AdvancedSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-zinc-800 pt-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-xs font-medium text-zinc-400 hover:text-white transition-colors"
      >
        <span>{title}</span>
        <span className="text-lg">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  );
}
