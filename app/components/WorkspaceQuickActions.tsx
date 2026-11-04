'use client';

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
          ? 'border-violet-200 bg-[linear-gradient(135deg,rgba(124,58,237,0.08),rgba(168,85,247,0.16))] text-violet-700'
          : tone === 'neutral'
            ? 'border-zinc-200 bg-white text-zinc-700'
            : 'border-border bg-surface text-ink';

        return (
          <Link
            key={label}
            href={href}
            className={`rounded-[1.5rem] border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${styles}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">Next action</div>
              {Icon ? <Icon className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
            </div>

            <div className="mt-4 text-lg font-semibold">{label}</div>
            <p className="mt-2 text-sm leading-6 opacity-80">{description}</p>
          </Link>
        );
      })}
    </section>
  );
}
