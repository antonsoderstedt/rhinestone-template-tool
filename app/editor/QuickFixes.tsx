'use client';

import { AlertTriangle, Info, Wand2 } from 'lucide-react';
import type { QuickFixAction, QuickFixItem } from './quickFixItems';

import { useT } from '../lib/i18n';
interface QuickFixesProps {
  items: QuickFixItem[];
  /** False when the design cannot be resized automatically (made by hand, or by a tool without a size setting). */
  canResize: boolean;
  onAction: (action: QuickFixAction) => void;
}

/** One-click fixes for the problems the export check found. Rendered only when there is something to fix. */
export default function QuickFixes({ items, canResize, onAction }: QuickFixesProps) {
  const t = useT();
  if (items.length === 0) return null;

  return (
    <ul aria-label={t('Problems you can fix')} className="space-y-2">
      {items.map((item) => {
        const Icon = item.tone === 'warning' ? AlertTriangle : Info;
        const isResize = item.action === 'fit-12x12' || item.action === 'fit-12x24';
        const disabled = isResize && !canResize;
        return (
          <li
            key={item.id}
            className={`rounded-md border px-3 py-2.5 ${item.tone === 'warning' ? 'border-warning-500/40 bg-warning-50' : 'border-info-500/30 bg-info-500/10'}`}
          >
            <div className={`flex items-start gap-2 text-sm font-semibold ${item.tone === 'warning' ? 'text-warning-600' : 'text-info-700'}`}>
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{item.title}</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--studio-ink-secondary)]">{item.detail}</p>
            {item.action && item.actionLabel && (
              <>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onAction(item.action as QuickFixAction)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-violet-400/50 bg-violet-500/20 px-3 py-1.5 text-xs font-semibold text-[var(--studio-ink)] transition hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {item.actionLabel}
                </button>
                {item.secondary && (
                  <button
                    type="button"
                    onClick={() => onAction(item.secondary!.action)}
                    className="ml-2 mt-2 inline-flex items-center gap-1.5 rounded-md border border-[var(--studio-border)] px-3 py-1.5 text-xs font-semibold text-[var(--studio-ink)] transition hover:bg-[var(--studio-hover-overlay-soft)]"
                  >
                    {item.secondary.label}
                  </button>
                )}
                {disabled && (
                  <p className="mt-1.5 text-xs leading-5 text-[var(--studio-ink-muted)]">
                    {t('This design cannot be resized automatically. Change its size in the Design panel, or delete stones.')}
                  </p>
                )}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
