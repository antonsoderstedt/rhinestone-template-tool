'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { studioOfPath } from '@/src/lib/tracking/trackingConfig';
import { flushTracking, startTracking, track } from '../lib/tracking/track';

/**
 * Starts tracking once the page has loaded and records a page view on every route change. Renders nothing. The admin panel is not
 * counted (that would be the owner looking at the statistics). Where there is no tracking server it does nothing at all.
 */
export default function TrackingManager() {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SYNC_ENABLED !== '1') return undefined;
    void startTracking();
    const onHide = () => { if (document.visibilityState === 'hidden') flushTracking(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushTracking);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flushTracking);
    };
  }, []);

  useEffect(() => {
    const path = pathname ?? '/';
    if (studioOfPath(path) === 'admin') return;
    track('page_view', {}, '', path);
  }, [pathname]);

  return null;
}
