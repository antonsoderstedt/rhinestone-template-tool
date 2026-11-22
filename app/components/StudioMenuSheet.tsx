'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Moon, Sun, X } from 'lucide-react';
import Modal from '../editor/ui/Modal';
import { NAV_ITEMS } from './GlobalTopNav';
import type { StudioTheme } from '../lib/studioTheme';

import { useT } from '../lib/i18n';
export interface StudioMenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  onSelect?: () => void;
  href?: string;
  disabled?: boolean;
  /** For choice lists (e.g. canvas / garment / 3D): marks the current one. */
  pressed?: boolean;
}

export interface StudioMenuSection {
  title: string;
  items: StudioMenuItem[];
}

const TITLE_ID = 'studio-menu-title';

const rowClass =
  'flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base font-medium transition focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Phone/tablet menu for a studio: the actions the desktop top bar shows as buttons, the view
 * choices, a theme switch and links to the rest of the app, as a bottom sheet of 48px rows.
 */
export default function StudioMenuSheet({
  open,
  onClose,
  sections,
  theme,
  onToggleTheme,
}: {
  open: boolean;
  onClose: () => void;
  sections: StudioMenuSection[];
  theme: StudioTheme;
  onToggleTheme: () => void;
}) {
  const t = useT();
  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId={TITLE_ID}
      overlayClassName="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
    >
      <div
        role="document"
        className="flex max-h-[85dvh] w-screen max-w-lg flex-col overflow-hidden rounded-t-2xl border border-zinc-800 bg-zinc-950 pb-[env(safe-area-inset-bottom)] text-zinc-100 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-2">
          <h2 id={TITLE_ID} className="text-base font-semibold">{t('Menu')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close menu')}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
          {sections.map((section) => (
            <section key={section.title} aria-labelledby={`studio-menu-${section.title}`}>
              <h3 id={`studio-menu-${section.title}`} className="px-3 pb-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
                {section.title}
              </h3>
              <ul>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const content = (
                    <>
                      {Icon && <Icon className="h-5 w-5 shrink-0 text-zinc-300" aria-hidden="true" />}
                      <span className="flex-1">{item.label}</span>
                    </>
                  );
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={item.disabled}
                        aria-pressed={item.pressed}
                        onClick={() => { item.onSelect?.(); onClose(); }}
                        className={`${rowClass} ${item.pressed ? 'bg-violet-500/30 text-white' : 'text-zinc-100 hover:bg-zinc-900'}`}
                      >
                        {content}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <section aria-labelledby="studio-menu-appearance">
            <h3 id="studio-menu-appearance" className="px-3 pb-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">{t('Appearance')}</h3>
            <button type="button" onClick={() => { onToggleTheme(); onClose(); }} className={`${rowClass} text-zinc-100 hover:bg-zinc-900`}>
              {theme === 'dark' ? <Sun className="h-5 w-5 text-zinc-300" aria-hidden="true" /> : <Moon className="h-5 w-5 text-zinc-300" aria-hidden="true" />}
              <span className="flex-1">{theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</span>
            </button>
          </section>

          <nav aria-label={t('Go to')} className="border-t border-zinc-800 pt-3">
            <h3 className="px-3 pb-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">{t('Go to')}</h3>
            <ul>
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link href={item.href} className={`${rowClass} text-zinc-100 hover:bg-zinc-900`}>
                      <Icon className="h-5 w-5 shrink-0 text-zinc-300" aria-hidden="true" />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </Modal>
  );
}
