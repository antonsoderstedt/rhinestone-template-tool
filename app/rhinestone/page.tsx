import { Suspense } from 'react';
import EditorShell from '../editor/EditorShell';

export default function RhinestoneStudioPage() {
  return (
    <Suspense fallback={<div className="flex min-h-full items-center justify-center bg-surface text-sm text-ink-secondary">Loading Rhinestone Studio…</div>}>
      <EditorShell />
    </Suspense>
  );
}