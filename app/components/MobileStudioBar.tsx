'use client';

import type { ComponentType } from 'react';

export interface MobileStudioBarItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onSelect: () => void;
  /** The panel this tab controls is open (or this is the current tool). */
  active?: boolean;
  /** Shown as the main action (filled). */
  primary?: boolean;
  disabled?: boolean;
  /** Small status text under the label, e.g. a count. */
  hint?: string;
}

/**
 * Bottom tab bar for the studios on phones and tablets (hidden from `lg` up, where the side
 * panels are always visible). Each tab is at least 56px tall, so thumbs hit it reliably, and the
 * bar keeps clear of the iOS home indicator.
 */
export default function MobileStudioBar({ items, label = 'Studio sections' }: { items: MobileStudioBarItem[]; label?: string }) {
  return (
    <nav
      aria-label={label}
      className="flex shrink-0 border-t border-[var(--studio-border)] bg-[var(--studio-surface)] pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={item.onSelect}
            disabled={item.disabled}
            aria-pressed={item.primary ? undefined : Boolean(item.active)}
            className={`m-1 flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-40 ${
              item.primary
                ? 'bg-violet-600 text-white hover:bg-violet-500'
                : item.active
                  ? 'bg-violet-500/30 text-[var(--studio-ink)]'
                  : 'text-[var(--studio-ink-muted)] hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]'
            }`}
          >
            <span aria-hidden="true"><Icon className="h-5 w-5" /></span>
            <span>{item.label}</span>
            {item.hint && <span className="text-xs font-normal opacity-80">{item.hint}</span>}
          </button>
        );
      })}
    </nav>
  );
}
