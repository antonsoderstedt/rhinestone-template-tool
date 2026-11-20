'use client';

import StudioError from '../components/StudioError';

export default function HtvError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <StudioError studioName="HTV Studio" error={error} onRetry={unstable_retry} />;
}
