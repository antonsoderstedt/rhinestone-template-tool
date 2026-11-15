import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';

export interface WorkspaceQuickAction {
  label: string;
  description: string;
  href: string;
  icon?: LucideIcon;
  tone?: 'default' | 'brand' | 'neutral';
}

export default function WorkspaceQuickActions({ actions }: { actions: WorkspaceQuickAction[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {actions.map(({ label, description, href, icon: Icon, tone = 'default' }) => {
        const styles = tone === 'brand'
          ? 'border-violet-300/50 bg-[linear-gradient(135deg,rgba(124,58,237,0.12),rgba(168,85,247,0.18))] text-[var(--studio-ink)]'
          : tone === 'neutral'
            ? 'border-[var(--studio-border)] bg-[var(--studio-hover-overlay-soft)] text-[var(--studio-ink)]'
            : 'border-[var(--studio-border)] bg-[var(--studio-surface)] text-[var(--studio-ink)]';

        return (
          <Link
            key={label}
            href={href}
            className={`rounded-[1.5rem] border p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300/40 hover:shadow-md ${styles}`}
          >
            <div className="flex items-center justify-between gap-3 text-[var(--studio-ink-secondary)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em]">Next action</div>
              {Icon ? <Icon className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
            </div>

            <div className="mt-4 text-lg font-semibold text-[var(--studio-ink)]">{label}</div>
            <p className="mt-2 text-sm leading-6 text-[var(--studio-ink-secondary)]">{description}</p>
          </Link>
        );
      })}
    </section>
  );
}
