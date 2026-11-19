'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FolderOpen, Gem, LibraryBig, Ruler, Settings2, ShieldAlert, Sparkles, SwatchBook, Type } from 'lucide-react';
import { readActiveCalibrationProfile } from '@/app/lib/workspaceVault';

const NAV_ITEMS = [
  { href: '/', label: 'Start', shortLabel: 'Start', icon: Sparkles },
  { href: '/rhinestone', label: 'Rhinestone Studio', shortLabel: 'Stone', icon: Gem },
  { href: '/htv', label: 'HTV Studio', shortLabel: 'HTV', icon: SwatchBook },
  { href: '/library', label: 'Library', shortLabel: 'Library', icon: LibraryBig },
  { href: '/fonts', label: 'Fonts', shortLabel: 'Fonts', icon: Type },
  { href: '/designs', label: 'My Designs', shortLabel: 'Designs', icon: FolderOpen },
  { href: '/setup', label: 'Setup & Calibration', shortLabel: 'Setup', icon: Ruler },
  { href: '/settings', label: 'Settings', shortLabel: 'Settings', icon: Settings2 },
] as const;

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getModeMeta(pathname: string, activeCalibrationProfile: ReturnType<typeof readActiveCalibrationProfile> | null) {
  if (pathname.startsWith('/htv')) {
    if (!activeCalibrationProfile) {
      return {
        studioLabel: 'HTV Studio',
        status: 'Warning',
        statusText: 'Calibration required before production',
        statusClassName: 'border-amber-200 bg-amber-50 text-amber-700',
        icon: AlertTriangle,
      };
    }

    if (!activeCalibrationProfile.approvedAt) {
      return {
        studioLabel: 'HTV Studio',
        status: 'Warning',
        statusText: `Pending calibration: ${activeCalibrationProfile.name}`,
        statusClassName: 'border-amber-200 bg-amber-50 text-amber-700',
        icon: AlertTriangle,
      };
    }

    return {
      studioLabel: 'HTV Studio',
      status: 'Ready',
      statusText: `Production ready: ${activeCalibrationProfile.name}`,
      statusClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      icon: CheckCircle2,
    };
  }

  if (pathname.startsWith('/setup')) {
    return {
      studioLabel: 'Setup & Calibration',
      status: 'Warning',
      statusText: 'Calibration gate before production',
      statusClassName: 'border-amber-200 bg-amber-50 text-amber-700',
      icon: AlertTriangle,
    };
  }

  if (pathname.startsWith('/rhinestone')) {
    if (!activeCalibrationProfile) {
      return {
        studioLabel: 'Rhinestone Studio',
        status: 'Warning',
        statusText: 'Calibration required before production',
        statusClassName: 'border-amber-200 bg-amber-50 text-amber-700',
        icon: AlertTriangle,
      };
    }

    if (!activeCalibrationProfile.approvedAt) {
      return {
        studioLabel: 'Rhinestone Studio',
        status: 'Warning',
        statusText: `Pending calibration: ${activeCalibrationProfile.name}`,
        statusClassName: 'border-amber-200 bg-amber-50 text-amber-700',
        icon: AlertTriangle,
      };
    }

    return {
      studioLabel: 'Rhinestone Studio',
      status: 'Ready',
      statusText: `Production ready: ${activeCalibrationProfile.name}`,
      statusClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      icon: CheckCircle2,
    };
  }

  if (pathname.startsWith('/library')) {
    return {
      studioLabel: 'Library',
      status: 'Ready',
      statusText: 'Asset workspace ready',
      statusClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      icon: CheckCircle2,
    };
  }

  if (pathname.startsWith('/fonts')) {
    return {
      studioLabel: 'Fonts',
      status: 'Ready',
      statusText: 'Font catalog loaded',
      statusClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      icon: CheckCircle2,
    };
  }

  if (pathname.startsWith('/designs')) {
    return {
      studioLabel: 'My Designs',
      status: 'Ready',
      statusText: 'Saved work visible',
      statusClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      icon: CheckCircle2,
    };
  }

  if (pathname.startsWith('/settings')) {
    return {
      studioLabel: 'Settings',
      status: 'Warning',
      statusText: 'Review production defaults',
      statusClassName: 'border-amber-200 bg-amber-50 text-amber-700',
      icon: ShieldAlert,
    };
  }

  return {
    studioLabel: 'Workspace Home',
    status: 'Ready',
    statusText: 'Workspace ready',
    statusClassName: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: CheckCircle2,
  };
}

