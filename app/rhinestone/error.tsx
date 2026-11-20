'use client';

import StudioError from '../components/StudioError';

export default function RhinestoneError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <StudioError studioName="Rhinestone Studio" error={error} onRetry={unstable_retry} hasAutosave />;
}
