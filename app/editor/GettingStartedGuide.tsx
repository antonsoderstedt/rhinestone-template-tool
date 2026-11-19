'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { GETTING_STARTED_STEPS, readOnboardingDismissed, writeOnboardingDismissed } from '../lib/onboarding';

/**
 * Four-step first-project guide. Dismissible; once closed it stays closed in this
 * browser. Renders nothing until the saved choice has been read (no flash).
 */
export default function GettingStartedGuide() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    queueMicrotask(() => setDismissed(readOnboardingDismissed(globalThis.localStorage)));
  }, []);

  if (dismissed !== false) return null;

  return (
    <section
      aria-label="Getting started"
      className="shrink-0 border-b border-[var(--studio-border)] bg-[var(--studio-well)] px-3 py-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">Your first design in 4 steps</h2>
          <ol className="mt-1.5 grid gap-x-4 gap-y-1 text-xs text-[var(--studio-ink-secondary)] sm:grid-cols-2 xl:grid-cols-4">
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
          Got it
        </button>
      </div>
    </section>
  );
}