export default function GlobalTopNav() {
  const pathname = usePathname();
  const [activeCalibrationProfile, setActiveCalibrationProfile] = useState<ReturnType<typeof readActiveCalibrationProfile> | null>(null);

  useEffect(() => {
    const syncProfile = () => setActiveCalibrationProfile(readActiveCalibrationProfile());
    syncProfile();
    window.addEventListener('storage', syncProfile);
    window.addEventListener('focus', syncProfile);
    return () => {
      window.removeEventListener('storage', syncProfile);
      window.removeEventListener('focus', syncProfile);
    };
  }, [pathname]);

  const modeMeta = useMemo(
    () => getModeMeta(pathname, activeCalibrationProfile),
    [activeCalibrationProfile, pathname],
  );
  const StatusIcon = modeMeta.icon;

  const workflowSummary = pathname.startsWith('/rhinestone')
    ? activeCalibrationProfile
      ? activeCalibrationProfile.approvedAt
        ? `Production ready • ${activeCalibrationProfile.name}`
        : `Approval needed • ${activeCalibrationProfile.name}`
      : 'Calibration gate • approve before production'
    : pathname.startsWith('/htv')
      ? activeCalibrationProfile
        ? activeCalibrationProfile.approvedAt
          ? `Production ready • ${activeCalibrationProfile.name}`
          : `Approval needed • ${activeCalibrationProfile.name}`
        : 'Calibration gate • approve before production'
      : pathname.startsWith('/setup')
        ? 'Setup gate • cut, measure, approve, then produce'
        : pathname.startsWith('/designs')
          ? 'Saved work • resume the next production pass'
          : pathname.startsWith('/settings')
            ? 'Workspace defaults • review before production'
            : 'Workspace ready';

  return (
    <header data-focus-surface="dark" className="sticky top-0 z-50 border-b border-zinc-200/80 bg-[#1b1a1d]/95 text-zinc-200 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-3 py-1.5 md:px-5">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-400/40 bg-violet-500/20 text-xs font-black text-violet-100 shadow-md shadow-black/20">
            RT
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium tracking-[0.18em] text-zinc-400 uppercase">Rhinestone OS</div>
            <div className="truncate text-sm font-medium text-zinc-200">Studios, assets, fonts, production workflow</div>
          </div>
        </Link>

        <nav aria-label="Main" className={`hidden items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1 shadow-sm xl:flex ${pathname.startsWith('/rhinestone') || pathname.startsWith('/htv') ? '!hidden' : ''}`}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
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
          <span className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
            {modeMeta.studioLabel}
          </span>

          <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${modeMeta.statusClassName}`}>
            <StatusIcon className="h-3.5 w-3.5" />
            {modeMeta.status}
          </span>

          <Link
            href="/library"
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-white/10 hover:text-zinc-100"
          >
            Manage Assets
          </Link>
          <Link
            href="/rhinestone"
            className="rounded-md bg-violet-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-violet-500"
          >
            Open Studio
          </Link>
        </div>
      </div>

      <div className={`${pathname.startsWith('/rhinestone') || pathname.startsWith('/htv') ? 'hidden' : 'block'} border-t border-white/10 bg-[#121215] px-3 py-2 text-xs text-zinc-300 md:px-5`}>
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-zinc-300">
            <span className="inline-flex h-2 w-2 rounded-full bg-violet-400" />
            <span className="font-medium text-zinc-200">Workflow</span>
            <span className="text-zinc-400">{workflowSummary}</span>
          </div>
          <div className="hidden items-center gap-2 text-zinc-400 md:flex">
            <span>Mode split:</span>
            <span className="font-medium text-zinc-200">Rhinestone / HTV / Setup</span>
          </div>
        </div>
      </div>

      <div className={`overflow-x-auto border-t border-white/10 xl:hidden ${pathname.startsWith('/rhinestone') || pathname.startsWith('/htv') ? 'hidden' : ''}`}>
        <nav aria-label="Main" className="mx-auto flex w-max min-w-full gap-1 px-2 py-1.5 sm:px-3">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
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