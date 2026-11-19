'use client';

import { usePathname } from 'next/navigation';
import GlobalTopNav from './GlobalTopNav';
import SkipLink from './SkipLink';

function isStudioRoute(pathname: string): boolean {
  return pathname.startsWith('/rhinestone') || pathname.startsWith('/htv');
}

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const studioRoute = isStudioRoute(pathname);

  return (
    <div className={studioRoute ? 'flex h-dvh min-h-dvh flex-col overflow-hidden' : 'flex min-h-full flex-col'}>
      <SkipLink label={studioRoute ? 'Skip to editor' : 'Skip to main content'} />
      <GlobalTopNav />
      {studioRoute ? (
        // The studios render their own <main id="main-content"> around the canvas.
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      ) : (
        <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>
      )}
    </div>
  );
}
