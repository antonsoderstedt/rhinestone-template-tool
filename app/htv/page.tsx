import { Suspense } from 'react';
import { FolderOpen, Gem, Settings2, SwatchBook } from 'lucide-react';
import WorkspaceModeBanner from '../components/WorkspaceModeBanner';
import WorkspaceQuickActions from '../components/WorkspaceQuickActions';
import HtvShell from './HtvShell';

export default function HtvPage() {
  return (
    <>
      <WorkspaceQuickActions
        actions={[
          { label: 'Setup & calibration', description: 'Validate the material profile before cutting the next garment.', href: '/setup', icon: Settings2, tone: 'brand' },
          { label: 'Saved work', description: 'Check archive state and reopen the last garment print or cut job.', href: '/designs', icon: FolderOpen, tone: 'neutral' },
          { label: 'Rhinestone studio', description: 'Switch to the rhinestone studio when it is time to build a new stone layout.', href: '/rhinestone', icon: Gem, tone: 'neutral' },
          { label: 'Production settings', description: 'Review machine and heat-transfer defaults before the next run.', href: '/settings', icon: SwatchBook, tone: 'default' },
        ]}
      />
      <WorkspaceModeBanner
        mode="HTV Studio"
        status="Warning"
        project="Garment workflow"
        guidance="Review garment placement and final cut paths before export. Production quality depends on the active material setup."
        calibrationState={{ label: 'Material check', tone: 'warning' }}
      />
      <Suspense fallback={<div className="flex min-h-full items-center justify-center bg-surface text-sm text-ink-secondary">Loading HTV Studio…</div>}>
        <HtvShell />
      </Suspense>
    </>
  );
}
