'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const AUTOSAVE_KEY = 'rhinestone-template-library-autosave';
/** One slot. The autosave that was set aside when a studio failed to open, kept so nothing is lost. */
export const AUTOSAVE_RECOVERY_KEY = 'rhinestone-template-library-autosave-set-aside';

export interface StudioErrorProps {
  studioName: string;
  error: Error & { digest?: string };
  onRetry: () => void;
  /** Only the Rhinestone studio autosaves into the browser; HTV does not. */
  hasAutosave?: boolean;
}

/**
 * What the user sees when a studio throws while rendering. Says what is safe, offers a retry and, for a studio with an
 * autosave, a way out of a crash loop that keeps the autosave (it is set aside, not deleted).
 */
export default function StudioError({ studioName, error, onRetry, hasAutosave = false }: StudioErrorProps) {
  const [autosaveSetAside, setAutosaveSetAside] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  const openWithoutAutosave = () => {
    try {
      const raw = window.localStorage.getItem(AUTOSAVE_KEY);
      if (raw) window.localStorage.setItem(AUTOSAVE_RECOVERY_KEY, raw);
      window.localStorage.removeItem(AUTOSAVE_KEY);
      setAutosaveSetAside(true);
    } catch {
      // Storage unavailable: the retry button is all there is.
    }
    onRetry();
  };

  return (
    <main className="flex min-h-full items-center justify-center bg-surface px-6 py-16 text-ink">
      <div role="alert" className="flex max-w-md flex-col gap-4 rounded-xl border border-border bg-surface-raised p-6 shadow-sm">
        <h1 className="text-lg font-semibold">The {studioName} stopped working</h1>
        <p className="text-sm leading-6 text-ink-secondary">
          Your designs saved in this browser were not touched. Trying again often fixes it.
          {hasAutosave && ' If it keeps failing, open the studio without restoring the last session; that session is kept aside, not deleted.'}
        </p>
        {error.message && (
          <p className="break-words rounded-md bg-surface-sunken px-3 py-2 font-mono text-xs text-ink-muted">{error.message}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md bg-accent-500 px-3 py-2 text-sm font-medium text-ink-inverse hover:bg-accent-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
          >
            Try again
          </button>
          {hasAutosave && (
            <button
              type="button"
              onClick={openWithoutAutosave}
              disabled={autosaveSetAside}
              className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-surface-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 disabled:opacity-50"
            >
              Open without the last session
            </button>
          )}
          <Link
            href="/designs"
            className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-surface-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
          >
            My Designs
          </Link>
        </div>
      </div>
    </main>
  );
}
