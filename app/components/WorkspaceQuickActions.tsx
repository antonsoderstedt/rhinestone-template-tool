import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';

import { useT } from '../lib/i18n';
export interface WorkspaceQuickAction {
  label: string;
  description: string;
  href: string;
  icon?: LucideIcon;
  tone?: 'default' | 'brand' | 'neutral';
}

/**
 * Shortcut links to the places a user most likely wants next. They are real links with
 * readable text on the workspace's light surfaces (not the studios' theme variables,
 * which are dark by default and washed these cards out).
 */
export default function WorkspaceQuickActions({ actions }: { actions: WorkspaceQuickAction[] }) {
  const t = useT();
  return (
    <nav aria-label={t('Shortcuts')} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {actions.map(({ label, description, href, icon: Icon, tone = 'default' }) => {
        const styles = tone === 'brand'
          ? 'border-accent-300 bg-accent-50 hover:border-accent-400'
          : 'border-border bg-surface-raised hover:border-border-strong';

        return (
          <Link
            key={label}
            href={href}
            className={`group flex flex-col rounded-[1.5rem] border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${styles}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-base font-semibold text-ink">{label}</div>
              {Icon ? <Icon className="h-4 w-4 shrink-0 text-accent-700" aria-hidden="true" /> : null}
            </div>
            <p className="mt-1.5 text-sm leading-6 text-ink-secondary">{description}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-700">
              {t('Open')}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
