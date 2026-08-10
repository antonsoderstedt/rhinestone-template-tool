'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FolderOpen, Gem, LibraryBig, Settings2, Sparkles, SwatchBook, Type } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Start', icon: Sparkles },
  { href: '/rhinestone', label: 'Rhinestone Studio', icon: Gem },
  { href: '/htv', label: 'HTV Studio', icon: SwatchBook },
  { href: '/library', label: 'Library', icon: LibraryBig },
  { href: '/fonts', label: 'Fonts', icon: Type },
  { href: '/designs', label: 'My Designs', icon: FolderOpen },
  { href: '/settings', label: 'Settings', icon: Settings2 },
] as const;

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function GlobalTopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--color-brand-500),var(--color-accent-500))] text-sm font-black text-ink-inverse shadow-lg shadow-brand-500/25">
            RT
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-[0.18em] text-ink-secondary uppercase">Rhinestone OS</div>
            <div className="truncate text-base font-semibold text-ink">Templates, HTV, assets, fonts, production flow</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 rounded-2xl border border-border bg-surface-raised/80 p-1.5 shadow-sm xl:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-accent-500 text-ink-inverse shadow-sm'
                    : 'text-ink-secondary hover:bg-surface-sunken hover:text-ink'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="/library"
            className="rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm font-medium text-ink-secondary transition hover:border-border-strong hover:text-ink"
          >
            Manage Assets
          </Link>
          <Link
            href="/rhinestone"
            className="rounded-xl bg-[linear-gradient(135deg,var(--color-brand-500),var(--color-accent-500))] px-4 py-2 text-sm font-semibold text-ink-inverse shadow-lg shadow-accent-500/20 transition hover:brightness-105"
          >
            Open Studio
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto border-t border-border/70 xl:hidden">
        <nav className="mx-auto flex w-max min-w-full gap-1 px-3 py-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
                  active
                    ? 'bg-accent-500 text-ink-inverse'
                    : 'text-ink-secondary hover:bg-surface-sunken hover:text-ink'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}