'use client';

import { useEffect, useState } from 'react';
import { Keyboard, X } from 'lucide-react';
import Modal from '../editor/ui/Modal';
import {
  HTV_SHORTCUT_GROUPS,
  RHINESTONE_SHORTCUT_GROUPS,
  isKeyHandlingWidget,
  isModalOpen,
  type ShortcutGroup,
} from '../lib/studioShortcuts';

import { useT } from '../lib/i18n';
const OPEN_EVENT = 'studio:open-shortcuts';

/** Topbar button that opens the shortcuts sheet (the host below listens for it). */
export function KeyboardShortcutsButton() {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      aria-label={t('Keyboard shortcuts')}
      title={t('Keyboard shortcuts (?)')}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--studio-border)] bg-[var(--studio-hover-overlay-soft)] text-[var(--studio-ink-secondary)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]"
    >
      <Keyboard className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

const TITLE_ID = 'keyboard-shortcuts-title';

function Key({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-[1.75rem] items-center justify-center rounded-md border border-zinc-600 bg-zinc-800 px-1.5 py-0.5 text-xs font-semibold text-zinc-100 shadow-sm">
      {children}
    </kbd>
  );
}

function Combination({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {keys.map((key, index) => (
        <span key={`${key}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 && <span aria-hidden="true" className="text-xs text-zinc-400">+</span>}
          <Key>{key}</Key>
        </span>
      ))}
    </span>
  );
}

/**
 * Owns the shortcuts sheet for a studio: opens it from the topbar button or the `?` key
 * (not while typing in a field or while another dialog is open).
 */
export function KeyboardShortcutsHost({ studio }: { studio: 'rhinestone' | 'htv' }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const groups: ShortcutGroup[] = studio === 'htv' ? HTV_SHORTCUT_GROUPS : RHINESTONE_SHORTCUT_GROUPS;

  useEffect(() => {
    const openSheet = () => setOpen(true);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '?' || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isKeyHandlingWidget(event.target) || isModalOpen()) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, openSheet);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener(OPEN_EVENT, openSheet);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <Modal open={open} onClose={() => setOpen(false)} titleId={TITLE_ID}>
      <div role="document" className="flex max-h-[88vh] w-[min(40rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-800 px-5 py-4">
          <h2 id={TITLE_ID} className="text-base font-semibold text-white">{t('Keyboard shortcuts')}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t('Close keyboard shortcuts')}
            className="rounded-lg p-2 text-zinc-300 transition hover:bg-zinc-900 hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-5 sm:grid-cols-2">
          {groups.map((group) => (
            <section key={group.title} aria-labelledby={`shortcuts-${group.title}`}>
              <h3 id={`shortcuts-${group.title}`} className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">{group.title}</h3>
              <dl className="space-y-2">
                {group.items.map((item) => (
                  <div key={item.description} className="flex items-start justify-between gap-3">
                    <dt className="text-sm text-zinc-200">{item.description}</dt>
                    <dd className="flex shrink-0 flex-col items-end gap-1">
                      {item.keys.map((combo, index) => <Combination key={index} keys={combo} />)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <p className="border-t border-zinc-800 px-5 py-3 text-xs text-zinc-400">
          {t('Single-key shortcuts are paused while you type in a field or while a dialog is open.')}
        </p>
      </div>
    </Modal>
  );
}
