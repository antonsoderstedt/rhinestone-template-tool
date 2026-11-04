import { Suspense } from 'react';
import { FolderOpen, Gem, Settings2, SwatchBook } from 'lucide-react';
import WorkspaceModeBanner from '../components/WorkspaceModeBanner';
import WorkspaceQuickActions from '../components/WorkspaceQuickActions';
import EditorShell from '../editor/EditorShell';

export default function RhinestoneStudioPage() {
  return (
    <>
      <WorkspaceQuickActions
        actions={[
          { label: 'Setup & calibration', description: 'Check the active profile and approval gate before exporting.', href: '/setup', icon: Settings2, tone: 'brand' },
          { label: 'Saved work', description: 'Reopen a recent template or archive with clear design context.', href: '/designs', icon: FolderOpen, tone: 'neutral' },
          { label: 'HTV studio', description: 'Move to garment planning if the order changes direction.', href: '/htv', icon: SwatchBook, tone: 'neutral' },
          { label: 'Production settings', description: 'Tune cut defaults, material target, and export preferences.', href: '/settings', icon: Gem, tone: 'default' },
        ]}
      />
      <WorkspaceModeBanner
        mode="Rhinestone Studio"
        status="Ready"
        project="Production workflow"
        guidance="Design work is active. Calibrate before production when a new material profile is introduced."
        calibrationState={{ label: 'Calibration gate', tone: 'warning' }}
      />
      <Suspense fallback={<div className="flex min-h-full items-center justify-center bg-surface text-sm text-ink-secondary">Loading Rhinestone Studio…</div>}>
        <EditorShell />
      </Suspense>
    </>
  );
}