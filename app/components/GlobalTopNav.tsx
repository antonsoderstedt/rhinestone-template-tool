'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FolderOpen, Gem, LibraryBig, Settings2, Sparkles, SwatchBook, Type } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Start', shortLabel: 'Start', icon: Sparkles },
  { href: '/rhinestone', label: 'Rhinestone Studio', shortLabel: 'Stone', icon: Gem },
  { href: '/htv', label: 'HTV Studio', shortLabel: 'HTV', icon: SwatchBook },
  { href: '/library', label: 'Library', shortLabel: 'Library', icon: LibraryBig },
  { href: '/fonts', label: 'Fonts', shortLabel: 'Fonts', icon: Type },
  { href: '/designs', label: 'My Designs', shortLabel: 'Designs', icon: FolderOpen },
  { href: '/settings', label: 'Settings', shortLabel: 'Settings', icon: Settings2 },
] as const;

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function GlobalTopNav() {
  const pathname = usePathname();
  const studioLabel = pathname.startsWith('/htv')
    ? 'HTV Studio'
    : pathname.startsWith('/rhinestone')
      ? 'Rhinestone Studio'
      : pathname.startsWith('/library')
        ? 'Library'
        : pathname.startsWith('/fonts')
          ? 'Fonts'
          : pathname.startsWith('/designs')
            ? 'My Designs'
            : pathname.startsWith('/settings')
              ? 'Settings'
              : 'Workspace Home';

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#151518] text-zinc-200 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-3 py-1.5 md:px-5">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-400/40 bg-violet-500/20 text-xs font-black text-violet-100 shadow-md shadow-black/20">
            RT
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-medium tracking-[0.18em] text-zinc-500 uppercase">Rhinestone OS</div>
            <div className="truncate text-sm font-medium text-zinc-200">Studios, assets, fonts, saved production flow</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1 shadow-sm xl:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'bg-violet-500/35 text-white shadow-sm'
                    : 'text-zinc-400 hover:bg-white/10 hover:text-zinc-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-400">
            {studioLabel}
          </span>
          <Link
            href="/library"
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-white/10 hover:text-zinc-100"
          >
            Manage Assets
          </Link>
          <Link
            href="/rhinestone"
            className="rounded-md bg-violet-500 px-3.5 py-1.5 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-violet-400"
          >
            Open Studio
          </Link>
        </div>
      </div>

      <div className="overflow-x-auto border-t border-white/10 xl:hidden">
        <nav className="mx-auto flex w-max min-w-full gap-1 px-2 py-1.5 sm:px-3">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition sm:gap-2 sm:px-3 sm:text-sm ${
                  active
                    ? 'bg-violet-500/35 text-white'
                    : 'text-zinc-400 hover:bg-white/10 hover:text-zinc-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="sm:hidden">{item.shortLabel}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}