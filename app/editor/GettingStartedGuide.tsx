'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { GETTING_STARTED_STEPS, readOnboardingDismissed, writeOnboardingDismissed } from '../lib/onboarding';

import { useT } from '../lib/i18n';
/**
 * Four-step first-project guide. Dismissible; once closed it stays closed in this
 * browser. Renders nothing until the saved choice has been read (no flash).
 */
export default function GettingStartedGuide() {
  const t = useT();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  // The four steps start collapsed, on every screen, so the canvas keeps its space and the studio opens calm.
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setDismissed(readOnboardingDismissed(globalThis.localStorage)));
  }, []);

  if (dismissed !== false) return null;

  return (
    // An overlay on the canvas, not a row above it: the guide appears after the saved "dismissed" choice has been
    // read, and a row inserted then pushed the whole studio down (a layout shift of 0.13 in Lighthouse).
    <section
      aria-label={t('Getting started')}
      className="absolute z-20 rounded-lg max-lg:inset-x-3 max-lg:bottom-16 lg:left-1/2 lg:top-12 lg:w-[min(46rem,calc(100%-1.5rem))] lg:-translate-x-1/2 border border-[var(--studio-border-strong)] bg-[var(--studio-surface)]/95 px-3 py-2 shadow-lg backdrop-blur"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">
            <button type="button" onClick={() => setExpanded((open) => !open)} aria-expanded={expanded} className="uppercase tracking-[0.16em]">
              Your first design in 4 steps {expanded ? '▴' : '▾'}
            </button>
          </h2>
          <ol hidden={!expanded} className="mt-1.5 grid gap-x-4 gap-y-1 text-xs text-[var(--studio-ink-secondary)] sm:grid-cols-2 xl:grid-cols-4">
            {GETTING_STARTED_STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-xs font-semibold text-violet-200">{index + 1}</span>
                <span><strong className="font-semibold text-[var(--studio-ink)]">{step.title}.</strong> {step.detail}</span>
              </li>
            ))}
          </ol>
        </div>
        <button
          type="button"
          onClick={() => {
            writeOnboardingDismissed(globalThis.localStorage);
            setDismissed(true);
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--studio-border)] px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--studio-ink-muted)] transition hover:bg-[var(--studio-hover-overlay)] hover:text-[var(--studio-ink)]"
        >
          <X className="h-3 w-3" aria-hidden="true" />
          {t('Got it')}
        </button>
      </div>
    </section>
  );
}
