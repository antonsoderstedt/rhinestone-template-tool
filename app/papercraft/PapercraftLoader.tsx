'use client';

import dynamic from 'next/dynamic';

/**
 * The studio computes the pattern when it opens. It is drawn in the browser only: the server's numbers and the browser's could
 * differ in the last digit and React would then refuse to hydrate the page.
 */
const PapercraftShell = dynamic(() => import('./PapercraftShell'), {
  ssr: false,
  loading: () => <div className="flex min-h-full flex-1 items-center justify-center bg-surface text-sm text-ink-secondary">Loading Papercraft Studio…</div>,
});

export default function PapercraftLoader() {
  return <PapercraftShell />;
}
