import { Suspense } from 'react';
import HtvShell from './HtvShell';

export default function HtvPage() {
  return (
    <Suspense fallback={<div className="flex min-h-full items-center justify-center bg-surface text-sm text-ink-secondary">Loading HTV Studio…</div>}>
      <HtvShell />
    </Suspense>
  );
}
