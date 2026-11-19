'use client';

import { usePathname } from 'next/navigation';
import GlobalTopNav from './GlobalTopNav';

function isStudioRoute(pathname: string): boolean {
  return pathname.startsWith('/rhinestone') || pathname.startsWith('/htv');
}

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const studioRoute = isStudioRoute(pathname);

  return (
    <div className={studioRoute ? 'flex h-dvh min-h-dvh flex-col overflow-hidden' : 'flex min-h-full flex-col'}>
      <GlobalTopNav />
      <div className={studioRoute ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'flex-1'}>{children}</div>
    </div>
  );
}
